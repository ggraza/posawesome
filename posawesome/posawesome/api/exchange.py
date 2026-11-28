"""Item exchange / replacement at the POS.

Return items of an earlier sale and give other (exchange) or the same
(replacement) items in their place, in one step:

* a credit note (Sales Invoice return) against the original invoice, made with
  ERPNext's make_sales_return and limited to the rows and quantities returned;
* a new Sales Invoice for the replacement items, priced by ERPNext;
* a POS Item Exchange record linking the three invoices (audit trail).

Both invoices are POS invoices of the cashier's open shift. The value they have
in common is settled through the profile's default mode of payment (refunded on
the credit note, received on the new invoice, so it nets to zero in the till);
only the difference is paid by the customer or refunded. Each invoice is fully
settled, stock moves through the invoices, and the closing shift sees both.

Everything is created in one request: if any step fails, nothing is saved.
Cancelling is done on the POS Item Exchange (see its controller).
"""

import json
from collections import defaultdict

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime, nowdate, nowtime

QTY_EPS = 1e-6
MONEY_EPS = 0.005


# ----------------------------------------------------------------- settings
def _load(value):
    if isinstance(value, str):
        return frappe._dict(json.loads(value))
    return frappe._dict(value or {})


def _profile(name):
    if not name:
        frappe.throw(_("POS Profile is required"))
    if isinstance(name, dict):
        name = name.get("name")
    return frappe.get_doc("POS Profile", name)


def exchange_settings(profile):
    return frappe._dict(
        exchange=cint(profile.get("posa_enable_item_exchange")),
        replacement=cint(profile.get("posa_enable_item_replacement")),
        additional_payment=cint(profile.get("posa_allow_exchange_additional_payment")),
        refund=cint(profile.get("posa_allow_exchange_refund")),
        approval=cint(profile.get("posa_exchange_require_approval")),
        approver_role=profile.get("posa_exchange_approver_role") or "Sales Manager",
    )


def _check_enabled(profile, exchange_type):
    s = exchange_settings(profile)
    if exchange_type == "Replacement":
        if not s.replacement:
            frappe.throw(_("Item replacement is not enabled in POS Profile {0}").format(profile.name))
    elif exchange_type == "Exchange":
        if not s.exchange:
            frappe.throw(_("Item exchange is not enabled in POS Profile {0}").format(profile.name))
    else:
        frappe.throw(_("Unknown exchange type {0}").format(exchange_type))
    return s


# ------------------------------------------------------- returnable quantity
def returned_stock_qty(invoice):
    """Stock qty already returned per row of the original invoice.

    Returns made with a row reference (sales_invoice_item) count for that row;
    returns without one (e.g. made from the POS return screen) count for the
    item code and are spread over that item's rows in order."""
    rows = frappe.db.sql(
        """
        SELECT i.item_code, i.sales_invoice_item, ABS(i.stock_qty) AS stock_qty
        FROM `tabSales Invoice Item` i
        JOIN `tabSales Invoice` p ON p.name = i.parent
        WHERE p.docstatus = 1 AND p.is_return = 1 AND p.return_against = %s
        """,
        invoice.name,
        as_dict=True,
    )
    own = {d.name for d in invoice.items}
    linked = defaultdict(float)
    loose = defaultdict(float)
    for r in rows:
        if r.sales_invoice_item and r.sales_invoice_item in own:
            linked[r.sales_invoice_item] += flt(r.stock_qty)
        else:
            loose[r.item_code] += flt(r.stock_qty)
    out = {}
    for d in invoice.items:
        used = linked[d.name]
        free = max(flt(d.stock_qty) - used, 0)
        take = min(free, loose[d.item_code])
        loose[d.item_code] -= take
        out[d.name] = used + take
    return out


def _check_original(invoice, profile):
    if invoice.docstatus != 1:
        frappe.throw(_("{0} is not a submitted invoice").format(invoice.name))
    if cint(invoice.is_return):
        frappe.throw(_("{0} is a return; choose the original sale").format(invoice.name))
    if invoice.company != profile.company:
        frappe.throw(_("{0} belongs to another company").format(invoice.name))


