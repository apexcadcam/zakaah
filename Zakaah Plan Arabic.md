# نظام إدارة الزكاة - خطة التنفيذ الكاملة

## نظرة عامة

نظام شامل لحساب ومتابعة زكاة الشركات بناءً على تقييم الأصول، أسعار الذهب، ومطابقة المدفوعات تلقائياً.

---

## التقنيات المستخدمة

### إطار العمل والمنصة
- **Frappe Framework**: الإصدار 14.0 أو أعلى
  - إطار العمل الأساسي لتطوير التطبيق
  - يوفر ORM، API، مكونات UI، وواجهة إدارية
  - يتعامل مع تجريد قاعدة البيانات والتحديثات

- **ERPNext**: وحدة التكامل
  - وحدة المحاسبة لمتابعة الأصول
  - تكامل قيود اليومية
  - إدارة الحسابات
  - إدارة أسعار الصرف

### قاعدة البيانات
- **MariaDB**: قاعدة البيانات الرئيسية
  - تخزين جميع بيانات التطبيق
  - بيانات DocTypes
  - سجلات المعاملات
  - استعلامات مفهرسة للأداء

### اللغة والبيئة
- **Python**: الإصدار 3.8 أو أعلى
  - منطق العمل للواجهة الخلفية
  - تطوير API
  - معالجة البيانات والحسابات
  - البرمجة النصية من جانب الخادم

- **JavaScript**: البرمجة النصية من جانب العميل
  - تخصيص النماذج
  - تفاعلات واجهة المستخدم
  - السلوك الديناميكي للنماذج
  - التحقق من صحة جانب العميل

### APIs والتكامل
- **APIs أسعار الذهب**:
  - metals-api.com (الرئيسي)
  - goldapi.io (البديل)
  - اختياري: إدخال يدوي احتياطي

- **أسعار صرف العملات**: وحدة أسعار الصرف في ERPNext
- **REST API**: إطار عمل Frappe REST لمكالمات API

### تقنيات الويب
- **HTML5/CSS3**: واجهة المستخدم
- **Bootstrap**: مكونات واجهة المستخدم
- **jQuery**: معالجة DOM
- **Frappe Charts**: تصور البيانات

### أدوات التطوير
- **Git**: التحكم في الإصدارات
- **Bench CLI**: أدوات تطوير Frappe
- **Frappe Desk**: بيئة التطوير

### الاعتماديات
```txt
frappe>=14.0.0
erpnext>=14.0.0
mysqlclient>=2.1.0
requests>=2.28.0
python-dateutil>=2.8.0
```

### نمط البنية
- **Model-View-Controller (MVC)**:
  - DocType JSON (النموذج)
  - كلاسات Python (المتحكم)
  - JavaScript (العرض)
- **RESTful API**: التواصل بين الخادم والعميل
- **تطبيق صفحة واحدة**: واجهة Frappe Desk

---

## المتطلبات الأساسية

### 1. تقييم شامل للأصول
حساب إجمالي أصول الشركة بما في ذلك:
- النقدية: الإيداعات البنكية، النقد التشغيلي، الاحتياطيات
- المخزون: اختيار بين رصيد الحساب أو حركات المخزون
- الديون المدينة: ديون العملاء (قابل للتكوين حسب النوع: جيدة/مشكوك فيها/معدومة)
- الديون الدائنة: ديون الموردين (تخصم من الأصول)
- الاحتياطيات والتكاليف التشغيلية: إذا كانت نقدية، تُدرج في حساب الزكاة

### 2. دعم العملات المتعددة
- العملة الأساسية: ج.م (جنيه مصري)
- العملات المدعومة: الدولار، اليورو، اليوان الصيني، الريال السعودي
- سعر الصرف: استخدام السعر اعتباراً من تاريخ نهاية السنة المالية
- التحويل: تحويل جميع العملات إلى جنيه مصري بسعر نهاية السنة

### 3. النصاب على أساس الذهب
- المعيار: 85 جرام ذهب عيار 24
- مصدر السعر: API مباشر (نسخة مجانية متاحة)
- طريقة الحساب: قيمة النصاب = 85 × سعر الذهب للجرام
- التكرار: يتم جلب السعر عند الحاجة، يُخزن لكل تاريخ حساب

### 4. دعم التقويم المزدوج
- ميلادي: التقويم الميلادي المعياري
- هجري: التقويم الإسلامي القمري
- الاختيار: المستخدم يختار نوع التقويم لكل حساب
- السنة المالية: تُسمى حسب نوع التقويم المختار

