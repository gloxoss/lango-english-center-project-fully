// Handoff adapter boundary (deferred integrations — see plan §9). Hostel and
// Transport handoffs are disabled until the owning addons expose stable phase-2
// APIs. Every consumer degrades safely: `enabled:false` and no addon queries.
export async function getHandoffStatus(tenantId: string): Promise<{
  hostel: { enabled: false };
  transport: { enabled: false };
}> {
  return { hostel: { enabled: false }, transport: { enabled: false } };
}
