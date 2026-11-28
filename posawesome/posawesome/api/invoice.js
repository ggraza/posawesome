// Copyright (c) 20201 Youssef Restom and contributors
frappe.ui.form.on('Sales Invoice', {
    before_submit: function (frm) {
        if (!frm.doc.payments || frm.doc.payments.length === 0) return;
        if (frm.doc.change_amount <= 0) return;

        let valid_payments = frm.doc.payments.filter(p => p.amount > 0 && p.account);

        if (!valid_payments.length) return;

        // Pick payment with maximum amount
        let payment = valid_payments.reduce((max, p) =>
            p.amount > max.amount ? p : max
        );

        frm.set_value('account_for_change_amount', payment.account);
    }
});

frappe.ui.form.on("Sales Invoice", {
    refresh: function(frm){
        // Hide default Print button
        $('.page-head .btn[data-original-title="Print"]').hide();

        if(frm.doc.docstatus == 1){

            frm.add_custom_button('<i class="fa fa-print"></i> ' + __("Print"), ()=>{
                
                // Check if we should send to FBR
                if(frm.doc.custom_allow_fbr_on_submit == 1 && frm.doc.pos_id && frm.doc.fbr_pos_token && is_null(frm.doc.fbr_invoice_no)){
                    
                    // FBR update logic
                    var item_list = [];
                    var total_qty = 0;
                    var tax_rate = (frm.doc.taxes.length > 0 ? frm.doc.taxes[0].rate : 0);

                    $.each(frm.doc.items, (k,item)=>{
                        var salevalue = item.rate * item.qty;
                        item_list.push({
                            "ItemCode": item.item_code,
                            "ItemName": item.item_name,
                            "Quantity": item.qty,
                            "PCTCode": "11001010",
                            "TaxRate": tax_rate,
                            "SaleValue": salevalue,
                            "TotalAmount": salevalue * (1 + (tax_rate/100)),
                            "TaxCharged": (salevalue/100)*tax_rate,
                            "Discount": "0.0",
                            "FurtherTax": 0,
                            "InvoiceType": 1,
                            "RefUSIN": null
                        });
                        total_qty += item.qty;
                    });

                    var data = {
                        "InvoiceNumber": "",
                        "POSID": frm.doc.pos_id,
                        "USIN": frm.doc.name,
                        "DateTime": frm.doc.posting_date,
                        "BuyerNTN": "",
                        "BuyerCNIC": null,
                        "BuyerName": frm.doc.customer,
                        "BuyerPhoneNumber": null,
                        "TotalBillAmount": frm.doc.rounded_total,
                        "TotalQuantity": total_qty,
                        "TotalSaleValue": frm.doc.net_total,
                        "TotalTaxCharged": frm.doc.total_taxes_and_charges,
                        "Discount": "0",
                        "FurtherTax": "0",
                        "PaymentMode": 1,
                        "RefUSIN": null,
                        "InvoiceType": 1,
                        "Items": item_list
                    };

                    $.ajax('https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData', {
                        type: 'POST',
                        data: data,
                        async: false,
                        success: function (response) {
                            console.log('FBR Response:', response);
                            var invoiceNumber = response.InvoiceNumber;

                            frappe.call({
                                method: "posawesome.events.sales_invoice.set_invoice_number",
                                args: {
                                    doctype: frm.doc.doctype,
                                    name: frm.doc.name,
                                    inv: invoiceNumber
                                },
                                async: false,
                                callback: function(){
                                    // Reload doc and then print
                                    frm.reload_doc().then(() => {
                                        frm.print_doc();
                                    });
                                }
                            });

                        },
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader("Authorization", "Bearer " + frm.doc.fbr_pos_token);
                        },
                        error: function (jqXhr, textStatus, errorMessage) {
                            frappe.msgprint(__('FBR Update Failed: {0}', [errorMessage]));
                            console.log('Error: ' + errorMessage);
                        }
                    });

                } else {
                    // Just print normally
                    frm.print_doc();
                }

            });

        }
    },
});
