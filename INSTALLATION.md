# Zakaah Management System - Installation & Testing Guide

## Phase 1: Installation on ERPNext

### Prerequisites
- ERPNext version 14.x or higher
- Frappe Bench setup
- Access to terminal/command line

---

## Step 1: Move to Your Bench Directory

```bash
cd /path/to/your/bench
```

---

## Step 2: Install the App

```bash
# Option A: If app is in bench/apps
cd apps
bench get-app zakaah

# Option B: If app is outside bench
cd /home/frappe/erpnext-project/Zakah\ App/zakaah
bench get-app zakaah
```

---

## Step 3: Install the App in Your Site

```bash
# Switch to your site
cd sites
cd your-site-name

# Install the app
bench --site your-site-name install-app zakaah
```

---

## Step 4: Migrate Database

```bash
# Run migrations to create DocTypes in database
bench --site your-site-name migrate

# Clear cache
bench --site your-site-name clear-cache
bench --site your-site-name clear-website-cache
```

---

## Step 5: Create DocTypes in Database

The migrations will automatically create the following DocTypes:

1. **Gold Price** - Store gold prices
2. **Zakaah Account Configuration** - Child table for account setup
3. **Zakaah Assets Configuration** - Configure which accounts to use
4. **Zakaah Calculation Run Item** - Child table for detailed breakdown
5. **Zakaah Calculation Run** - Main calculation document

---

## Step 6: Restart Bench

```bash
# Restart all services
bench restart

# OR restart specific services
bench restart --web
bench restart --workers
```

---

## Step 7: Access the App in ERPNext

1. Log in to ERPNext
2. You should see **"Zakaah Management"** in the module list
3. Click on it to access:
   - Assets Configuration
   - Calculation Runs
   - Gold Prices

---

## Testing Phase 1 Features

### Test 1: Create a Gold Price Record

1. Go to **Zakaah Management > Gold Prices**
2. Click **New**
3. Fill in:
   - Price Date: Today's date
   - Currency: EGP
   - Price per Gram (24K): 2500 (example)
   - Source: Manual or API
4. Click **Save**

✅ **Expected**: Gold price record created successfully

---

### Test 2: Configure Assets

1. Go to **Zakaah Management > Assets Configuration**
2. Select a Company
3. Add accounts to each category:
   - **Cash Accounts**: Add bank/cash accounts
   - **Inventory Accounts**: Add inventory accounts
   - **Receivable Accounts**: Add customer accounts
   - **Payable Accounts**: Add supplier accounts
   - **Reserve Accounts**: Add reserve accounts
4. Click **Save**

✅ **Expected**: Assets configuration saved

---

### Test 3: Create Calculation Run

1. Go to **Zakaah Management > Calculation Runs**
2. Click **New**
3. Fill in:
   - Company: Select your company
   - Calendar Type: Gregorian
   - Fiscal Year: 2024
   - From Date: 2024-01-01
   - To Date: 2024-12-31
4. Click **Submit**
   - The system will calculate assets automatically
   - It will fetch/use gold price
   - It will calculate Nisab (85 grams)
   - It will calculate Zakaah (2.5% if Nisab is met)

✅ **Expected**: 
- Total Assets calculated
- Nisab status displayed
- Total Zakaah amount displayed
- Status updated to "Calculated" or "Not Due"

---

### Test 4: View Results

Check the calculated fields:
- **Cash Balance**: Sum of cash accounts
- **Inventory Balance**: Sum of inventory accounts
- **Receivables**: Sum of receivable accounts
- **Payables**: Deducted from total
- **Total Assets**: Final calculated amount
- **Gold Price**: Used for Nisab
- **Nisab Value**: 85 grams worth
- **Assets in Gold Grams**: Your assets converted to gold
- **Meets Nisab**: Yes/No
- **Total Zakaah**: 2.5% of assets (if Nisab met)

---

## Troubleshooting

### Issue 1: DocTypes not appearing in ERPNext

**Solution**:
```bash
bench --site your-site-name migrate
bench --site your-site-name clear-cache
bench restart
```

---

### Issue 2: "Cannot find DocType" error

**Solution**:
```bash
# Check if DocTypes are in database
bench --site your-site-name console

# In console:
frappe.db.exists("DocType", "Gold Price")
frappe.db.exists("DocType", "Zakaah Calculation Run")

# If False, run:
bench --site your-site-name migrate
```

---

### Issue 3: Calculation returns 0

**Possible causes**:
1. Assets configuration not set up
2. No account balances on the date
3. Date range has no transactions

**Solution**:
- Check Assets Configuration has accounts
- Verify accounts have balances in the date range
- Check GL Entry table for transactions

---

### Issue 4: Gold price not found

**Solution**:
1. Create a Gold Price record manually
2. Or install gold API key in site_config.json:
```json
{
  "gold_api_key": "your_api_key_here"
}
```

---

## Next Steps

### After Phase 1 Testing

If Phase 1 works correctly, you can proceed to Phase 2:
- Payment tracking
- Allocation system
- Reconciliation

---

## Notes

- Gold prices should be entered manually for historical dates
- Current date uses API if configured
- Assets configuration is company-specific
- Each fiscal year needs a separate calculation run

---

## Support

For issues or questions:
1. Check logs: `bench --site your-site-name logs`
2. Check errors: ERPNext > Error Log
3. Review Phase 1.md for implementation details

---

**Status**: Phase 1 Complete
**Next**: Phase 2 (Payment Tracking)


