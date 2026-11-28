# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt


from posawesome.posawesome.api.sm_manage import offer_report


def execute(filters=None):
	return offer_report(filters or {})
