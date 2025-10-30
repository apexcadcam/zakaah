# Phase 2: Payment Tracking & Reconciliation - Implementation Guide

## Overview

Phase 2 focuses on building the payment tracking and reconciliation system for Zakaah. This includes enhancing the existing Zakaah Payments system, implementing unreconciled entries logic, and creating the allocation history tracking mechanism.

**Duration**: Estimated 2-3 weeks  
**Priority**: Critical for payment tracking  
**Dependencies**: Phase 1 (Core Calculation must be complete)

---

## Objectives

1. Enhance existing Zakaah Payments DocType
2. Implement unreconciled entries logic (like Payment Reconciliation)
3. Build allocation history tracking
4. Create payment allocation system
5. Add reconciliation status tracking
6. Implement partial payment handling
7. Build UI for payment management

---

## Step-by-Step Implementation

### Step 1: Enhance Zakaah Payments DocType

**Purpose**: Upgrade existing Zakaah Payments to support reconciliation

#### 1.1 Update JSON Schema

File: `zakaah/zakaah_management/doctype/zakaah_payments/zakaah_payments.json`

Add these fields to existing structure:

```json
{
  "fields": [
   // ... existing fields ...
   
   {
    "fieldname": "reconciliation_status",
    "label": "Reconciliation Status",
    "fieldtype": "Select",
    "options": "Open\nPartial\nReconciled",
    "default": "Open",
    "read_only": 1
   },
   {
    "fieldname": "total_unreconciled",
    "label": "Total Unreconciled Amount",
    "fieldtype": "Currency",
    "read_only": 1
   },
   {
    "fieldname": "total_reconciled",
    "label": "Total Reconciled Amount",
    "fieldtype": "Currency",
    "read_only": 1
   },
   {
    "fieldname": "section_reconciliation_buttons",
    "label": "Reconciliation Actions",
    "fieldtype": "Section Break"
   },
   {
    "fieldname": "btn_get_unreconciled",
    "label": "Get Unreconciled Entries",
    "fieldtype": "Button"
   }
  ]
}
```

#### 1.2 Update Python Backend