# ------------------------------------------------------------ dialog lookups
@frappe.whitelist()
def search_exchange_invoices(pos_profile, text=None):
    """Submitted sales (not returns) of the profile's company, newest first,
    by invoice number, customer, customer name or mobile."""
    profile = _profile(pos_profile)
    s = exchange_settings(profile)
    if not (s.exchange or s.replacement):
        frappe.throw(_("Item exchange is not enabled in POS Profile {0}").format(profile.name))
    text = (text or "").strip()
    cond = ""
    values = {"company": profile.company}
    if text:
        values["like"] = f"%{text}%"
        cond = """AND (si.name LIKE %(like)s OR si.customer LIKE %(like)s
                   OR si.customer_name LIKE %(like)s OR IFNULL(si.contact_mobile, '') LIKE %(like)s)"""
    return frappe.db.sql(
        f"""
        SELECT si.name, si.customer, si.customer_name, si.posting_date, si.grand_total,
               si.rounded_total, si.currency, si.status, si.pos_profile
        FROM `tabSales Invoice` si
        WHERE si.docstatus = 1 AND si.is_return = 0 AND si.company = %(company)s {cond}
        ORDER BY si.posting_date DESC, si.creation DESC
        LIMIT 30
        """,
        values,
        as_dict=True,
    )


@frappe.whitelist()
def get_exchange_invoice(invoice, pos_profile):
    """The original sale with, per row, the quantity returned before and the
    quantity that can still be returned."""
    profile = _profile(pos_profile)
    doc = frappe.get_doc("Sales Invoice", invoice)
    _check_original(doc, profile)
    returned = returned_stock_qty(doc)
    items = []
    for d in doc.items:
        cf = flt(d.conversion_factor) or 1
        prev = flt(returned.get(d.name, 0) / cf, 6)
        returnable = max(flt(d.qty - prev, 6), 0)
        meta = frappe.get_cached_value("Item", d.item_code, ["has_batch_no", "has_serial_no"], as_dict=True) or {}
        items.append(
            {
                "row": d.name,
                "idx": d.idx,
                "item_code": d.item_code,
                "item_name": d.item_name,
                "uom": d.uom,
                "stock_uom": d.stock_uom,
                "conversion_factor": cf,
                "qty": d.qty,
                "rate": d.rate,
                "price_list_rate": d.price_list_rate,
                "discount_percentage": d.discount_percentage,
                "amount": d.amount,
                "previously_returned": prev,
                "returnable_qty": returnable,
                "batch_no": d.batch_no,
                "serial_no": d.serial_no,
                "has_batch_no": cint(meta.get("has_batch_no")),
                "has_serial_no": cint(meta.get("has_serial_no")),
            }
        )
    return {
        "name": doc.name,
        "customer": doc.customer,
        "customer_name": doc.customer_name,
        "posting_date": doc.posting_date,
        "currency": doc.currency,
        "grand_total": doc.grand_total,
        "rounded_total": doc.rounded_total,
        "discount_amount": doc.discount_amount,
        "items": items,
    }


def _item_prices(codes, price_list):
    today = nowdate()
    rows = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", codes], "price_list": price_list},
        fields=["item_code", "uom", "price_list_rate", "valid_from", "valid_upto"],
        order_by="valid_from desc",
    )
    prices = {}
    for r in rows:
        if r.valid_from and str(r.valid_from) > today:
            continue
        if r.valid_upto and str(r.valid_upto) < today:
            continue
        prices.setdefault((r.item_code, r.uom or ""), flt(r.price_list_rate))
    return prices


