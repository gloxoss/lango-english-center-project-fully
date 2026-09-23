import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { guardians } from '@/models/Schema';

export type GuardianInput = {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
  preferredLanguage?: string | null;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  defaultRelation?: string | null;
};

export class GuardianResolutionService {
  /**
   * Normalizes Moroccan phone number to canonical E.164 (+212XXXXXXXXX) format,
   * or strips non-digits for international/other formats.
   */
  static normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^0-9]/g, '');
    if (!digits) return null;
    if (digits.startsWith('00212') && digits.length === 14) {
      return `+212${digits.slice(5)}`;
    }
    if (digits.startsWith('212') && digits.length === 12) {
      return `+${digits}`;
    }
    if (digits.startsWith('0') && digits.length === 10) {
      return `+212${digits.slice(1)}`;
    }
    return digits;
  }

  /**
   * Normalizes email address by trimming and converting to lowercase.
   */
  static normalizeEmail(email?: string | null): string | null {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return clean.length > 0 ? clean : null;
  }

  /**
   * Finds an existing guardian in the given tenant by matching normalized phone (last 8-9 digits)
   * or normalized email. Does NOT match by surname alone.
   */
  static async findExistingGuardian(
    tenantId: string,
    phone?: string | null,
    email?: string | null,
    tx: any = db,
  ) {
    const cleanPhone = this.normalizePhone(phone);
    const cleanEmail = this.normalizeEmail(email);

    if (!cleanPhone && !cleanEmail) {
      return null;
    }

    const conditions = [];

    if (cleanPhone && cleanPhone.length >= 8) {
      const matchSuffix = cleanPhone.slice(-8);
      conditions.push(
        sql`regexp_replace(${guardians.phone}, '[^0-9]', '', 'g') LIKE ${`%${matchSuffix}`}`,
      );
    }

    if (cleanEmail) {
      conditions.push(sql`LOWER(${guardians.email}) = ${cleanEmail}`);
    }

    if (conditions.length === 0) {
      return null;
    }

    const [existing] = await tx
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        email: guardians.email,
        userId: guardians.userId,
      })
      .from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), or(...conditions)))
      .limit(1);

    return existing || null;
  }

  /**
   * Resolves an existing guardian or creates a new one if no strong match is found.
   */
  static async resolveOrCreateGuardian(
    tenantId: string,
    input: GuardianInput,
    tx: any = db,
  ): Promise<{ id: string; isExisting: boolean; guardian: any }> {
    const existing = await this.findExistingGuardian(tenantId, input.phone, input.email, tx);

    if (existing) {
      return {
        id: existing.id,
        isExisting: true,
        guardian: existing,
      };
    }

    const [created] = await tx
      .insert(guardians)
      .values({
        tenantId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        email: this.normalizeEmail(input.email),
        occupation: input.occupation?.trim() || null,
        address: input.address?.trim() || null,
        preferredLanguage: input.preferredLanguage || null,
        emailOptIn: input.emailOptIn ?? true,
        smsOptIn: input.smsOptIn ?? true,
        defaultRelation: input.defaultRelation || 'Parent',
      })
      .returning();

    return {
      id: created.id,
      isExisting: false,
      guardian: created,
    };
  }

  /**
   * Alias helper for domain tests and standardized resolution.
   */
  static async resolveOrCreate(
    args: GuardianInput & { tenantId: string },
    tx: any = db,
  ): Promise<{ guardianId: string; created: boolean; matchedBy: 'phone' | 'email' | 'created'; guardian: any }> {
    const existing = await this.findExistingGuardian(args.tenantId, args.phone, args.email, tx);
    if (existing) {
      const cleanPhone = this.normalizePhone(args.phone);
      const cleanEmail = this.normalizeEmail(args.email);
      let matchedBy: 'phone' | 'email' = 'phone';
      const existingPhone = this.normalizePhone(existing.phone);
      if (cleanPhone && existingPhone && cleanPhone.slice(-8) === existingPhone.slice(-8)) {
        matchedBy = 'phone';
      } else if (cleanEmail && existing.email && cleanEmail === this.normalizeEmail(existing.email)) {
        matchedBy = 'email';
      }
      return {
        guardianId: existing.id,
        created: false,
        matchedBy,
        guardian: existing,
      };
    }

    const result = await this.resolveOrCreateGuardian(args.tenantId, args, tx);
    return {
      guardianId: result.id,
      created: true,
      matchedBy: 'created',
      guardian: result.guardian,
    };
  }
}
