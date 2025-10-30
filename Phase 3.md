# Phase 3: Reports, Dashboards & Advanced Features - Implementation Guide

## Overview

Phase 3 focuses on building comprehensive reports, dashboards, advanced features, and final polish for the Zakaah Management System. This phase enhances user experience and provides powerful analytical tools.

**Duration**: Estimated 2-3 weeks  
**Priority**: Enhancements and polish  
**Dependencies**: Phase 1 & Phase 2 (Core Calculation and Payment Tracking must be complete)

---

## Objectives

1. Create comprehensive Zakaah reports
2. Build interactive dashboards
3. Implement advanced features (multi-currency, inventory methods)
4. Add data visualization and charts
5. Create audit trail and history reports
6. Build export and printing capabilities
7. Final polish and optimization

---

## Step-by-Step Implementation

### Step 1: Create Zakaah Outstanding Summary Report

**Purpose**: Overview of all outstanding Zakaah amounts by year

#### 1.1 Create Report DocType

```bash
cd /path/to/frappe-bench
bench new-report "Zakaah Outstanding Summary" zakaah
```

#### 1.2 Python Implementation

File: `zakaah/zakaah_management/report/zakaah_outstanding_summary/zakaah_outstanding_summary.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt, getdate

def execute(filters=None):
    """Generate Zakaah Outstanding Summary Report"""
    
    columns = get_columns()
    data = get_data(filters)
    chart = get_chart(data)
    
    return columns, data, None, chart

def get_columns():
    return [
        {"fieldname": "fiscal_year", "label": _("Fiscal Year"), "fieldtype": "Data", "width": 100},
        {"fieldname": "calendar_type", "label": _("Calendar"), "fieldtype": "Data", "width": 80},
        {"fieldname": "total_zakaah", "label": _("Total Zakaah"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "paid_zakaah", "label": _("Paid Zakaah"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "outstanding_zakaah", "label": _("Outstanding"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "paid_percentage", "label": _("Paid %"), "fieldtype": "Percent", "width": 80},
        {"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 100},
        {"fieldname": "calculation_date", "label": _("Calculation Date"), "fieldtype": "Date", "width": 120}
    ]

def get_data(filters):
    """Get data for the report"""
    conditions = get_conditions(filters)
    
    query = """
        SELECT 
            name,
            fiscal_year,
            calendar_type,
            total_zakaah,
            paid_zakaah,
            outstanding_zakaah,
            status,
            to_date as calculation_date,
            company
        FROM `tabZakaah Calculation Run`
        WHERE docstatus = 1
        {conditions}
        ORDER BY fiscal_year DESC, calendar_type DESC
    """.format(conditions=conditions)
    
    data = frappe.db.sql(query, as_dict=True)
    
    # Calculate paid percentage
    for row in data:
        if row.total_zakaah > 0:
            row.paid_percentage = (row.paid_zakaah / row.total_zakaah) * 100
        else:
            row.paid_percentage = 0
    
    return data

def get_conditions(filters):
    """Build WHERE conditions"""
    conditions = []
    
    if filters.get("company"):
        conditions.append("company = '{}'".format(filters.company))
    
    if filters.get("calendar_type"):
        conditions.append("calendar_type = '{}'".format(filters.calendar_type))
    
    if filters.get("show_only_outstanding"):
        conditions.append("outstanding_zakaah > 0")
    
    if filters.get("from_year"):
        conditions.append("fiscal_year >= '{}'".format(filters.from_year))
    
    if filters.get("to_year"):
        conditions.append("fiscal_year <= '{}'".format(filters.to_year))
    
    return " AND " + " AND ".join(conditions) if conditions else ""

def get_chart(data):
    """Generate chart for the report"""
    if not data:
        return None
    
    chart = {
        "type": "bar",
        "data": {
            "labels": [row.fiscal_year for row in data],
            "datasets": [
                {
                    "name": "Total Zakaah",
                    "values": [row.total_zakaah for row in data]
                },
                {
                    "name": "Paid Zakaah",
                    "values": [row.paid_zakaah for row in data]
                },
                {
                    "name": "Outstanding",
                    "values": [row.outstanding_zakaah for row in data]
                }
            ]
        }
    }
    
    return chart
```

