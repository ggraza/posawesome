from frappe.custom.doctype.custom_field.custom_field import CustomField
import frappe


class CustomCustomField(CustomField):
    def set_fieldname(self):
        super().set_fieldname()

        if not frappe.db.get_single_value(
            "System Settings",
            "remove_custom__on_custom_field"
        ):
            return

        prefix = "custom_"

        if self.fieldname.startswith(prefix):
            self.fieldname = self.fieldname[len(prefix):]

#from frappe.custom.doctype.custom_field.custom_field import CustomField
#
#class CustomCustomField(CustomField):
#    def set_fieldname(self):
#        super(CustomCustomField, self).set_fieldname()
#        
#        prefix = "custom_"
#
#        if self.fieldname.startswith(prefix):
#            self.fieldname = self.fieldname[len(prefix):]