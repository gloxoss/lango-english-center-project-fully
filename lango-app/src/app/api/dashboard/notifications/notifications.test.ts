import { beforeEach, describe, expect, it, vi } from 'vitest';

// ENH-ADMIN-DASH-01: the bell must be a general notification surface
// aggregating REAL sources, grouped into À traiter / Mises à jour / Système,
// capability-gated per role — never fabricated events.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  hasCapability: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/libs/DB', () => {
  // Chain stub that works for BOTH await shapes used by the route:
  // `await db.select().from().where()` and `await db.select().from().limit(n)`.
  const makeChain = (leaf: unknown) => {
    const p = () => Promise.resolve(leaf);
    const chain: any = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => p()),
      groupBy: vi.fn(() => chain),
      then: (onF: any, onR: any) => p().then(onF, onR),
      catch: (onR: any) => p().catch(onR),
      finally: (f: any) => p().finally(f),
    };
    return chain;
  };
  return { db: { select: vi.fn(() => makeChain([])), __makeChain: makeChain } };
});

import { GET } from '@/app/api/dashboard/notifications/route';
import { db } from '@/libs/DB';
import type { Mock } from 'vitest';

const dbAny = db as any;

function chainLeaf(leaf: unknown) {
  return dbAny.__makeChain(leaf) as any;
}

describe('dashboard notifications aggregation', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // resetAllMocks wipes the module factory's implementations: re-seed them.
    dbAny.select.mockImplementation(() => dbAny.__makeChain([]));
    const { hasCapability } = await import('@/libs/api/permissions');
    (hasCapability as unknown as Mock).mockResolvedValue(true);
  });

  async function callRoute(role = 'school_admin') {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValueOnce({
      userId: 'usr-admin-1',
      tenantId: '00000000-0000-0000-0000-000000000001',
      branchId: null,
      role,
      baseRole: role,
      name: 'Director',
      email: 'director@atlas.ma',
    } as any);
    const request = new Request('http://localhost:3000/api/dashboard/notifications');
    return GET(request);
  }

  it('groups real sources into action/updates/system and sums the unread count', async () => {
    const { db } = await import('@/libs/DB');
    const select = db.select as unknown as Mock;
    // Query order in the route:
    // 1 announcementReads join -> rows   2 announcements -> rows
    // 3 overdue count -> [{c: 40}]       4 refunds -> [{c: 2}]
    // 5 expected classes -> [{c: 12}]    6 marked sections -> [{c: 0}]
    // 7 applicants -> [{c: 13}]          8 interviews -> [{c: 1}]
    // 9 failed sms -> [{c: 3}]
    select
      .mockReturnValueOnce(chainLeaf([{ announcementId: 'a2' }]))
      .mockReturnValueOnce(chainLeaf([
        { id: 'a1', title: 'Annonce 1', body: 'b1', createdAt: '2026-09-20T10:00:00' },
        { id: 'a2', title: 'Annonce 2', body: 'b2', createdAt: '2026-09-21T10:00:00' },
      ]))
      .mockReturnValueOnce(chainLeaf([{ c: 40 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 2 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 12 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 13 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 1 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 3 }]));

    const response = await callRoute();
    expect(response.status).toBe(200);
    const json = await response.json();
    const { groups, unreadCount } = json.data;

    expect(groups.action.map((a: any) => a.title)).toEqual([
      '40 facture(s) en retard',
      '2 remboursement(s) à approuver',
      'Pointage incomplet : 0/12 classes',
      '13 dossier(s) d\'admission à examiner',
      '1 entretien(s) aujourd\'hui',
    ]);
    expect(groups.updates.map((u: any) => u.id)).toEqual(['ann-a1']); // a2 is read
    expect(groups.system.map((s: any) => s.title)).toEqual(['3 SMS en échec (7 jours)']);
    expect(unreadCount).toBe(groups.action.length + groups.updates.length + groups.system.length);
    expect(unreadCount).toBe(7);
  });

  it('hides finance signals from roles without finance.read (capability-gated)', async () => {
    const { db } = await import('@/libs/DB');
    const { hasCapability } = await import('@/libs/api/permissions');
    (hasCapability as unknown as Mock).mockImplementation(async (_u, _t, _r, cap: string) => cap !== 'finance.read');
    const select = db.select as unknown as Mock;
    select
      .mockReturnValueOnce(chainLeaf([]))                       // reads
      .mockReturnValueOnce(chainLeaf([]))                       // announcements
      .mockReturnValueOnce(chainLeaf([{ c: 12 }]))              // expected classes
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))               // marked sections
      .mockReturnValueOnce(chainLeaf([{ c: 4 }]))               // applicants
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))               // interviews
      .mockReturnValueOnce(chainLeaf([{ c: 1 }]));              // sms

    const response = await callRoute();
    const json = await response.json();
    const titles = json.data.groups.action.map((a: any) => a.title);
    expect(titles.some((t: string) => t.includes('facture'))).toBe(false);
    expect(titles.some((t: string) => t.includes('remboursement'))).toBe(false);
    expect(titles.some((t: string) => t.includes('admission'))).toBe(true);
  });

  it('returns zero notifications when nothing needs attention (no fabrication)', async () => {
    const { db } = await import('@/libs/DB');
    const select = db.select as unknown as Mock;
    select
      .mockReturnValueOnce(chainLeaf([]))
      .mockReturnValueOnce(chainLeaf([]))
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 12 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 12 }])) // all classes marked
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]))
      .mockReturnValueOnce(chainLeaf([{ c: 0 }]));

    const response = await callRoute();
    const json = await response.json();
    expect(json.data.unreadCount).toBe(0);
    expect(json.data.groups.action).toEqual([]);
    expect(json.data.groups.updates).toEqual([]);
    expect(json.data.groups.system).toEqual([]);
  });
});