#### 1.3 JavaScript for Filters

File: `zakaah/zakaah_management/report/zakaah_outstanding_summary/zakaah_outstanding_summary.js`

```javascript
frappe.query_reports["Zakaah Outstanding Summary"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company")
        },
        {
            "fieldname": "calendar_type",
            "label": __("Calendar Type"),
            "fieldtype": "Select",
            "options": "Gregorian\nHijri",
            "default": "Gregorian"
        },
        {
            "fieldname": "show_only_outstanding",
            "label": __("Show Only Outstanding"),
            "fieldtype": "Check",
            "default": 0
        },
        {
            "fieldname": "from_year",
            "label": __("From Year"),
            "fieldtype": "Data"
        },
        {
            "fieldname": "to_year",
            "label": __("To Year"),
            "fieldtype": "Data"
        }
    ]
};
```

---

### Step 2: Create Zakaah Asset Breakdown Report

**Purpose**: Detailed breakdown of assets for each calculation

#### 2.1 Python Implementation

File: `zakaah/zakaah_management/report/zakaah_asset_breakdown/zakaah_asset_breakdown.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data

def get_columns():
    return [
        {"fieldname": "asset_category", "label": _("Category"), "fieldtype": "Data", "width": 150},
        {"fieldname": "account", "label": _("Account"), "fieldtype": "Link", "options": "Account", "width": 200},
        {"fieldname": "currency", "label": _("Currency"), "fieldtype": "Link", "options": "Currency", "width": 80},
        {"fieldname": "balance", "label": _("Balance"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "sub_total", "label": _("Sub Total (EGP)"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "notes", "label": _("Notes"), "fieldtype": "Text", "width": 300}
    ]

def get_data(filters):
    """Get asset breakdown data"""
    if not filters.get("zakaah_calculation_run"):
        return []
    
    query = """
        SELECT 
            asset_category,
            account,
            currency,
            balance,
            sub_total,
            notes
        FROM `tabZakaah Calculation Run Item`
        WHERE parent = %(zakaah_calculation_run)s
        ORDER BY asset_category, account
    """
    
    return frappe.db.sql(query, filters, as_dict=True)

def get_conditions(filters):
    conditions = []
    
    if filters.get("company"):
        conditions.append("company = '{}'".format(filters.company))
    
    if filters.get("fiscal_year"):
        conditions.append("fiscal_year = '{}'".format(filters.fiscal_year))
    
    return " WHERE " + " AND ".join(conditions) if conditions else ""
```

#### 2.2 Report Template

File: `zakaah/zakaah_management/report/zakaah_asset_breakdown/zakaah_asset_breakdown.html`

```html
<div class="report-summary">
    <div class="summary-cards">
        <div class="card">
            <div class="card-header">Cash Balance</div>
            <div class="card-value">{{ data.cash_balance }}</div>
        </div>
        <div class="card">
            <div class="card-header">Inventory</div>
            <div class="card-value">{{ data.inventory_balance }}</div>
        </div>
        <div class="card">
            <div class="card-header">Receivables</div>
            <div class="card-value">{{ data.receivables }}</div>
        </div>
        <div class="card">
            <div class="card-header">Total Assets</div>
            <div class="card-value highlight">{{ data.total_assets }}</div>
        </div>
    </div>
</div>
```

---

### Step 3: Create Zakaah Payment History Report

**Purpose**: Track all payments made for Zakaah

#### 3.1 Python Implementation

