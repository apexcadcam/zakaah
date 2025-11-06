# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe.model.document import Document
import frappe
from frappe.utils import getdate

class ZakaahAssetsConfiguration(Document):
    def validate(self):
        """
        Calculate balances and account adjustments for the selected fiscal year.
        This ensures that when the form is saved, all values are correct for the fiscal year.
        
        For each account row:
        1. Fetches the balance as of the fiscal year end date
        2. Calculates the Account Adjustment (calculated_zakaah_value) based on margin_profit:
           - If margin_profit is empty/None: Account Adjustment = Balance
           - If margin_profit contains '%': Account Adjustment = Balance × (1 + percent/100)
           - Otherwise: Account Adjustment = Balance + amount
        """
        if self.company and self.fiscal_year:
            # Get fiscal year dates
            fiscal_year_doc = frappe.get_doc("Fiscal Year", self.fiscal_year)
            balance_date = fiscal_year_doc.year_end_date
            fiscal_year_start = fiscal_year_doc.year_start_date
            fiscal_year_end = fiscal_year_doc.year_end_date
            
            # Calculate balances for all child tables
            self._calculate_balances(balance_date, fiscal_year_start, fiscal_year_end)
    
    def _calculate_balances(self, balance_date, fiscal_year_start, fiscal_year_end):
        """Calculate account balances as of given date"""
        from frappe.utils import flt
        
        # Calculate balances for all account tables
        account_tables = [
            'cash_accounts',
            'inventory_accounts',
            'receivable_accounts',
            'liabilities_accounts',
            'reserve_accounts',
            'payment_accounts'
        ]
        
        for table_name in account_tables:
            if hasattr(self, table_name):
                for row in getattr(self, table_name):
                    if row.account:
                        if table_name == 'payment_accounts':
                            # For payment accounts, calculate Debit from GL Entry
                            # Don't calculate balance - it should not appear
                            debit = self._get_payment_account_debit(
                                row.account, 
                                fiscal_year_start, 
                                fiscal_year_end
                            )
                            row.debit = debit
                            # Calculate zakaah value based on debit
                            row.calculated_zakaah_value = self._calculate_zakaah_value(debit, row.margin_profit)
                            # Don't set balance at all for payment accounts
                        else:
                            # For other accounts, calculate Balance using Trial Balance logic
                            balance = self._get_account_balance(row.account, balance_date)
                            row.balance = balance
                            # Calculate zakaah value based on balance
                            row.calculated_zakaah_value = self._calculate_zakaah_value(balance, row.margin_profit)
    
    def _calculate_zakaah_value(self, base_amount, margin_profit):
        """
        Calculate zakaah value (Account Adjustment) based on margin profit.
        If margin_profit is empty/None, return base_amount.
        If margin_profit contains %, apply percentage.
        Otherwise, add/subtract the fixed amount.
        """
        from frappe.utils import flt
        
        # If no margin_profit or empty string, return base_amount
        if not margin_profit or str(margin_profit).strip() == '':
            return flt(base_amount)
        
        margin = str(margin_profit).strip()
        zakaah_value = flt(base_amount)
        
        # Check if it's a percentage (contains % sign)
        if '%' in margin:
            # Remove % sign and parse
            try:
                percent = flt(margin.replace('%', ''))
                # Apply percentage: base_amount × (1 + percent/100)
                zakaah_value = base_amount * (1 + (percent / 100))
            except:
                # If parsing fails, return base_amount
                zakaah_value = base_amount
        else:
            # It's a fixed amount (can be positive or negative)
            try:
                amount = flt(margin)
                # Simply add (positive or negative)
                zakaah_value = base_amount + amount
            except:
                # If parsing fails, return base_amount
                zakaah_value = base_amount
        
        return flt(zakaah_value)
    
    def _get_account_balance(self, account, date):
        """Get account balance as of date - using Trial Balance logic"""
        try:
            from erpnext.accounts.utils import get_balance_on
            
            # Get balance using ERPNext's built-in function (same as Trial Balance)
            # This respects fiscal year, company, and all ERPNext rules
            balance = get_balance_on(
                account=account,
                date=date,
                company=self.company
            )
            
            # Return absolute value for summation
            return abs(balance or 0)
            
        except Exception as e:
            frappe.log_error(f"Error getting balance for {account}: {str(e)}", "Balance Calculation")
            return 0.0
    
    def _get_payment_account_debit(self, account, from_date, to_date):
        """Get total Debit from GL Entry for payment accounts according to Fiscal Year"""
        try:
            from frappe.utils import flt, getdate
            
            # Ensure dates are date objects
            from_date = getdate(from_date)
            to_date = getdate(to_date)
            
            # Sum all debit amounts from GL Entry for the fiscal year period
            # Payment accounts are always debit side (money paid out)
            debit_result = frappe.db.sql("""
                SELECT 
                    SUM(gle.debit) as total_debit,
                    COUNT(*) as entry_count
                FROM `tabGL Entry` gle
                WHERE gle.account = %(account)s
                    AND gle.company = %(company)s
                    AND gle.posting_date BETWEEN %(from_date)s AND %(to_date)s
                    AND gle.is_cancelled = 0
            """, {
                'account': account,
                'company': self.company,
                'from_date': from_date,
                'to_date': to_date
            }, as_dict=True)
            
            total_debit = flt(debit_result[0].total_debit) if debit_result and debit_result[0] and debit_result[0].total_debit else 0.0
            entry_count = debit_result[0].entry_count if debit_result and debit_result[0] and debit_result[0].entry_count else 0
            
            # If no debit found in date range, check all dates to see what's available
            if total_debit == 0:
                date_range_check = frappe.db.sql("""
                    SELECT 
                        MIN(gle.posting_date) as min_date,
                        MAX(gle.posting_date) as max_date,
                        SUM(gle.debit) as total_all_debit,
                        SUM(ABS(gle.debit - gle.credit)) as net_debit
                    FROM `tabGL Entry` gle
                    WHERE gle.account = %(account)s
                        AND gle.company = %(company)s
                        AND gle.is_cancelled = 0
                """, {
                    'account': account,
                    'company': self.company
                }, as_dict=True)
                
                if date_range_check and date_range_check[0] and date_range_check[0].total_all_debit:
                    # Use short title and detailed message
                    message = (
                        f"Account: {account}\n"
                        f"Company: {self.company}\n"
                        f"Requested: {from_date} to {to_date}\n"
                        f"Available: {date_range_check[0].min_date} to {date_range_check[0].max_date}\n"
                        f"Total Debit (all dates): {date_range_check[0].total_all_debit}\n"
                        f"Net Movement: {date_range_check[0].net_debit}"
                    )
                    frappe.log_error(
                        message,
                        "Payment Account Debit - Date Range Mismatch"
                    )
            
            # Only log for debugging if there's an issue or if needed
            # Removed automatic logging to avoid truncation errors
            
            return total_debit
            
        except Exception as e:
            # Use short title and detailed message
            message = (
                f"Error getting debit for payment account: {account}\n"
                f"Company: {getattr(self, 'company', 'N/A')}\n"
                f"Date Range: {from_date} to {to_date}\n"
                f"Error: {str(e)}"
            )
            frappe.log_error(message, "Payment Account Debit Error")
            return 0.0


