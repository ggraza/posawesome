# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt


from posawesome.posawesome.api.shelf_labels import label_check_report


def execute(filters=None):
	return label_check_report(filters or {})
