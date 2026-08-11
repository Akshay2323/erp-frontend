# API Prompt — Hour-based My Salary Payslip PDF

Copy everything below the line into a backend agent (Laravel / `erp-backend`).

---

## Task

Implement a new authenticated API that generates and downloads a **PDF salary slip** for the hour-based **My Salary** screen.

This is **not** the existing PayrollRun payslip (`GET /api/v1/payroll/payslip/{payrollRun}/download`). My Salary uses live hour-based calculation via `HourBasedSalaryService` and often has **no** finalized payroll run. Create a dedicated endpoint.

## Endpoint

```
GET /api/v1/payroll/my-salary/payslip
```

Register it in the existing Sanctum-protected `payroll` route group in `routes/api.php`, next to:

```php
Route::get('my-salary', [MySalaryController::class, 'show']);
```

Suggested:

```php
Route::get('my-salary/payslip', [MySalaryPayslipController::class, 'download']);
```

## Auth & authorization

- Middleware: `auth:sanctum` (same as other payroll routes).
- Reuse the **exact** employee resolution and scope rules from `App\Http\Controllers\Api\V1\Payroll\MySalaryController::resolveTargetEmployee` (or extract/share that method):
  - Payroll admins (`Super Admin`, `Group Admin`, `Company Admin`, `HR`) and `Manager` may pass `employee_id` within their scope.
  - Regular employees may only download their own linked employee’s payslip.
  - Call `AccessScopeService::assertTenantUser` like My Salary does.
- Return:
  - `401` unauthenticated
  - `403` no linked employee / out of scope / cannot view payroll
  - `404` employee not found
  - `422` invalid query params

## Query parameters

| Param | Required | Rules |
|-------|----------|--------|
| `month` | yes | integer 1–12 |
| `year` | yes | integer 2000–2100 |
| `employee_id` | no | integer; admin/manager only (same as `GET my-salary`) |

Reuse or clone `MySalaryRequest` validation for these fields.

## Response

- **Success `200`:** binary PDF stream
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="payslip_{employee_code}_{YYYY}_{MM}.pdf"`
  - Prefer the same embeddable download headers used by `PayslipController` / `EmbedableFileResponse` if applicable.
- Do **not** return JSON on success.

## PDF engine & branding

- Use existing DomPDF setup: `Barryvdh\DomPDF\Facade\Pdf`.
- Create Blade view: `resources/views/pdf/my-salary-payslip.blade.php`.
- Branding comes from the **employee’s company Tenant**, not the logged-in user’s session tenant alone:
  - Relation: `Employee::company()` → `Tenant` via `company_id`
  - Company name: `Tenant.company_name` (fallback `legal_name` or `"Company"`)
  - Logo: use `Tenant::resolvedLogoPath()` (preferred) or existing disk path under `storage/app/public/...`
  - Embed logo as a **data URI** in the Blade (same pattern as `PayslipController::buildPdf`) so DomPDF always renders it.
- DejaVu Sans (or existing DomPDF font) for ₹ / Unicode.

## Data to load

1. Resolve target `Employee`.
2. Eager-load:
   - `company` (Tenant)
   - `branch`
   - `designation` (and/or `jobDetail.designation`)
   - `jobDetail`
   - `contactDetail`
   - `bankDetail`
   - `statutoryDetail`
   - `salaryDetail` (if needed for monthly CTC display)
3. Build hour-based payload:

```php
$data = app(HourBasedSalaryService::class)->build($employee, $month, $year);
```

Use `$data['summary']`, `$data['period']`, `$data['attendance_summary']`, `$data['records']`.

## PDF layout (match reference Salarybox-style slip)

Reference sections (adapt design/spacing as needed, keep structure):

1. **Header**
   - Company name (left) + company logo (right)
   - Title: `Salary Slip for {Month Name} {Year}` (e.g. `Salary Slip for January 2026`)
   - Optional small report date line

2. **Employee Details** (2-column key/value table)
   - Name → `employee.fullName()`
   - Phone → `employee.mobile` (fallback emergency contact phone if needed; show `—` if missing)
   - Salary Amount → monthly basic/gross from salary structure or `salaryDetail` if available; otherwise omit or show hourly rate from summary
   - Designation → designation name (`employee.designation` or `jobDetail.designation`)
   - Date of Joining → `employee.joining_date`
   - Branch → branch name (`employee.branch`)
   - PAN → `statutoryDetail.pan_number`
   - Bank Name → `bankDetail.bank_name`
   - Bank Account Number → `bankDetail.account_number`
   - Employee Code → `employee.employee_code`

3. **Salary Calculations** (two columns: Earnings | Deductions)
   - Earnings rows:
     - Regular / Base hours earning = `summary.total_regular_hours * summary.hourly_rate` (or sum of `records[].regular_earning`)
     - Overtime earning = `summary.total_overtime_hours * summary.overtime_rate` (or sum of OT earnings)
     - **Total Earnings** = `summary.gross_earnings`
   - Deductions rows:
     - Statutory / structure deductions = `summary.total_deductions` (label clearly, e.g. PF + ESI / Other Deductions)
     - Late penalty = `summary.late_penalty`
     - Early departure penalty = `summary.early_departure_penalty`
     - **Total Deductions** = `total_deductions + total_penalty`
   - **Net Salary** = `summary.net_payable` (prominent)

4. **Attendance Summary**
   - Prefer `attendance_summary.status_counts` keys (Present, Absent, Week Off, Holiday, Leave, Half Day, etc.)
   - Also show:
     - Hours worked / regular hours → `summary.total_regular_hours` (format as `Xh Ym` if helpful)
     - Overtime hours → `summary.total_overtime_hours`
     - Days present → `summary.days_present`

5. **Earnings Breakdown** (optional but preferred)
   - Simple rows: `Regular Hours Pay`, `Overtime Pay` with amounts for the month

6. **Deductions Breakdown** (optional but preferred)
   - Rows for PF/ESI/structure deductions, late penalty, early departure penalty

7. **Footer**
   - `This is a system-generated payslip.`

Currency format: Indian style with 2 decimals, prefix `₹` (e.g. `₹ 6,193.55`).

## Implementation notes

- Prefer a dedicated controller `App\Http\Controllers\Api\V1\Payroll\MySalaryPayslipController` with method `download`.
- Keep PDF generation logic clean: controller resolves employee + builds data; Blade is presentation-only.
- Do not require a `PayrollRun` record.
- OpenAPI/Swagger attributes optional but nice to have (tag: `Payroll — My salary`).
- Add a feature test covering:
  - Employee can download own payslip PDF (`200`, `application/pdf`)
  - Employee cannot download another employee’s payslip (`403`)
  - Validation errors for missing month/year (`422`)
  - Admin with `employee_id` in scope can download that employee’s PDF

## Frontend contract (for callers)

```http
GET /api/v1/payroll/my-salary/payslip?month=7&year=2026
Authorization: Bearer {token}
Accept: application/pdf
```

Admin viewing another employee:

```http
GET /api/v1/payroll/my-salary/payslip?month=7&year=2026&employee_id=13
Authorization: Bearer {token}
Accept: application/pdf
```

## Out of scope

- Do not change the existing PayrollRun payslip template unless extracting a shared logo helper is trivial.
- No email / bulk ZIP for hour-based slips in this task.
- No JSON “preview” endpoint required unless useful for debugging.
