// -*- coding: utf-8 -*-
// Copyright (c) 2025, Zakaah Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Zakaah Assets Configuration", {
	refresh(frm) {
		// Add custom buttons
		if (!frm.is_new()) {
			frm.add_custom_button(__("Calculate All Balances"), function() {
				calculate_all_balances(frm);
			});

			frm.add_custom_button(__("Validate Configuration"), function() {
				validate_configuration(frm);
			});
			
			frm.add_custom_button(__("Recalculate Account Adjustments"), function() {
				recalculate_all_zakaah_values(frm, true);
				frappe.show_alert({
					message: __("Account Adjustments recalculated. Please save the form."),
					indicator: "green"
				}, 5);
			});
		}

	// Set helpful messages
	frm.set_intro(__("Configure which accounts to include in Zakaah calculation. Add accounts for each category."), "blue");

	// Make balance fields read-only
	set_balance_fields_readonly(frm);
	
	// Ensure all rows have calculated_zakaah_value set
	recalculate_all_zakaah_values(frm);
	
	// IMPORTANT: If form has accounts and fiscal year is already selected,
	// ensure balances are fetched for the fiscal year (not today's date)
	// This handles the case when user opens an existing form
	if (!frm.is_new() && frm.doc.fiscal_year && has_accounts(frm)) {
		// Check if any balances look like they're from the wrong date
		// If so, auto-recalculate
		setTimeout(() => {
			let needs_recalc = false;
			// Check if we have accounts but balances look stale
			['cash_accounts', 'inventory_accounts', 'receivable_accounts', 'liabilities_accounts', 'reserve_accounts'].forEach(table => {
				if (frm.doc[table] && frm.doc[table].length > 0) {
					frm.doc[table].forEach(row => {
						if (row.account && (!row.calculated_zakaah_value && row.calculated_zakaah_value !== 0)) {
							needs_recalc = true;
						}
					});
				}
			});
			
			if (needs_recalc) {
				frappe.show_alert({
					message: __("Recalculating balances for fiscal year {0}...", [frm.doc.fiscal_year]),
					indicator: "blue"
				}, 3);
				calculate_all_balances(frm);
			}
		}, 1000);
	}
	},

	company(frm) {
		if (frm.doc.company) {
			frappe.show_alert({
				message: __("Company changed. Please review and update account configurations."),
				indicator: "orange"
			}, 5);
		}
	},
	
	fiscal_year(frm) {
		if (frm.doc.fiscal_year && !frm.is_new()) {
			// When fiscal year changes, recalculate all balances for that fiscal year
			frappe.show_alert({
				message: __("Fiscal Year changed. Recalculating all balances and adjustments..."),
				indicator: "blue"
			}, 5);
			
			// Use the Calculate All Balances function which handles fiscal year
			// This will update both Balance and Account Adjustment for all rows
			setTimeout(() => {
				calculate_all_balances(frm);
			}, 500);
		}
	}
});

// Cash Accounts Child Table
frappe.ui.form.on("Zakaah Account Configuration", {
	account: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		// Auto-calculate balance when account is selected
		if (row.account && row.parentfield === 'cash_accounts') {
			calculate_account_balance(frm, row);
		}
	},

	cash_accounts_add: function(frm, cdt, cdn) {
		frappe.show_alert({
			message: __("Select an account to see its current balance"),
			indicator: "blue"
		}, 3);
	},
	
	margin_profit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'cash_accounts' && (row.balance || row.balance === 0)) {
			calculate_zakaah_value(row);
		}
	},
	
	balance: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'cash_accounts') {
			calculate_zakaah_value(row);
		}
	}
});

// Inventory Accounts Child Table
frappe.ui.form.on("Zakaah Account Configuration", {
	account: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.account && row.parentfield === 'inventory_accounts') {
			calculate_account_balance(frm, row);
		}
	},
	
	margin_profit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'inventory_accounts' && (row.balance || row.balance === 0)) {
			calculate_zakaah_value(row);
		}
	},
	
	balance: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'inventory_accounts') {
			calculate_zakaah_value(row);
		}
	}
});

