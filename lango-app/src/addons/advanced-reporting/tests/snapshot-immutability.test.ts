// Advanced-reporting snapshot immutability. SnapshotService stores a SHA-256
// checksum alongside the payload at creation and re-verifies it on read, so a
// snapshot whose stored payload is tampered after the fact fails integrity
// validation instead of silently reporting doctored numbers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { SnapshotService } from '../services/snapshot-service';
import { reportDefinitions, reportSnapshots } from '../models/reporting-schema';
import { tenants } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('advanced-reporting snapshot immutability', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const reportKey = `snap-${suffix}`;
  const periodKey = '2026-01';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Snapshot ${suffix}`, slug: `snap-${suffix}` });
    await db.insert(reportDefinitions).values({
      key: reportKey, domain: 'Fees', title: 'Snapshot Test', executionAdapter: 'test',
    });
  }, 30_000);

  afterAll(async () => {
    await db.delete(reportSnapshots).where(eq(reportSnapshots.tenantId, tenantId));
    await db.delete(reportDefinitions).where(eq(reportDefinitions.key, reportKey));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('passes integrity validation for an untampered snapshot', async () => {
    await SnapshotService.createSnapshot(tenantId, reportKey, periodKey, { total: 100 });
    const snapshot = await SnapshotService.getSnapshot(tenantId, reportKey, periodKey);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.isValid).toBe(true);
  });

  it('fails integrity validation after the stored payload is tampered', async () => {
    await db.update(reportSnapshots)
      .set({ snapshotData: { total: 999999 } })
      .where(and(
        eq(reportSnapshots.tenantId, tenantId),
        eq(reportSnapshots.reportKey, reportKey),
        eq(reportSnapshots.periodKey, periodKey),
      ));
    const snapshot = await SnapshotService.getSnapshot(tenantId, reportKey, periodKey);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.isValid).toBe(false);
  });
});
