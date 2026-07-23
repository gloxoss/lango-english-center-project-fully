const fs = require('fs');

// 1. src/actions/finance.ts
let financeTs = fs.readFileSync('src/actions/finance.ts', 'utf8');
financeTs = financeTs.replace("import { db } from '@/models/db';", "import { db } from '@/libs/DB';");
financeTs = financeTs.replace("import { feeStructures, invoices, payments, expenses, user, studentGroups, courses } from '@/models/Schema';", "import { feeStructures, invoices, payments, expenses, user } from '@/models/Schema';");
fs.writeFileSync('src/actions/finance.ts', financeTs);

// 2. src/app/[locale]/(auth)/dashboard/finance/page.tsx
let financePage = fs.readFileSync('src/app/[locale]/(auth)/dashboard/finance/page.tsx', 'utf8');
financePage = financePage.replace("import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';", "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';");
financePage = financePage.replace("import { DollarSign, CreditCard, Receipt, TrendingUp, TrendingDown } from 'lucide-react';", "import { DollarSign, Receipt, TrendingUp, TrendingDown } from 'lucide-react';");
fs.writeFileSync('src/app/[locale]/(auth)/dashboard/finance/page.tsx', financePage);

// 3. src/components/attendance/AttendanceClientWrapper.tsx
let attendanceClient = fs.readFileSync('src/components/attendance/AttendanceClientWrapper.tsx', 'utf8');
attendanceClient = attendanceClient.replace("import { Calendar as CalendarIcon, Check, ChevronDown, Save, Search, UserCheck } from 'lucide-react';", "import { Check, ChevronDown, Save, Search, UserCheck } from 'lucide-react';");
attendanceClient = attendanceClient.replace("export function AttendanceClientWrapper({ \n  initialAttendance, \n  courses, \n  studentGroups, \n  tenantId \n}: { \n  initialAttendance: any[], \n  courses: any[], \n  studentGroups: any[], \n  tenantId: string \n}) {", "export function AttendanceClientWrapper({ \n  initialAttendance, \n  courses, \n  studentGroups\n}: { \n  initialAttendance: any[], \n  courses: any[], \n  studentGroups: any[]\n}) {");
// Ensure tenantId isn't used anywhere else inside the component. If it is, the build will error. (I assume it's unused).
fs.writeFileSync('src/components/attendance/AttendanceClientWrapper.tsx', attendanceClient);

// 4. src/components/attendance/AttendanceHeatmap.tsx
let attendanceHeatmap = fs.readFileSync('src/components/attendance/AttendanceHeatmap.tsx', 'utf8');
attendanceHeatmap = attendanceHeatmap.replace("Array.from({ length: 90 }).map((_, i) => {", "Array.from({ length: 90 }).map((_) => {");
fs.writeFileSync('src/components/attendance/AttendanceHeatmap.tsx', attendanceHeatmap);

// 5. src/components/layout/AdminShell.tsx
let adminShell = fs.readFileSync('src/components/layout/AdminShell.tsx', 'utf8');
adminShell = adminShell.replace("IconCalendarTime", "IconCalendarEvent");
adminShell = adminShell.replace("IconCalendarTime", "IconCalendarEvent");
fs.writeFileSync('src/components/layout/AdminShell.tsx', adminShell);

// 6. src/scripts/seed-frappe.ts
let seedFrappe = fs.readFileSync('src/scripts/seed-frappe.ts', 'utf8');
seedFrappe = seedFrappe.replace(
  "dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],",
  "dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0] as string,"
);
seedFrappe = seedFrappe.replace(
  "expenseDate: new Date().toISOString().split('T')[0],",
  "expenseDate: new Date().toISOString().split('T')[0] as string,"
);
// Also fix the undefined 'invoice' issue
seedFrappe = seedFrappe.replace(
  "console.log(`Created Invoice for Student: ${studentForInvoice.name}`);",
  "console.log(`Created Invoice for Student: ${studentForInvoice.name}`);\n        if (!invoice) throw new Error('Invoice creation failed');"
);
fs.writeFileSync('src/scripts/seed-frappe.ts', seedFrappe);