File: `zakaah/zakaah_management/report/zakaah_payment_history/zakaah_payment_history.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    chart = get_chart(data)
    
    return columns, data, None, chart

def get_columns():
    return [
        {"fieldname": "allocation_date", "label": _("Date"), "fieldtype": "Date", "width": 120},
        {"fieldname": "journal_entry", "label": _("Journal Entry"), "fieldtype": "Link", "options": "Journal Entry", "width": 120},
        {"fieldname": "zakaah_calculation_run", "label": _("Year"), "fieldtype": "Link", "options": "Zakaah Calculation Run", "width": 100},
        {"fieldname": "fiscal_year", "label": _("Fiscal Year"), "fieldtype": "Data", "width": 100},
        {"fieldname": "allocated_amount", "label": _("Allocated Amount"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "unallocated_amount", "label": _("Remaining"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "posted_by", "label": _("Posted By"), "fieldtype": "Link", "options": "User", "width": 120}
    ]

def get_data(filters):
    """Get payment history data"""
    conditions = get_conditions(filters)
    
    query = """
        SELECT 
            ah.allocation_date,
            ah.journal_entry,
            ah.zakaah_calculation_run,
            zcr.fiscal_year,
            ah.allocated_amount,
            ah.unallocated_amount,
            ah.owner as posted_by
        FROM `tabZakaah Allocation History` ah
        INNER JOIN `tabZakaah Calculation Run` zcr ON ah.zakaah_calculation_run = zcr.name
        WHERE ah.docstatus != 2
        {conditions}
        ORDER BY ah.allocation_date DESC, ah.creation DESC
    """.format(conditions=conditions)
    
    return frappe.db.sql(query, as_dict=True)

def get_conditions(filters):
    conditions = []
    
    if filters.get("from_date"):
        conditions.append("ah.allocation_date >= '{}'".format(filters.from_date))
    
    if filters.get("to_date"):
        conditions.append("ah.allocation_date <= '{}'".format(filters.to_date))
    
    if filters.get("company"):
        conditions.append("zcr.company = '{}'".format(filters.company))
    
    if filters.get("fiscal_year"):
        conditions.append("zcr.fiscal_year = '{}'".format(filters.fiscal_year))
    
    return " AND " + " AND ".join(conditions) if conditions else ""

def get_chart(data):
    if not data:
        return None
    
    chart = {
        "type": "line",
        "data": {
            "labels": [frappe.format(row.allocation_date, {"fieldtype": "Date"}) for row in data],
            "datasets": [
                {
                    "name": "Allocated Amount",
                    "values": [row.allocated_amount for row in data]
                }
            ]
        }
    }
    
    return chart
```

---

### Step 4: Create Zakaah Dashboard

**Purpose**: Visual dashboard for Zakaah overview

#### 4.1 Dashboard Configuration

File: `zakaah/zakaah_management/dashboards/zakaah_dashboard.json`

```json
{
 "dashboard_name": "Zakaah Dashboard",
 "charts": [
  {
   "chart_name": "Zakaah Outstanding by Year",
   "chart_type": "Bar",
   "based_on": "Zakaah Calculation Run",
   "filters_json": "{\"status\":[\"=\",\"Calculated\"]}"
  },
  {
   "chart_name": "Payment Trends",
   "chart_type": "Line",
   "based_on": "Zakaah Allocation History",
   "filters_json": "{\"docstatus\":[\"!=\",2]}"
  },
  {
   "chart_name": "Assets Breakdown",
   "chart_type": "Pie",
   "based_on": "Zakaah Calculation Run Item",
   "filters_json": "{\"parent\":[\"=\",\"current_calculation\"]}"
  }
 ],
 "cards": [
  {
   "label": "Total Outstanding",
   "link_to": "Zakaah Outstanding Summary",
   "method": "get_total_outstanding"
  },
  {
   "label": "Total Paid",
   "link_to": "Zakaah Payment History",
   "method": "get_total_paid"
  },
  {
   "label": "Unreconciled Years",
   "link_to": "Zakaah Calculation Run",
   "method": "get_unreconciled_count"
  }
 ]
}
```

#### 4.2 Dashboard Python Methods

File: `zakaah/zakaah_management/dashboards/zakaah_dashboard.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _

@frappe.whitelist()
def get_total_outstanding():
    """Get total outstanding Zakaah amount"""
    total = frappe.db.sql("""
        SELECT SUM(outstanding_zakaah) as total
        FROM `tabZakaah Calculation Run`
        WHERE docstatus = 1
        AND outstanding_zakaah > 0
    """, as_dict=True)
    
    return total[0].total or 0

@frappe.whitelist()
def get_total_paid():
    """Get total paid Zakaah amount"""
    total = frappe.db.sql("""
        SELECT SUM(allocated_amount) as total
        FROM `tabZakaah Allocation History`
        WHERE docstatus != 2
    """, as_dict=True)
    
    return total[0].total or 0

@frappe.whitelist()
def get_unreconciled_count():
    """Get count of years with outstanding amount"""
    count = frappe.db.sql("""
        SELECT COUNT(*) as count
        FROM `tabZakaah Calculation Run`
        WHERE docstatus = 1
        AND outstanding_zakaah > 0
    """, as_dict=True)
    
    return count[0].count or 0
```