@frappe.whitelist()
def search_exchange_items(pos_profile, text):
    """Replacement items: exact barcode first, then every word in the code or
    name; with selling price per UOM, stock in the profile warehouse, discount
    limit and batch / serial flags."""
    from posawesome.posawesome.api.offline import get_profile_item_groups

    profile = _profile(pos_profile)
    text = (text or "").strip()
    if not text:
        return []
    barcode = frappe.db.get_value("Item Barcode", {"barcode": text}, ["parent", "uom"], as_dict=True)
    values = {"exact": text}
    conds = ["i.disabled = 0", "i.is_sales_item = 1", "i.has_variants = 0"]
    if barcode:
        conds.append("i.name = %(code)s")
        values["code"] = barcode.parent
    else:
        for n, word in enumerate(text.split()[:6]):
            values[f"w{n}"] = f"%{word}%"
            conds.append(f"(i.name LIKE %(w{n})s OR i.item_name LIKE %(w{n})s)")
    groups = get_profile_item_groups(profile.name)
    if groups:
        conds.append("i.item_group IN %(groups)s")
        values["groups"] = tuple(groups)
    items = frappe.db.sql(
        f"""
        SELECT i.name AS item_code, i.item_name, i.stock_uom, i.has_batch_no, i.has_serial_no,
               i.max_discount, i.item_group
        FROM `tabItem` i
        WHERE {' AND '.join(conds)}
        ORDER BY (i.name = %(exact)s) DESC, i.item_name
        LIMIT 20
        """,
        values,
        as_dict=True,
    )
    if not items:
        return []
    codes = [d.item_code for d in items]
    prices = _item_prices(codes, profile.selling_price_list)
    uoms = defaultdict(list)
    for u in frappe.get_all(
        "UOM Conversion Detail",
        filters={"parent": ["in", codes], "parenttype": "Item"},
        fields=["parent", "uom", "conversion_factor"],
        order_by="idx",
    ):
        uoms[u.parent].append(u)
    stock = {
        b.item_code: flt(b.actual_qty)
        for b in frappe.get_all(
            "Bin",
            filters={"item_code": ["in", codes], "warehouse": profile.warehouse},
            fields=["item_code", "actual_qty"],
        )
    }
    out = []
    for d in items:
        base = prices.get((d.item_code, d.stock_uom)) or prices.get((d.item_code, ""), 0)
        rows = [{"uom": d.stock_uom, "conversion_factor": 1, "rate": base}]
        for u in uoms[d.item_code]:
            if u.uom == d.stock_uom:
                continue
            cf = flt(u.conversion_factor) or 1
            rows.append({"uom": u.uom, "conversion_factor": cf, "rate": prices.get((d.item_code, u.uom)) or base * cf})
        d.update(
            {
                "uoms": rows,
                "uom": (barcode.uom if barcode and barcode.uom else d.stock_uom),
                "actual_qty": stock.get(d.item_code, 0),
                "max_discount": _discount_limit(profile, d.max_discount),
                "warehouse": profile.warehouse,
            }
        )
        out.append(d)
    return out


@frappe.whitelist()
def get_exchange_batches(item_code, pos_profile):
    """Batches with stock in the profile warehouse (and serial numbers if the
    item has them) for a replacement row."""
    from erpnext.stock.doctype.batch.batch import get_batch_qty

    profile = _profile(pos_profile)
    meta = frappe.get_cached_value("Item", item_code, ["has_batch_no", "has_serial_no"], as_dict=True) or {}
    batches = []
    if cint(meta.get("has_batch_no")):
        for b in get_batch_qty(warehouse=profile.warehouse, item_code=item_code) or []:
            if flt(b.get("qty")) > 0:
                expiry = frappe.db.get_value("Batch", b.get("batch_no"), "expiry_date")
                batches.append({"batch_no": b.get("batch_no"), "qty": flt(b.get("qty")), "expiry_date": expiry})
    serials = []
    if cint(meta.get("has_serial_no")):
        serials = frappe.get_all(
            "Serial No",
            filters={"item_code": item_code, "warehouse": profile.warehouse, "status": "Active"},
            pluck="name",
            limit=500,
        )
    return {"batches": batches, "serial_nos": serials}