// Receivable Accounts Child Table
frappe.ui.form.on("Zakaah Account Configuration", {
	account: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.account && row.parentfield === 'receivable_accounts') {
			calculate_account_balance(frm, row);
		}
	},
	
	margin_profit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'receivable_accounts' && (row.balance || row.balance === 0)) {
			calculate_zakaah_value(row);
		}
	},
	
	balance: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'receivable_accounts') {
			calculate_zakaah_value(row);
		}
	}
});

// Liability Accounts Child Table
frappe.ui.form.on("Zakaah Account Configuration", {
	account: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.account && row.parentfield === 'liabilities_accounts') {
			calculate_account_balance(frm, row);
		}
	},
	
	margin_profit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'liabilities_accounts' && (row.balance || row.balance === 0)) {
			calculate_zakaah_value(row);
		}
	},
	
	balance: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'liabilities_accounts') {
			calculate_zakaah_value(row);
		}
	}
});

// Reserve Accounts Child Table
frappe.ui.form.on("Zakaah Account Configuration", {
	account: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.account && row.parentfield === 'reserve_accounts') {
			calculate_account_balance(frm, row);
		}
	},
	
	margin_profit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'reserve_accounts' && (row.balance || row.balance === 0)) {
			calculate_zakaah_value(row);
		}
	},
	
	balance: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'reserve_accounts') {
			calculate_zakaah_value(row);
		}
	}
});

// Payment Accounts Child Table
frappe.ui.form.on("Zakaah Account Configuration", {
	account: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.account && row.parentfield === 'payment_accounts') {
			// If fiscal year is selected, use its date range
			if (frm.doc.fiscal_year) {
				frappe.call({
					method: 'frappe.client.get_value',
					args: {
						doctype: 'Fiscal Year',
						filters: { name: frm.doc.fiscal_year },
						fieldname: ['year_start_date', 'year_end_date']
					},
					callback: function(r) {
						if (r.message && r.message.year_end_date) {
							// Use fiscal year range (BETWEEN start and end)
							calculate_payment_account_debit_for_fy_range(frm, row, r.message.year_start_date, r.message.year_end_date);
						} else {
							calculate_payment_account_debit(frm, row);
						}
					}
				});
			} else {
				calculate_payment_account_debit(frm, row);
			}
		}
	},
	
	margin_profit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'payment_accounts' && (row.debit || row.debit === 0)) {
			calculate_zakaah_value_for_payment(row);
		}
	},
	
	debit: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		if (row.parentfield === 'payment_accounts') {
			// For payment accounts, use debit instead of balance
			calculate_zakaah_value_for_payment(row);
		}
	}
});

// Helper Functions

function calculate_account_balance(frm, row) {
	if (!row.account) return;

	// If fiscal year is selected, use fiscal year end date; otherwise use today
	let balance_date = frappe.datetime.get_today();
	
	if (frm.doc.fiscal_year) {
		// Get fiscal year end date
		frappe.call({
			method: 'frappe.client.get_value',
			args: {
				doctype: 'Fiscal Year',
				filters: { name: frm.doc.fiscal_year },
				fieldname: 'year_end_date'
			},
			callback: function(r) {
				if (r.message && r.message.year_end_date) {
					// Use fiscal year end date
					calculate_account_balance_for_date(frm, row, r.message.year_end_date);
				} else {
					// Fallback to today
					calculate_account_balance_for_date(frm, row, balance_date);
				}
			}
		});
	} else {
		// No fiscal year selected, use today
		calculate_account_balance_for_date(frm, row, balance_date);
	}
}

function calculate_zakaah_value(row) {
	if (!row.balance && row.balance !== 0) return;
	
	// If no margin_profit or empty string, set Account Adjustment = Balance
	if (!row.margin_profit || row.margin_profit.toString().trim() === '') {
		frappe.model.set_value(row.doctype, row.name, 'calculated_zakaah_value', row.balance);
		return;
	}
	
	let margin = row.margin_profit.toString().trim();
	let zakaah_value = row.balance;
	
	// Check if it's a percentage (contains % sign)
	if (margin.includes('%')) {
		// Remove % sign and parse
		let percent = parseFloat(margin.replace('%', ''));
		// Apply percentage: Balance × (1 + percent/100)
		// Supports both positive and negative percentages
		zakaah_value = row.balance * (1 + (percent / 100));
	} else {
		// It's a fixed amount (can be positive or negative)
		let amount = parseFloat(margin);
		if (!isNaN(amount)) {
			// Simply add (positive or negative)
			// Even if amount is 0, this will work correctly
			zakaah_value = row.balance + amount;
		}
	}
	
	frappe.model.set_value(row.doctype, row.name, 'calculated_zakaah_value', zakaah_value);
}

