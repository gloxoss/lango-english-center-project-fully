import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { reportSnapshots } from '../models/reporting-schema';

export class SnapshotService {
  /**
   * Creates an immutable snapshot payload with SHA-256 validation.
   */
  static async createSnapshot(
    tenantId: string,
    reportKey: string,
    periodKey: string,
    snapshotData: Record<string, any>,
    createdById?: string,
  ): Promise<string> {
    const jsonStr = JSON.stringify(snapshotData);
    const checksumSha256 = crypto.createHash('sha256').update(jsonStr).digest('hex');

    const [snapshot] = await db
      .insert(reportSnapshots)
      .values({
        tenantId,
        reportKey,
        periodKey,
        snapshotData,
        checksumSha256,
        createdById,
      })
      .returning();

    if (!snapshot) {
      throw new Error('Failed to create snapshot');
    }

    return snapshot.id;
  }

  /**
   * Retrieves snapshot by key and verifies SHA-256 checksum integrity.
   */
  static async getSnapshot(tenantId: string, reportKey: string, periodKey: string) {
    const [snapshot] = await db
      .select()
      .from(reportSnapshots)
      .where(
        and(
          eq(reportSnapshots.tenantId, tenantId),
          eq(reportSnapshots.reportKey, reportKey),
          eq(reportSnapshots.periodKey, periodKey),
        ),
      );

    if (!snapshot) {
      return null;
    }

    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(snapshot.snapshotData))
      .digest('hex');

    const isValid = calculatedChecksum === snapshot.checksumSha256;

    return {
      ...snapshot,
      isValid,
    };
  }
}
