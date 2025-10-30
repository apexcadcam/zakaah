# Phase 1: Core Zakaah Calculation - Implementation Guide

## Overview

Phase 1 focuses on building the core calculation engine for Zakaah. This includes creating necessary DocTypes, implementing calculation logic, and setting up the basic user interface.

**Duration**: Estimated 2-3 weeks
**Priority**: Critical foundation for the entire system

---

## Objectives

1. Create all required DocTypes for calculation
2. Implement asset calculation logic
3. Implement Nisab (85 grams gold) calculation
4. Build gold price integration
5. Create basic UI for calculation entry
6. Implement multi-currency support
7. Setup configuration system for assets

---

## Step-by-Step Implementation

### Step 1: Create Gold Price DocType

**Purpose**: Store gold prices fetched from API or entered manually

#### 1.1 Create DocType Structure

```bash
cd /path/to/frappe-bench
bench new-doctype "Gold Price" zakaah
```

#### 1.2 Define JSON Schema

File: `zakaah/zakaah_management/doctype/gold_price/gold_price.json`

```json
{
 "doctype": "DocType",
 "module": "zakaah_management",
 "name": "Gold Price",
 "title": "Gold Price",
 "is_submittable": 0,
 "is_child_table": 0,
 "track_changes": 1,
 "track_seen": 1,
 "autoname": "naming_series",
 "fields": [
  {
   "fieldname": "naming_series",
   "label": "ID",
   "fieldtype": "Select",
   "options": "GOLD-.YYYY.-"
  },
  {
   "fieldname": "price_date",
   "label": "Price Date",
   "fieldtype": "Date",
   "required": 1,
   "unique": 1
  },
  {
   "fieldname": "currency",
   "label": "Currency",
   "fieldtype": "Select",
   "options": "EGP",
   "default": "EGP",
   "required": 1
  },
  {
   "fieldname": "price_per_gram_24k",
   "label": "Price per Gram (24K)",
   "fieldtype": "Currency",
   "required": 1,
   "precision": 2
  },
  {
   "fieldname": "source",
   "label": "Source",
   "fieldtype": "Data",
   "default": "API"
  },
  {
   "fieldname": "api_response",
   "label": "API Response",
   "fieldtype": "JSON"
  }
 ],
 "permissions": [
  {
   "role": "System Manager",
   "read": 1,
   "write": 1,
   "create": 1,
   "delete": 1
  },
  {
   "role": "Zakaah Manager",
   "read": 1,
   "write": 1,
   "create": 1
  }
 ]
}
```

#### 1.3 Python Implementation

File: `zakaah/zakaah_management/doctype/gold_price/gold_price.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe.model.document import Document
import frappe
import requests

class GoldPrice(Document):
    def validate(self):
        # Auto-fetch gold price if not set and date is today
        if not self.price_per_gram_24k and self.price_date == frappe.utils.today():
            self.fetch_gold_price()
    
    def fetch_gold_price(self):
        """Fetch gold price from API"""
        try:
            # Try to get from cache first
            existing = frappe.db.exists("Gold Price", {"price_date": self.price_date})
            if existing:
                cached_price = frappe.db.get_value("Gold Price", existing, "price_per_gram_24k")
                self.price_per_gram_24k = cached_price
                self.source = "Cache"
                return
            
            # Fetch from API
            api_key = frappe.conf.get("gold_api_key") or "YOUR_API_KEY"
            url = "https://api.metals-api.com/v1/latest"
            params = {
                "base": "XAU",
                "currencies": "EGP",
                "access_key": api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                price_per_ounce = data['rates']['EGP']
                # Convert to price per gram (1 ounce = 31.1035 grams)
                self.price_per_gram_24k = price_per_ounce / 31.1035
                self.source = "metals-api.com"
                self.api_response = frappe.as_json(data)
            else:
                # Fallback to default price
                self.price_per_gram_24k = 2500
                self.source = "Default"
                
        except Exception as e:
            frappe.log_error(f"Error fetching gold price: {str(e)}")
            # Fallback to default
            self.price_per_gram_24k = 2500
            self.source = "Default/Error"

@frappe.whitelist()
def get_gold_price_for_date(date):
    """Get gold price for a specific date"""
    # Check if exists in DB
    existing = frappe.db.exists("Gold Price", {"price_date": date})
    if existing:
        return frappe.db.get_value("Gold Price", existing, "price_per_gram_24k")
    
    # Try to fetch
    doc = frappe.get_doc({
        "doctype": "Gold Price",
        "price_date": date,
        "currency": "EGP"
    })
    doc.insert()
    return doc.price_per_gram_24k
```