function calculate_zakaah_value_for_payment(row) {
	// For payment accounts, use debit instead of balance
	if (!row.debit && row.debit !== 0) return;
	
	// If no margin_profit or empty string, set Account Adjustment = Debit
	if (!row.margin_profit || row.margin_profit.toString().trim() === '') {
		frappe.model.set_value(row.doctype, row.name, 'calculated_zakaah_value', row.debit);
		return;
	}
	
	let margin = row.margin_profit.toString().trim();
	let zakaah_value = row.debit;
	
	// Check if it's a percentage (contains % sign)
	if (margin.includes('%')) {
		// Remove % sign and parse
		let percent = parseFloat(margin.replace('%', ''));
		// Apply percentage: Debit × (1 + percent/100)
		// Supports both positive and negative percentages
		zakaah_value = row.debit * (1 + (percent / 100));
	} else {
		// It's a fixed amount (can be positive or negative)
		let amount = parseFloat(margin);
		if (!isNaN(amount)) {
			// Simply add (positive or negative)
			// Even if amount is 0, this will work correctly
			zakaah_value = row.debit + amount;
		}
	}
	
	frappe.model.set_value(row.doctype, row.name, 'calculated_zakaah_value', zakaah_value);
}

function calculate_account_balance_for_date(frm, row, date) {
	if (!row.account) return;

	frappe.call({
		method: 'erpnext.accounts.utils.get_balance_on',
		args: {
			account: row.account,
			date: date,
			company: frm.doc.company
		},
		callback: function(r) {
			if (r.message !== undefined) {
				frappe.model.set_value(row.doctype, row.name, 'balance', r.message);
				
				// IMPORTANT: Wait for the balance to be set, then recalculate zakaah value
				setTimeout(() => {
					// Update the row object with the latest data
					let updated_row = locals[row.doctype][row.name];
					
					// Calculate zakaah value for all account types (even if margin_profit is 0 or empty)
					if (['cash_accounts', 'inventory_accounts', 'receivable_accounts', 'liabilities_accounts', 'reserve_accounts'].includes(updated_row.parentfield)) {
						calculate_zakaah_value(updated_row);
					}
				}, 100);
			}
		}
	});
}

function calculate_payment_account_debit(frm, row) {
	if (!row.account) return;

	// If fiscal year is selected, use fiscal year date range
	if (frm.doc.fiscal_year) {
		frappe.call({
			method: 'frappe.client.get_value',
			args: {
				doctype: 'Fiscal Year',
				filters: { name: frm.doc.fiscal_year },
				fieldname: ['year_start_date', 'year_end_date']
			},
			callback: function(r) {
				if (r.message && r.message.year_end_date) {
					// Use fiscal year range
					calculate_payment_account_debit_for_fy_range(frm, row, r.message.year_start_date, r.message.year_end_date);
				} else {
					// Fallback to all-time debit
					calculate_payment_account_debit_all_time(frm, row);
				}
			}
		});
	} else {
		// No fiscal year selected, calculate all-time debit
		calculate_payment_account_debit_all_time(frm, row);
	}
}

function calculate_payment_account_debit_all_time(frm, row) {
	if (!row.account) return;

	// For payment accounts, we need GL Entry debit, not balance
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'GL Entry',
			filters: {
				account: row.account,
				company: frm.doc.company
			},
			fields: ['sum(debit) as total_debit'],
		},
		callback: function(r) {
			if (r.message && r.message.length > 0) {
				let debit = r.message[0].total_debit || 0;
				frappe.model.set_value(row.doctype, row.name, 'debit', debit);
				
				// IMPORTANT: Wait for the debit to be set, then recalculate zakaah value
				setTimeout(() => {
					let updated_row = locals[row.doctype][row.name];
					calculate_zakaah_value_for_payment(updated_row);
				}, 100);
				
				frappe.show_alert({
					message: __("Debit amount updated: {0}", [format_currency(debit)]),
					indicator: "green"
				}, 3);
			}
		}
	});
}