### 5. مطابقة المدفوعات (مثل وحدة مطابقة المدفوعات)
- غير المسددة فقط: جلب السنوات والمدفوعات غير المسددة فقط
- الدفعة الجزئية: تتبع ما تم دفعه مقابل المتبقي لكل سنة
- الإخفاء التلقائي: السنوات المدفوعة بالكامل تُخفي تلقائياً
- قيود اليومية: عرض القيود غير المُخصصة بالكامل فقط

---

## معمارية النظام

### DocTypes المطلوبة

#### 1. تكوين أصول الزكاة (Singleton)
الهدف: تكوين الحسابات المستخدمة لحساب الزكاة

الحقول:
- cash_accounts (جدول)
- inventory_accounts (جدول)
- receivable_accounts (جدول)
- payable_accounts (جدول)
- operational_costs (جدول)
- reserve_accounts (جدول)

هيكل الجدول الفرعي (حسابات النقدية):
- account (رابط للحساب)
- include_bank_deposits (مربع اختيار) - شامل الإيداعات البنكية
- notes (نص)

هيكل الجدول الفرعي (المخزون):
- account (رابط للحساب)
- calculation_method (اختيار: "رصيد الحساب" | "حركات المخزون")
- notes (نص)

هيكل الجدول الفرعي (الديون المدينة):
- account (رابط للحساب)
- debt_type (اختيار: "الكل" | "جيدة" | "مشكوك فيها" | "معدومة")
- include_advances (مربع اختيار)
- notes (نص)

هيكل الجدول الفرعي (الديون الدائنة):
- account (رابط للحساب)
- deduct_from_assets (مربع اختيار) - دائماً نعم
- notes (نص)

---

#### 2. تشغيل حساب الزكاة (المستند الرئيسي)
الهدف: حفظ نتائج حساب الزكاة السنوي

الحقول:
- company (رابط لشركة) *
- fiscal_year (بيانات) *
- calendar_type (اختيار: ميلادي|هجري) *
- from_date (تاريخ) *
- to_date (تاريخ) *
- gold_price_date (تاريخ)
- gold_price_per_gram_24k (عملة)
- nisab_value (عملة)
- nisab_met (مربع اختيار)
- total_assets_in_gold_grams (عائم)
- cash_balance (عملة)
- inventory_balance (عملة)
- receivables (عملة)
- payables (عملة)
- reserves (عملة)
- total_assets (عملة)
- zakaah_rate (نسبة، افتراضي: 2.5)
- total_zakaah (عملة)
- paid_zakaah (عملة)
- outstanding_zakaah (عملة)
- status (اختيار: مسود|محسوب|مدفوع جزئياً|مدفوع|لا تجب)
- items (جدول: أصناف حساب الزكاة)
- exchange_rates (JSON)

---

#### 3. أصناف حساب الزكاة (جدول فرعي)
الهدف: تفصيل الأصول

الحقول:
- asset_category (اختيار: نقدية|مخزون|ديون مدينة|ديون دائنة|احتياطيات)
- account (رابط للحساب)
- balance (عملة)
- currency (رابط للعملة)
- exchange_rate (عائم)
- notes (نص)
- sub_total (عملة)

---

#### 4. سعر الذهب (DocType جديد)
الهدف: حفظ أسعار الذهب

الحقول:
- price_date (تاريخ) *
- currency (اختيار: ج.م) *
- price_per_gram_24k (عملة) *
- source (بيانات) - اسم الـ API
- api_response (JSON) - استجابة كاملة من الـ API

---

#### 5. معاملات الزكاة (جدول فرعي - موجود)
التحديث: تتبع حالة التخصيص

الحقول الإضافية:
- is_fully_allocated (مربع اختيار) - للقراءة فقط، محسوب
- remaining_unallocated (عملة) - للقراءة فقط، محسوب

---

#### 6. سجل تخصيص الزكاة (موجود - مُحسّن)
الهدف: تتبع تخصيصات المدفوعات للسنوات

تتبع الحالة:
- تسجيل كل تخصيص
- تتبع المبلغ غير المُخصص لكل قيد يومية
- الربط بقيد اليومية والسنوات معاً

---

## هيكل المشروع

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
│   │   │   ├── zakaah_payments/ (موجود - مُحسّن)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_payments.json
│   │   │   │   ├── zakaah_payments.py
│   │   │   │   └── zakaah_payments.js
│   │   │   │
│   │   │   ├── zakaah_payment_entry/ (موجود)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_payment_entry.json
│   │   │   │   └── zakaah_payment_entry.py
│   │   │   │
│   │   │   ├── zakaah_allocation_history/ (موجود - مُحسّن)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── zakaah_allocation_history.json
│   │   │   │   └── zakaah_allocation_history.py
│   │   │   │
│   │   │   └── zakaah_account_item/ (موجود)
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

