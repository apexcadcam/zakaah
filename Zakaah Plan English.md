# Zakaah Management System - Complete Implementation Plan

## Overview

Complete Zakaah (Islamic Wealth Tax) calculation and payment tracking system for companies based on assets valuation, gold price, and automated payment reconciliation.

---

## Technical Stack

### Framework & Platform
- **Frappe Framework**: Version 14.0 or higher
  - Core framework for application development
  - Provides ORM, API, UI components, and admin interface
  - Handles database abstraction and migration

- **ERPNext**: Integration module
  - Financial module for asset tracking
  - Journal Entry integration
  - Account management
  - Exchange rate management

### Database
- **MariaDB**: Primary database
  - Stores all application data
  - DocTypes metadata
  - Transaction logs
  - Indexed queries for performance

### Language & Runtime
- **Python**: Version 3.8 or higher
  - Backend business logic
  - API development
  - Data processing and calculations
  - Server-side scripting

- **JavaScript**: Client-side scripting
  - Form customizations
  - UI interactions
  - Dynamic form behavior
  - Client-side validations

### APIs & Integration
- **Gold Price APIs**:
  - metals-api.com (Primary)
  - goldapi.io (Alternative)
  - Optional: Manual entry fallback

- **Currency Exchange**: ERPNext Currency Exchange module
- **REST API**: Frappe REST framework for API calls

### Web Technologies
- **HTML5/CSS3**: User interface
- **Bootstrap**: UI components
- **jQuery**: DOM manipulation
- **Frappe Charts**: Data visualization

### Development Tools
- **Git**: Version control
- **Bench CLI**: Frappe development toolkit
- **Frappe Desk**: Development environment

### Dependencies
```txt
frappe>=14.0.0
erpnext>=14.0.0
mysqlclient>=2.1.0
requests>=2.28.0
python-dateutil>=2.8.0
```

### Architecture Pattern
- **Model-View-Controller (MVC)**:
  - DocType JSON (Model)
  - Python classes (Controller)
  - JavaScript (View)
- **RESTful API**: Server-client communication
- **Single Page Application**: Frappe desk interface

---

## Core Requirements

### 1. Complete Asset Valuation
Calculate company's total assets including:
- Cash: Bank deposits, operational cash, reserves
- Inventory: Choose between Account Balance or Stock Ledger methods
- Receivables: Customer debts (configurable by type: Good/Doubtful/Bad)
- Payables: Vendor debts (deducted from assets)
- Reserves & Operational Costs: If in cash, included in Zakaah calculation

### 2. Multi-Currency Support
- Base Currency: EGP (Egyptian Pound)
- Supported Currencies: USD, EUR, CNY (Chinese Yuan), SAR (Saudi Riyal)
- Exchange Rate: Use rate as of fiscal year end date
- Conversion: All currencies converted to EGP at year-end rate

### 3. Gold-Based Nisab
- Standard: 85 grams of 24K gold
- Price Source: Live API (free tier available)
- Calculation: Nisab value = 85 × Gold Price per gram
- Frequency: Fetched when needed, stored per calculation date

### 4. Dual Calendar Support
- Gregorian: Standard calendar years
- Hijri: Islamic lunar calendar
- Selection: User chooses calendar type per calculation
- Fiscal Year: Named by calendar type selected

### 5. Payment Reconciliation (Like Payment Reconciliation Module)
- Unreconciled Only: Get only unpaid years and unallocated payments
- Partial Payment: Track what's paid vs outstanding per year
- Auto-Hide: Years fully paid automatically hidden
- Journal Entries: Show only entries not fully allocated

---

## System Architecture

### DocTypes Required

#### 1. Zakaah Assets Configuration (Singleton)
Purpose: Configure which accounts to use for Zakaah calculation

Fields:
- cash_accounts (Table)
- inventory_accounts (Table)
- receivable_accounts (Table)
- payable_accounts (Table)
- operational_costs (Table)
- reserve_accounts (Table)

Table Child Structure (Cash Accounts):
- account (Link to Account)
- include_bank_deposits (Check)
- notes (Text)

Table Child Structure (Inventory):
- account (Link to Account)
- calculation_method (Select: "Account Balance" | "Stock Ledger")
- notes (Text)

Table Child Structure (Receivables):
- account (Link to Account)
- debt_type (Select: "All" | "Good" | "Doubtful" | "Bad")
- include_advances (Check)
- notes (Text)

Table Child Structure (Payables):
- account (Link to Account)
- deduct_from_assets (Check) - Always Yes
- notes (Text)