File: `zakaah/zakaah_management/doctype/zakaah_payments/zakaah_payments.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe.model.document import Document
import frappe
from frappe import _

class ZakaahPayments(Document):
    def validate(self):
        # Auto-calculate reconciliation status
        self.update_reconciliation_status()
    
    def update_reconciliation_status(self):
        """Update reconciliation status based on allocation"""
        if not self.calculation_runs or len(self.calculation_runs) == 0:
            self.reconciliation_status = "Open"
            return
        
        total_unreconciled = sum([
            (row.outstanding_zakaah or 0) for row in self.calculation_runs
        ])
        
        total_all_journal_amount = sum([
            (row.debit or 0) for row in self.payment_entries
        ])
        
        total_reconciled = total_all_journal_amount - total_unreconciled
        
        self.total_unreconciled = total_unreconciled
        self.total_reconciled = total_reconciled
        
        if total_unreconciled == 0:
            self.reconciliation_status = "Reconciled"
        elif total_unreconciled < total_all_journal_amount:
            self.reconciliation_status = "Partial"
        else:
            self.reconciliation_status = "Open"


@frappe.whitelist()
def get_calculation_runs(show_unreconciled_only=True):
    """Get Zakaah Calculation Runs
    By default: only years with outstanding > 0 (like Payment Reconciliation)
    """
    try:
        if not frappe.db.exists("DocType", "Zakaah Calculation Run"):
            return []
        
        # Base filters
        filters = {}
        if show_unreconciled_only:
            filters["outstanding_zakaah"] = [">", 0]
        
        # Get calculation runs
        runs = frappe.db.get_all(
            "Zakaah Calculation Run",
            filters=filters,
            fields=[
                "name", 
                "hijri_year", 
                "fiscal_year",
                "total_zakaah", 
                "paid_zakaah", 
                "outstanding_zakaah", 
                "status"
            ],
            order_by="hijri_year asc, fiscal_year asc"
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
                    }
                )
                
                run.paid_zakaah = paid_amount
                run.outstanding_zakaah = outstanding
        
        return runs
        
    except Exception as e:
        frappe.log_error(f"Error getting calculation runs: {str(e)}")
        return []


@frappe.whitelist()
def import_journal_entries(company, from_date, to_date, selected_accounts):
    """
    Import ONLY UNRECONCILED journal entries
    Exactly like Payment Reconciliation module
    """
    try:
        # 1. Get ALL journal entries from selected accounts
        all_entries = frappe.db.sql("""
            SELECT 
                je.name as journal_entry,
                je.posting_date,
                je.user_remark as remarks,
                SUM(jea.debit) as debit,
                SUM(jea.credit) as credit
            FROM `tabJournal Entry Account` jea
            INNER JOIN `tabJournal Entry` je ON jea.parent = je.name
            WHERE je.company = %s
            AND je.posting_date BETWEEN %s AND %s
            AND jea.account IN %s
            AND je.docstatus = 1
            GROUP BY je.name
            ORDER BY je.posting_date, je.name
        """, (company, from_date, to_date, tuple(selected_accounts)), as_dict=True)
        
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
        
        # Show alert like Payment Reconciliation
        message = f"Found {len(journal_entry_records)} unreconciled entries"
        if skipped_count > 0:
            message += f". Skipped {skipped_count} already fully allocated."
        
        frappe.show_alert(message, 'blue', 5)
        
        return {"journal_entry_records": journal_entry_records}
        
    except Exception as e:
        frappe.log_error(f"Error importing journal entries: {str(e)}")
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
                    # Create allocation history record
                    allocation_doc = frappe.get_doc({
                        "doctype": "Zakaah Allocation History",
                        "journal_entry": journal_entry_name,
                        "zakaah_calculation_run": run_item.get("zakaah_calculation_run"),
                        "allocated_amount": allocation_amount,
                        "unallocated_amount": original_debit - (allocated_records.count(journal_entry_name) * allocation_amount),
                        "allocation_date": frappe.utils.now()
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
                outstanding = max(0, total_zakaah - paid_amount)
                
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
                })
        
        frappe.db.commit()
        
        return {
            "success": True,
            "allocated_records": allocated_records,
            "summary": allocation_summary
        }
        
    except Exception as e:
        frappe.log_error(f"Error allocating payments: {str(e)}")
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
                "allocation_date"
            ],
            order_by="allocation_date desc, name desc"
        )
        
        return history
        
    except Exception as e:
        frappe.log_error(f"Error getting allocation history: {str(e)}")
        return []


def get_total_allocated_for_run(calculation_run_name):
    """Get total allocated amount for a calculation run"""
    result = frappe.db.sql("""
        SELECT SUM(allocated_amount) as total
        FROM `tabZakaah Allocation History`
        WHERE zakaah_calculation_run = %s
        AND docstatus != 2
    """, calculation_run_name, as_dict=True)
    
    return (result[0].total or 0) if result else 0


@frappe.whitelist()
def get_payment_accounts_from_settings(company):
    """Get payment accounts from Zakaah Settings"""
    try:
        if frappe.db.exists("DocType", "Zakaah Settings"):
            settings = frappe.get_single("Zakaah Settings")
            if hasattr(settings, 'payment_accounts'):
                accounts = frappe.db.get_all(
                    "Zakaah Account Item",
                    filters={
                        "parent": settings.name,
                        "company": company
                    },
                    fields=["account"]
                )
                return accounts
        return []
    except Exception as e:
        frappe.log_error(f"Error getting payment accounts: {str(e)}")
        return []
```

---

### Step 2: Enhance JavaScript Client Script

File: `zakaah/zakaah_management/doctype/zakaah_payments/zakaah_payments.js`

