// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on("Zakaah Payments", {
	refresh(frm) {
		// Store original journal entries for filtering
		if (!frm.doc.__original_journal_entries && frm.doc.journal_entries) {
			frm.doc.__original_journal_entries = JSON.parse(JSON.stringify(frm.doc.journal_entries));
		}

		// Add custom sorting buttons to grid
		frm.fields_dict.journal_entries.grid.wrapper.find('.grid-heading-row').off('click').on('click', function(e) {
			let $target = $(e.target);
			let field = $target.data('fieldname');

			if (field && ['posting_date', 'debit', 'credit', 'balance'].includes(field)) {
				frm.trigger('sort_journal_entries', field);
			}
		});
	},

	onload(frm) {
		// Store original journal entries on load
		if (frm.doc.journal_entries) {
			frm.doc.__original_journal_entries = JSON.parse(JSON.stringify(frm.doc.journal_entries));
		}
	},

	import_journal_entries(frm) {
		// Check if company is selected
		if (!frm.doc.company) {
			frappe.msgprint(__('Please select a Company first'));
			return;
		}

		// Check if accounts are selected
		if (!frm.doc.zakaah_accounts || frm.doc.zakaah_accounts.length === 0) {
			frappe.msgprint(__('Please add Zakaah Accounts first before importing Journal Entries'));
			return;
		}

		// Get list of selected accounts
		let selected_accounts = frm.doc.zakaah_accounts.map(row => row.account).filter(Boolean);

		if (selected_accounts.length === 0) {
			frappe.msgprint(__('Please select accounts in the Zakaah Accounts table'));
			return;
		}

		// Open dialog to select date range
		let d = new frappe.ui.Dialog({
			title: __('Import Journal Entries'),
			fields: [
				{
					label: __('From Date'),
					fieldname: 'from_date',
					fieldtype: 'Date',
					reqd: 1,
					default: frappe.datetime.add_months(frappe.datetime.get_today(), -12)
				},
				{
					label: __('To Date'),
					fieldname: 'to_date',
					fieldtype: 'Date',
					reqd: 1,
					default: frappe.datetime.get_today()
				},
				{
					fieldname: 'column_break',
					fieldtype: 'Column Break'
				},
				{
					label: __('Company'),
					fieldname: 'company',
					fieldtype: 'Link',
					options: 'Company',
					default: frm.doc.company,
					read_only: 1
				}
			],
			primary_action_label: __('Import'),
			primary_action(values) {
				d.hide();
				frappe.show_alert({
					message: __('Importing data, please wait...'),
					indicator: 'blue'
				});

				// Call server-side method
				frappe.call({
					method: 'zakaah.zakaah_management.doctype.zakaah_payments.zakaah_payments.import_journal_entries',
					args: {
						company: frm.doc.company,
						from_date: values.from_date,
						to_date: values.to_date,
						selected_accounts: selected_accounts
					},
					callback: function(r) {
						if (r.message) {
							let account_balances = r.message.account_balances;
							let total_entries = r.message.total_entries;
							let journal_entry_records = r.message.journal_entry_records;

							// Update balances in the zakaah_accounts table
							frm.doc.zakaah_accounts.forEach(function(row) {
								if (account_balances[row.account] !== undefined) {
									row.balance = account_balances[row.account];
								}
							});

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
								});
							}

							frm.refresh_field('zakaah_accounts');
							frm.refresh_field('journal_entries');
							frm.trigger('calculate_total');

							// Store original entries for filtering
							frm.doc.__original_journal_entries = JSON.parse(JSON.stringify(frm.doc.journal_entries));

							frappe.show_alert({
								message: __('Imported {0} records from {1} Journal Entries', [journal_entry_records.length, total_entries]),
								indicator: 'green'
							}, 5);

							// Save the document to persist the imported data
							frm.save();
						}
					},
					error: function(r) {
						frappe.show_alert({
							message: __('Error importing data'),
							indicator: 'red'
						});
					}
				});
			}
		});

		d.show();
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

	apply_filters(frm) {
		if (!frm.doc.__original_journal_entries || frm.doc.__original_journal_entries.length === 0) {
			frappe.msgprint(__('No journal entries to filter. Please import data first.'));
			return;
		}

		let filtered_entries = frm.doc.__original_journal_entries.filter(row => {
			// Filter by date range
			if (frm.doc.filter_from_date && row.posting_date < frm.doc.filter_from_date) {
				return false;
			}
			if (frm.doc.filter_to_date && row.posting_date > frm.doc.filter_to_date) {
				return false;
			}

			// Filter by journal entry
			if (frm.doc.filter_journal_entry && row.journal_entry !== frm.doc.filter_journal_entry) {
				return false;
			}

			// Search in remarks
			if (frm.doc.search_remarks && row.remarks) {
				if (!row.remarks.toLowerCase().includes(frm.doc.search_remarks.toLowerCase())) {
					return false;
				}
			}

			return true;
		});

		// Clear and repopulate table
		frm.clear_table('journal_entries');
		filtered_entries.forEach(entry => {
			let row = frm.add_child('journal_entries');
			Object.assign(row, entry);
		});

		frm.refresh_field('journal_entries');

		frappe.show_alert({
			message: __('Filtered: {0} of {1} entries', [filtered_entries.length, frm.doc.__original_journal_entries.length]),
			indicator: 'blue'
		}, 3);
	},

	clear_filters(frm) {
		// Clear filter fields
		frm.set_value('filter_from_date', '');
		frm.set_value('filter_to_date', '');
		frm.set_value('filter_journal_entry', '');
		frm.set_value('search_remarks', '');

		// Restore original entries
		if (frm.doc.__original_journal_entries) {
			frm.clear_table('journal_entries');
			frm.doc.__original_journal_entries.forEach(entry => {
				let row = frm.add_child('journal_entries');
				Object.assign(row, entry);
			});
			frm.refresh_field('journal_entries');

			frappe.show_alert({
				message: __('Filters cleared'),
				indicator: 'green'
			}, 2);
		}
	},

	sort_journal_entries(frm, field) {
		if (!frm.doc.journal_entries || frm.doc.journal_entries.length === 0) {
			return;
		}

		// Toggle sort direction
		frm.__sort_direction = frm.__sort_direction || {};
		frm.__sort_direction[field] = !frm.__sort_direction[field];
		let ascending = frm.__sort_direction[field];

		// Sort the entries
		frm.doc.journal_entries.sort((a, b) => {
			let val_a = a[field];
			let val_b = b[field];

			if (field === 'posting_date') {
				val_a = new Date(val_a);
				val_b = new Date(val_b);
			}

			if (val_a < val_b) return ascending ? -1 : 1;
			if (val_a > val_b) return ascending ? 1 : -1;
			return 0;
		});

		frm.refresh_field('journal_entries');

		frappe.show_alert({
			message: __('Sorted by {0} ({1})', [field, ascending ? 'Ascending' : 'Descending']),
			indicator: 'blue'
		}, 2);
	},

	export_to_excel(frm) {
		if (!frm.doc.journal_entries || frm.doc.journal_entries.length === 0) {
			frappe.msgprint(__('No journal entries to export'));
			return;
		}

		// Prepare data for export
		let data = frm.doc.journal_entries.map(row => {
			return {
				'Posting Date': row.posting_date || '',
				'Journal Entry': row.journal_entry || '',
				'Debit': row.debit || 0,
				'Credit': row.credit || 0,
				'Balance': row.balance || 0,
				'Remarks': row.remarks || ''
			};
		});

		// Create CSV content
		let csv = '';
		let headers = Object.keys(data[0]);
		csv += headers.join(',') + '\n';

		data.forEach(row => {
			let values = headers.map(header => {
				let val = row[header];
				// Escape quotes and wrap in quotes if contains comma
				if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
					val = '"' + val.replace(/"/g, '""') + '"';
				}
				return val;
			});
			csv += values.join(',') + '\n';
		});

		// Download file
		let blob = new Blob([csv], { type: 'text/csv' });
		let url = window.URL.createObjectURL(blob);
		let a = document.createElement('a');
		a.href = url;
		a.download = 'zakaah_journal_entries_' + frappe.datetime.now_datetime().replace(/[\s:]/g, '_') + '.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);

		frappe.show_alert({
			message: __('Exported {0} entries to Excel', [data.length]),
			indicator: 'green'
		}, 3);
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
