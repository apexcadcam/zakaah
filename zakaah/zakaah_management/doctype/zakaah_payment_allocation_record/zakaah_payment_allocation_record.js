// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on("Zakaah Payment Allocation Record", {
	refresh(frm) {
		// Disable save button - this is an audit record that should not be edited
		frm.disable_save();

		// Make all fields read-only
		frm.set_df_property('journal_entry', 'read_only', 1);
		frm.set_df_property('zakaah_calculation_run', 'read_only', 1);
		frm.set_df_property('allocated_amount', 'read_only', 1);
		frm.set_df_property('allocation_date', 'read_only', 1);
	}
});