#### 1.4 JavaScript Client Script

File: `zakaah/zakaah_management/doctype/gold_price/gold_price.js`

```javascript
frappe.ui.form.on("Gold Price", {
    refresh(frm) {
        // Add button to fetch current price
        if (frm.is_new()) {
            frm.add_custom_button(__("Fetch Current Price"), function() {
                fetch_current_gold_price(frm);
            });
        }
    }
});

function fetch_current_gold_price(frm) {
    frappe.call({
        method: 'zakaah.zakaah_management.doctype.gold_price.gold_price.get_gold_price_for_date',
        args: {
            date: frappe.datetime.get_today()
        },
        callback: function(r) {
            if (r.message) {
                frm.set_value('price_per_gram_24k', r.message);
                frm.save();
            }
        }
    });
}
```

---

### Step 2: Create Zakaah Assets Configuration (Singleton)

**Purpose**: Configure which accounts to use for Zakaah calculation

#### 2.1 Create DocType

```bash
bench new-doctype "Zakaah Assets Configuration" zakaah
```

#### 2.2 Define JSON Schema

File: `zakaah/zakaah_management/doctype/zakaah_assets_configuration/zakaah_assets_configuration.json`

```json
{
 "doctype": "DocType",
 "module": "zakaah_management",
 "name": "Zakaah Assets Configuration",
 "title": "Zakaah Assets Configuration",
 "is_submittable": 0,
 "is_single": 1,
 "track_changes": 1,
 "fields": [
  {
   "fieldname": "company",
   "label": "Company",
   "fieldtype": "Link",
   "options": "Company",
   "reqd": 1
  },
  {
   "fieldname": "section_cash",
   "label": "Cash Accounts",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "cash_accounts",
   "label": "Cash Accounts",
   "fieldtype": "Table",
   "options": "Zakaah Account Configuration"
  },
  {
   "fieldname": "section_inventory",
   "label": "Inventory Accounts",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "inventory_accounts",
   "label": "Inventory Accounts",
   "fieldtype": "Table",
   "options": "Zakaah Account Configuration"
  },
  {
   "fieldname": "section_receivables",
   "label": "Receivable Accounts",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "receivable_accounts",
   "label": "Receivable Accounts",
   "fieldtype": "Table",
   "options": "Zakaah Account Configuration"
  },
  {
   "fieldname": "section_payables",
   "label": "Payable Accounts",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "payable_accounts",
   "label": "Payable Accounts",
   "fieldtype": "Table",
   "options": "Zakaah Account Configuration"
  },
  {
   "fieldname": "section_reserves",
   "label": "Reserve Accounts",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "reserve_accounts",
   "label": "Reserve Accounts",
   "fieldtype": "Table",
   "options": "Zakaah Account Configuration"
  }
 ],
 "permissions": [
  {
   "role": "System Manager",
   "read": 1,
   "write": 1
  },
  {
   "role": "Zakaah Manager",
   "read": 1,
   "write": 1
  }
 ]
}
```

#### 2.3 Create Child Table for Account Configuration

Create `Zakaah Account Configuration` child table with these fields:
- account (Link to Account) *
- calculation_method (Select: Account Balance | Stock Ledger)
- debt_type (Select: All | Good | Doubtful | Bad) - for receivables
- include_deposits (Check) - for cash
- notes (Text)

---

### Step 3: Create Zakaah Calculation Run

**Purpose**: Main document for annual Zakaah calculation

#### 3.1 Create DocType

```bash
bench new-doctype "Zakaah Calculation Run" zakaah
```

#### 3.2 Define JSON Schema

File: `zakaah/zakaah_management/doctype/zakaah_calculation_run/zakaah_calculation_run.json`

