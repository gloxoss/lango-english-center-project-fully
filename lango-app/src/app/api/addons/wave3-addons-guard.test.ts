// Wave 3 W4 regression suite: payload-shape + capability right-fit fixes found
// by the 86-route addons sweep. Mounts the actual Next.js route handlers
// (same pattern as src/app/api/security.test.ts / adversarial.test.ts) against
// a real Postgres — skipped automatically unless DATABASE_URL is set.
//
// Covered fixes:
//  - broadcast/connections/[id] GET must project secrets through maskConfig
//  - broadcast/campaigns/[id]/recipients GET must mask phone/email
//  - broadcast/segments PUT (search) + [id]/preview POST must mask phone/email
//  - library/stocktakes/[id]/adjustments/apply requires stocktake.approve,
//    not the librarian-held stocktake.manage (maker/checker separation)
//  - library/members POST records an audit entry
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let currentSessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { addonEntitlements, auditLogs, branches, inquiries, libraryMembers, user, tenants } = await import('@/models/Schema');
const {
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationConnections,
  communicationSegments,
} = await import('@/features/broadcast/models/broadcast-schema');

const connectionsRoute = await import('./broadcast/connections/[id]/route');
const recipientsRoute = await import('./broadcast/campaigns/[id]/recipients/route');
const segmentsRoute = await import('./broadcast/segments/route');
const segmentsPreviewRoute = await import('./broadcast/segments/[id]/preview/route');
const stocktakeApplyRoute = await import('./library/stocktakes/[id]/adjustments/apply/route');
const membersRoute = await import('./library/members/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Wave 3 addons payload/capability regressions (W4)', () => {
  const suffix = `w3w4-${Date.now()}`;
  const tenantA = crypto.randomUUID();
  const ids = {
    adminA: `W3-ADMIN-A-${suffix}`,
    librarianA: `W3-LIB-A-${suffix}`,
    memberTarget: `W3-STU-A-${suffix}`,
  } as const;

  let connectionId = '';
  let campaignId = '';
  let segmentId = '';
  let branchId = '';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantA, name: `Wave3 W4 ${suffix}`, slug: `w3w4-${suffix}` });
    await db.insert(user).values([
      { id: ids.adminA, tenantId: tenantA, name: 'Admin A', email: `${ids.adminA.toLowerCase()}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: ids.librarianA, tenantId: tenantA, name: 'Librarian A', email: `${ids.librarianA.toLowerCase()}@test.local`, role: 'librarian', userStatus: 'active' },
      { id: ids.memberTarget, tenantId: tenantA, name: 'Student Target', email: `${ids.memberTarget.toLowerCase()}@test.local`, role: 'student', userStatus: 'active' },
    ]);
    await db.insert(addonEntitlements).values([
      { tenantId: tenantA, addonId: 'broadcast-messaging', isEnabled: true },
      { tenantId: tenantA, addonId: 'library', isEnabled: true },
    ]);
    const [branch] = await db.insert(branches).values({ tenantId: tenantA, name: `B ${suffix}`, code: `W3-${suffix}` }).returning();
    branchId = branch!.id;

    const [conn] = await db.insert(communicationConnections).values({
      tenantId: tenantA, channel: 'sms', name: `Conn ${suffix}`, provider: 'test',
      configJson: { apiKey: 'sk-live-super-secret', senderName: 'SchoolOS' },
    }).returning();
    connectionId = conn!.id;

    const [campaign] = await db.insert(communicationCampaigns).values({
      tenantId: tenantA, name: `Camp ${suffix}`, channel: 'sms', bodyText: 'hello',
    }).returning();
    campaignId = campaign!.id;
    await db.insert(communicationCampaignRecipients).values({
      tenantId: tenantA, campaignId: campaign!.id, recipientKind: 'guardian', recipientId: `g-${suffix}`,
      contactName: 'Famille Benali', phone: '0612345678', email: 'parent@example.com',
    });

    const [segment] = await db.insert(communicationSegments).values({
      tenantId: tenantA, name: `Seg ${suffix}`, definition: { kind: 'inquiry', filters: {} },
    }).returning();
    segmentId = segment!.id;
    await db.insert(inquiries).values({
      tenantId: tenantA, contactName: 'Famille Alami', phone: '0698765432', email: 'alami@example.com',
    });
  }, 60_000);

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantA));
    await db.delete(libraryMembers).where(eq(libraryMembers.tenantId, tenantA));
    await db.delete(branches).where(eq(branches.tenantId, tenantA));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    // communication_*/inquiries rows cascade on tenant delete.
  });

  function req(url: string, method: string, body?: unknown): Request {
    return new Request(url, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
    });
  }
  function paramsOf(p: Record<string, string>): any {
    return { params: Promise.resolve(p) };
  }

  it('connections GET masks secret config keys', async () => {
    currentSessionUserId = ids.adminA;
    const res = await connectionsRoute.GET(req(`http://x/api/addons/broadcast/connections/${connectionId}`, 'GET'), paramsOf({ id: connectionId }));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.config.apiKey).toBe('••••••••');
    expect(json.data.config.apiKey).not.toContain('sk-live');
    expect(json.data.config.senderName).toBe('SchoolOS');
  });

  it('campaign recipients drill-down masks phone and email', async () => {
    currentSessionUserId = ids.adminA;
    const res = await recipientsRoute.GET(req(`http://x/api/addons/broadcast/campaigns/${campaignId}/recipients`, 'GET'), paramsOf({ id: campaignId }));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.rows).toHaveLength(1);
    const recipient = json.data.rows[0].recipient;
    expect(recipient.phone).toBe('06…78');
    expect(recipient.email).toBe('pa***@example.com');
    expect(recipient.contactName).toBe('Famille Benali'); // name stays usable for drill-down
  });

  it('segment search (PUT) masks phone and email', async () => {
    currentSessionUserId = ids.adminA;
    const res = await segmentsRoute.PUT(req('http://x/api/addons/broadcast/segments?kind=inquiry&q=Alami', 'PUT'));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    for (const row of json.data) {
      expect(row.phone ?? null).toBe('06…32');
      expect(row.email ?? null).toBe('al***@example.com');
    }
  });

  it('segment preview masks phone and email', async () => {
    currentSessionUserId = ids.adminA;
    const res = await segmentsPreviewRoute.POST(req(`http://x/api/addons/broadcast/segments/${segmentId}/preview`, 'POST', { limit: 10 }), paramsOf({ id: segmentId }));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.recipients.length).toBeGreaterThan(0);
    for (const row of json.data.recipients) {
      expect(row.phone ?? null).toBe('06…32');
      expect(row.email ?? null).toBe('al***@example.com');
    }
  });

  it('stocktake adjustments/apply: librarian 403 (needs stocktake.approve), admin reaches the route (404 on unknown id)', async () => {
    const unknownId = crypto.randomUUID();
    currentSessionUserId = ids.librarianA;
    const librarianRes = await stocktakeApplyRoute.POST(req(`http://x/api/addons/library/stocktakes/${unknownId}/adjustments/apply`, 'POST'), paramsOf({ id: unknownId }));
    expect(librarianRes.status).toBe(403);

    currentSessionUserId = ids.adminA;
    const adminRes = await stocktakeApplyRoute.POST(req(`http://x/api/addons/library/stocktakes/${unknownId}/adjustments/apply`, 'POST'), paramsOf({ id: unknownId }));
    expect(adminRes.status).toBe(404); // passed the capability gate; entity genuinely absent
  });

  it('library members POST records an audit entry', async () => {
    currentSessionUserId = ids.adminA;
    const res = await membersRoute.POST(req('http://x/api/addons/library/members', 'POST', {
      userId: ids.memberTarget, memberNumber: `W3-${suffix}`, branchId,
    }));
    expect(res.status).toBe(201);
    const json: any = await res.json();
    // recordAudit is fire-and-forget: poll briefly for the row to land.
    let auditRow: { action: string; entityType: string } | undefined;
    for (let i = 0; i < 20 && !auditRow; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const [row] = await db
        .select({ action: auditLogs.action, entityType: auditLogs.entityType })
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, json.data.id), eq(auditLogs.action, 'create'), eq(auditLogs.entityType, 'library_member')))
        .limit(1);
      auditRow = row;
    }
    expect(auditRow).toBeDefined();
  });
});
