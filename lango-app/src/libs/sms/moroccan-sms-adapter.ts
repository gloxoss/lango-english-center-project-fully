/**
 * Moroccan SMS Adapter & Phone Number Normalizer (+212)
 * Phone normalization and SMS templates. Sending goes through
 * features/broadcast/services/sms-delivery (real providers, STOP enforced).
 */

/**
 * Normalizes a Moroccan phone number to E.164 (+212) format.
 * Examples:
 *   "06 61 22 33 44" -> "+212661223344"
 *   "07 12 34 56 78" -> "+212712345678"
 *   "+212661223344"  -> "+212661223344"
 */
export function normalizeMoroccanPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+212')) {
    return cleaned;
  }
  if (cleaned.startsWith('00212')) {
    return `+${cleaned.slice(2)}`;
  }
  if (cleaned.startsWith('212')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('06') || cleaned.startsWith('07') || cleaned.startsWith('05')) {
    return `+212${cleaned.slice(1)}`;
  }

  return cleaned;
}

/**
 * Formats an Attendance Absence SMS template in French.
 */
export function formatAbsenceSms(studentName: string, dateStr: string): string {
  return `SchoolOS Center: Nous vous informons de l'absence de votre enfant ${studentName} le ${dateStr}. Merci de contacter l'administration.`;
}

/**
 * Formats a Payment Due Reminder SMS template.
 */
export function formatPaymentReminderSms(studentName: string, amountMad: number, dueDateStr: string): string {
  return `SchoolOS Center: Rappel de paiement de la scolarité pour ${studentName} d'un montant de ${amountMad} MAD à régler avant le ${dueDateStr}.`;
}
