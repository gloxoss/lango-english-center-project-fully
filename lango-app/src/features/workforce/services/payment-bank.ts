export function missingBankRibCount(rows: Array<{ bankRib: string | null }>): number {
  return rows.filter(row => !row.bankRib?.trim()).length;
}

export function isBankPaymentMethod(method: string): boolean {
  return method === 'bank' || method === 'bank_transfer';
}