```json
{
 "doctype": "DocType",
 "module": "zakaah_management",
 "name": "Zakaah Calculation Run",
 "title": "Zakaah Calculation Run",
 "is_submittable": 1,
 "fields": [
  {
   "fieldname": "company",
   "label": "Company",
   "fieldtype": "Link",
   "options": "Company",
   "reqd": 1
  },
  {
   "fieldname": "calendar_type",
   "label": "Calendar Type",
   "fieldtype": "Select",
   "options": "Gregorian\nHijri",
   "reqd": 1,
   "default": "Gregorian"
  },
  {
   "fieldname": "fiscal_year",
   "label": "Fiscal Year",
   "fieldtype": "Data",
   "reqd": 1
  },
  {
   "fieldname": "from_date",
   "label": "From Date",
   "fieldtype": "Date",
   "reqd": 1
  },
  {
   "fieldname": "to_date",
   "label": "To Date",
   "fieldtype": "Date",
   "reqd": 1
  },
  {
   "fieldname": "section_gold",
   "label": "Gold Price Information",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "gold_price_date",
   "label": "Gold Price Date",
   "fieldtype": "Date"
  },
  {
   "fieldname": "gold_price_per_gram_24k",
   "label": "Price per Gram (24K)",
   "fieldtype": "Currency",
   "precision": 2,
   "read_only": 1
  },
  {
   "fieldname": "nisab_value",
   "label": "Nisab Value (85 grams)",
   "fieldtype": "Currency",
   "precision": 2,
   "read_only": 1
  },
  {
   "fieldname": "assets_in_gold_grams",
   "label": "Assets in Gold Grams",
   "fieldtype": "Float",
   "precision": 2,
   "read_only": 1
  },
  {
   "fieldname": "nisab_met",
   "label": "Meets Nisab Requirement",
   "fieldtype": "Check",
   "read_only": 1
  },
  {
   "fieldname": "section_assets",
   "label": "Assets Breakdown",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "cash_balance",
   "label": "Cash Balance",
   "fieldtype": "Currency",
   "read_only": 1
  },
  {
   "fieldname": "inventory_balance",
   "label": "Inventory Balance",
   "fieldtype": "Currency",
   "read_only": 1
  },
  {
   "fieldname": "receivables",
   "label": "Receivables",
   "fieldtype": "Currency",
   "read_only": 1
  },
  {
   "fieldname": "payables",
   "label": "Payables",
   "fieldtype": "Currency",
   "read_only": 1
  },
  {
   "fieldname": "reserves",
   "label": "Reserves",
   "fieldtype": "Currency",
   "read_only": 1
  },
  {
   "fieldname": "total_assets",
   "label": "Total Assets",
   "fieldtype": "Currency",
   "read_only": 1,
   "bold": 1
  },
  {
   "fieldname": "section_zakaah",
   "label": "Zakaah Calculation",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "zakaah_rate",
   "label": "Zakaah Rate (%)",
   "fieldtype": "Percent",
   "default": 2.5,
   "read_only": 1
  },
  {
   "fieldname": "total_zakaah",
   "label": "Total Zakaah",
   "fieldtype": "Currency",
   "read_only": 1,
   "bold": 1
  },
  {
   "fieldname": "paid_zakaah",
   "label": "Paid Zakaah",
   "fieldtype": "Currency",
   "default": 0,
   "read_only": 1
  },
  {
   "fieldname": "outstanding_zakaah",
   "label": "Outstanding Zakaah",
   "fieldtype": "Currency",
   "read_only": 1,
   "bold": 1
  },
  {
   "fieldname": "status",
   "label": "Status",
   "fieldtype": "Select",
   "options": "Draft\nCalculated\nPartially Paid\nPaid\nNot Due",
   "default": "Draft",
   "read_only": 1
  },
  {
   "fieldname": "section_items",
   "label": "Detailed Breakdown",
   "fieldtype": "Section Break"
  },
  {
   "fieldname": "items",
   "label": "Items",
   "fieldtype": "Table",
   "options": "Zakaah Calculation Run Item",
   "cannot_add_rows": 1,
   "cannot_delete_rows": 1
  }
 ],
 "permissions": [
  {
   "role": "System Manager",
   "read": 1,
   "write": 1,
   "create": 1,
   "delete": 1,
   "submit": 1,
   "cancel": 1
  },
  {
   "role": "Zakaah Manager",
   "read": 1,
   "write": 1,
   "create": 1,
   "submit": 1
  },
  {
   "role": "Zakaah Accountant",
   "read": 1,
   "write": 1,
   "create": 1
  }
 ]
}
```

#### 3.3 Python Implementation

