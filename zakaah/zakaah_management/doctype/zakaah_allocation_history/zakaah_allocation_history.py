# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe.model.document import Document
import frappe

class ZakaahAllocationHistory(Document):
	def before_insert(self):
		# Set allocated_by to current user
		if not self.allocated_by:
			self.allocated_by = frappe.session.user