---

### Step 5: Implement Advanced Multi-Currency Features

#### 5.1 Currency Conversion Helper

File: `zakaah/zakaah_management/utils/currency_helper.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe.utils import flt

@frappe.whitelist()
def get_exchange_rate_for_date(from_currency, to_currency, date):
    """Get exchange rate for specific date"""
    
    # Try to get from Currency Exchange
    rate = frappe.db.get_value(
        "Currency Exchange",
        {
            "from_currency": from_currency,
            "to_currency": to_currency,
            "date": ["<=", date]
        },
        "exchange_rate",
        order_by="date desc"
    )
    
    if rate:
        return rate
    
    # If not found, try to get latest rate
    rate = frappe.db.get_value(
        "Currency Exchange",
        {
            "from_currency": from_currency,
            "to_currency": to_currency
        },
        "exchange_rate",
        order_by="date desc"
    )
    
    return rate or 1

@frappe.whitelist()
def convert_currency(amount, from_currency, to_currency, date):
    """Convert currency amount"""
    if from_currency == to_currency:
        return amount
    
    exchange_rate = get_exchange_rate_for_date(from_currency, to_currency, date)
    return flt(amount) * flt(exchange_rate)

@frappe.whitelist()
def get_all_exchange_rates_for_date(date, base_currency="EGP"):
    """Get all exchange rates for a specific date"""
    rates = frappe.db.get_all(
        "Currency Exchange",
        filters={
            "to_currency": base_currency,
            "date": ["<=", date]
        },
        fields=["from_currency", "exchange_rate"],
        order_by="date desc",
        group_by="from_currency"
    )
    
    result = {base_currency: 1}
    for row in rates:
        result[row.from_currency] = row.exchange_rate
    
    return result
```

---

### Step 6: Implement Inventory Calculation Choice

#### 6.1 Add Method Selection in Calculation

File: `zakaah/zakaah_management/doctype/zakaah_calculation_run/zakaah_calculation_run.py`

Add this method to the class:

```python
def calculate_inventory_by_method(self, account, method, company):
    """Calculate inventory based on selected method"""
    
    if method == "Account Balance":
        # Quick calculation from account balance
        return get_account_balance(account, self.to_date)
    
    elif method == "Stock Ledger":
        # Detailed calculation from Stock Ledger Entry
        return calculate_stock_balance(account, self.to_date, company)
    
    return 0

def calculate_stock_balance(self, account, to_date, company):
    """Calculate inventory from Stock Ledger Entry"""
    
    # Get stock ledger entries
    stock_balance = frappe.db.sql("""
        SELECT 
            sle.item_code,
            SUM(sle.actual_qty) as quantity,
            AVG(sle.valuation_rate) as avg_rate,
            SUM(sle.actual_qty * sle.valuation_rate) as total_value
        FROM `tabStock Ledger Entry` sle
        WHERE sle.company = %s
        AND sle.posting_date <= %s
        AND sle.docstatus = 1
        GROUP BY sle.item_code
        HAVING SUM(sle.actual_qty) > 0
    """, (company, to_date), as_dict=True)
    
    total_value = sum([row.total_value or 0 for row in stock_balance])
    
    return {
        'total_value': total_value,
        'items': stock_balance,
        'items_count': len(stock_balance)
    }
```

---

### Step 7: Add Print Formats and Export

#### 7.1 Print Format for Zakaah Calculation Run

File: `zakaah/zakaah_management/print_format/zakaah_calculation_run.html`

