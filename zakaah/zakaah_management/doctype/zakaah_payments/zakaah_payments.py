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

	# Get list of already allocated journal entries
	allocated_entries = frappe.get_all(
		'Zakaah Payment Allocation Record',
		fields=['journal_entry'],
		pluck='journal_entry'
	)

	# Process each journal entry
	running_balance = 0
	for je in journal_entries:
		# Skip if already allocated
		if je.name in allocated_entries:
			continue

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


@frappe.whitelist()
def get_unreconciled_payments():
	"""
	Get all unreconciled payments from journal entries
	Returns only entries where reconciled = 0
	"""
	doc = frappe.get_doc('Zakaah Payments', 'Zakaah Payments')

	if not doc.journal_entries:
		frappe.throw("No journal entries found. Please import journal entries first.")

	# Count unreconciled entries
	unreconciled_count = 0
	for entry in doc.journal_entries:
		if not entry.reconciled:
			unreconciled_count += 1

	return {
		'total_entries': len(doc.journal_entries),
		'unreconciled_count': unreconciled_count
	}


@frappe.whitelist()
def get_calculation_runs():
	"""
	Get all Zakaah Calculation Runs for reconciliation
	"""
	runs = frappe.get_all(
		'Zakaah Calculation Run',
		fields=['name', 'hijri_year', 'calculation_date', 'calculated_zakaah', 'paid_zakaah', 'outstanding_zakaah', 'status'],
		order_by='calculation_date desc'
	)

	# Format data for the table
	formatted_runs = []
	for run in runs:
		formatted_runs.append({
			'name': run.name,
			'hijri_year': run.hijri_year,
			'calculation_date': run.calculation_date,
			'total_zakaah': run.calculated_zakaah,
			'paid_zakaah': run.paid_zakaah or 0,
			'outstanding_zakaah': run.outstanding_zakaah or run.calculated_zakaah,
			'status': run.status
		})

	return formatted_runs


@frappe.whitelist()
def allocate_payments(calculation_run_items, journal_entries):
	"""
	Allocate selected journal entries to selected Zakaah Calculation Runs
	"""
	import json

	if isinstance(calculation_run_items, str):
		calculation_run_items = json.loads(calculation_run_items)

	if isinstance(journal_entries, str):
		journal_entries = json.loads(journal_entries)

	if not calculation_run_items:
		frappe.throw("No calculation runs selected")

	if not journal_entries:
		frappe.throw("No journal entries selected")

	# Process allocation - link each selected journal entry to all selected runs
	allocated_count = 0
	total_allocated = 0
	run_allocations = {}  # Track total allocated per run

	# Calculate total amount from selected journal entries
	total_amount = sum([entry.get('debit', 0) for entry in journal_entries])

	# Distribute equally among selected runs
	amount_per_run = total_amount / len(calculation_run_items) if len(calculation_run_items) > 0 else 0

	for run in calculation_run_items:
		run_name = run.get('zakaah_calculation_run')

		if not run_name:
			continue

		# Initialize tracking for this run
		if run_name not in run_allocations:
			run_allocations[run_name] = 0

		# Link journal entries to this run
		for entry in journal_entries:
			entry_name = entry.get('journal_entry')
			if entry_name:
				# Check if this allocation already exists
				existing = frappe.db.exists('Zakaah Payment Allocation Record', {
					'journal_entry': entry_name,
					'zakaah_calculation_run': run_name
				})

				if not existing:
					# Create allocation record
					allocation_doc = frappe.get_doc({
						'doctype': 'Zakaah Payment Allocation Record',
						'journal_entry': entry_name,
						'zakaah_calculation_run': run_name,
						'allocated_amount': entry.get('debit', 0),
						'allocation_date': frappe.utils.today()
					})
					allocation_doc.insert()
					allocated_count += 1

		# Track total allocated to this run
		run_allocations[run_name] = amount_per_run
		total_allocated += amount_per_run

	# Update paid_zakaah and outstanding_zakaah in each Zakaah Calculation Run
	for run_name, allocated_amount in run_allocations.items():
		run_doc = frappe.get_doc('Zakaah Calculation Run', run_name)
		run_doc.paid_zakaah = (run_doc.paid_zakaah or 0) + allocated_amount
		run_doc.outstanding_zakaah = (run_doc.calculated_zakaah or 0) - (run_doc.paid_zakaah or 0)
		run_doc.save()

	frappe.db.commit()

	return {
		'success': True,
		'allocated_count': allocated_count,
		'total_allocated': total_allocated,
		'runs_updated': len(run_allocations)
	}
