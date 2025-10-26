// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.listview_settings['Zakaah Payment Allocation Record'] = {
	onload: function(listview) {
		// Remove the primary action button (Add button)
		listview.page.clear_primary_action();

		// Hide the add button from menu
		listview.page.hide_menu_button();
	},

	// Disable bulk actions
	get_indicator: function(doc) {
		return [__("Allocated"), "green", "docstatus,=,0"];
	}
};
