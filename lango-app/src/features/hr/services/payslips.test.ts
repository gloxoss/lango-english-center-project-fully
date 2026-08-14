import { describe, expect, it } from 'vitest';
import { renderPayslipHtml } from './payslips';

describe('employee payslip rendering', () => {
  it('escapes stored employee identity fields and does not claim statutory percentages', () => {
    const html = renderPayslipHtml({
      employeeName: '<img src=x onerror=alert(1)>', employeeEmail: 'a&b@example.test', issuedAt: '2026-08-01',
      year: 2026, month: 7, grossSalary: '1000', cnssEmployee: '10', amoEmployee: '20', irTax: '30',
      netSalary: '940', cnssEmployer: '40', amoEmployer: '50', totalEmployerCost: '1090',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('a&amp;b@example.test');
    expect(html).not.toMatch(/\(\d+(?:\.\d+)?%\)/);
  });
});
