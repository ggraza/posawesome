# Copyright (c) 2026, G2Virtu and contributors
# For license information, please see license.txt
"""Server side of the POS offline mode (Frappe / ERPNext v16).

* Catalogue sync: items (+ barcodes, UOMs, item tax templates), item prices,
  stock (Bin), customers, offers and coupons are served in keyset-paginated pages
  ordered by (modified, name) so a terminal can download 30,000+ items in chunks
  and afterwards only pull what changed.
* Offline invoices: terminals upload the invoices they took while offline. Every
  invoice carries a client generated ``offline_id``; uploads are idempotent (an id
  is never turned into two Sales Invoices) and are stored in **POS Offline Invoice**
  first, so nothing is lost if processing fails or the terminal drops off again.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, get_datetime, getdate, now_datetime, nowdate

PAGE_MAX = 5000
SCHEMA_VERSION = 3


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _loads(value, default=None):
    if value is None or value == "":
        return default
    if isinstance(value, str):
        return json.loads(value)
    return value


def _profile_name(pos_profile):
    if isinstance(pos_profile, dict):
        return pos_profile.get("name")
    if isinstance(pos_profile, str) and pos_profile.strip().startswith("{"):
        return json.loads(pos_profile).get("name")
    return pos_profile


def check_profile_access(pos_profile):
    """Only users of the POS Profile (or users with an opening shift on it) may
    download its catalogue."""
    name = _profile_name(pos_profile)
    if not name or not frappe.db.exists("POS Profile", name):
        frappe.throw(_("POS Profile {0} not found").format(name), frappe.DoesNotExistError)
    if "System Manager" in frappe.get_roles():
        return name
    user = frappe.session.user
    if frappe.db.exists("POS Profile User", {"parent": name, "user": user}):
        return name
    if frappe.db.exists("POS Opening Shift", {"pos_profile": name, "user": user, "docstatus": 1}):
        return name
    if frappe.db.exists("POS Profile Captain", {"parent": name, "user": user}):
        return name
    if not frappe.db.exists("POS Profile User", {"parent": name}):
        # profile not restricted to users
        return name
    frappe.throw(_("You are not allowed to use POS Profile {0}").format(name), frappe.PermissionError)


def _page_args(since, after, limit):
    since = get_datetime(since) if since else None
    limit = min(max(cint(limit) or 1000, 1), PAGE_MAX)
    return since, cstr(after or ""), limit


def _keyset_condition(table, since, after):
    """(modified, name) > (since, after)"""
    if not since:
        return None
    return (table.modified > since) | ((table.modified == since) & (table.name > after))


def _cursor(rows):
    if not rows:
        return None
    last = rows[-1]
    return {"since": str(last["modified"]), "after": last["name"]}


def get_profile_item_groups(profile_name):
    from erpnext.accounts.doctype.pos_profile.pos_profile import get_item_groups

    return get_item_groups(profile_name)


# ---------------------------------------------------------------------------
# bootstrap
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_bootstrap(pos_profile):
    """Everything a terminal needs besides the big catalogue tables."""
    name = check_profile_access(pos_profile)
    profile = frappe.get_doc("POS Profile", name)
    company = frappe.get_cached_doc("Company", profile.company)

    payments = []
    for row in profile.get("payments") or []:
        mop = frappe.get_cached_doc("Mode of Payment", row.mode_of_payment)
        account = next((a.default_account for a in mop.accounts if a.company == profile.company), None)
        payments.append(
            {
                "mode_of_payment": row.mode_of_payment,
                "default": row.default,
                "allow_in_returns": row.get("allow_in_returns"),
                "type": mop.type,
                "account": account,
                "enabled": mop.enabled,
            }
        )

    tax_templates = {}
    for template in {profile.get("taxes_and_charges"), profile.get("posa_card_taxes_and_charges")}:
        if template and frappe.db.exists("Sales Taxes and Charges Template", template):
            tdoc = frappe.get_cached_doc("Sales Taxes and Charges Template", template)
            tax_templates[template] = [
                {
                    "idx": t.idx,
                    "charge_type": t.charge_type,
                    "row_id": t.row_id,
                    "account_head": t.account_head,
                    "description": t.description,
                    "rate": t.rate,
                    "tax_amount": t.tax_amount,
                    "included_in_print_rate": t.included_in_print_rate,
                    "cost_center": t.cost_center,
                }
                for t in tdoc.taxes
            ]

    item_tax_templates = {}
    for itt in frappe.get_all("Item Tax Template", filters={"disabled": 0}, pluck="name"):
        rows = frappe.get_all(
            "Item Tax Template Detail", filters={"parent": itt}, fields=["tax_type", "tax_rate"]
        )
        item_tax_templates[itt] = {r.tax_type: flt(r.tax_rate) for r in rows}

    currency = frappe.get_cached_doc("Currency", profile.currency) if profile.currency else None

    from posawesome.posawesome.api.posapp import get_offers, get_sales_person_names

    return {
        "schema_version": SCHEMA_VERSION,
        "server_time": str(now_datetime()),
        "today": nowdate(),
        "user": frappe.session.user,
        "pos_profile": profile.as_dict(),
        "company": {
            "name": company.name,
            "default_currency": company.default_currency,
            "default_cash_account": company.default_cash_account,
            "cost_center": company.cost_center,
            "round_off_account": company.round_off_account,
            "tax_id": company.tax_id,
            "company_name": company.company_name,
        },
        "payments": payments,
        "tax_templates": tax_templates,
        "item_tax_templates": item_tax_templates,
        "stock_settings": {
            "allow_negative_stock": frappe.db.get_single_value("Stock Settings", "allow_negative_stock"),
        },
        "accounts_settings": {
            "add_taxes_from_item_tax_template": frappe.db.get_single_value(
                "Accounts Settings", "add_taxes_from_item_tax_template"
            ),
        },
        "precision": {
            "float": cint(frappe.db.get_default("float_precision")) or 3,
            "currency": cint(frappe.db.get_default("currency_precision")) or 2,
            "rounding_method": frappe.db.get_single_value("System Settings", "rounding_method")
            or "Banker's Rounding (legacy)",
        },
        "currency": {
            "name": profile.currency,
            "symbol": currency.symbol if currency else None,
            "number_format": currency.number_format if currency else None,
            "smallest_currency_fraction_value": flt(currency.smallest_currency_fraction_value)
            if currency
            else 0,
        },
        "disable_rounded_total": cint(profile.get("disable_rounded_total"))
        or cint(frappe.db.get_single_value("Global Defaults", "disable_rounded_total")),
        "offers": get_offers(name),
        "coupons": get_coupons(name),
        "delivery_charges": get_delivery_charges(name),
        "sales_persons": get_sales_person_names(),
        "customer_groups": frappe.get_all("Customer Group", filters={"is_group": 0}, pluck="name"),
        "territories": frappe.get_all("Territory", filters={"is_group": 0}, pluck="name"),
        "item_groups": get_profile_item_groups(name),
    }


def get_coupons(profile_name):
    company = frappe.get_cached_value("POS Profile", profile_name, "company")
    today = getdate()
    rows = frappe.get_all(
        "POS Coupon",
        filters={"company": company},
        fields=[
            "name",
            "coupon_code",
            "coupon_type",
            "customer",
            "pos_offer",
            "valid_from",
            "valid_upto",
            "maximum_use",
            "used",
        ],
    )
    out = []
    for r in rows:
        if r.valid_upto and getdate(r.valid_upto) < today:
            continue
        if r.maximum_use and cint(r.used) >= cint(r.maximum_use):
            continue
        out.append(r)
    return out


def get_delivery_charges(profile_name):
    company = frappe.get_cached_value("POS Profile", profile_name, "company")
    charges = frappe.get_all(
        "Delivery Charges",
        filters={"company": company, "disabled": 0},
        fields=["name", "label", "default_rate", "shipping_account", "cost_center"],
    )
    for c in charges:
        rate = frappe.db.get_value(
            "Delivery Charges POS Profile", {"parent": c.name, "pos_profile": profile_name}, "rate"
        )
        c["rate"] = flt(rate) if rate is not None else flt(c.default_rate)
    return charges


# ---------------------------------------------------------------------------
# catalogue pages
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_items_page(pos_profile, since=None, after=None, limit=1000):
    """Items for the profile, keyset paginated on (modified, name).

    Rows that are no longer sellable (disabled, not a sales item, outside the
    profile's item groups...) are returned with ``deleted: 1`` during a delta sync
    so the terminal drops them."""
    name = check_profile_access(pos_profile)
    profile = frappe.get_cached_doc("POS Profile", name)
    since, after, limit = _page_args(since, after, limit)
    item_groups = set(get_profile_item_groups(name) or [])
    show_templates = cint(profile.get("posa_show_template_items"))

    Item = frappe.qb.DocType("Item")
    q = (
        frappe.qb.from_(Item)
        .select(
            Item.name,
            Item.item_name,
            Item.item_group,
            Item.stock_uom,
            Item.image,
            Item.is_stock_item,
            Item.has_variants,
            Item.variant_of,
            Item.has_batch_no,
            Item.has_serial_no,
            Item.max_discount,
            Item.brand,
            Item.description,
            Item.disabled,
            Item.is_sales_item,
            Item.is_fixed_asset,
            Item.sales_uom,
            Item.weight_per_unit,
            Item.weight_uom,
            Item.modified,
        )
        .orderby(Item.modified)
        .orderby(Item.name)
        .limit(limit)
    )
    cond = _keyset_condition(Item, since, after)
    if cond is not None:
        q = q.where(cond)
    else:
        # full download: only sellable items
        q = q.where((Item.disabled == 0) & (Item.is_sales_item == 1) & (Item.is_fixed_asset == 0))
        if item_groups:
            q = q.where(Item.item_group.isin(list(item_groups)))
        if not show_templates:
            q = q.where(Item.has_variants == 0)
    rows = q.run(as_dict=True)
    cursor = _cursor(rows)

    codes = [r.name for r in rows]
    barcodes, uoms, taxes = {}, {}, {}
    if codes:
        for b in frappe.get_all(
            "Item Barcode",
            filters={"parent": ["in", codes], "parenttype": "Item"},
            fields=["parent", "barcode", "posa_uom", "uom"],
        ):
            barcodes.setdefault(b.parent, []).append(
                {"barcode": b.barcode, "posa_uom": b.posa_uom or b.uom, "uom": b.uom or b.posa_uom}
            )
        for u in frappe.get_all(
            "UOM Conversion Detail",
            filters={"parent": ["in", codes], "parenttype": "Item"},
            fields=["parent", "uom", "conversion_factor"],
        ):
            uoms.setdefault(u.parent, []).append({"uom": u.uom, "conversion_factor": flt(u.conversion_factor)})
        for t in frappe.get_all(
            "Item Tax",
            filters={"parent": ["in", codes], "parenttype": "Item"},
            fields=["parent", "item_tax_template", "tax_category", "valid_from"],
            order_by="valid_from desc",
        ):
            taxes.setdefault(t.parent, []).append(
                {
                    "item_tax_template": t.item_tax_template,
                    "tax_category": t.tax_category,
                    "valid_from": str(t.valid_from) if t.valid_from else None,
                }
            )

    attributes = {}
    if show_templates and codes:
        for a in frappe.get_all(
            "Item Variant Attribute",
            filters={"parent": ["in", codes], "parenttype": "Item"},
            fields=["parent", "attribute", "attribute_value"],
            order_by="idx asc",
        ):
            attributes.setdefault(a.parent, []).append({"attribute": a.attribute, "attribute_value": a.attribute_value})

    items = []
    for r in rows:
        sellable = (
            not r.disabled
            and r.is_sales_item
            and not r.is_fixed_asset
            and (not item_groups or r.item_group in item_groups)
            and (show_templates or not r.has_variants)
        )
        if not sellable:
            items.append({"item_code": r.name, "deleted": 1, "modified": str(r.modified)})
            continue
        description = r.description or ""
        if description == r.item_name:
            description = ""
        items.append(
            {
                "item_code": r.name,
                "item_name": r.item_name,
                "item_group": r.item_group,
                "stock_uom": r.stock_uom,
                "sales_uom": r.sales_uom,
                "image": r.image,
                "is_stock_item": r.is_stock_item,
                "has_variants": r.has_variants,
                "variant_of": r.variant_of,
                "has_batch_no": r.has_batch_no,
                "has_serial_no": r.has_serial_no,
                "max_discount": flt(r.max_discount),
                "brand": r.brand,
                "description": description[:500],
                "weight_per_unit": flt(r.weight_per_unit),
                "weight_uom": r.weight_uom,
                "item_barcode": barcodes.get(r.name, []),
                "item_uoms": uoms.get(r.name) or [{"uom": r.stock_uom, "conversion_factor": 1}],
                "item_taxes": taxes.get(r.name, []),
                "item_attributes": attributes.get(r.name, []) if r.variant_of else [],
                "modified": str(r.modified),
            }
        )
    return {"rows": items, "cursor": cursor, "done": len(rows) < limit}


@frappe.whitelist()
def get_prices_page(pos_profile, since=None, after=None, limit=2000, price_lists=None):
    """Item Price rows of the profile's selling price list (and MRP / customer
    price lists the terminal asks for). Validity dates are resolved on the
    terminal at sale time, so prices that start tomorrow are already cached."""
    name = check_profile_access(pos_profile)
    profile = frappe.get_cached_doc("POS Profile", name)
    since, after, limit = _page_args(since, after, limit)
    lists = set(_loads(price_lists, []) or [])
    lists.add(profile.selling_price_list)
    if profile.get("posa_mrp_price_list"):
        lists.add(profile.get("posa_mrp_price_list"))
    lists.discard(None)

    IP = frappe.qb.DocType("Item Price")
    q = (
        frappe.qb.from_(IP)
        .select(
            IP.name,
            IP.item_code,
            IP.price_list,
            IP.uom,
            IP.price_list_rate,
            IP.currency,
            IP.customer,
            IP.batch_no,
            IP.valid_from,
            IP.valid_upto,
            IP.selling,
            IP.modified,
        )
        .where(IP.price_list.isin(list(lists)))
        .orderby(IP.modified)
        .orderby(IP.name)
        .limit(limit)
    )
    cond = _keyset_condition(IP, since, after)
    if cond is not None:
        q = q.where(cond)
    else:
        q = q.where(IP.selling == 1)
    rows = q.run(as_dict=True)
    out = []
    for r in rows:
        if not r.selling:
            out.append({"name": r.name, "deleted": 1, "modified": str(r.modified)})
            continue
        out.append(
            {
                "name": r.name,
                "item_code": r.item_code,
                "price_list": r.price_list,
                "uom": r.uom,
                "price_list_rate": flt(r.price_list_rate),
                "currency": r.currency,
                "customer": r.customer,
                "batch_no": r.batch_no,
                "valid_from": str(r.valid_from) if r.valid_from else None,
                "valid_upto": str(r.valid_upto) if r.valid_upto else None,
                "modified": str(r.modified),
            }
        )
    return {"rows": out, "cursor": _cursor(rows), "done": len(rows) < limit}


@frappe.whitelist()
def get_stock_page(pos_profile, since=None, after=None, limit=5000):
    """Bin rows (actual qty, valuation rate) of the profile warehouse."""
    name = check_profile_access(pos_profile)
    warehouse = frappe.get_cached_value("POS Profile", name, "warehouse")
    since, after, limit = _page_args(since, after, limit)
    Bin = frappe.qb.DocType("Bin")
    q = (
        frappe.qb.from_(Bin)
        .select(
            Bin.name,
            Bin.item_code,
            Bin.actual_qty,
            Bin.reserved_qty,
            Bin.projected_qty,
            Bin.valuation_rate,
            Bin.modified,
        )
        .where(Bin.warehouse == warehouse)
        .orderby(Bin.modified)
        .orderby(Bin.name)
        .limit(limit)
    )
    cond = _keyset_condition(Bin, since, after)
    if cond is not None:
        q = q.where(cond)
    rows = q.run(as_dict=True)
    out = [
        {
            "item_code": r.item_code,
            "actual_qty": flt(r.actual_qty),
            "reserved_qty": flt(r.reserved_qty),
            "projected_qty": flt(r.projected_qty),
            "valuation_rate": flt(r.valuation_rate),
            "modified": str(r.modified),
        }
        for r in rows
    ]
    return {
        "rows": out,
        "cursor": _cursor(rows),
        "done": len(rows) < limit,
        "warehouse": warehouse,
        "server_time": str(now_datetime()),
    }


@frappe.whitelist()
def get_customers_page(pos_profile, since=None, after=None, limit=2000):
    name = check_profile_access(pos_profile)
    profile = frappe.get_cached_doc("POS Profile", name)
    since, after, limit = _page_args(since, after, limit)
    from posawesome.posawesome.api.posapp import get_customer_groups

    groups = [g.strip("'") for g in get_customer_groups(profile.as_dict())]

    C = frappe.qb.DocType("Customer")
    q = (
        frappe.qb.from_(C)
        .select(
            C.name,
            C.customer_name,
            C.mobile_no,
            C.email_id,
            C.tax_id,
            C.primary_address,
            C.customer_group,
            C.territory,
            C.default_price_list,
            C.loyalty_program,
            C.posa_discount,
            C.disabled,
            C.modified,
        )
        .orderby(C.modified)
        .orderby(C.name)
        .limit(limit)
    )
    cond = _keyset_condition(C, since, after)
    if cond is not None:
        q = q.where(cond)
    else:
        q = q.where(C.disabled == 0)
    if groups:
        q = q.where(C.customer_group.isin(groups))
    rows = q.run(as_dict=True)
    out = []
    for r in rows:
        if r.disabled:
            out.append({"name": r.name, "deleted": 1, "modified": str(r.modified)})
            continue
        r.modified = str(r.modified)
        r.pop("disabled", None)
        out.append(r)
    return {"rows": out, "cursor": _cursor(rows), "done": len(rows) < limit}


@frappe.whitelist()
def get_deleted_documents(since, doctypes=None):
    """Names deleted since `since` (Deleted Document log)."""
    allowed = {"Item", "Item Price", "Customer", "POS Offer", "POS Coupon", "Bin"}
    doctypes = [d for d in (_loads(doctypes, None) or list(allowed)) if d in allowed]
    rows = frappe.get_all(
        "Deleted Document",
        filters={"deleted_doctype": ["in", doctypes], "creation": [">", get_datetime(since)]},
        fields=["deleted_doctype", "deleted_name", "creation"],
        order_by="creation asc",
        limit_page_length=20000,
    )
    return [
        {"doctype": r.deleted_doctype, "name": r.deleted_name, "deleted_on": str(r.creation)} for r in rows
    ]


@frappe.whitelist()
def get_catalog_counts(pos_profile):
    """Rough sizes so the terminal can show download progress."""
    name = check_profile_access(pos_profile)
    profile = frappe.get_cached_doc("POS Profile", name)
    groups = get_profile_item_groups(name)
    item_filters = {"disabled": 0, "is_sales_item": 1, "is_fixed_asset": 0}
    if groups:
        item_filters["item_group"] = ["in", groups]
    if not cint(profile.get("posa_show_template_items")):
        item_filters["has_variants"] = 0
    lists = [profile.selling_price_list] + ([profile.posa_mrp_price_list] if profile.get("posa_mrp_price_list") else [])
    return {
        "items": frappe.db.count("Item", item_filters),
        "prices": frappe.db.count("Item Price", {"price_list": ["in", lists], "selling": 1}),
        "stock": frappe.db.count("Bin", {"warehouse": profile.warehouse}),
        "customers": frappe.db.count("Customer", {"disabled": 0}),
    }


@frappe.whitelist()
def get_item_batches(pos_profile, item_codes):
    """Batches (with qty in the profile warehouse) for batch-tracked items, used
    to refresh the offline cache for items in the cart."""
    name = check_profile_access(pos_profile)
    warehouse = frappe.get_cached_value("POS Profile", name, "warehouse")
    from erpnext.stock.doctype.batch.batch import get_batch_qty

    today = getdate()
    out = {}
    for code in _loads(item_codes, [])[:200]:
        rows = []
        for b in get_batch_qty(item_code=code, warehouse=warehouse) or []:
            if not b.get("batch_no") or flt(b.get("qty")) <= 0:
                continue
            batch = frappe.get_cached_doc("Batch", b.get("batch_no"))
            if batch.disabled or (batch.expiry_date and getdate(batch.expiry_date) < today):
                continue
            rows.append(
                {
                    "batch_no": batch.name,
                    "batch_qty": flt(b.get("qty")),
                    "expiry_date": str(batch.expiry_date) if batch.expiry_date else None,
                    "batch_price": flt(batch.get("posa_batch_price")),
                    "manufacturing_date": str(batch.manufacturing_date) if batch.manufacturing_date else None,
                }
            )
        out[code] = rows
    return out


# ---------------------------------------------------------------------------
# offline invoices
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["POST"])
def upload_offline_invoices(invoices, process_now=1):
    """Store invoices taken offline and process them.

    ``invoices``: list of ``{"offline_id", "invoice": {...}, "data": {...},
    "created_on", "pos_profile", "pos_opening_shift", "offline_customer"}``.

    Returns one result per offline_id: ``{"offline_id", "status", "sales_invoice",
    "error"}``. Calling it again with the same ids is safe."""
    invoices = _loads(invoices, [])
    if not isinstance(invoices, list):
        frappe.throw(_("invoices must be a list"))
    results = []
    to_process = []
    for entry in invoices[:200]:
        offline_id = cstr(entry.get("offline_id")).strip()
        if not offline_id:
            results.append({"offline_id": None, "status": "Failed", "error": _("Missing offline_id")})
            continue
        existing = frappe.db.get_value(
            "POS Offline Invoice", offline_id, ["name", "status", "sales_invoice", "error"], as_dict=True
        )
        if existing:
            if existing.status in ("Synced", "Duplicate"):
                results.append(_result(existing))
                continue
            if existing.status == "Failed":
                # client resends after fixing data -> take the new payload
                frappe.db.set_value(
                    "POS Offline Invoice",
                    offline_id,
                    {
                        "payload": json.dumps(entry.get("invoice") or {}),
                        "submit_data": json.dumps(entry.get("data") or {}),
                        "offline_customer": json.dumps(entry.get("offline_customer") or {}),
                        "status": "Queued",
                    },
                )
            to_process.append(offline_id)
            continue
        # already turned into an invoice by an earlier request that timed out?
        si = frappe.db.get_value("Sales Invoice", {"posa_offline_id": offline_id}, "name")
        doc = frappe.get_doc(
            {
                "doctype": "POS Offline Invoice",
                "offline_id": offline_id,
                "status": "Synced" if si else "Queued",
                "sales_invoice": si,
                "pos_profile": entry.get("pos_profile") or (entry.get("invoice") or {}).get("pos_profile"),
                "pos_opening_shift": entry.get("pos_opening_shift")
                or (entry.get("invoice") or {}).get("posa_pos_opening_shift"),
                "user": frappe.session.user,
                "customer": (entry.get("invoice") or {}).get("customer"),
                "grand_total": flt(entry.get("grand_total")),
                "client_created_on": _client_datetime(entry.get("created_on")),
                "payload": json.dumps(entry.get("invoice") or {}),
                "submit_data": json.dumps(entry.get("data") or {}),
                "offline_customer": json.dumps(entry.get("offline_customer") or {}),
            }
        )
        doc.insert(ignore_permissions=True)
        if si:
            results.append(_result(doc))
        else:
            to_process.append(offline_id)
    frappe.db.commit()

    if cint(process_now):
        # process inline within a time budget, leave the rest to a background job
        started = now_datetime()
        pending = []
        for offline_id in to_process:
            if (now_datetime() - started).total_seconds() > 20:
                pending.append(offline_id)
                continue
            process_offline_invoice(offline_id)
        if pending:
            frappe.enqueue(
                "posawesome.posawesome.api.offline.process_offline_invoices",
                offline_ids=pending,
                queue="long",
                timeout=3600,
                enqueue_after_commit=True,
            )
    else:
        frappe.enqueue(
            "posawesome.posawesome.api.offline.process_offline_invoices",
            offline_ids=to_process,
            queue="long",
            timeout=3600,
            enqueue_after_commit=True,
        )

    for offline_id in to_process:
        row = frappe.db.get_value(
            "POS Offline Invoice", offline_id, ["name", "status", "sales_invoice", "error"], as_dict=True
        )
        results.append(_result(row))
    return results


def _client_datetime(value):
    try:
        return get_datetime(value) if value else now_datetime()
    except Exception:
        return now_datetime()


def _result(row):
    return {
        "offline_id": row.name,
        "status": row.status,
        "sales_invoice": row.sales_invoice,
        "error": row.error if row.status == "Failed" else None,
    }


@frappe.whitelist()
def get_offline_invoice_status(offline_ids):
    offline_ids = _loads(offline_ids, [])
    rows = frappe.get_all(
        "POS Offline Invoice",
        filters={"name": ["in", offline_ids]},
        fields=["name", "status", "sales_invoice", "error"],
    )
    return [_result(r) for r in rows]


@frappe.whitelist()
def retry_offline_invoices(offline_ids=None):
    """Reprocess failed offline invoices (button on the list / form)."""
    frappe.only_for(("System Manager", "Accounts Manager", "Sales Manager"))
    offline_ids = _loads(offline_ids, None)
    if not offline_ids:
        offline_ids = frappe.get_all("POS Offline Invoice", filters={"status": "Failed"}, pluck="name")
    for offline_id in offline_ids:
        frappe.db.set_value("POS Offline Invoice", offline_id, "status", "Queued")
    frappe.db.commit()
    frappe.enqueue(
        "posawesome.posawesome.api.offline.process_offline_invoices",
        offline_ids=offline_ids,
        queue="long",
        timeout=3600,
        enqueue_after_commit=True,
    )
    return len(offline_ids)


def process_offline_invoices(offline_ids=None):
    """Background worker; also run hourly to pick up anything left Queued."""
    if offline_ids is None:
        offline_ids = frappe.get_all(
            "POS Offline Invoice",
            filters={"status": ["in", ["Queued", "Processing"]]},
            order_by="client_created_on asc",
            pluck="name",
            limit_page_length=2000,
        )
    for offline_id in offline_ids:
        process_offline_invoice(offline_id)


def process_offline_invoice(offline_id):
    """Turn one POS Offline Invoice into a submitted Sales Invoice. Commits."""
    # lock the row so two workers never process the same invoice
    row = frappe.db.sql(
        "select name, status from `tabPOS Offline Invoice` where name=%s for update",
        offline_id,
        as_dict=True,
    )
    if not row or row[0].status in ("Synced", "Duplicate"):
        frappe.db.commit()
        return
    queue_doc = frappe.get_doc("POS Offline Invoice", offline_id)

    existing = frappe.db.get_value("Sales Invoice", {"posa_offline_id": offline_id, "docstatus": ["<", 2]}, "name")
    if existing:
        queue_doc.db_set({"status": "Synced", "sales_invoice": existing, "error": None})
        frappe.db.commit()
        return

    queue_doc.db_set({"status": "Processing", "attempts": cint(queue_doc.attempts) + 1})
    frappe.db.commit()

    owner = queue_doc.user or frappe.session.user
    current_user = frappe.session.user
    try:
        if owner and owner != current_user and frappe.db.exists("User", owner):
            frappe.set_user(owner)
        invoice_name = _create_invoice_from_payload(queue_doc)
        frappe.db.commit()
        queue_doc.reload()
        queue_doc.db_set({"status": "Synced", "sales_invoice": invoice_name, "error": None})
        frappe.db.commit()
    except Exception:
        frappe.db.rollback()
        error = frappe.get_traceback(with_context=False)
        message = _last_message() or error.strip().splitlines()[-1]
        frappe.db.set_value(
            "POS Offline Invoice",
            offline_id,
            {"status": "Failed", "error": message[:1000] + "\n\n" + error[-6000:]},
        )
        frappe.db.commit()
    finally:
        if frappe.session.user != current_user:
            frappe.set_user(current_user)
        frappe.local.message_log = []


def _last_message():
    try:
        logs = frappe.local.message_log or []
        if logs:
            last = logs[-1]
            if isinstance(last, str):
                last = json.loads(last)
            return frappe.utils.strip_html(cstr(last.get("message")))
    except Exception:
        return None


def _create_invoice_from_payload(queue_doc):
    from posawesome.posawesome.api.posapp import prepare_invoice_doc, submit_invoice_doc

    payload = _loads(queue_doc.payload, {}) or {}
    data = _loads(queue_doc.submit_data, {}) or {}
    offline_customer = _loads(queue_doc.offline_customer, {}) or {}

    if offline_customer and not frappe.db.exists("Customer", payload.get("customer")):
        payload["customer"] = _ensure_offline_customer(offline_customer, payload)

    # never trust names coming from the terminal
    for key in ("name", "amended_from", "docstatus", "owner", "creation", "modified"):
        payload.pop(key, None)
    payload["doctype"] = "Sales Invoice"
    payload["posa_offline_id"] = queue_doc.offline_id
    payload["posa_offline_created_on"] = str(queue_doc.client_created_on or now_datetime())
    payload["is_pos"] = 1 if payload.get("is_pos", 1) else 0
    for row in payload.get("items") or []:
        row.pop("name", None)
    for row in payload.get("payments") or []:
        row.pop("name", None)

    client_total = flt(payload.get("rounded_total") or payload.get("grand_total"))

    frappe.flags.posa_offline_sync = True
    try:
        invoice_doc = prepare_invoice_doc(payload)
        invoice_doc.flags.posa_offline_sync = True
        invoice_doc.set_posting_time = 1
        if payload.get("posting_date"):
            invoice_doc.posting_date = payload.get("posting_date")
        if payload.get("posting_time"):
            invoice_doc.posting_time = payload.get("posting_time")
        invoice_doc.calculate_taxes_and_totals()
        _reconcile_payments(invoice_doc, client_total, data)
        submit_invoice_doc(invoice_doc, payload, data, allow_background=False)
    finally:
        frappe.flags.posa_offline_sync = False
    return invoice_doc.name


def _reconcile_payments(invoice_doc, client_total, data):
    """The terminal computed totals itself; ERPNext may differ by a rounding unit.
    If the customer paid in full on the terminal, move the difference to the cash
    (or largest) payment row so the invoice is still fully paid."""
    if invoice_doc.is_return:
        return
    server_total = flt(invoice_doc.rounded_total or invoice_doc.grand_total)
    paid = sum(flt(p.amount) for p in invoice_doc.payments)
    diff = flt(server_total - client_total, invoice_doc.precision("grand_total"))
    if not diff or not invoice_doc.payments:
        return
    smallest = max(
        flt(frappe.get_cached_value("Currency", invoice_doc.currency, "smallest_currency_fraction_value")),
        1 / (10 ** invoice_doc.precision("grand_total")),
    )
    tolerance = max(smallest * 2, 1.0)
    if abs(diff) > tolerance:
        # real difference (e.g. price changed): leave it, the invoice will show an
        # outstanding amount / change and the error log keeps the client total.
        invoice_doc.add_comment(
            "Comment",
            _("Offline total {0} differs from server total {1}").format(client_total, server_total),
        )
        return
    if flt(paid) >= client_total:
        rows = [p for p in invoice_doc.payments if flt(p.amount)]
        target = next((p for p in rows if p.get("type") == "Cash"), None) or (
            max(rows, key=lambda p: flt(p.amount)) if rows else None
        )
        if target:
            target.amount = flt(target.amount) + diff
            target.base_amount = flt(target.amount) * flt(invoice_doc.conversion_rate or 1)
            invoice_doc.calculate_taxes_and_totals()


def _ensure_offline_customer(customer, payload):
    """Create the customer the cashier added while offline (dedupe by mobile)."""
    mobile = customer.get("mobile_no")
    if mobile:
        found = frappe.db.get_value("Customer", {"mobile_no": mobile}, "name")
        if found:
            return found
    name = frappe.db.get_value("Customer", {"customer_name": customer.get("customer_name")}, "name")
    if name and not mobile:
        return name
    doc = frappe.get_doc(
        {
            "doctype": "Customer",
            "customer_name": customer.get("customer_name") or payload.get("customer"),
            "customer_group": customer.get("customer_group")
            or frappe.db.get_single_value("Selling Settings", "customer_group")
            or "All Customer Groups",
            "territory": customer.get("territory")
            or frappe.db.get_single_value("Selling Settings", "territory")
            or "All Territories",
            "mobile_no": mobile,
            "email_id": customer.get("email_id"),
            "tax_id": customer.get("tax_id"),
            "posa_referral_company": payload.get("company"),
        }
    )
    doc.flags.ignore_permissions = True
    doc.insert()
    return doc.name


def check_pending_before_closing(opening_shift):
    """Used by POS Closing Shift: invoices of the shift still waiting on the server."""
    return frappe.get_all(
        "POS Offline Invoice",
        filters={"pos_opening_shift": opening_shift, "status": ["in", ["Queued", "Processing", "Failed"]]},
        fields=["name", "status"],
    )


def after_migrate():
    """Indexes used by the keyset pagination of the offline sync."""
    for doctype in ("Item", "Item Price", "Bin", "Customer"):
        try:
            frappe.db.add_index(doctype, ["modified", "name"], index_name="posa_modified_name")
        except Exception:
            frappe.log_error(title=f"posawesome: could not add index on {doctype}")
