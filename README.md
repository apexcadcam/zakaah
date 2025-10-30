# Zakaah Management System - Integration with Chart of Accounts

## Overview
This system automatically links Journal Entries with Zakaah Payments when payments are made to the Zakaah Liability account (2205001 - Zakaa Liability - AP).

## Features

### 1. Automatic Journal Entry Linking
- When a Journal Entry is submitted with a debit to account `2205001 - Zakaa Liability - AP`, it automatically creates a Zakaah Payment record
- The system detects zakaah-related accounts by checking for "2205001" or "zakaa" in the account name

### 2. Auto-Allocation by Year Order
- Payments are automatically allocated to outstanding zakaah calculations
- Allocation follows Hijri year order (oldest years first)
- Each payment is split across multiple years if needed

### 3. Manual Controls
- Users can manually trigger auto-allocation for specific payments
- View outstanding zakaah summary by company
- Link existing Journal Entries to Zakaah Payments

## How to Use

### Step 1: Create Journal Entry
1. Go to Accounting > Journal Entry
2. Create a new Journal Entry with:
   - **Debit**: Account `2205001 - Zakaa Liability - AP` (amount to be paid)
   - **Credit**: Bank/Cash Account (source of payment)
3. Submit the Journal Entry

### Step 2: Automatic Processing
- The system automatically:
  - Creates a Zakaah Payment record
  - Links it to the Journal Entry
  - Allocates the payment to outstanding zakaah by year order
  - Updates calculation run status

### Step 3: View Results
- Check Zakaah Payment list to see created payments
- View Zakaah Outstanding Summary report for overall status
- Each payment shows allocation details

## API Functions

### `link_journal_entry_to_zakaah(journal_entry_name)`
Manually link a Journal Entry to Zakaah Payment system.

### `auto_allocate_payment(payment_name)`
Manually trigger auto-allocation for a specific payment.

### `get_outstanding_zakaah_summary(company)`
Get summary of outstanding zakaah by year for a company.

## Configuration

### Account Setup
Ensure your Chart of Accounts includes:
- `2205001 - Zakaa Liability - AP` (or any account containing "zakaa")

### Permissions
The system uses these roles:
- **Zakaah Manager**: Full access to all zakaah functions
- **Zakaah Accountant**: Read/write access to payments and reports
- **System Manager**: Full administrative access

## Troubleshooting

### Payment Not Auto-Allocated
1. Check if there are outstanding zakaah calculations
2. Verify the Journal Entry has correct account codes
3. Ensure the payment amount is positive

### Manual Allocation
If automatic allocation fails:
1. Go to Zakaah Payment record
2. Click "Auto Allocate" button
3. Check for error messages

### Account Detection
The system detects zakaah accounts by:
- Account code containing "2205001"
- Account name containing "zakaa" (case-insensitive)

## Reports

### Zakaah Outstanding Summary
Shows:
- Outstanding zakaah by Hijri year
- Total calculated, paid, and outstanding amounts
- Status of each calculation run

## Technical Details

### Document Events
- `Journal Entry.on_submit`: Creates Zakaah Payment and auto-allocates
- `Journal Entry.on_cancel`: Reverses allocations and cancels payments

### Database Tables
- `tabZakaah Payment`: Stores payment records
- `tabZakaah Calculation Run`: Stores calculation results
- Links maintained via `journal_entry` field

### Error Handling
- All operations include try-catch blocks
- Errors are logged to Frappe Error Log
- User-friendly error messages displayed