function calculate_payment_account_debit_for_date(frm, row, date) {
	if (!row.account) return;

	// For payment accounts, we need GL Entry debit up to the date, not balance
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'GL Entry',
			filters: {
				account: row.account,
				company: frm.doc.company,
				posting_date: ['<=', date]
			},
			fields: ['sum(debit) as total_debit'],
		},
		callback: function(r) {
			if (r.message && r.message.length > 0) {
				let debit = r.message[0].total_debit || 0;
				frappe.model.set_value(row.doctype, row.name, 'debit', debit);
				
				// IMPORTANT: Wait for the debit to be set, then recalculate zakaah value
				setTimeout(() => {
					let updated_row = locals[row.doctype][row.name];
					calculate_zakaah_value_for_payment(updated_row);
				}, 100);
			}
		}
	});
}

function calculate_payment_account_debit_for_fy_range(frm, row, from_date, to_date) {
	if (!row.account) return;

	// For payment accounts, sum debits WITHIN the fiscal year range (BETWEEN)
	// This matches the Python logic: BETWEEN from_date AND to_date
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'GL Entry',
			filters: {
				account: row.account,
				company: frm.doc.company,
				posting_date: ['between', [from_date, to_date]],
				is_cancelled: 0
			},
			fields: ['sum(debit) as total_debit'],
		},
		callback: function(r) {
			if (r.message && r.message.length > 0) {
				let debit = r.message[0].total_debit || 0;
				frappe.model.set_value(row.doctype, row.name, 'debit', debit);
				
				// IMPORTANT: Wait for the debit to be set, then recalculate zakaah value
				setTimeout(() => {
					let updated_row = locals[row.doctype][row.name];
					calculate_zakaah_value_for_payment(updated_row);
				}, 100);
			}
		}
	});
}

function calculate_all_balances(frm) {
	if (!frm.doc.company) {
		frappe.msgprint(__("Please select a company first"));
		return;
	}

	// Check if fiscal year is selected
	if (!frm.doc.fiscal_year) {
		frappe.msgprint(__("Please select a Fiscal Year first"));
		return;
	}

	// Get the fiscal year's start and end dates
	frappe.call({
		method: 'frappe.client.get_value',
		args: {
			doctype: 'Fiscal Year',
			filters: { name: frm.doc.fiscal_year },
			fieldname: ['year_start_date', 'year_end_date']
		},
		callback: function(r) {
			if (r.message && r.message.year_end_date) {
				let fiscal_year_start = r.message.year_start_date;
				let fiscal_year_end = r.message.year_end_date;
				frappe.show_alert({
					message: __("Calculating balances for {0} to {1}...", [
						frappe.datetime.str_to_user(fiscal_year_start),
						frappe.datetime.str_to_user(fiscal_year_end)
					]),
					indicator: "blue"
				});
				calculate_balances_for_date(frm, fiscal_year_start, fiscal_year_end);
			} else {
				frappe.msgprint(__("Could not get fiscal year dates"));
			}
		}
	});
}

