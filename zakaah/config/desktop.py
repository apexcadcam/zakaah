# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe import _

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
					"name": "Gold Price",
					"label": _("Gold Prices"),
					"description": _("Manage gold prices for Nisab calculation")
				},
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
				"name": "Zakaah Payments",
				"label": _("Zakaah Payments"),
				"description": _("Track and reconcile Zakaah payments")
			},
			{
				"type": "doctype",
				"name": "Zakaah Allocation History",
				"label": _("Allocation History"),
				"description": _("View payment allocation history")
			}
		]
	}
]




