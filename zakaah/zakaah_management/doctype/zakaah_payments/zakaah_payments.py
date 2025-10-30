# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe.model.document import Document
import frappe
from frappe import _
from frappe.utils import now

class ZakaahPayments(Document):
	def validate(self):
		# Auto-calculate reconciliation status
		self.update_reconciliation_status()
	
	def update_reconciliation_status(self):
		"""Update reconciliation status based on allocation"""
		if not self.calculation_runs or len(self.calculation_runs) == 0:
			self.reconciliation_status = "Open"
			self.total_unreconciled = 0
			self.total_reconciled = 0
			return
		
		total_unreconciled = sum([
			(row.outstanding_zakaah or 0) for row in self.calculation_runs
		])
		
		total_all_journal_amount = sum([
			(row.debit or 0) for row in self.payment_entries
		])
		
		total_reconciled = max(0, total_all_journal_amount - total_unreconciled)
		
		self.total_unreconciled = total_unreconciled
		self.total_reconciled = total_reconciled
		
		if total_unreconciled == 0:
			self.reconciliation_status = "Reconciled"
		elif total_unreconciled < total_all_journal_amount:
			self.reconciliation_status = "Partial"
		else:
			self.reconciliation_status = "Open"


@frappe.whitelist()
def get_calculation_runs(company=None, show_unreconciled_only=True):
	"""Get Zakaah Calculation Runs
	By default: only years with outstanding > 0 (like Payment Reconciliation)
	"""
	try:
		if not frappe.db.exists("DocType", "Zakaah Calculation Run"):
			return []
		
		# Base filters
		filters = {}
		if company:
			filters["company"] = company
		if show_unreconciled_only:
			filters["outstanding_zakaah"] = [">", 0]
		
		# Get calculation runs
		runs = frappe.db.get_all(
			"Zakaah Calculation Run",
			filters=filters,
			fields=[
				"name", 
				"fiscal_year",
				"total_zakaah", 
				"paid_zakaah", 
				"outstanding_zakaah", 
				"status"
			],
			order_by="fiscal_year asc"
		)
		
		# Update outstanding amounts (recalculate from allocation history)
		for run in runs:
			paid_amount = get_total_allocated_for_run(run.name)
			outstanding = (run.total_zakaah or 0) - paid_amount
			
			# Update if different
			if outstanding != (run.outstanding_zakaah or 0):
				frappe.db.set_value(
					"Zakaah Calculation Run",
					run.name,
					{
						"paid_zakaah": paid_amount,
						"outstanding_zakaah": outstanding
					},
					update_modified=False
				)
				
				run.paid_zakaah = paid_amount
				run.outstanding_zakaah = outstanding
		
		return runs
		
	except Exception as e:
		frappe.log_error(f"Error getting calculation runs: {str(e)}", "Get Calculation Runs")
		return []