# ------------------------------------------------------------- build / price
def _discount_limit(profile, item_max_discount):
    """Highest discount % a cashier may give on a replacement row."""
    if not cint(profile.get("posa_allow_user_to_edit_item_discount")):
        return 0
    limits = [flt(x) for x in (item_max_discount, profile.get("posa_max_discount_allowed")) if flt(x) > 0]
    return min(limits) if limits else 100


def _due(doc):
    if not cint(doc.disable_rounded_total) and flt(doc.rounded_total):
        return flt(doc.rounded_total)
    return flt(doc.grand_total)


def _profile_modes(profile):
    modes = [p.mode_of_payment for p in profile.payments]
    if not modes:
        frappe.throw(_("POS Profile {0} has no modes of payment").format(profile.name))
    default = next((p.mode_of_payment for p in profile.payments if cint(p.default)), modes[0])
    return modes, default


def _payment_row(mode, amount, company, rate, default_mode):
    from erpnext.accounts.doctype.sales_invoice.sales_invoice import get_bank_cash_account

    return {
        "mode_of_payment": mode,
        "amount": flt(amount, 2),
        "base_amount": flt(amount * rate, 2),
        "account": get_bank_cash_account(mode, company)["account"],
        "type": frappe.get_cached_value("Mode of Payment", mode, "type"),
        "default": 1 if mode == default_mode else 0,
    }


def _clear_inherited(ret):
    """Things the credit note must not copy from the original sale."""
    for table in ("posa_offers", "posa_coupons", "sales_team"):
        if ret.meta.has_field(table):
            ret.set(table, [])
    for field in ("posa_delivery_date", "posa_is_printed", "posa_offline_id", "posa_offline_created_on", "posa_item_exchange"):
        if ret.meta.has_field(field):
            ret.set(field, None)


