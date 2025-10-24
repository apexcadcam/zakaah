// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on("Zakaah Payment", {
	refresh(frm) {
		// Make tables read-only
		if (frm.fields_dict.zakaah_accounts) {
			frm.fields_dict.zakaah_accounts.grid.cannot_add_rows = true;
			frm.fields_dict.zakaah_accounts.grid.cannot_delete_rows = true;
		}
		if (frm.fields_dict.journal_entry_details) {
			frm.fields_dict.journal_entry_details.grid.cannot_add_rows = true;
			frm.fields_dict.journal_entry_details.grid.cannot_delete_rows = true;
		}
	},

	import_journal_entry(frm) {
		// Open dialog to select Journal Entry
		let d = new frappe.ui.Dialog({
			title: 'Import Journal Entry',
			fields: [
				{
					label: 'Journal Entry',
					fieldname: 'journal_entry',
					fieldtype: 'Link',
					options: 'Journal Entry',
					reqd: 1,
					get_query: function() {
						return {
							filters: {
								'docstatus': 1,  // Only submitted journal entries
								'company': frm.doc.company || ''
							}
						};
					}
				}
			],
			size: 'small',
			primary_action_label: 'Import',
			primary_action(values) {
				// Get Journal Entry and import data
				frappe.call({
					method: 'frappe.client.get',
					args: {
						doctype: 'Journal Entry',
						name: values.journal_entry
					},
					callback: function(r) {
						if (r.message) {
							let journal_entry = r.message;

							// Set journal entry reference
							frm.set_value('journal_entry', values.journal_entry);

							// Clear existing tables
							frm.clear_table('journal_entry_details');
							frm.clear_table('zakaah_accounts');

							// Import Journal Entry Details (all data)
							if (journal_entry.accounts && journal_entry.accounts.length > 0) {
								let total_debit = 0;
								let total_credit = 0;

								// Create a map to aggregate accounts
								let account_map = {};

								journal_entry.accounts.forEach(function(account) {
									// Add to journal entry details table (full data)
									let detail = frm.add_child('journal_entry_details');
									detail.account = account.account;
									detail.account_name = account.account_name || '';
									detail.debit = account.debit_in_account_currency || account.debit || 0;
									detail.credit = account.credit_in_account_currency || account.credit || 0;
									detail.party_type = account.party_type || '';
									detail.party = account.party || '';

									total_debit += detail.debit;
									total_credit += detail.credit;

									// Aggregate for zakaah accounts table
									if (!account_map[account.account]) {
										account_map[account.account] = {
											account: account.account,
											account_name: account.account_name || '',
											balance: 0
										};
									}
									account_map[account.account].balance +=
										(account.debit_in_account_currency || account.debit || 0) -
										(account.credit_in_account_currency || account.credit || 0);
								});

								// Populate Zakaah Accounts table with aggregated balances
								let total_balance = 0;
								for (let acc in account_map) {
									let child = frm.add_child('zakaah_accounts');
									child.account = account_map[acc].account;
									child.account_name = account_map[acc].account_name;
									child.balance = account_map[acc].balance;
									total_balance += account_map[acc].balance;
								}

								// Set totals
								frm.set_value('total_amount', total_debit);  // or total_credit, they should be equal
								frm.set_value('total_balance', total_balance);

								// Refresh tables
								frm.refresh_field('journal_entry_details');
								frm.refresh_field('zakaah_accounts');

								frappe.show_alert({
									message: __('Imported Journal Entry with {0} accounts', [journal_entry.accounts.length]),
									indicator: 'green'
								});
							} else {
								frappe.msgprint(__('No accounts found in the selected Journal Entry'));
							}
						}
					}
				});

				d.hide();
			}
		});

		d.show();
	}
});
