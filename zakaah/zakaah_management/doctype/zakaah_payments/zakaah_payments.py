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

	# Get allocated amounts per journal entry (to handle partial allocations)
	allocated_amounts = frappe.db.sql("""
		SELECT journal_entry, SUM(allocated_amount) as total_allocated
		FROM `tabZakaah Payment Allocation Record`
		GROUP BY journal_entry
	""", as_dict=1)

	# Create a dict for quick lookup
	allocated_dict = {item['journal_entry']: item['total_allocated'] for item in allocated_amounts}

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
			# Check if this JE has been partially or fully allocated
			already_allocated = allocated_dict.get(je.name, 0)
			remaining_amount = total_debit - already_allocated

			# Only include entries that have unallocated amounts
			if remaining_amount > 0.01:  # Account for rounding
				running_balance += (total_debit - total_credit)

				journal_entry_records.append({
					'posting_date': je.posting_date,
					'journal_entry': je.name,
					'debit': total_debit,
					'credit': total_credit,
					'balance': running_balance,
					'remarks': je.remark or '',
					'allocated_amount': already_allocated,
					'unallocated_amount': remaining_amount
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
		# Use outstanding_zakaah if it exists, otherwise calculate it
		# Note: We use 'if run.outstanding_zakaah is not None' to handle 0 values correctly
		outstanding = run.outstanding_zakaah if run.outstanding_zakaah is not None else (run.calculated_zakaah - (run.paid_zakaah or 0))

		formatted_runs.append({
			'name': run.name,
			'hijri_year': run.hijri_year,
			'calculation_date': run.calculation_date,
			'total_zakaah': run.calculated_zakaah,
			'paid_zakaah': run.paid_zakaah or 0,
			'outstanding_zakaah': outstanding,
			'status': run.status
		})

	return formatted_runs


@frappe.whitelist()
def allocate_payments(calculation_run_items, journal_entries):
	"""
	Allocate selected journal entries to selected Zakaah Calculation Runs

	Logic:
	- Allocate journal entry amounts sequentially to ZCR records based on outstanding balance
	- Never exceed the Total Zakaah (calculated_zakaah) amount for each ZCR
	- Once a ZCR outstanding reaches 0, mark it as fully paid
	- If journal entries have excess amounts after paying all ZCRs, keep unallocated for next fiscal year
	- Create allocation records for each journal entry-run pair
	- Update paid_zakaah and outstanding_zakaah accordingly
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

	# Sort calculation runs by date (oldest first) to ensure FIFO allocation
	sorted_runs = sorted(calculation_run_items, key=lambda x: x.get('calculation_date', ''))

	# Process allocation
	allocated_count = 0
	run_allocations = {}  # Track total allocated per run
	entry_allocations = {}  # Track allocated amount per journal entry

	# Calculate total amount available from selected journal entries
	total_amount_available = sum([entry.get('debit', 0) for entry in journal_entries])
	remaining_amount = total_amount_available

	# Get current outstanding for each run
	run_details = {}
	for run in sorted_runs:
		run_name = run.get('zakaah_calculation_run')
		if run_name:
			run_doc = frappe.get_doc('Zakaah Calculation Run', run_name)
			run_details[run_name] = {
				'calculated_zakaah': run_doc.calculated_zakaah or 0,
				'paid_zakaah': run_doc.paid_zakaah or 0,
				'outstanding_zakaah': run_doc.outstanding_zakaah or run_doc.calculated_zakaah or 0
			}
			run_allocations[run_name] = 0

	# Get already allocated amounts for journal entries (to handle re-allocation attempts)
	already_allocated_per_je = frappe.db.sql("""
		SELECT journal_entry, SUM(allocated_amount) as total_allocated
		FROM `tabZakaah Payment Allocation Record`
		GROUP BY journal_entry
	""", as_dict=1)
	je_allocated_dict = {item['journal_entry']: item['total_allocated'] for item in already_allocated_per_je}

	# Sort journal entries by debit amount (smallest first) to allocate completely when possible
	# This ensures smaller amounts are fully allocated before using larger amounts
	sorted_journal_entries = sorted(journal_entries, key=lambda x: x.get('debit', 0))

	# Allocate journal entries sequentially to runs
	for entry in sorted_journal_entries:
		entry_name = entry.get('journal_entry')
		entry_amount = entry.get('debit', 0)

		if not entry_name or entry_amount <= 0:
			continue

		# Check if this entry was already partially allocated
		previously_allocated = je_allocated_dict.get(entry_name, 0)
		entry_remaining = entry_amount - previously_allocated

		# Skip if fully allocated
		if entry_remaining <= 0.01:
			continue

		# Initialize tracking for this entry
		entry_allocations[entry_name] = 0

		# Try to allocate this entry amount across runs (in order)
		for run in sorted_runs:
			run_name = run.get('zakaah_calculation_run')

			if not run_name or entry_remaining <= 0:
				continue

			# Get current outstanding for this run
			current_outstanding = run_details[run_name]['outstanding_zakaah'] - run_allocations[run_name]

			# Only allocate if this run still has outstanding balance
			if current_outstanding > 0:
				# Allocate the minimum of: entry remaining amount OR run outstanding
				amount_to_allocate = min(entry_remaining, current_outstanding)

				# Check if this allocation already exists
				existing = frappe.db.exists('Zakaah Payment Allocation Record', {
					'journal_entry': entry_name,
					'zakaah_calculation_run': run_name
				})

				if not existing:
					# Track allocations first
					run_allocations[run_name] += amount_to_allocate
					entry_allocations[entry_name] += amount_to_allocate
					entry_remaining -= amount_to_allocate
					remaining_amount -= amount_to_allocate

					# Create allocation record with unallocated amount
					allocation_doc = frappe.get_doc({
						'doctype': 'Zakaah Payment Allocation Record',
						'journal_entry': entry_name,
						'zakaah_calculation_run': run_name,
						'allocated_amount': amount_to_allocate,
						'unallocated_amount': entry_remaining,
						'allocation_date': frappe.utils.today()
					})
					allocation_doc.insert()
					allocated_count += 1

		# If entry still has unallocated amount after all runs, it remains unallocated for next fiscal year
		if entry_remaining > 0:
			frappe.msgprint(
				f"Journal Entry {entry_name}: {frappe.utils.fmt_money(entry_remaining)} could not be allocated "
				f"(all selected ZCRs are fully paid). This amount will remain unallocated for the next fiscal year.",
				indicator='orange',
				title='Partial Allocation'
			)

	# Calculate total allocated across all runs
	total_allocated = sum(run_allocations.values())

	# Update paid_zakaah and outstanding_zakaah in each Zakaah Calculation Run
	runs_fully_paid = []
	for run_name, allocated_amount in run_allocations.items():
		if allocated_amount > 0:  # Only update if something was allocated
			run_doc = frappe.get_doc('Zakaah Calculation Run', run_name)
			run_doc.paid_zakaah = (run_doc.paid_zakaah or 0) + allocated_amount
			run_doc.outstanding_zakaah = (run_doc.calculated_zakaah or 0) - (run_doc.paid_zakaah or 0)

			# Ensure outstanding doesn't go negative
			if run_doc.outstanding_zakaah < 0:
				run_doc.outstanding_zakaah = 0

			# Update status based on payment
			if run_doc.outstanding_zakaah <= 0.01:  # Account for rounding
				run_doc.outstanding_zakaah = 0
				run_doc.status = 'Paid'
				runs_fully_paid.append(run_name)
			elif run_doc.paid_zakaah > 0 and run_doc.outstanding_zakaah > 0:
				run_doc.status = 'Partially Paid'

			run_doc.save()

	frappe.db.commit()

	# Prepare success message
	message = f"Successfully allocated {frappe.utils.fmt_money(total_allocated)} across {len(run_allocations)} ZCR record(s)."
	if remaining_amount > 0.01:
		message += f"<br><br>{frappe.utils.fmt_money(remaining_amount)} remains unallocated and will carry forward to the next fiscal year."
	if runs_fully_paid:
		message += f"<br><br>The following ZCR(s) are now fully paid: {', '.join(runs_fully_paid)}"

	frappe.msgprint(message, indicator='green', title='Allocation Complete')

	return {
		'success': True,
		'allocated_count': allocated_count,
		'total_allocated': total_allocated,
		'unallocated_amount': remaining_amount,
		'runs_updated': len([a for a in run_allocations.values() if a > 0]),
		'runs_fully_paid': runs_fully_paid
	}