def build_exchange(data, profile, lock=False):
    """Credit note + new invoice (not saved) and the settlement. Raises on any
    rule broken: nothing returned twice, settings, discounts, payments."""
    from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_sales_return

    data = _load(data)
    exchange_type = data.get("exchange_type") or "Exchange"
    settings = _check_enabled(profile, exchange_type)
    if not data.get("original_invoice"):
        frappe.throw(_("Select the original invoice"))
    if lock:
        # one exchange / return on this sale at a time
        frappe.db.get_value("Sales Invoice", data.original_invoice, "name", for_update=True)
    original = frappe.get_doc("Sales Invoice", data.original_invoice)
    _check_original(original, profile)

    # ---- A. returned rows
    rows = {d.name: d for d in original.items}
    returned_before = returned_stock_qty(original)
    selected = {}
    for r in data.get("return_items") or []:
        r = frappe._dict(r)
        qty = flt(r.qty, 6)
        if qty <= 0:
            continue
        row = rows.get(r.row)
        if not row:
            frappe.throw(_("Row {0} is not part of invoice {1}").format(r.row, original.name))
        if r.row in selected:
            frappe.throw(_("Row #{0} ({1}) is listed twice").format(row.idx, row.item_code))
        cf = flt(row.conversion_factor) or 1
        prev = flt(returned_before.get(row.name, 0) / cf, 6)
        left = flt(row.qty - prev, 6)
        if qty > left + QTY_EPS:
            frappe.throw(
                _("Row #{0} {1}: only {2} {3} can be returned ({4} sold, {5} returned before).").format(
                    row.idx, row.item_code, left, row.uom, row.qty, prev
                ),
                title=_("Return quantity too high"),
            )
        selected[r.row] = frappe._dict(qty=qty, serial_no=r.get("serial_no"), prev=prev)
    if not selected:
        frappe.throw(_("Select at least one item to return and enter its quantity"))

    # ---- B. replacement rows
    new_rows = [frappe._dict(r) for r in (data.get("new_items") or []) if flt(frappe._dict(r).qty) > 0]
    if exchange_type == "Replacement":
        # same items, same quantity, at the price paid
        by_row = {r.get("row"): r for r in new_rows if r.get("row")}
        new_rows = []
        for name, sel in selected.items():
            row = rows[name]
            choice = by_row.get(name) or frappe._dict()
            new_rows.append(
                frappe._dict(
                    item_code=row.item_code, uom=row.uom, qty=sel.qty, row=name,
                    batch_no=choice.get("batch_no"), serial_no=choice.get("serial_no"),
                )
            )
    if not new_rows:
        frappe.throw(_("Add at least one replacement item"))

    # ---- credit note
    ret = make_sales_return(original.name)
    ret.set("items", [d for d in ret.items if d.get("sales_invoice_item") in selected])
    returned_amount = 0.0
    for n, d in enumerate(ret.items, 1):
        sel = selected[d.sales_invoice_item]
        d.idx = n
        d.qty = -sel.qty
        d.stock_qty = -sel.qty * (flt(d.conversion_factor) or 1)
        if sel.serial_no:
            d.serial_no = sel.serial_no
            d.use_serial_batch_fields = 1
            d.serial_and_batch_bundle = None
        returned_amount += flt(rows[d.sales_invoice_item].amount) * sel.qty / (flt(rows[d.sales_invoice_item].qty) or 1)
    _clear_inherited(ret)
    if flt(original.discount_amount) and flt(original.total):
        # additional discount of the sale, for the share returned
        ret.discount_amount = -flt(original.discount_amount * returned_amount / flt(original.total), 2)
        ret.additional_discount_percentage = 0
    shift = data.get("pos_opening_shift")
    ret.update(
        {
            "is_pos": 1,
            "pos_profile": profile.name,
            "posa_pos_opening_shift": shift,
            "set_posting_time": 0,
            "posting_date": nowdate(),
            "posting_time": nowtime(),
            "due_date": nowdate(),
            "update_stock": original.update_stock,
        }
    )
    ret.calculate_taxes_and_totals()

    # ---- new invoice
    new = frappe.new_doc("Sales Invoice")
    new.update(
        {
            "customer": original.customer,
            "company": original.company,
            "is_pos": 1,
            "pos_profile": profile.name,
            "posa_pos_opening_shift": shift,
            "update_stock": 1,
            "set_warehouse": profile.warehouse,
            "selling_price_list": profile.selling_price_list or original.selling_price_list,
            "currency": original.currency,
            "conversion_rate": original.conversion_rate or 1,
            "set_posting_time": 0,
            "posting_date": nowdate(),
            "posting_time": nowtime(),
            "due_date": nowdate(),
            "taxes_and_charges": profile.get("taxes_and_charges") or original.taxes_and_charges,
            "ignore_pricing_rule": 1 if exchange_type == "Replacement" else profile.get("ignore_pricing_rule"),
        }
    )
    for r in new_rows:
        line = {"item_code": r.item_code, "qty": flt(r.qty, 6), "warehouse": profile.warehouse}
        if r.get("uom"):
            line["uom"] = r.uom
        if r.get("batch_no") or r.get("serial_no"):
            line.update(use_serial_batch_fields=1, batch_no=r.get("batch_no"), serial_no=r.get("serial_no"))
        new.append("items", line)
    new.set_missing_values()  # ERPNext item details, prices, taxes (payment rows rebuilt below)
    for d, r in zip(new.items, new_rows):
        if exchange_type == "Replacement":
            orig = rows[r.row]
            per_stock_unit = flt(orig.rate) / (flt(orig.conversion_factor) or 1)
            d.price_list_rate = flt(per_stock_unit * (flt(d.conversion_factor) or 1), d.precision("rate"))
            d.discount_percentage = 0
            d.discount_amount = 0
            d.margin_type = None
            d.margin_rate_or_amount = 0
            d.rate = d.price_list_rate
            continue
        disc = flt(r.get("discount_percentage"))
        if disc < 0:
            frappe.throw(_("Row #{0} {1}: discount cannot be negative").format(d.idx, d.item_code))
        limit = _discount_limit(profile, frappe.get_cached_value("Item", d.item_code, "max_discount"))
        if disc > limit + QTY_EPS:
            frappe.throw(
                _("Row #{0} {1}: discount {2}% is more than allowed ({3}%)").format(d.idx, d.item_code, disc, limit),
                title=_("Discount not allowed"),
            )
        if not flt(d.price_list_rate):
            frappe.throw(_("Row #{0} {1}: no selling price in {2}").format(d.idx, d.item_code, new.selling_price_list))
        d.discount_percentage = disc
        d.discount_amount = 0
        d.rate = flt(flt(d.price_list_rate) * (1 - disc / 100), d.precision("rate"))
    new.calculate_taxes_and_totals()

    # ---- settlement
    returned_total = abs(_due(ret))
    replacement_total = _due(new)
    difference = flt(replacement_total - returned_total, 2)
    modes, default_mode = _profile_modes(profile)
    rate = flt(new.conversion_rate) or 1
    common = min(returned_total, replacement_total)
    received = []  # (mode, amount) paid by the customer on top of the returned value
    refund = 0.0
    refund_mode = None
    if difference > MONEY_EPS:
        settlement = "Additional Payment"
        if exchange_type == "Exchange" and not settings.additional_payment:
            frappe.throw(
                _("Replacement items cost {0} more than the returned items. Exchanges with additional payment are not allowed in this POS Profile.").format(difference),
                title=_("Additional payment not allowed"),
            )
        for p in data.get("payments") or []:
            p = frappe._dict(p)
            if flt(p.amount) <= 0:
                continue
            if p.mode_of_payment not in modes:
                frappe.throw(_("Mode of payment {0} is not in POS Profile {1}").format(p.mode_of_payment, profile.name))
            received.append((p.mode_of_payment, flt(p.amount, 2)))
        if not received:
            received = [(default_mode, difference)]
        paid = flt(sum(a for _m, a in received), 2)
        if paid + MONEY_EPS < difference:
            frappe.throw(
                _("Customer pays {0}, but the difference is {1}").format(paid, difference),
                title=_("Payment not complete"),
            )
        has_cash = any(frappe.get_cached_value("Mode of Payment", m, "type") == "Cash" for m, _a in received)
        if paid > difference + MONEY_EPS and not has_cash:
            frappe.throw(_("Paid {0}, more than the difference {1}; only cash can give change").format(paid, difference))
    elif difference < -MONEY_EPS:
        settlement = "Refund"
        refund = flt(-difference, 2)
        if exchange_type == "Exchange" and not settings.refund:
            frappe.throw(
                _("Returned items are worth {0} more than the replacement items. Exchanges with refund are not allowed in this POS Profile; add items worth at least the returned value.").format(refund),
                title=_("Refund not allowed"),
            )
        refund_mode = data.get("refund_mode") or default_mode
        if refund_mode not in modes:
            frappe.throw(_("Mode of payment {0} is not in POS Profile {1}").format(refund_mode, profile.name))
    else:
        settlement = "Equal Value"
        difference = 0.0

    # credit note: refund the returned value (common part + any refund)
    ret.set("payments", [])
    ret_pay = defaultdict(float)
    ret_pay[default_mode] += common
    if refund:
        ret_pay[refund_mode] += refund
    for mode, amount in ret_pay.items():
        if amount:
            ret.append("payments", _payment_row(mode, -amount, ret.company, rate, default_mode))
    # new invoice: the common part + what the customer pays
    new_pay = defaultdict(float)
    new_pay[default_mode] += common
    for mode, amount in received:
        new_pay[mode] += amount
    new.set("payments", [])
    for mode in modes:  # keep the profile's order
        new.append("payments", _payment_row(mode, new_pay.pop(mode, 0), new.company, rate, default_mode))
    ret.calculate_taxes_and_totals()
    new.calculate_taxes_and_totals()

    return frappe._dict(
        exchange_type=exchange_type,
        original=original,
        rows=rows,
        selected=selected,
        credit_note=ret,
        new_invoice=new,
        returned_total=returned_total,
        replacement_total=replacement_total,
        difference=difference,
        settlement=settlement,
        received=received,
        refund=refund,
        refund_mode=refund_mode,
        default_mode=default_mode,
        settings=settings,
    )


