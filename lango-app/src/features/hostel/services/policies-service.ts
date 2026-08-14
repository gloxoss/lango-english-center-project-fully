// Hostel policies service — tenant-configurable legal/visitor/consent and
// safeguarding policies (Phase 0 ADR). Versioned, JSON-backed, defaults merge.
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { hostelPolicies } from '@/features/hostel/models/hostel-schema';
import { firstRow } from '@/features/hostel/server/db-utils';

export const HOSTEL_POLICY_VERSION = 1;

export const DEFAULT_HOSTEL_POLICIES = {
  // Consent: is guardian approval required for a minor's leave pass / stay?
  guardianConsentRequiredForMinors: true,
  guardianConsentRequiredForLeave: true,
  // Legal majority threshold (Morocco: 18).
  majorityAge: 18,
  // Leave pass rules.
  leavePassMaxHours: 72,
  leavePassRequiresReason: true,
  leavePassRequiresDestination: true,
  // Escalation tiers: after N consecutive missing roll calls, escalate one tier.
  escalationTiers: [
    { tier: 1, recipient: 'warden', afterMissingRollCalls: 1, channel: 'log' },
    { tier: 2, recipient: 'school_admin', afterMissingRollCalls: 2, channel: 'log' },
    { tier: 3, recipient: 'guardian', afterMissingRollCalls: 3, channel: 'log' },
  ],
  // Roll call.
  rollCallGraceMinutes: 15,
  // Visitors (phase 4 UI; stored now so the policy is configurable up front).
  visitorPreApprovalRequired: true,
  visitorHoursDefault: { start: '08:00', end: '20:00' },
  // Safeguarding: which roles may read restricted `reason` fields.
  safeguardingReaders: ['school_admin', 'super_admin'],
  // Finance adapter: emit residence fee charge on check-in (true) or reserve only.
  emitChargeOnCheckIn: true,
  // Emergency departure: finance failure must never block the departure.
  allowEmergencyDepartureOnFinanceFailure: true,
  // Data retention (months) for allocation/roll-call history before anonymization.
  retentionMonths: 36,
};

export type HostelPolicies = typeof DEFAULT_HOSTEL_POLICIES;

export async function getPolicies(tenantId: string) {
  const [row] = await db.select().from(hostelPolicies)
    .where(eq(hostelPolicies.tenantId, tenantId)).limit(1);
  if (!row) {
    return { policies: DEFAULT_HOSTEL_POLICIES, version: 0 };
  }
  return {
    policies: { ...DEFAULT_HOSTEL_POLICIES, ...(row.policies as Record<string, unknown>) } as HostelPolicies,
    version: row.version,
  };
}

export async function upsertPolicies(tenantId: string, policies: Partial<HostelPolicies>, updatedById: string) {
  const existing = await getPolicies(tenantId);
  const merged = { ...DEFAULT_HOSTEL_POLICIES, ...existing.policies, ...policies } as HostelPolicies;
  const nextVersion = existing.version + 1;

  const row = firstRow(await db
    .insert(hostelPolicies)
    .values({
      tenantId,
      policies: merged,
      version: nextVersion,
      updatedById,
    })
    .onConflictDoUpdate({
      target: hostelPolicies.tenantId,
      set: {
        policies: merged,
        version: nextVersion,
        updatedById,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning());

  return { policies: row.policies as HostelPolicies, version: row.version };
}
