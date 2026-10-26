import frappe

def apply_conditional_pos_taxes(doc, method=None):
    # Only for POS Invoices
    if not doc.is_pos or not doc.pos_profile:
        return

    pos_profile = frappe.get_doc("POS Profile", doc.pos_profile)

    # Decide correct tax template
    if doc.posa_conditional_tax_applied == 1:
        tax_template = pos_profile.posa_card_taxes_and_charges
    else:
        tax_template = pos_profile.taxes_and_charges

    if not tax_template:
        return

    # Avoid unnecessary recalculation
    if doc.taxes_and_charges == tax_template and doc.taxes:
        return

    # Set template
    doc.taxes_and_charges = tax_template

    # Clear existing taxes
    doc.set("taxes", [])

    # Load tax template manually
    template = frappe.get_doc(
        "Sales Taxes and Charges Template",
        tax_template
    )

    for t in template.taxes:
        doc.append("taxes", {
            "charge_type": t.charge_type,
            "account_head": t.account_head,
            "description": t.description,
            "rate": t.rate,
            "cost_center": t.cost_center,
            "included_in_print_rate": t.included_in_print_rate
        })

    # Recalculate totals
    doc.calculate_taxes_and_totals()