@frappe.whitelist()
def import_journal_entries(company, from_date, to_date, selected_accounts):
	"""
	Import ONLY UNRECONCILED journal entries
	Exactly like Payment Reconciliation module
	"""
	try:
		if not selected_accounts or len(selected_accounts) == 0:
			return {
				"journal_entry_records": [],
				"skipped_count": 0
			}
		
		# 1. Get ALL journal entries from selected accounts
		# IMPORTANT: Get debit from GL Entry (not Journal Entry Account)
		# This aligns with Payment Accounts rule (Debit from GL Entry)
		all_entries = frappe.db.sql("""
			SELECT 
				je.name as journal_entry,
				je.posting_date,
				je.user_remark as remarks,
				SUM(gle.debit) as debit,
				SUM(gle.credit) as credit
			FROM `tabJournal Entry` je
			INNER JOIN `tabGL Entry` gle ON gle.voucher_no = je.name
			WHERE je.company = %(company)s
			AND je.posting_date BETWEEN %(from_date)s AND %(to_date)s
			AND gle.account IN %(accounts)s
			AND je.docstatus = 1
			AND gle.is_cancelled = 0
			GROUP BY je.name, je.posting_date, je.user_remark
			ORDER BY je.posting_date, je.name
		""", {
			'company': company,
			'from_date': from_date,
			'to_date': to_date,
			'accounts': tuple(selected_accounts) if isinstance(selected_accounts, list) else (selected_accounts,)
		}, as_dict=True)
		
		# 2. Get already allocated amounts from Allocation History
		already_allocated = frappe.db.sql("""
			SELECT 
				journal_entry,
				SUM(allocated_amount) as total_allocated
			FROM `tabZakaah Allocation History`
			WHERE docstatus != 2
			GROUP BY journal_entry
		""", as_dict=True)
		
		# Create dictionary for quick lookup
		allocated_dict = {
			row.journal_entry: row.total_allocated 
			for row in already_allocated
		}
		
		# 3. Filter: Only unreconciled (unallocated > 0)
		journal_entry_records = []
		skipped_count = 0
		
		for entry in all_entries:
			entry_name = entry.journal_entry
			debit_amount = entry.debit or 0
			
			# Get total allocated for this JE
			total_allocated = allocated_dict.get(entry_name, 0)
			
			# Calculate unallocated amount
			unallocated = debit_amount - total_allocated
			
			# Only add if there's unallocated amount
			if unallocated > 0:
				journal_entry_records.append({
					"journal_entry": entry_name,
					"posting_date": str(entry.posting_date),
					"debit": debit_amount,
					"credit": entry.credit or 0,
					"balance": debit_amount,
					"remarks": entry.remarks or "",
					"allocated_amount": total_allocated,
					"unallocated_amount": unallocated
				})
			else:
				skipped_count += 1
		
		# Return result without showing message (let JS handle it)
		return {
			"journal_entry_records": journal_entry_records,
			"skipped_count": skipped_count
		}
		
	except Exception as e:
		frappe.log_error(f"Error importing journal entries: {str(e)}", "Import Journal Entries")
		return {"journal_entry_records": []}