function calculate_balances_for_date(frm, fiscal_year_start, fiscal_year_end) {
	let calculated = 0;
	let total = 0;

	// Count total accounts
	['cash_accounts', 'inventory_accounts', 'receivable_accounts',
	 'liabilities_accounts', 'reserve_accounts', 'payment_accounts'].forEach(table => {
		if (frm.doc[table]) {
			total += frm.doc[table].length;
		}
	});

	// Calculate cash accounts
	if (frm.doc.cash_accounts) {
		frm.doc.cash_accounts.forEach(row => {
			if (row.account) {
				calculate_account_balance_for_date(frm, row, fiscal_year_end);
				calculated++;
			}
		});
	}

	// Calculate inventory accounts
	if (frm.doc.inventory_accounts) {
		frm.doc.inventory_accounts.forEach(row => {
			if (row.account) {
				calculate_account_balance_for_date(frm, row, fiscal_year_end);
				calculated++;
			}
		});
	}

	// Calculate receivable accounts
	if (frm.doc.receivable_accounts) {
		frm.doc.receivable_accounts.forEach(row => {
			if (row.account) {
				calculate_account_balance_for_date(frm, row, fiscal_year_end);
				calculated++;
			}
		});
	}

	// Calculate liability accounts
	if (frm.doc.liabilities_accounts) {
		frm.doc.liabilities_accounts.forEach(row => {
			if (row.account) {
				calculate_account_balance_for_date(frm, row, fiscal_year_end);
				calculated++;
			}
		});
	}

	// Calculate reserve accounts
	if (frm.doc.reserve_accounts) {
		frm.doc.reserve_accounts.forEach(row => {
			if (row.account) {
				calculate_account_balance_for_date(frm, row, fiscal_year_end);
				calculated++;
			}
		});
	}

	// Calculate payment accounts (debit) - use fiscal year RANGE
	if (frm.doc.payment_accounts) {
		frm.doc.payment_accounts.forEach(row => {
			if (row.account) {
				calculate_payment_account_debit_for_fy_range(frm, row, fiscal_year_start, fiscal_year_end);
				calculated++;
			}
		});
	}

	setTimeout(() => {
		frappe.show_alert({
			message: __("Calculated balances for {0} of {1} accounts", [calculated, total]),
			indicator: "green"
		}, 5);

		// Refresh all child tables to show updated values
		frm.refresh_fields();
		
		// Extra refresh after a short delay to ensure all async calculations complete
		setTimeout(() => {
			frm.refresh_fields();
		}, 500);
	}, 1500);
}

function validate_configuration(frm) {
	let warnings = [];
	let errors = [];

	// Check if company is set
	if (!frm.doc.company) {
		errors.push(__("Company is not set"));
	}

	// Check if at least one account is configured
	let has_accounts = false;
	['cash_accounts', 'inventory_accounts', 'receivable_accounts',
	 'liabilities_accounts', 'reserve_accounts', 'payment_accounts'].forEach(table => {
		if (frm.doc[table] && frm.doc[table].length > 0) {
			has_accounts = true;
		}
	});

	if (!has_accounts) {
		errors.push(__("No accounts configured. Please add at least one account."));
	}

	// Check for duplicate accounts across tables
	let all_accounts = [];
	['cash_accounts', 'inventory_accounts', 'receivable_accounts',
	 'liabilities_accounts', 'reserve_accounts', 'payment_accounts'].forEach(table => {
		if (frm.doc[table]) {
			frm.doc[table].forEach(row => {
				if (row.account) {
					if (all_accounts.includes(row.account)) {
						warnings.push(__("Account {0} appears in multiple tables", [row.account]));
					}
					all_accounts.push(row.account);
				}
			});
		}
	});

	// Check if payment accounts are configured
	if (!frm.doc.payment_accounts || frm.doc.payment_accounts.length === 0) {
		warnings.push(__("No payment accounts configured. You won't be able to track Zakaah payments."));
	}

	// Display results
	if (errors.length > 0) {
		frappe.msgprint({
			title: __("Configuration Errors"),
			indicator: "red",
			message: errors.join("<br>")
		});
	} else if (warnings.length > 0) {
		frappe.msgprint({
			title: __("Configuration Warnings"),
			indicator: "orange",
			message: warnings.join("<br>")
		});
	} else {
		frappe.msgprint({
			title: __("Configuration Valid"),
			indicator: "green",
			message: __("Your Zakaah assets configuration looks good!")
		});
	}
}

function set_balance_fields_readonly(frm) {
	// Make balance and debit fields read-only as they are auto-calculated
	const all_tables = ['cash_accounts', 'inventory_accounts', 'receivable_accounts', 'liabilities_accounts', 'reserve_accounts', 'payment_accounts'];
	
	all_tables.forEach(table => {
		if (frm.fields_dict[table] && frm.fields_dict[table].grid) {
			frm.fields_dict[table].grid.update_docfield_property('balance', 'read_only', 1);
			frm.fields_dict[table].grid.update_docfield_property('debit', 'read_only', 1);
		}
	});
}

