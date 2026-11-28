# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt


from posawesome.posawesome.api.sm_manage import movers_report


def execute(filters=None):
	return movers_report(filters or {})