@frappe.whitelist()
def allocate_payments(calculation_run_items, journal_entries):
	"""
	Allocate journal entries to Zakaah Calculation Runs
	Updates outstanding amounts after allocation
	"""
	try:
		if not frappe.db.exists("DocType", "Zakaah Allocation History"):
			return {"success": False, "message": "Zakaah Allocation History doctype not found"}
		
		allocated_records = []
		allocation_summary = []
		
		# Process each journal entry
		for journal_entry in journal_entries:
			journal_entry_name = journal_entry.get("journal_entry")
			unallocated_amount = journal_entry.get("unallocated_amount") or 0
			original_debit = journal_entry.get("debit") or 0
			
			# Track how much is being allocated in this session
			remaining_to_allocate = unallocated_amount
			
			for run_item in calculation_run_items:
				if (run_item.get("outstanding_zakaah") or 0) <= 0:
					continue
				
				if remaining_to_allocate <= 0:
					break
				
				outstanding = run_item.get("outstanding_zakaah") or 0
				allocation_amount = min(remaining_to_allocate, outstanding)
				
				if allocation_amount > 0:
					# Calculate remaining unallocated after this allocation
					current_allocated = sum([
						r.get("allocated_amount", 0) 
						for r in allocated_records 
						if r.get("journal_entry") == journal_entry_name
					])
					new_unallocated = original_debit - current_allocated - allocation_amount
					
					# Create allocation history record
					allocation_doc = frappe.get_doc({
						"doctype": "Zakaah Allocation History",
						"journal_entry": journal_entry_name,
						"zakaah_calculation_run": run_item.get("zakaah_calculation_run"),
						"allocated_amount": allocation_amount,
						"unallocated_amount": new_unallocated,
						"allocation_date": now(),
						"allocated_by": frappe.session.user
					})
					allocation_doc.insert()
					allocation_doc.submit()
					
					allocated_records.append({
						"journal_entry": journal_entry_name,
						"zakaah_calculation_run": run_item.get("zakaah_calculation_run"),
						"allocated_amount": allocation_amount
					})
					
					remaining_to_allocate -= allocation_amount
			
			if remaining_to_allocate > 0:
				allocation_summary.append({
					"journal_entry": journal_entry_name,
					"still_unallocated": remaining_to_allocate
				})
		
		# Update outstanding amounts in Calculation Runs
		for run_item in calculation_run_items:
			run_name = run_item.get("zakaah_calculation_run")
			if run_name:
				total_zakaah = frappe.db.get_value("Zakaah Calculation Run", run_name, "total_zakaah")
				
				# Recalculate paid amount
				paid_amount = get_total_allocated_for_run(run_name)
				outstanding = max(0, (total_zakaah or 0) - paid_amount)
				
				# Determine status
				if outstanding == 0:
					status = "Paid"
				elif paid_amount > 0:
					status = "Partially Paid"
				else:
					status = "Calculated"
				
				# Update Calculation Run
				frappe.db.set_value("Zakaah Calculation Run", run_name, {
					"paid_zakaah": paid_amount,
					"outstanding_zakaah": outstanding,
					"status": status
				}, update_modified=False)
		
		frappe.db.commit()
		
		return {
			"success": True,
			"allocated_records": allocated_records,
			"summary": allocation_summary
		}
		
	except Exception as e:
		frappe.log_error(f"Error allocating payments: {str(e)}", "Allocate Payments")
		frappe.rollback()
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def get_allocation_history(calculation_run=None, journal_entry=None):
	"""Get allocation history records with filters"""
	try:
		filters = {"docstatus": ["!=", 2]}
		
		if calculation_run:
			filters["zakaah_calculation_run"] = calculation_run
		
		if journal_entry:
			filters["journal_entry"] = journal_entry
		
		history = frappe.db.get_all(
			"Zakaah Allocation History",
			filters=filters,
			fields=[
				"name",
				"journal_entry", 
				"zakaah_calculation_run", 
				"allocated_amount", 
				"unallocated_amount", 
				"allocation_date",
				"allocated_by"
			],
			order_by="allocation_date desc, name desc"
		)
		
		return history
		
	except Exception as e:
		frappe.log_error(f"Error getting allocation history: {str(e)}", "Get Allocation History")
		return []


def get_total_allocated_for_run(calculation_run_name):
	"""Get total allocated amount for a calculation run"""
	try:
		result = frappe.db.sql("""
			SELECT SUM(allocated_amount) as total
			FROM `tabZakaah Allocation History`
			WHERE zakaah_calculation_run = %s
			AND docstatus != 2
		""", calculation_run_name, as_dict=True)
		
		return (result[0].total or 0) if result and result[0] else 0
	except Exception as e:
		frappe.log_error(f"Error getting total allocated: {str(e)}", "Get Total Allocated")
		return 0


@frappe.whitelist()
def get_payment_accounts_from_settings(company):
	"""Get payment accounts from Zakaah Assets Configuration"""
	try:
		# Get payment accounts from Zakaah Assets Configuration
		if not frappe.db.exists("DocType", "Zakaah Assets Configuration"):
			return []
		
		if not company:
			return []
		
		# Find assets configuration for company
		config_name = frappe.db.get_value(
			"Zakaah Assets Configuration",
			{"company": company},
			"name"
		)
		
		if not config_name:
			return []
		
		config_doc = frappe.get_doc("Zakaah Assets Configuration", config_name)
		
		if not config_doc or not hasattr(config_doc, 'payment_accounts') or not config_doc.payment_accounts:
			return []
		
		accounts = []
		for row in config_doc.payment_accounts:
			if row.account:
				accounts.append({
					"account": row.account,
					"account_name": row.account_name or frappe.db.get_value("Account", row.account, "account_name")
				})
		
		return accounts
		
	except Exception as e:
		frappe.log_error(f"Error getting payment accounts: {str(e)}", "Get Payment Accounts")
		return []

