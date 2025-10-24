# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import frappe
from frappe import _

# App title
app_title = "Zakaah Management"

# App description
app_description = "Zakaah Management System"

# App publisher
app_publisher = "Your Company"

# App email
app_email = "support@yourcompany.com"

# App version
app_version = "1.0.0"

def get_data():
	return [
		{
			"module_name": "Zakaah Management",
			"color": "grey",
			"icon": "octicon octicon-file-directory",
			"type": "module",
			"label": _("Zakaah Management")
		}
	]