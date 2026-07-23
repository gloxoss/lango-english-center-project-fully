const fs = require('fs');
let content = fs.readFileSync('src/models/Schema.ts', 'utf8');

const searchEnum = `export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'late', 'excused']);`;
const replaceEnum = `${searchEnum}
export const invoiceStatusEnum = pgEnum('invoice_status', ['pending', 'partial', 'paid', 'overdue', 'cancelled']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'transfer', 'check']);
export const expenseCategoryEnum = pgEnum('expense_category', ['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other']);`;

content = content.replace(searchEnum, replaceEnum);

fs.writeFileSync('src/models/Schema.ts', content);