```javascript
frappe.ui.form.on("Zakaah Payments", {
    refresh(frm) {
        // Make tables read-only
        frm.set_df_property("calculation_runs", "cannot_delete_rows", true);
        frm.set_df_property("calculation_runs", "cannot_add_rows", true);
        frm.set_df_property("payment_entries", "cannot_delete_rows", true);
        frm.set_df_property("payment_entries", "cannot_add_rows", true);
        frm.set_df_property("allocation_history", "cannot_delete_rows", true);
        frm.set_df_property("allocation_history", "cannot_add_rows", true);
        
        // Hide checkbox columns
        frm.trigger('hide_select_columns');
        
        // Add buttons
        frm.add_custom_button(__("Get Unreconciled Entries"), function() {
            frm.trigger("load_data");
        });
        
        frm.add_custom_button(__("View Allocation History"), function() {
            frm.trigger("load_allocation_history");
        });
        
        // Show Allocate button only if there's data
        if (frm.doc.calculation_runs && frm.doc.calculation_runs.length > 0 &&
            frm.doc.payment_entries && frm.doc.payment_entries.length > 0) {
            frm.add_custom_button(__("Allocate"), function() {
                frm.trigger("allocate_payments");
            });
        }
    },
    
    onload(frm) {
        // Set default date range
        if (!frm.doc.from_date) {
            frm.set_value('from_date', frappe.datetime.add_months(frappe.datetime.get_today(), -12));
        }
        if (!frm.doc.to_date) {
            frm.set_value('to_date', frappe.datetime.get_today());
        }
        
        // Load allocation history
        frm.trigger("load_allocation_history");
    },
    
    load_data(frm) {
        if (!frm.doc.company) {
            frappe.msgprint(__('Please select a Company first'));
            return;
        }
        
        if (!frm.doc.from_date || !frm.doc.to_date) {
            frappe.msgprint(__('Please select From Date and To Date'));
            return;
        }
        
        frappe.show_alert({
            message: __('Loading data, please wait...'),
            indicator: 'blue'
        });
        
        // Get payment accounts from Settings
        frappe.call({
            method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.get_payment_accounts_from_settings',
            args: { company: frm.doc.company },
            callback: function(r) {
                if (!r.message || r.message.length === 0) {
                    frappe.msgprint(__('No payment accounts found in Zakaah Settings. Please configure payment accounts first.'));
                    return;
                }
                
                let selected_accounts = r.message.map(account => account.account);
                
                // Load calculation runs (unreconciled only)
                frm.trigger('load_calculation_runs');
                
                // Load journal entries (unreconciled only)
                frappe.call({
                    method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.import_journal_entries',
                    args: {
                        company: frm.doc.company,
                        from_date: frm.doc.from_date,
                        to_date: frm.doc.to_date,
                        selected_accounts: selected_accounts
                    },
                    callback: function(r) {
                        if (r.message) {
                            let journal_entry_records = r.message.journal_entry_records;
                            
                            frm.clear_table('payment_entries');
                            
                            if (journal_entry_records && journal_entry_records.length > 0) {
                                journal_entry_records.forEach(function(record) {
                                    let row = frm.add_child('payment_entries');
                                    row.posting_date = record.posting_date;
                                    row.journal_entry = record.journal_entry;
                                    row.debit = record.debit;
                                    row.credit = record.credit;
                                    row.balance = record.balance;
                                    row.remarks = record.remarks;
                                    row.allocated_amount = record.allocated_amount || 0;
                                    row.unallocated_amount = record.unallocated_amount || record.debit || 0;
                                });
                            }
                            
                            frm.refresh_field('payment_entries');
                            frm.trigger('refresh');
                            
                            frappe.show_alert({
                                message: __('Loaded {0} unreconciled entries', [journal_entry_records ? journal_entry_records.length : 0]),
                                indicator: 'green'
                            }, 5);
                        }
                    }
                });
            }
        });
    },
    
    load_calculation_runs(frm) {
        frappe.call({
            method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.get_calculation_runs',
            args: { show_unreconciled_only: true },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    frm.clear_table('calculation_runs');
                    
                    let total_outstanding = 0;
                    r.message.forEach(run => {
                        let row = frm.add_child('calculation_runs');
                        row.zakaah_calculation_run = run.name;
                        row.fiscal_year = run.fiscal_year || run.hijri_year || '';
                        row.total_zakaah = run.total_zakaah;
                        row.paid_zakaah = run.paid_zakaah || 0;
                        row.outstanding_zakaah = run.outstanding_zakaah || run.total_zakaah;
                        row.status = run.status;
                        
                        total_outstanding += (run.outstanding_zakaah || 0);
                    });
                    
                    frm.refresh_field('calculation_runs');
                    frm.trigger('refresh');
                    
                    if (total_outstanding > 0) {
                        frappe.show_alert({
                            message: __('Found {0} unreconciled year(s) with outstanding: {1}', 
                                    [r.message.length, format_currency(total_outstanding)]),
                            indicator: 'blue'
                        }, 5);
                    }
                } else {
                    frappe.show_alert({
                        message: __('All zakaah years are fully paid'),
                        indicator: 'green'
                    }, 5);
                }
            }
        });
    },
    
    allocate_payments(frm) {
        // Get all runs with outstanding balance
        let selected_runs = frm.doc.calculation_runs.filter(run =>
            (run.outstanding_zakaah || 0) > 0
        );
        
        // Get all unallocated journal entries
        let selected_entries = frm.doc.payment_entries.filter(entry =>
            (entry.unallocated_amount || entry.debit || 0) > 0
        );
        
        if (selected_runs.length === 0) {
            frappe.msgprint(__('No Zakaah Calculation Runs with outstanding balance available'));
            return;
        }
        
        if (selected_entries.length === 0) {
            frappe.msgprint(__('No unallocated Journal Entries available'));
            return;
        }
        
        // Calculate totals for confirmation
        let total_journal_amount = selected_entries.reduce((sum, entry) => 
            sum + (entry.unallocated_amount || entry.debit || 0), 0);
        let total_outstanding = selected_runs.reduce((sum, run) => 
            sum + (run.outstanding_zakaah || 0), 0);
        
        // Build confirmation message
        let message = `<div style="margin-bottom: 15px;">
            <strong>Allocation Summary:</strong><br>
            • Journal Entries: ${selected_entries.length} (Total: ${format_currency(total_journal_amount)})<br>
            • ZCR Records: ${selected_runs.length} (Total Outstanding: ${format_currency(total_outstanding)})<br>
        </div>`;
        
        if (total_journal_amount > total_outstanding) {
            message += `<div style="background-color: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                <strong>⚠️ Note:</strong> Journal entry amount (${format_currency(total_journal_amount)}) exceeds
                total outstanding (${format_currency(total_outstanding)}). Excess amount of
                ${format_currency(total_journal_amount - total_outstanding)} will remain unallocated
                for the next fiscal year.
            </div>`;
        }
        
        message += `<div style="margin-top: 15px;">
            <strong>Do you want to proceed with the allocation?</strong>
        </div>`;
        
        // Confirm allocation
        frappe.confirm(
            message,
            function() {
                frappe.show_alert({
                    message: __('Processing allocation...'),
                    indicator: 'blue'
                });
                
                frappe.call({
                    method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.allocate_payments',
                    args: {
                        calculation_run_items: selected_runs,
                        journal_entries: selected_entries
                    },
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: __('Allocation completed successfully'),
                                indicator: 'green'
                            }, 5);
                            
                            setTimeout(() => {
                                frm.trigger('load_data');
                            }, 2000);
                        } else {
                            frappe.msgprint(__('Allocation failed: {0}', [r.message.message || 'Unknown error']));
                        }
                    }
                });
            }
        );
    },
    
    load_allocation_history(frm) {
        frappe.call({
            method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.get_allocation_history',
            callback: function(r) {
                frm.clear_table('allocation_history');
                
                if (r.message && r.message.length > 0) {
                    r.message.forEach(function(record) {
                        let row = frm.add_child('allocation_history');
                        row.journal_entry = record.journal_entry;
                        row.zakaah_calculation_run = record.zakaah_calculation_run;
                        row.allocated_amount = record.allocated_amount;
                        row.unallocated_amount = record.unallocated_amount;
                        row.allocation_date = record.allocation_date;
                    });
                    
                    frm.refresh_field('allocation_history');
                    frm.trigger('hide_select_columns');
                }
            }
        });
    },
    
    hide_select_columns(frm) {
        // Function to hide checkbox columns
        let hideColumns = () => {
            frm.wrapper.find('th:first-child, td:first-child').each(function() {
                let $cell = $(this);
                if ($cell.find('input[type="checkbox"]').length > 0) {
                    $cell.hide();
                }
            });
            
            frm.wrapper.find('input[type="checkbox"]').closest('th, td').hide();
        };
        
        hideColumns();
        setTimeout(hideColumns, 0);
        setTimeout(hideColumns, 10);
    }
});

function format_currency(amount) {
    return frappe.format(amount, {
        fieldtype: "Currency",
        precision: 2
    });
}
```