---

#### 2. Zakaah Calculation Run (Main Document)
Purpose: Store annual Zakaah calculation results

Fields:
- company (Link to Company) *
- fiscal_year (Data) *
- calendar_type (Select: Gregorian|Hijri) *
- from_date (Date) *
- to_date (Date) *
- gold_price_date (Date)
- gold_price_per_gram_24k (Currency)
- nisab_value (Currency)
- nisab_met (Check)
- total_assets_in_gold_grams (Float)
- cash_balance (Currency)
- inventory_balance (Currency)
- receivables (Currency)
- payables (Currency)
- reserves (Currency)
- total_assets (Currency)
- zakaah_rate (Percent, default: 2.5)
- total_zakaah (Currency)
- paid_zakaah (Currency)
- outstanding_zakaah (Currency)
- status (Select: Draft|Calculated|Partially Paid|Paid|Not Due)
- items (Table: Zakaah Calculation Run Item)
- exchange_rates (JSON)

---

#### 3. Zakaah Calculation Run Item (Child Table)
Purpose: Detailed breakdown of assets

Fields:
- asset_category (Select: Cash|Inventory|Receivables|Payables|Reserves)
- account (Link to Account)
- balance (Currency)
- currency (Link to Currency)
- exchange_rate (Float)
- notes (Text)
- sub_total (Currency)

---

#### 4. Gold Price (New DocType)
Purpose: Store gold prices

Fields:
- price_date (Date) *
- currency (Select: EGP) *
- price_per_gram_24k (Currency) *
- source (Data) - API name
- api_response (JSON) - Full API response

---

#### 5. Zakaah Payment Entry (Child Table - Existing)
Enhancement: Track allocation status

Additional Fields:
- is_fully_allocated (Check) - Read-only, calculated
- remaining_unallocated (Currency) - Read-only, calculated

---

#### 6. Zakaah Allocation History (Existing - Enhanced)
Purpose: Track payment allocations to years

Status Tracking:
- Record each allocation
- Track unallocated amount per Journal Entry
- Link to both Journal Entry AND Calculation Run

---

## Project Structure

```
zakaah/
├── zakaah/
│   ├── __init__.py
│   ├── hooks.py
│   ├── manifest.json
│   ├── modules.txt
│   ├── patches.txt
│   │
│   ├── config/
│   │   ├── __init__.py
│   │   └── desktop.py
│   │
│   ├── zakaah_management/
│   │   ├── __init__.py
│   │   │
│   │   ├── doctype/
│   │   │   ├── __init__.py
│   │   │   │
│   │   │   ├── zakaah_assets_configuration/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_assets_configuration.json
│   │   │   │   ├── zakaah_assets_configuration.py
│   │   │   │   └── zakaah_assets_configuration.js
│   │   │   │
│   │   │   ├── zakaah_calculation_run/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_calculation_run.json
│   │   │   │   ├── zakaah_calculation_run.py
│   │   │   │   ├── zakaah_calculation_run.js
│   │   │   │   └── zakaah_calculation_run_list.js
│   │   │   │
│   │   │   ├── zakaah_calculation_run_item/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_calculation_run_item.json
│   │   │   │   └── zakaah_calculation_run_item.py
│   │   │   │
│   │   │   ├── gold_price/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── gold_price.json
│   │   │   │   ├── gold_price.py
│   │   │   │   └── gold_price.js
│   │   │   │
│   │   │   ├── zakaah_payments/ (Existing - Enhanced)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_payments.json
│   │   │   │   ├── zakaah_payments.py
│   │   │   │   └── zakaah_payments.js
│   │   │   │
│   │   │   ├── zakaah_payment_entry/ (Existing)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_payment_entry.json
│   │   │   │   └── zakaah_payment_entry.py
│   │   │   │
│   │   │   ├── zakaah_allocation_history/ (Existing - Enhanced)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_allocation_history.json
│   │   │   │   └── zakaah_allocation_history.py
│   │   │   │
│   │   │   └── zakaah_account_item/ (Existing)
│   │   │       ├── __init__.py
│   │   │       ├── zakaah_account_item.json
│   │   │       └── zakaah_account_item.py
│   │   │
│   │   └── public/
│   │       ├── css/
│   │       │   └── zakaah_payments.css
│   │       └── js/
│   │           └── zakaah_payments.js
│   │
│   ├── fixtures/
│   │   └── custom_field.json
│   │
│   ├── __init__.py
│   ├── config/
│   │   ├── __init__.py
│   │   └── desktop.py
│   ├── hooks.py
│   ├── manifest.json
│   ├── modules.txt
│   └── patches.txt
│
├── public/
│   ├── css/
│   │   └── zakaah_payments.css
│   └── js/
│       └── zakaah_payments.js
│
├── setup.py
├── requirements.txt
├── README.md
├── Zakaah Plan English.md
└── Zakaah Plan Arabic.md
```