File: `zakaah/zakaah_management/doctype/zakaah_calculation_run/zakaah_calculation_run.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe.model.document import Document
import frappe
from frappe import _
from frappe.utils import flt, today

class ZakaahCalculationRun(Document):
    def validate(self):
        if not self.status:
            self.status = "Draft"
        
        # Validate dates
        if self.from_date and self.to_date:
            if self.from_date >= self.to_date:
                frappe.throw(_("From Date must be before To Date"))
    
    def on_submit(self):
        """Calculate Zakaah when submitted"""
        if self.status == "Draft":
            self.calculate_zakaah()
            self.status = "Calculated"
    
    def calculate_zakaah(self):
        """Main calculation method"""
        # Get assets configuration
        config = get_zakaah_assets_config(self.company)
        
        # Calculate all assets
        assets = self.calculate_assets(config)
        
        # Get gold price
        gold_info = self.get_gold_price_info()
        
        # Calculate Nisab and Zakaah
        zakaah_info = self.calculate_nisab_and_zakaah(assets['total_in_egp'], gold_info['price'])
        
        # Update fields
        self.update_asset_fields(assets)
        self.update_gold_fields(gold_info, zakaah_info)
        self.update_zakaah_fields(zakaah_info)
        
        # Create items
        self.create_items(assets, config)
        
        # Update outstanding
        self.outstanding_zakaah = self.total_zakaah - self.paid_zakaah
    
    def calculate_assets(self, config):
        """Calculate all assets based on configuration"""
        assets = {
            'cash': 0,
            'inventory': 0,
            'receivables': 0,
            'payables': 0,
            'reserves': 0,
            'currencies': {}
        }
        
        # Cash accounts
        for row in config.get('cash_accounts', []):
            balance = get_account_balance(row.account, self.to_date)
            if row.get('include_deposits'):
                balance += get_bank_deposits(row.account, self.to_date)
            assets['cash'] += balance
        
        # Inventory accounts
        for row in config.get('inventory_accounts', []):
            if row.get('calculation_method') == 'Stock Ledger':
                balance = calculate_stock_balance(row.account, self.to_date, self.company)
            else:
                balance = get_account_balance(row.account, self.to_date)
            assets['inventory'] += balance
        
        # Receivables
        for row in config.get('receivable_accounts', []):
            debt_type = row.get('debt_type', 'All')
            balance = get_receivables_by_type(row.account, self.to_date, debt_type)
            assets['receivables'] += balance
        
        # Payables (deducted)
        for row in config.get('payable_accounts', []):
            balance = get_account_balance(row.account, self.to_date)
            assets['payables'] += balance
        
        # Reserves
        for row in config.get('reserve_accounts', []):
            balance = get_account_balance(row.account, self.to_date)
            assets['reserves'] += balance
        
        # Calculate total
        assets['total_in_egp'] = (
            assets['cash'] + 
            assets['inventory'] + 
            assets['receivables'] - 
            assets['payables'] + 
            assets['reserves']
        )
        
        return assets
    
    def get_gold_price_info(self):
        """Get gold price for calculation date"""
        price = frappe.db.get_value("Gold Price", 
                                   {"price_date": self.to_date}, 
                                   "price_per_gram_24k")
        
        if not price:
            # Try to fetch it
            from zakaah.zakaah_management.doctype.gold_price.gold_price import get_gold_price_for_date
            price = get_gold_price_for_date(self.to_date)
        
        return {
            'date': self.to_date,
            'price': price or 2500
        }
    
    def calculate_nisab_and_zakaah(self, total_assets, gold_price):
        """Calculate Nisab and Zakaah amount"""
        nisab_value = 85 * gold_price
        assets_in_gold = total_assets / gold_price
        meets_nisab = assets_in_gold >= 85
        
        if meets_nisab:
            zakaah_amount = total_assets * 0.025
            status = "Due"
        else:
            zakaah_amount = 0
            status = "Not Due"
        
        return {
            'nisab_value': nisab_value,
            'assets_in_gold_grams': assets_in_gold,
            'meets_nisab': meets_nisab,
            'zakaah_amount': zakaah_amount,
            'status': status
        }
    
    def update_asset_fields(self, assets):
        self.cash_balance = assets['cash']
        self.inventory_balance = assets['inventory']
        self.receivables = assets['receivables']
        self.payables = assets['payables']
        self.reserves = assets.get('reserves', 0)
        self.total_assets = assets['total_in_egp']
    
    def update_gold_fields(self, gold_info, zakaah_info):
        self.gold_price_date = gold_info['date']
        self.gold_price_per_gram_24k = gold_info['price']
        self.nisab_value = zakaah_info['nisab_value']
        self.assets_in_gold_grams = zakaah_info['assets_in_gold_grams']
        self.nisab_met = zakaah_info['meets_nisab']
    
    def update_zakaah_fields(self, zakaah_info):
        self.total_zakaah = zakaah_info['zakaah_amount']
        self.outstanding_zakaah = zakaah_info['zakaah_amount']
        if self.nisab_met:
            self.status = "Calculated"
        else:
            self.status = "Not Due"
    
    def create_items(self, assets, config):
        """Create detailed items"""
        self.clear_table('items')
        
        # Add cash items
        for row in config.get('cash_accounts', []):
            balance = get_account_balance(row.account, self.to_date)
            if balance > 0:
                item = self.append('items')
                item.asset_category = "Cash"
                item.account = row.account
                item.balance = balance
                item.currency = "EGP"
                item.notes = row.get('notes', '')
        
        # Add inventory items
        for row in config.get('inventory_accounts', []):
            if row.get('calculation_method') == 'Stock Ledger':
                balance = calculate_stock_balance(row.account, self.to_date, self.company)
            else:
                balance = get_account_balance(row.account, self.to_date)
            if balance > 0:
                item = self.append('items')
                item.asset_category = "Inventory"
                item.account = row.account
                item.balance = balance
                item.currency = "EGP"
                item.notes = row.get('notes', '')
        
        # Similar for receivables, payables, reserves...

# Helper functions
def get_zakaah_assets_config(company):
    """Get assets configuration for company"""
    config_doc = frappe.get_doc("Zakaah Assets Configuration")
    return {
        'cash_accounts': config_doc.cash_accounts,
        'inventory_accounts': config_doc.inventory_accounts,
        'receivable_accounts': config_doc.receivable_accounts,
        'payable_accounts': config_doc.payable_accounts,
        'reserve_accounts': config_doc.reserve_accounts
    }

def get_account_balance(account, date):
    """Get account balance as of date"""
    balance = frappe.db.get_value("Account", account, "account_currency")
    
    # Get balance from GL entry
    balance_data = frappe.db.sql("""
        SELECT 
            SUM(CASE WHEN gle.debit > 0 THEN gle.debit ELSE 0 END) as debit,
            SUM(CASE WHEN gle.credit > 0 THEN gle.credit ELSE 0 END) as credit
        FROM `tabGL Entry` gle
        WHERE gle.account = %s
        AND gle.posting_date <= %s
        AND gle.is_cancelled = 0
    """, (account, date), as_dict=True)
    
    if balance_data and balance_data[0]:
        return (balance_data[0].debit or 0) - (balance_data[0].credit or 0)
    return 0

def calculate_stock_balance(account, to_date, company):
    """Calculate inventory from Stock Ledger"""
    # Implementation for stock ledger calculation
    balance = frappe.db.sql("""
        SELECT 
            SUM(sle.actual_qty * sle.valuation_rate) as total_value
        FROM `tabStock Ledger Entry` sle
        WHERE sle.company = %s
        AND sle.posting_date <= %s
        AND sle.docstatus = 1
        GROUP BY sle.item_code
        HAVING SUM(sle.actual_qty) > 0
    """, (company, to_date), as_dict=True)
    
    return sum([row.total_value or 0 for row in balance])

def get_receivables_by_type(account, date, debt_type):
    """Get receivables filtered by type"""
    # Implementation for debt type filtering
    balance = get_account_balance(account, date)
    
    if debt_type == "All":
        return balance
    elif debt_type == "Good":
        # Only include good debts
        return balance * 1.0
    elif debt_type == "Doubtful":
        # Include with percentage
        return balance * 0.7
    else:  # Bad
        return 0
    
    return 0

def get_bank_deposits(account, date):
    """Get bank deposits"""
    # Implementation for bank deposits
    return 0  # Placeholder
```

---

## Testing Phase 1

### Test Cases

1. **Create Gold Price Record**
   - Manually enter price
   - Auto-fetch from API
   - Validate date uniqueness

2. **Configure Assets**
   - Set up cash accounts
   - Set up inventory accounts
   - Configure receivables

3. **Run Calculation**
   - Enter dates
   - Submit calculation
   - Verify calculated amounts
   - Check Nisab status

### Expected Results

- Gold prices can be stored and retrieved
- Assets configuration can be set up
- Calculation runs produce correct results
- Nisab validation works correctly
- Multi-currency conversion works

---

## Next Steps After Phase 1

1. Move to Phase 2: Payment tracking and reconciliation
2. Implement Zakaah Payments enhancements
3. Build allocation history system
4. Create reports and dashboards

---

**Status**: Planning
**Estimated Completion**: 2-3 weeks
**Priority**: High