---

### Step 3: Update Allocation History DocType

File: `zakaah/zakaah_management/doctype/zakaah_allocation_history/zakaah_allocation_history.json`

Add these fields if not exist:

```json
{
  "fields": [
   // ... existing fields ...
   
   {
    "fieldname": "allocation_date",
    "label": "Allocation Date",
    "fieldtype": "Datetime",
    "default": "now",
    "reqd": 1
   },
   {
    "fieldname": "allocated_by",
    "label": "Allocated By",
    "fieldtype": "Link",
    "options": "User",
    "read_only": 1
   },
   {
    "fieldname": "reconciliation_status",
    "label": "Status",
    "fieldtype": "Select",
    "options": "Draft\nSubmitted\nCancelled"
   }
  ]
}
```

---

## Testing Phase 2

### Test Cases

1. **Load Unreconciled Entries**
   - Only years with outstanding > 0 shown
   - Only unallocated journal entries shown
   - Skipped entries counted correctly

2. **Allocation**
   - Partial allocation works
   - Full allocation works
   - Excess handling works

3. **Status Updates**
   - Outstanding amounts updated after allocation
   - Status changes to Partially Paid/Paid
   - Calculation Run updated correctly

### Expected Results

- Only unreconciled items shown
- Allocation creates history records
- Outstanding amounts update automatically
- Status changes reflect reality
- No duplicate allocations

---

## Next Steps

After Phase 2 completion:
1. Move to Phase 3: Reports and Dashboards
2. Create Zakaah Outstanding Summary report
3. Add visualization charts
4. Create audit trail reports

---

**Status**: Ready to Implement
**Estimated Completion**: 2-3 weeks
**Priority**: High

