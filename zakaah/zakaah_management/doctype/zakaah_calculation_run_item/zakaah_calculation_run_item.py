# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ZakaahCalculationRunItem(Document):
	def validate(self):
		"""Calculate remaining amount"""
		self.remaining_amount = (self.total_zakaah or 0) - (self.allocated_amount or 0)
