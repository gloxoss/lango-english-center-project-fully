import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { issuedCertificates } from '@/features/certificates/models/certificates-schema';
import crypto from 'node:crypto';

export class SerialService {
  static async generateVerificationToken(): Promise<{ token: string; hash: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }

  /**
   * Generates a transaction-safe serial number for a certificate.
   * Format: CERT-{YYYY}-{000000}
   */
  static async generateSerial(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    tenantId: string
  ): Promise<string> {
    const year = new Date().getFullYear().toString();
    const prefix = `CERT-${year}-`;

    // Re-check max inside the transaction to avoid races, matching AssetService pattern
    const existing = await tx
      .select({ serialNumber: issuedCertificates.serialNumber })
      .from(issuedCertificates)
      .where(
        and(
          eq(issuedCertificates.tenantId, tenantId),
          sql`${issuedCertificates.serialNumber} LIKE ${prefix || ''} || '%'`
        )
      );

    const numbers = existing
      .map((e: any) => {
        const parts = e.serialNumber.split('-');
        return parseInt(parts[2] || '0', 10);
      })
      .filter((n: number) => !isNaN(n));

    const maxNumber = numbers.length === 0 ? 0 : Math.max(...numbers);
    const nextNumber = maxNumber + 1;

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }
}