def _summary(b):
    def lines(doc):
        return [
            {
                "item_code": d.item_code,
                "item_name": d.item_name,
                "uom": d.uom,
                "qty": d.qty,
                "price_list_rate": d.price_list_rate,
                "discount_percentage": d.discount_percentage,
                "rate": d.rate,
                "amount": d.amount,
                "row": d.get("sales_invoice_item"),
            }
            for d in doc.items
        ]

    def totals(doc):
        return {
            "net_total": doc.net_total,
            "total_taxes_and_charges": doc.total_taxes_and_charges,
            "discount_amount": doc.discount_amount,
            "grand_total": doc.grand_total,
            "rounded_total": doc.rounded_total,
            "due": _due(doc),
        }

    return {
        "exchange_type": b.exchange_type,
        "currency": b.new_invoice.currency,
        "returned_items": lines(b.credit_note),
        "replacement_items": lines(b.new_invoice),
        "credit_note_totals": totals(b.credit_note),
        "new_invoice_totals": totals(b.new_invoice),
        "returned_total": b.returned_total,
        "replacement_total": b.replacement_total,
        "difference": b.difference,
        "settlement": b.settlement,
        "additional_payment": b.difference if b.settlement == "Additional Payment" else 0,
        "paid": flt(sum(a for _m, a in b.received), 2),
        "change": flt(b.new_invoice.change_amount),
        "refund_amount": b.refund,
        "refund_mode": b.refund_mode,
        "default_mode": b.default_mode,
        "approval_required": b.settings.approval,
    }


