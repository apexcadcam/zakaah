# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ZakaahPayments(Document):
	def validate(self):
		self.calculate_total_balance()

	def calculate_total_balance(self):
		"""Calculate total balance from zakaah accounts"""
		total = 0
		if self.zakaah_accounts:
			for account in self.zakaah_accounts:
				total += account.balance or 0
		self.total_balance = total


@frappe.whitelist()
def import_journal_entries(company, from_date, to_date, selected_accounts):
	"""
	Import journal entry data for selected accounts within date range
	"""
	import json

	# Parse selected_accounts if it's a string
	if isinstance(selected_accounts, str):
		selected_accounts = json.loads(selected_accounts)

	if not selected_accounts:
		frappe.throw("No accounts selected")

	# Initialize balances dictionary
	account_balances = {acc: 0 for acc in selected_accounts}

	# List to store journal entry records for the table
	journal_entry_records = []

	# Get all journal entries in the date range
	journal_entries = frappe.get_all(
		'Journal Entry',
		filters={
			'docstatus': 1,
			'company': company,
			'posting_date': ['between', [from_date, to_date]]
		},
		fields=['name', 'posting_date', 'remark']
	)

	# Process each journal entry
	running_balance = 0
	for je in journal_entries:
		# Get journal entry accounts
		je_accounts = frappe.get_all(
			'Journal Entry Account',
			filters={
				'parent': je.name,
				'account': ['in', selected_accounts]
			},
			fields=['account', 'debit', 'credit', 'debit_in_account_currency', 'credit_in_account_currency']
		)

		# Calculate totals for this journal entry
		total_debit = 0
		total_credit = 0

		for acc in je_accounts:
			debit = acc.debit_in_account_currency or acc.debit or 0
			credit = acc.credit_in_account_currency or acc.credit or 0

			total_debit += debit
			total_credit += credit

			# Update balances
			account_balances[acc.account] += (debit - credit)

		# Only add to records if there were matching accounts
		if je_accounts:
			running_balance += (total_debit - total_credit)

			journal_entry_records.append({
				'posting_date': je.posting_date,
				'journal_entry': je.name,
				'debit': total_debit,
				'credit': total_credit,
				'balance': running_balance,
				'remarks': je.remark or ''
			})

	return {
		'account_balances': account_balances,
		'total_entries': len(journal_entries),
		'journal_entry_records': journal_entry_records
	}