### المجلدات الرئيسية

**zakaah/zakaah_management/doctype/**
- يحتوي على جميع DocTypes المخصصة
- كل DocType يتكون من: مخطط JSON، كلاس Python، سكريبتات JavaScript

**zakaah/zakaah_management/public/**
- ملفات CSS و JavaScript
- تخصيصات جانب العميل

**zakaah/hooks.py**
- خطافات وإعدادات التطبيق
- التخصيصات على Frappe/ERPNext

**zakaah/config/desktop.py**
- تكوين سطح المكتب
- عناصر القائمة والتنقل

---

## منطق الحساب

### الخطوة 1: حساب الأصول

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
    
    # 1. النقدية (شاملة الإيداعات البنكية)
    for account in config['cash_accounts']:
        balance = get_account_balance(account, to_date)
        if account.get('include_bank_deposits'):
            deposits = get_bank_deposits(account, to_date)
            balance += deposits
        assets['cash'] += balance
    
    # 2. المخزون (اختيار المستخدم)
    for account in config['inventory_accounts']:
        if account['calculation_method'] == 'account':
            balance = get_account_balance(account, to_date)
        else:
            balance = calculate_stock_balance(account, to_date)
        assets['inventory'] += balance
    
    # 3. الديون المدينة (فلترة حسب النوع)
    for account in config['receivable_accounts']:
        debt_type = account.get('debt_type', 'All')
        balance = get_receivables_by_type(account, to_date, debt_type)
        assets['receivables'] += balance
    
    # 4. الديون الدائنة (تُخصم)
    for account in config['payable_accounts']:
        balance = get_account_balance(account, to_date)
        assets['payables'] += balance
    
    # 5. الاحتياطيات (احتياطيات نقدية)
    for account in config.get('reserve_accounts', []):
        balance = get_account_balance(account, to_date)
        assets['reserves'] += balance
    
    # 6. التحويل للعملات المتعددة
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
    
    # حساب الإجمالي بالجنيه المصري
    total = (assets['cash'] + assets['inventory'] + 
             assets['receivables'] - assets['payables'] + 
             assets['reserves'])
    
    # إضافة المبالغ المحولة
    for curr_data in assets['currencies'].values():
        total += curr_data['egp_value']
    
    assets['total_in_egp'] = total
    return assets
```

### الخطوة 2: حساب النصاب والزكاة

```python
def calculate_nisab_and_zakaah(total_assets, calculation_date):
    gold_price = get_gold_price_for_date(calculation_date)
    nisab_value = 85 * gold_price
    assets_in_gold = total_assets / gold_price
    meets_nisab = assets_in_gold >= 85
    
    if meets_nisab:
        zakaah_amount = total_assets * 0.025
        status = "تجب"
    else:
        zakaah_amount = 0
        status = "لا تجب - دون النصاب"
    
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

## منطق مطابقة المدفوعات

### المفهوم
مشابه لوحدة مطابقة المدفوعات في ERPNext - عرض العناصر غير المسددة فقط.

### التنفيذ

#### 1. جلب سنوات الحساب غير المسددة

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

#### 2. جلب قيود اليومية غير المسددة

```python
@frappe.whitelist()
def import_journal_entries(company, from_date, to_date, selected_accounts):
    # جلب كل القيود من الحسابات
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
    
    # جلب المبالغ المُخصصة بالفعل
    allocated = frappe.db.sql("""
        SELECT journal_entry, SUM(allocated_amount) as total_allocated
        FROM `tabZakaah Allocation History`
        WHERE docstatus != 2
        GROUP BY journal_entry
    """, as_dict=True)
    
    allocated_dict = {row.journal_entry: row.total_allocated for row in allocated}
    
    # فلترة: فقط القيود ذات المبلغ غير المُخصص > 0
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

## سير العمل للمستخدم

### السيناريو 1: حساب الزكاة لسنة 2024

```
1. افتح "تشغيل حساب الزكاة"
2. انقر "جديد"
3. املأ البيانات:
   - الشركة: "شركة ABC"
   - نوع التقويم: "ميلادي"
   - السنة المالية: "2024"
   - من تاريخ: 2024-01-01
   - إلى تاريخ: 2024-12-31
4. انقر "تحميل تكوين الأصول"
   → النظام يحمل إعدادات الحسابات
5. راجع تفصيل الأصول
6. انقر "حساب الزكاة"
   → النظام يعرض معاينة:
      - الأصول: 1,050,000 ج.م
      - المكافئ الذهبي: 1,018 جرام
      - يتجاوز النصاب: ✓
      - الزكاة المستحقة: 26,250 ج.م (2.5%)
7. انقر "حفظ وإرسال"
```

### السيناريو 2: دفع جزئي

```
1. افتح "معاملات الزكاة"
2. املأ البيانات:
   - الشركة: "شركة ABC"
   - من تاريخ: 2025-01-01
   - إلى تاريخ: 2025-01-31
3. انقر "جلب الإدخالات غير المسددة"
   → يعرض فقط السنوات ذات الرصيد المستحق
   → يعرض فقط قيود اليومية غير المُخصصة
4. انقر "تخصيص"
   → دفعت 50,000 لسنة 2024 (المستحقة كانت 26,250، لكن دُفع أكثر)
   → المتبقي: 23,750 ستذهب لسنة 2023
5. النظام ينشئ سجلات سجل التخصيص
6. حالة تشغيل الحساب: "مدفوع جزئياً"
```

### السيناريو 3: دفع كامل

```
1. افتح "معاملات الزكاة"
2. انقر "جلب الإدخالات غير المسددة"
   → الآن يعرض: 2023, 2024 فقط (2022 مدفوعة بالكامل ومخفية)
   → يعرض فقط قيود اليومية الجديدة/غير المُخصصة
3. خصص المدفوعات المتبقية
4. 2023 و 2024 الآن تظهر "مدفوع"
5. جلب الإدخالات غير المسددة مرة أخرى
   → يعرض "لم يتم العثور على إدخالات غير مسددة"
```

---

## تكامل API

### API أسعار الذهب

المُوصى به: استخدام API نسخة مجانية
- الخيار 1: https://metals-api.com (نسخة مجانية: 100 طلب/شهر)
- الخيار 2: https://goldapi.io (نسخة مجانية متاحة)
- الخيار 3: إدخال يدوي إذا كان API غير متاح

التنفيذ:
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
        return 2500  # سعر افتراضي
```

---

## الإعدادات

### الإعدادات المطلوبة

#### 1. تكوين أصول الزكاة
تكوين حسب الشركة الحسابات المستخدمة:
- حسابات نقدية (مع/بدون إيداعات بنكية)
- حسابات مخزون (طريقة الحساب)
- حسابات ديون مدينة (فلترة حسب نوع الدين)
- حسابات ديون دائنة (تُخصم دائماً)
- حسابات احتياطيات (إذا كانت نقدية)

#### 2. مفتاح API الذهب (إذا تم استخدام API)
```python
# في site_config.json
{
  "gold_api_key": "your_api_key_here"
}
```

#### 3. أسعار الصرف
- من جدول أسعار صرف العملات في ERPNext
- التاريخ: استخدام تاريخ نهاية السنة المالية
- العملات: دولار، يورو، يوان صيني، ريال سعودي

---

## تفاصيل الحقول والمنطق التجاري

### فئات الأصول المُوضحة

#### 1. النقدية
- يشمل: حسابات بنكية، حسابات نقدية، نقد تشغيلي
- الإيداعات البنكية: إدراج اختياري

#### 2. المخزون
- طريقة الحساب: سريع، من رصيد الحساب
- من حركات المخزون: تفصيلي، يحسب الأصناف الفعلية
- اختيار المستخدم لكل حساب

#### 3. الديون المدينة
- الكل: شامل كل ديون العملاء
- جيدة فقط: فقط الديون القابلة للتحصيل
- مشكوك فيها: تضمين بنسبة مئوية
- معدومة: استبعاد أو تضمين بـ 0%

#### 4. الديون الدائنة
- تُخصم دائماً من إجمالي الأصول
- فواتير الموردين، المقدمات، الاعتمادات

#### 5. الاحتياطيات والتكاليف التشغيلية
- تُضمّن فقط إذا كانت نقدية
- مثال: احتياطيات نقدية، صندوق المصروفات التشغيلية
- لا تُضمّن إذا كانت في أصول (أصول ثابتة)

---

## الصلاحيات

### الأدوار

1. مدير الزكاة
   - الوصول الكامل لجميع DocTypes
   - يمكن تكوين إعدادات الأصول
   - يمكن إنشاء حسابات
   - يمكن تخصيص المدفوعات

2. محاسب الزكاة
   - صلاحية قراءة/كتابة للحسابات والمدفوعات
   - لا يمكن تكوين إعدادات الأصول
   - يمكن عرض التقارير

3. مدير النظام
   - الوصول الكامل
   - يمكن تكوين كل شيء

---

## التقارير

### 1. ملخص حساب الزكاة
- جميع تشغيلات الحساب
- حسب السنة، حسب نوع التقويم
- الإجمالي مقابل المدفوع مقابل المتبقي
- مؤشرات الحالة

### 2. سجل مدفوعات الزكاة
- جميع المدفوعات المُخصصة
- حسب تفصيل السنة
- إشارات لقيود اليومية

### 3. تقرير الزكاة المتبقية
- فقط السنوات غير المدفوعة
- المبالغ المتبقية
- تحليل التقادم

### 4. تقرير تفصيل الأصول
- الأصول حسب الفئة
- تحويل العملات المتعددة
- حساب المكافئ الذهبي

---

## سيناريوهات الاختبار

### حالة اختبار 1: شركة جديدة
- أول سنة لحساب الزكاة
- جميع الأصول بالجنيه المصري
- تجاوز النصاب
المتوقع: حساب كامل ناجح

### حالة اختبار 2: عملات متعددة
- أصول بالدولار، اليورو، اليوان الصيني
- أسعار صرف نهاية السنة
- تحويل الكل إلى جنيه مصري
المتوقع: تحويل وإجمالي صحيح

### حالة اختبار 3: دفع جزئي
- سنة 2022 مستحقة 100,000
- دفع 50,000
المتوقع: المتبقي = 50,000، الحالة = "مدفوع جزئياً"

### حالة اختبار 4: مطابقة المدفوعات
- دفع 100,000 لتسوية 2022
المتوقع: 
  - حالة 2022 = "مدفوع"
  - 2022 لم تعد في قائمة غير المسددة
  - فقط السنوات الجديدة تظهر

### حالة اختبار 5: تحت النصاب
- الأصول = 100 جرام ذهب (أقل من 85)
المتوقع: الحالة = "لا تجب"، الزكاة = 0

---

## أولوية التنفيذ

### المرحلة 1: الحساب الأساسي
1. إنشاء DocTypes
2. تنفيذ حساب الأصول
3. تنفيذ حساب النصاب
4. واجهة المستخدم الأساسية

### المرحلة 2: تتبع المدفوعات
1. تحسين معاملات الزكاة
2. تنفيذ منطق المطابقة
3. تتبع سجل التخصيص

### المرحلة 3: الميزات المتقدمة
1. دعم العملات المتعددة
2. اختيار طريقة المخزون
3. التقارير ولوحات المعلومات
4. تكامل API لأسعار الذهب

### المرحلة 4: اللمسات الأخيرة
1. معالجة الأخطاء
2. قواعد التحقق
3. تحسين الأداء
4. توثيق المستخدم

---

## ملاحظات

### اعتبارات مهمة

1. سعر الذهب: يُجلب عند الطلب، يُخزن لكل تاريخ
2. أسعار الصرف: استخدام سعر نهاية السنة بشكل ثابت
3. المدفوعات: تتبع من حسابات الزكاة المستحقة فقط
4. المخزون: اختيار المستخدم مهم للدقة
5. الديون المدينة: قابل للتكوين حسب جودة الدين

### القيود المعروفة

1. API الذهب قد يكون له حدود معدل (يُعادل بواسطة التخزين المؤقت)
2. أسعار الصرف التاريخية قد لا تكون متاحة
3. حساب حركات المخزون أبطأ للمخزونات الكبيرة

---

## معايير النجاح

### المتطلبات الوظيفية
- حساب جميع أنواع الأصول
- دعم العملات المتعددة
- تتبع النصاب القائم على الذهب
- مطابقة المدفوعات
- دعم التقويم المزدوج
- منع التخصيصات المكررة

### المتطلبات غير الوظيفية
- حساب سريع (< 5 ثوان)
- مطابقة دقيقة
- واجهة مستخدم سهلة
- تقارير شاملة
- معالجة أخطاء مناسبة

---

## الدعم والصيانة

### التكوين
- مراجعة تكوين الأصول سنوياً
- تحديث أسعار الصرف حسب الحاجة
- مراقبة حالة API أسعار الذهب

### استكشاف الأخطاء
- التحقق من صحة مفتاح API الذهب
- التحقق من تعيينات الحسابات
- مراجعة سجل التخصيص

---

الإصدار: 1.0
آخر تحديث: 2025-01-XX
الحالة: مرحلة التخطيط
