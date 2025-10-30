# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe import _

# App Information
app_name = "zakaah"
app_title = "Zakaah"
app_publisher = "Zakaah Team"
app_description = "Zakaah Management System"
app_email = "info@zakaah.com"

# include js, css files in header of desk.html
# app_include_css = []

# include js in doctype views
# doctype_js = {}

def get_data():
	return [
		{
			"module_name": "Zakaah Management",
			"color": "orange",
			"icon": "octicon octicon-flame",
			"type": "module",
			"label": _("Zakaah Management"),
			"items": [
				{
					"type": "doctype",
					"name": "Zakaah Assets Configuration",
					"label": _("Assets Configuration"),
					"description": _("Configure assets for Zakaah calculation")
				},
				{
					"type": "doctype",
					"name": "Zakaah Calculation Run",
					"label": _("Calculation Runs"),
					"description": _("Zakaah calculation runs by year")
				},
				{
					"type": "doctype",
					"name": "Gold Price",
					"label": _("Gold Prices"),
					"description": _("Manage gold prices for Nisab calculation")
				}
			]
		}
	]



