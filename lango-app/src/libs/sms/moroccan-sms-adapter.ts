/**
 * Moroccan SMS Adapter & Phone Number Normalizer (+212)
 * Handles phone normalization, template generation, and multi-provider dispatch.
 */

export type SmsDispatchResult = {
  success: boolean;
  messageId: string;
  normalizedPhone: string;
  provider: 'IAM_SMS' | 'ORANGE_SMS' | 'INWI_SMS' | 'MOCK_GATEWAY';
  sentAt: string;
};

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
  return `Lango Center: Nous vous informons de l'absence de votre enfant ${studentName} le ${dateStr}. Merci de contacter l'administration.`;
}

/**
 * Formats a Payment Due Reminder SMS template.
 */
export function formatPaymentReminderSms(studentName: string, amountMad: number, dueDateStr: string): string {
  return `Lango Center: Rappel de paiement de la scolarité pour ${studentName} d'un montant de ${amountMad} MAD à régler avant le ${dueDateStr}.`;
}

/**
 * Dispatches an SMS to a Moroccan recipient phone number.
 */
export async function sendMoroccanSms(
  recipientPhone: string,
  messageText: string,
): Promise<SmsDispatchResult> {
  const normalizedPhone = normalizeMoroccanPhone(recipientPhone);

  if (!normalizedPhone || normalizedPhone.length < 12) {
    throw new Error(`Numéro de téléphone marocain invalide: ${recipientPhone}`);
  }

  // Simulated provider dispatch with unique message ID
  const messageId = `SMS-MA-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  return {
    success: true,
    messageId,
    normalizedPhone,
    provider: 'MOCK_GATEWAY',
    sentAt: new Date().toISOString(),
  };
}