@frappe.whitelist()
def preview_exchange(data, pos_profile):
    """Totals, settlement and the exact prices ERPNext will use; nothing saved."""
    profile = _profile(pos_profile)
    return _summary(build_exchange(data, profile))


# ------------------------------------------------------------------ approval
def _approve(profile, settings, approver=None, password=None):
    """The approving user, or raise. A user with the approver role who is
    logged in approves by themselves; otherwise their user and password."""
    from frappe.utils.password import check_password

    role = settings.approver_role
    me = frappe.session.user
    if not approver or approver == me:
        if role in frappe.get_roles(me):
            return me
        frappe.throw(
            _("Manager approval is required: enter the user and password of a {0}.").format(role),
            title=_("Approval required"),
        )
    if not frappe.db.get_value("User", approver, "enabled"):
        frappe.throw(_("Approval failed: user {0} not found or disabled").format(approver), title=_("Approval failed"))
    if role not in frappe.get_roles(approver):
        frappe.throw(_("Approval failed: {0} does not have the role {1}").format(approver, role), title=_("Approval failed"))
    try:
        check_password(approver, password or "")
    except frappe.AuthenticationError:
        frappe.throw(_("Approval failed: wrong password for {0}").format(approver), title=_("Approval failed"))
    return approver


def _check_shift(shift, profile):
    if not shift:
        frappe.throw(_("Open a POS shift first"))
    s = frappe.db.get_value("POS Opening Shift", shift, ["docstatus", "status", "pos_profile", "user"], as_dict=True)
    if not s or s.docstatus != 1 or s.status != "Open":
        frappe.throw(_("POS shift {0} is not open").format(shift))
    if s.pos_profile != profile.name:
        frappe.throw(_("POS shift {0} is not for POS Profile {1}").format(shift, profile.name))


def _result(name):
    ex = frappe.db.get_value(
        "POS Item Exchange",
        name,
        ["name", "return_invoice", "new_invoice", "settlement", "difference", "additional_payment",
         "refund_amount", "returned_total", "replacement_total", "approved_by", "status"],
        as_dict=True,
    )
    ex["exchange"] = ex.pop("name")
    return ex