function hide_irrelevant_columns(frm) {
	// Hide 'debit' column from Cash, Inventory, Receivables, Liabilities, and Reserve accounts
	// Hide 'balance' column from Payment accounts

	// For regular accounts (Cash, Inventory, Receivables, Liabilities, Reserves): hide 'debit' column
	const regular_account_tables = ['cash_accounts', 'inventory_accounts', 'receivable_accounts', 'liabilities_accounts', 'reserve_accounts'];

	regular_account_tables.forEach(table => {
		if (frm.fields_dict[table] && frm.fields_dict[table].grid) {
			// Get the docfield and set it to hidden
			let grid = frm.fields_dict[table].grid;
			let debit_field = grid.docfields.find(f => f.fieldname === 'debit');
			if (debit_field) {
				debit_field.hidden = 1;
				debit_field.in_list_view = 0;
			}

			// Remove debit from visible columns
			if (grid.visible_columns) {
				grid.visible_columns = grid.visible_columns.filter(col => col.fieldname !== 'debit');
			}
		}
	});

	// For payment accounts: hide 'balance' column
	if (frm.fields_dict.payment_accounts && frm.fields_dict.payment_accounts.grid) {
		let grid = frm.fields_dict.payment_accounts.grid;
		let balance_field = grid.docfields.find(f => f.fieldname === 'balance');
		if (balance_field) {
			balance_field.hidden = 1;
			balance_field.in_list_view = 0;
		}

		// Remove balance from visible columns
		if (grid.visible_columns) {
			grid.visible_columns = grid.visible_columns.filter(col => col.fieldname !== 'balance');
		}
	}

	// Force refresh all grids
	setTimeout(() => {
		regular_account_tables.forEach(table => {
			if (frm.fields_dict[table] && frm.fields_dict[table].grid) {
				frm.fields_dict[table].grid.refresh();
			}
		});
		if (frm.fields_dict.payment_accounts && frm.fields_dict.payment_accounts.grid) {
			frm.fields_dict.payment_accounts.grid.refresh();
		}
	}, 100);
}

function has_accounts(frm) {
	// Check if form has any accounts configured
	const account_tables = ['cash_accounts', 'inventory_accounts', 'receivable_accounts', 
	                        'liabilities_accounts', 'reserve_accounts', 'payment_accounts'];
	
	for (let table of account_tables) {
		if (frm.doc[table] && frm.doc[table].length > 0) {
			return true;
		}
	}
	return false;
}

function recalculate_all_zakaah_values(frm, force) {
	// Recalculate zakaah values for all rows to ensure calculated_zakaah_value is set
	// force: if true, recalculate even if calculated_zakaah_value exists
	
	const account_tables = ['cash_accounts', 'inventory_accounts', 'receivable_accounts', 'liabilities_accounts', 'reserve_accounts'];
	
	account_tables.forEach(table => {
		if (frm.doc[table]) {
			frm.doc[table].forEach(row => {
				// Recalculate if:
				// 1. Force mode is on, OR
				// 2. Balance exists but calculated_zakaah_value is null/undefined/empty
				if (force || ((row.balance || row.balance === 0) && (row.calculated_zakaah_value === null || row.calculated_zakaah_value === undefined || row.calculated_zakaah_value === ''))) {
					calculate_zakaah_value(row);
				}
			});
		}
	});
	
	// Handle payment accounts separately (uses debit instead of balance)
	if (frm.doc.payment_accounts) {
		frm.doc.payment_accounts.forEach(row => {
			if (force || ((row.debit || row.debit === 0) && (row.calculated_zakaah_value === null || row.calculated_zakaah_value === undefined || row.calculated_zakaah_value === ''))) {
				calculate_zakaah_value_for_payment(row);
			}
		});
	}
	
	// Refresh the form to show updated values
	if (force) {
		frm.refresh_fields();
	}
}
