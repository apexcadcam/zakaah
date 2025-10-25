// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on("Zakaah Payments", {
	refresh(frm) {
		// Remove standard save button
		frm.disable_save();

		// Make tables read-only (cannot add/delete rows manually)
		frm.set_df_property("reconciliation_table", "cannot_delete_rows", true);
		frm.set_df_property("reconciliation_table", "cannot_add_rows", true);
		frm.set_df_property("journal_entries", "cannot_delete_rows", true);
		frm.set_df_property("journal_entries", "cannot_add_rows", true);

		// Add "View Allocation History" button
		frm.add_custom_button(__("View Allocation History"), () => {
			frappe.set_route("List", "Zakaah Payment Allocation Record");
		});

		// Add "Get Unreconciled Entries" button
		if (frm.doc.company) {
			frm.add_custom_button(__("Get Unreconciled Entries"), () =>
				frm.trigger("get_unreconciled_payments")
			);
			frm.change_custom_button_type(__("Get Unreconciled Entries"), null, "primary");
		}

		// Add "Allocate" button if there are items loaded in both tables
		if (frm.doc.reconciliation_table && frm.doc.reconciliation_table.length > 0 &&
		    frm.doc.journal_entries && frm.doc.journal_entries.length > 0) {
			frm.add_custom_button(__("Allocate"), () => frm.trigger("allocate_payments"));
			frm.change_custom_button_type(__("Allocate"), null, "primary");
			frm.change_custom_button_type(__("Get Unreconciled Entries"), null, "default");
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
	},

	calculate_total(frm) {
		let total = 0;
		if (frm.doc.zakaah_accounts) {
			frm.doc.zakaah_accounts.forEach(row => {
				total += row.balance || 0;
			});
		}
		frm.set_value('total_balance', total);
	},

	get_unreconciled_payments(frm) {
		if (!frm.doc.from_date || !frm.doc.to_date) {
			frappe.msgprint(__('Please select From Date and To Date'));
			return;
		}

		if (!frm.doc.zakaah_accounts || frm.doc.zakaah_accounts.length === 0) {
			frappe.msgprint(__('Please add Zakaah Accounts first'));
			return;
		}

		let selected_accounts = frm.doc.zakaah_accounts.map(row => row.account).filter(Boolean);

		if (selected_accounts.length === 0) {
			frappe.msgprint(__('Please select accounts in the Zakaah Accounts table'));
			return;
		}

		frappe.show_alert({
			message: __('Loading data, please wait...'),
			indicator: 'blue'
		});

		// Load calculation runs
		frm.trigger('load_calculation_runs');

		// Load journal entries
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

					// Clear existing journal entries
					frm.clear_table('journal_entries');

					// Add journal entry records to the table
					if (journal_entry_records && journal_entry_records.length > 0) {
						journal_entry_records.forEach(function(record) {
							let row = frm.add_child('journal_entries');
							row.posting_date = record.posting_date;
							row.journal_entry = record.journal_entry;
							row.debit = record.debit;
							row.credit = record.credit;
							row.balance = record.balance;
							row.remarks = record.remarks;
							row.selected = 0;
							row.reconciled = record.reconciled || 0;
						});
					}

					frm.refresh_field('journal_entries');

					// Refresh form to show Allocate button
					frm.trigger('refresh');

					frappe.show_alert({
						message: __('Loaded {0} journal entries and calculation runs', [journal_entry_records.length]),
						indicator: 'green'
					}, 5);
				}
			}
		});
	},

	load_calculation_runs(frm) {
		frappe.call({
			method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.get_calculation_runs',
			callback: function(r) {
				if (r.message && r.message.length > 0) {
					// Clear existing table
					frm.clear_table('reconciliation_table');

					// Add calculation runs to table
					r.message.forEach(run => {
						let row = frm.add_child('reconciliation_table');
						row.zakaah_calculation_run = run.name;
						row.fiscal_year = run.hijri_year;
						row.total_zakaah = run.total_zakaah;
						row.paid_zakaah = run.paid_zakaah || 0;
						row.outstanding_zakaah = run.outstanding_zakaah || run.total_zakaah;
						row.selected = 0;
					});

					frm.refresh_field('reconciliation_table');

					// Refresh form to show Allocate button
					frm.trigger('refresh');
				}
			}
		});
	},

	allocate_payments(frm) {
		// Get selected runs (if none selected, use all)
		let selected_runs = frm.fields_dict.reconciliation_table.grid.get_selected_children();
		if (!selected_runs.length) {
			selected_runs = frm.doc.reconciliation_table;
		}

		// Get selected journal entries (if none selected, use all)
		let selected_entries = frm.fields_dict.journal_entries.grid.get_selected_children();
		if (!selected_entries.length) {
			selected_entries = frm.doc.journal_entries;
		}

		if (selected_runs.length === 0) {
			frappe.msgprint(__('No Zakaah Calculation Runs available'));
			return;
		}

		if (selected_entries.length === 0) {
			frappe.msgprint(__('No Journal Entries available'));
			return;
		}

		// Confirm allocation
		frappe.confirm(
			__('This will permanently link {0} journal entries to {1} calculation run(s). Continue?',
				[selected_entries.length, selected_runs.length]),
			function() {
				frappe.call({
					method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.allocate_payments',
					args: {
						calculation_run_items: selected_runs,
						journal_entries: selected_entries
					},
					callback: function(r) {
						if (r.message && r.message.success) {
							frappe.show_alert({
								message: __('Successfully allocated {0} payments to {1} runs',
									[r.message.allocated_count, r.message.runs_updated]),
								indicator: 'green'
							}, 5);

							// Reload the data
							frm.trigger('get_unreconciled_payments');
						}
					}
				});
			}
		);
	}
});

// Recalculate when zakaah_accounts table changes
frappe.ui.form.on("Zakaah Account", {
	balance(frm) {
		frm.trigger('calculate_total');
	},
	zakaah_accounts_remove(frm) {
		frm.trigger('calculate_total');
	}
});