@frappe.whitelist()
def create_exchange(data, pos_profile, approver=None, approver_password=None):
    """Make the exchange: credit note, new invoice and the POS Item Exchange,
    all submitted, or nothing at all."""
    data = _load(data)
    profile = _profile(pos_profile)
    client_ref = (data.get("client_ref") or "").strip() or None
    if data.get("original_invoice"):
        # lock the sale first: a second click / resend waits here, then sees
        # the exchange the first one made (checked just below)
        frappe.db.get_value("Sales Invoice", data.original_invoice, "name", for_update=True)
    if client_ref:
        done = frappe.db.get_value("POS Item Exchange", {"client_ref": client_ref, "docstatus": 1}, "name")
        if done:  # the terminal sent it again (answer lost): same exchange
            return dict(_result(done), already_done=1)
    exchange_type = data.get("exchange_type") or "Exchange"
    settings = _check_enabled(profile, exchange_type)
    _check_shift(data.get("pos_opening_shift"), profile)
    approved_by = _approve(profile, settings, approver, approver_password) if settings.approval else None

    b = build_exchange(data, profile, lock=True)
    ret, new = b.credit_note, b.new_invoice

    ex = frappe.get_doc(
        {
            "doctype": "POS Item Exchange",
            "exchange_type": b.exchange_type,
            "company": profile.company,
            "pos_profile": profile.name,
            "pos_opening_shift": data.get("pos_opening_shift"),
            "cashier": frappe.session.user,
            "customer": b.original.customer,
            "posting_date": nowdate(),
            "original_invoice": b.original.name,
            "currency": new.currency,
            "client_ref": client_ref,
            "approval_required": settings.approval,
            "approved_by": approved_by,
            "approved_on": now_datetime() if approved_by else None,
        }
    )
    for d in ret.items:
        sel = b.selected[d.sales_invoice_item]
        ex.append(
            "returned_items",
            {
                "item_code": d.item_code, "item_name": d.item_name, "uom": d.uom,
                "conversion_factor": d.conversion_factor, "qty": abs(flt(d.qty)), "rate": d.rate,
                "discount_percentage": d.discount_percentage, "amount": abs(flt(d.amount)),
                "batch_no": d.batch_no, "serial_no": d.serial_no, "original_row": d.sales_invoice_item,
                "previously_returned": sel.prev, "currency": new.currency,
            },
        )
    for d in new.items:
        ex.append(
            "replacement_items",
            {
                "item_code": d.item_code, "item_name": d.item_name, "uom": d.uom,
                "conversion_factor": d.conversion_factor, "qty": d.qty, "rate": d.rate,
                "discount_percentage": d.discount_percentage, "amount": d.amount,
                "batch_no": d.batch_no, "serial_no": d.serial_no, "currency": new.currency,
            },
        )
    ex.flags.ignore_permissions = True
    frappe.flags.posa_exchange_creating = True
    try:
        return _save_exchange(ex, b, ret, new)
    finally:
        frappe.flags.posa_exchange_creating = False


def _save_exchange(ex, b, ret, new):
    ex.insert()

    ret.posa_item_exchange = ex.name
    new.posa_item_exchange = ex.name
    ret.insert()
    ret.submit()
    new.insert()
    new.submit()

    ex.return_invoice = ret.name
    ex.new_invoice = new.name
    ex.returned_total = b.returned_total
    ex.replacement_total = b.replacement_total
    ex.difference = b.difference
    ex.settlement = b.settlement
    ex.additional_payment = b.difference if b.settlement == "Additional Payment" else 0
    ex.refund_amount = b.refund
    for mode, amount in b.received:
        ex.append("payments", {"mode_of_payment": mode, "direction": "Received", "amount": amount, "currency": new.currency})
    if b.refund:
        ex.append("payments", {"mode_of_payment": b.refund_mode, "direction": "Refunded", "amount": b.refund, "currency": new.currency})
    ex.submit()
    return dict(_result(ex.name), already_done=0)