```html
<div class="zakaah-calculation-print">
    <div class="header">
        <h1>Zakaah Calculation Run</h1>
        <div class="company">{{ doc.company }}</div>
        <div class="fiscal-year">Fiscal Year: {{ doc.fiscal_year }}</div>
    </div>
    
    <div class="gold-info">
        <div><strong>Gold Price:</strong> {{ doc.gold_price_per_gram_24k }} EGP/gram</div>
        <div><strong>Nisab Value:</strong> {{ doc.nisab_value }} EGP</div>
        <div><strong>Assets in Gold:</strong> {{ doc.assets_in_gold_grams }} grams</div>
        <div><strong>Meets Nisab:</strong> {{ "Yes" if doc.nisab_met else "No" }}</div>
    </div>
    
    <div class="assets-breakdown">
        <h2>Assets Breakdown</h2>
        <table>
            <tr>
                <th>Category</th>
                <th>Account</th>
                <th>Balance</th>
            </tr>
            {% for item in doc.items %}
            <tr>
                <td>{{ item.asset_category }}</td>
                <td>{{ item.account }}</td>
                <td>{{ item.balance }}</td>
            </tr>
            {% endfor %}
        </table>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <div>Total Assets: {{ doc.total_assets }}</div>
        <div>Zakaah Rate: {{ doc.zakaah_rate }}%</div>
        <div>Total Zakaah: {{ doc.total_zakaah }}</div>
        <div>Status: {{ doc.status }}</div>
    </div>
</div>
```

---

### Step 8: Add Scheduled Tasks

#### 8.1 Update hooks.py

File: `zakaah/hooks.py`

```python
scheduler_events = {
    'daily': [
        'zakaah.zakaah_management.tasks.update_gold_price_daily'
    ],
    'weekly': [
        'zakaah.zakaah_management.tasks.send_outstanding_reminders'
    ]
}
```

#### 8.2 Create Tasks File

File: `zakaah/zakaah_management/tasks.py`

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _

def update_gold_price_daily():
    """Update gold price daily"""
    try:
        today = frappe.utils.today()
        
        # Check if already fetched
        existing = frappe.db.exists("Gold Price", {"price_date": today})
        if existing:
            return
        
        # Fetch from API
        doc = frappe.get_doc({
            "doctype": "Gold Price",
            "price_date": today,
            "currency": "EGP"
        })
        doc.insert()
        
        frappe.logger().info("Gold price updated for {0}".format(today))
        
    except Exception as e:
        frappe.log_error(f"Error updating gold price: {str(e)}")

def send_outstanding_reminders():
    """Send reminders for outstanding Zakaah"""
    try:
        outstanding = frappe.db.get_all(
            "Zakaah Calculation Run",
            filters={
                "status": ["in", ["Calculated", "Partially Paid"]],
                "outstanding_zakaah": [">", 0]
            },
            fields=["name", "company", "fiscal_year", "outstanding_zakaah"]
        )
        
        if not outstanding:
            return
        
        # Send notifications
        for record in outstanding:
            # Build notification
            message = f"Outstanding Zakaah for {record.fiscal_year}: {record.outstanding_zakaah}"
            
            # Create notification
            frappe.publish_realtime(
                'notification',
                {
                    'title': 'Outstanding Zakaah',
                    'message': message,
                    'type': 'info'
                }
            )
        
        frappe.logger().info("Outstanding reminders sent for {0} records".format(len(outstanding)))
        
    except Exception as e:
        frappe.log_error(f"Error sending reminders: {str(e)}")
```

---

## Testing Phase 3

### Test Cases

1. **Reports**
   - All reports generate correctly
   - Filters work properly
   - Charts display correctly
   - Export functions work

2. **Dashboards**
   - Cards show correct data
   - Charts update properly
   - Links work correctly

3. **Advanced Features**
   - Multi-currency conversion accurate
   - Inventory methods work correctly
   - Scheduled tasks run properly

### Expected Results

- All reports functional
- Dashboards show real-time data
- Export options work
- Print formats display correctly
- Scheduled tasks run automatically

---

## Next Steps

After Phase 3 completion:
1. User acceptance testing
2. Performance optimization
3. Documentation finalization
4. Training materials
5. Production deployment

---

**Status**: Ready to Implement
**Estimated Completion**: 2-3 weeks
**Priority**: Medium