### Key Directories

**zakaah/zakaah_management/doctype/**
- Contains all custom DocTypes
- Each DocType has: JSON schema, Python class, JavaScript client scripts

**zakaah/zakaah_management/public/**
- CSS and JavaScript assets
- Client-side customizations

**zakaah/hooks.py**
- App hooks and configuration
- Customizations to Frappe/ERPNext

**zakaah/config/desktop.py**
- Desktop configuration
- Menu items and navigation

---

## Calculation Logic

### Step 1: Asset Calculation

```python
def calculate_zakaah_assets(company, to_date, config):
    assets = {
        'cash': 0,
        'inventory': 0,
        'receivables': 0,
        'payables': 0,
        'reserves': 0,
        'currencies': {}
    }
    
    # 1. CASH (including bank deposits)
    for account in config['cash_accounts']:
        balance = get_account_balance(account, to_date)
        if account.get('include_bank_deposits'):
            deposits = get_bank_deposits(account, to_date)
            balance += deposits
        assets['cash'] += balance
    
    # 2. INVENTORY (user choice)
    for account in config['inventory_accounts']:
        if account['calculation_method'] == 'account':
            balance = get_account_balance(account, to_date)
        else:
            balance = calculate_stock_balance(account, to_date)
        assets['inventory'] += balance
    
    # 3. RECEIVABLES (filter by type)
    for account in config['receivable_accounts']:
        debt_type = account.get('debt_type', 'All')
        balance = get_receivables_by_type(account, to_date, debt_type)
        assets['receivables'] += balance
    
    # 4. PAYABLES (deducted)
    for account in config['payable_accounts']:
        balance = get_account_balance(account, to_date)
        assets['payables'] += balance
    
    # 5. RESERVES (cash reserves)
    for account in config.get('reserve_accounts', []):
        balance = get_account_balance(account, to_date)
        assets['reserves'] += balance
    
    # 6. MULTI-CURRENCY CONVERSION
    exchange_rates = get_exchange_rates_for_date(to_date)
    for account_list in [config['cash_accounts'], config['receivable_accounts']]:
        for account in account_list:
            currency = get_account_currency(account)
            if currency != 'EGP':
                balance = get_balance_in_currency(account, to_date)
                rate = exchange_rates.get(currency, 1)
                assets['currencies'][currency] = {
                    'original': balance,
                    'rate': rate,
                    'egp_value': balance * rate
                }
    
    # Calculate total in EGP
    total = (assets['cash'] + assets['inventory'] + 
             assets['receivables'] - assets['payables'] + 
             assets['reserves'])
    
    # Add converted amounts
    for curr_data in assets['currencies'].values():
        total += curr_data['egp_value']
    
    assets['total_in_egp'] = total
    return assets
```

### Step 2: Nisab & Zakaah Calculation

```python
def calculate_nisab_and_zakaah(total_assets, calculation_date):
    gold_price = get_gold_price_for_date(calculation_date)
    nisab_value = 85 * gold_price
    assets_in_gold = total_assets / gold_price
    meets_nisab = assets_in_gold >= 85
    
    if meets_nisab:
        zakaah_amount = total_assets * 0.025
        status = "Due"
    else:
        zakaah_amount = 0
        status = "Not Due - Below Nisab"
    
    return {
        'gold_price': gold_price,
        'nisab_value': nisab_value,
        'assets_in_gold_grams': assets_in_gold,
        'meets_nisab': meets_nisab,
        'zakaah_amount': zakaah_amount,
        'status': status
    }
```

---

## Payment Reconciliation Logic

### Concept
Similar to ERPNext Payment Reconciliation module - only show unreconciled items.

### Implementation

#### 1. Get Unreconciled Calculation Runs

```python
@frappe.whitelist()
def get_calculation_runs(show_unreconciled_only=True):
    filters = {}
    if show_unreconciled_only:
        filters["outstanding_zakaah"] = [">", 0]
    
    runs = frappe.db.get_all(
        "Zakaah Calculation Run",
        filters=filters,
        fields=["name", "hijri_year", "total_zakaah", 
                "paid_zakaah", "outstanding_zakaah", "status"],
        order_by="hijri_year asc"
    )
    return runs
```

#### 2. Get Unreconciled Journal Entries

```python
@frappe.whitelist()
def import_journal_entries(company, from_date, to_date, selected_accounts):
    # Get all JE from accounts
    all_entries = frappe.db.sql("""
        SELECT je.name as journal_entry, je.posting_date,
               SUM(jea.debit) as debit, SUM(jea.credit) as credit
        FROM `tabJournal Entry Account` jea
        INNER JOIN `tabJournal Entry` je ON jea.parent = je.name
        WHERE je.company = %s
        AND je.posting_date BETWEEN %s AND %s
        AND jea.account IN %s
        AND je.docstatus = 1
        GROUP BY je.name
    """, (company, from_date, to_date, tuple(selected_accounts)), as_dict=True)
    
    # Get already allocated amounts
    allocated = frappe.db.sql("""
        SELECT journal_entry, SUM(allocated_amount) as total_allocated
        FROM `tabZakaah Allocation History`
        WHERE docstatus != 2
        GROUP BY journal_entry
    """, as_dict=True)
    
    allocated_dict = {row.journal_entry: row.total_allocated for row in allocated}
    
    # Filter: only entries with unallocated amount > 0
    unreconciled = []
    for entry in all_entries:
        debit = entry.debit or 0
        total_allocated = allocated_dict.get(entry.journal_entry, 0)
        unallocated = debit - total_allocated
        
        if unallocated > 0:
            unreconciled.append({
                "journal_entry": entry.journal_entry,
                "posting_date": str(entry.posting_date),
                "debit": debit,
                "allocated_amount": total_allocated,
                "unallocated_amount": unallocated
            })
    
    return {"journal_entry_records": unreconciled}
```

---

## User Workflow

### Scenario 1: Calculate Zakaah for Year 2024

```
1. Open "Zakaah Calculation Run"
2. Click "New"
3. Fill in:
   - Company: "ABC Company"
   - Calendar Type: "Gregorian"
   - Fiscal Year: "2024"
   - From Date: 2024-01-01
   - To Date: 2024-12-31
4. Click "Load Assets Configuration"
5. Review assets breakdown
6. Click "Calculate Zakaah"
   → Shows preview:
      - Assets: 1,050,000 EGP
      - Gold equivalent: 1,018 grams
      - Meets Nisab: ✓
      - Zakaah due: 26,250 EGP (2.5%)
7. Click "Save & Submit"
```

### Scenario 2: Make Partial Payment

```
1. Open "Zakaah Payments"
2. Fill in dates
3. Click "Get Unreconciled Entries"
   → Shows only years with outstanding
   → Shows only unallocated JE
4. Click "Allocate"
   → 50,000 paid to 2024
   → Remaining goes to next year
5. System updates Allocation History
```

### Scenario 3: Complete Payment

```
1. Open "Zakaah Payments"
2. Click "Get Unreconciled Entries"
   → 2022 fully paid and hidden
   → Shows 2023, 2024 only
3. Allocate remaining payments
4. Get Unreconciled Entries again
   → "No unreconciled entries found"
```

---

## API Integration

### Gold Price API

Recommended: Use free tier APIs
- Option 1: https://metals-api.com (free tier: 100 requests/month)
- Option 2: https://goldapi.io (free tier available)
- Option 3: Manual entry if API unavailable

Implementation:
```python
def get_gold_price_for_date(date):
    existing = frappe.db.exists("Gold Price", {"price_date": date})
    if existing:
        return frappe.db.get_value("Gold Price", 
                                   {"price_date": date}, 
                                   "price_per_gram_24k")
    
    try:
        url = "https://api.metals-api.com/v1/latest"
        params = {
            "base": "XAU",
            "currencies": "EGP",
            "access_key": frappe.conf.gold_api_key
        }
        response = requests.get(url, params=params)
        price_per_gram = response.json()['rates']['EGP'] / 31.1035
        
        doc = frappe.get_doc({
            "doctype": "Gold Price",
            "price_date": date,
            "currency": "EGP",
            "price_per_gram_24k": price_per_gram,
            "source": "metals-api"
        })
        doc.insert()
        return price_per_gram
    except:
        return 2500  # Default fallback
```

---

## Configuration

### Settings Required

#### 1. Zakaah Assets Configuration
Configure per company which accounts to use:
- Cash accounts (with/without bank deposits)
- Inventory accounts (calculation method)
- Receivable accounts (filter by debt type)
- Payable accounts (always deducted)
- Reserve accounts (if cash)

#### 2. Gold API Key (if using API)
```python
# In site_config.json
{
  "gold_api_key": "your_api_key_here"
}
```

#### 3. Exchange Rates
- From ERPNext Currency Exchange table
- Date: Use fiscal year end date
- Currencies: USD, EUR, CNY, SAR

---

## Field Details & Business Logic

### Asset Categories Explained

#### 1. Cash
- Includes: Bank accounts, cash accounts, operational cash
- Bank deposits: Optional inclusion

#### 2. Inventory
- Account Method: Quick, from account balance
- Stock Ledger: Detailed, counts actual items
- User choice per calculation

#### 3. Receivables
- All: Include all customer debts
- Good Only: Only collectible debts
- Doubtful: Include with percentage
- Bad: Exclude or include with 0%

#### 4. Payables
- Always deducted from total assets
- Vendor invoices, advances, credits

#### 5. Reserves & Operational Costs
- Included ONLY if in cash
- Example: Cash reserves, operating expense fund
- NOT included if in assets (fixed assets)

---

## Permissions

### Roles

1. Zakaah Manager
   - Full access to all DocTypes
   - Can configure asset setup
   - Can create calculations
   - Can allocate payments

2. Zakaah Accountant
   - Read/Write access to calculations and payments
   - Cannot configure assets setup
   - Can view reports

3. System Manager
   - Full access
   - Can configure everything

---

## Reports

### 1. Zakaah Calculation Summary
- All calculation runs
- By year, by calendar type
- Total vs Paid vs Outstanding
- Status indicators

### 2. Zakaah Payment History
- All payments allocated
- By year breakdown
- Journal entry references

### 3. Outstanding Zakaah Report
- Only unpaid years
- Outstanding amounts
- Aging analysis

### 4. Asset Breakdown Report
- Assets by category
- Multi-currency conversion
- Gold equivalent calculation

---

## Testing Scenarios

### Test Case 1: Fresh Company
- First year calculating Zakaah
- All assets in EGP
- Meets Nisab
Expected: Full calculation successful

### Test Case 2: Multi-Currency
- Assets in USD, EUR, CNY
- Exchange rates at year-end
- All converted to EGP
Expected: Correct conversion and total

### Test Case 3: Partial Payment
- Year 2022 owes 100,000
- Pay 50,000
Expected: Outstanding = 50,000, status = "Partially Paid"

### Test Case 4: Payment Reconciliation
- Pay 100,000 to clear 2022
Expected: 
  - 2022 status = "Paid"
  - 2022 no longer in unreconciled list
  - Only new years shown

### Test Case 5: Below Nisab
- Assets = 100 grams gold (below 85)
Expected: Status = "Not Due", Zakaah = 0

---

## Implementation Priority

### Phase 1: Core Calculation
1. Create DocTypes
2. Implement asset calculation
3. Implement Nisab calculation
4. Basic UI

### Phase 2: Payment Tracking
1. Enhance Zakaah Payments
2. Implement reconciliation logic
3. Allocation history tracking

### Phase 3: Advanced Features
1. Multi-currency support
2. Inventory method choice
3. Reports and dashboards
4. API integration for gold prices

### Phase 4: Polish
1. Error handling
2. Validation rules
3. Performance optimization
4. User documentation

---

## Notes

### Important Considerations

1. Gold Price: Fetched on-demand, cached per date
2. Exchange Rates: Use year-end rate consistently
3. Payments: Track from Zakaah liability accounts only
4. Inventory: User choice crucial for accuracy
5. Receivables: Configurable by debt quality

### Known Limitations

1. Gold API might have rate limits (mitigated by caching)
2. Historical exchange rates might not be available
3. Stock Ledger calculation slower for large inventories

---

## Success Criteria

### Functional Requirements
- Calculate all asset types
- Support multi-currency
- Track gold-based Nisab
- Payment reconciliation
- Dual calendar support
- Prevent duplicate allocations

### Non-Functional Requirements
- Fast calculation (< 5 seconds)
- Accurate reconciliation
- User-friendly interface
- Comprehensive reporting
- Proper error handling

---

## Support & Maintenance

### Configuration
- Review asset configuration annually
- Update exchange rates as needed
- Monitor gold price API status

### Troubleshooting
- Check gold API key validity
- Verify account mappings
- Review allocation history

---

Version: 1.0
Last Updated: 2025-01-XX
Status: Planning Phase
