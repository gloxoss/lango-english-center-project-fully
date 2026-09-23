import { describe, expect, it, vi } from 'vitest';

// Audit 2026-09-22 P1-3: the "random" preview used Math.random() per request,
// and dry-run and commit were separate requests — the director approved one
// distribution and a DIFFERENT one was saved. The commit now applies exactly
// the previewed assignment list, gated by this roster fingerprint: a 409 is
// raised when the roster changed between preview and commit.

vi.mock('@/libs/DB', () => ({ db: {} }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: vi.fn() }));
vi.mock('@/libs/services/student-placement', () => ({ recordStudentPlacement: vi.fn() }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

describe('hashRoster — preview/commit roster fingerprint', () => {
  it('is deterministic for the same roster', async () => {
    const { hashRoster } = await import('@/app/api/students/placements/auto/route');
    const roster = [
      { id: 's-1', authoritativeSectionId: 'sec-A' },
      { id: 's-2', authoritativeSectionId: 'sec-B' },
      { id: 's-3', authoritativeSectionId: null },
    ];
    expect(hashRoster('session-1', roster)).toBe(hashRoster('session-1', [...roster].reverse()));
  });

  it('is order-independent', async () => {
    const { hashRoster } = await import('@/app/api/students/placements/auto/route');
    const a = hashRoster('s', [
      { id: 's-1', authoritativeSectionId: 'A' },
      { id: 's-2', authoritativeSectionId: 'B' },
    ]);
    const b = hashRoster('s', [
      { id: 's-2', authoritativeSectionId: 'B' },
      { id: 's-1', authoritativeSectionId: 'A' },
    ]);
    expect(a).toBe(b);
  });

  it('changes when any placement changes (admission, transfer, move)', async () => {
    const { hashRoster } = await import('@/app/api/students/placements/auto/route');
    const base = [
      { id: 's-1', authoritativeSectionId: 'A' as const },
      { id: 's-2', authoritativeSectionId: 'B' as const },
    ];
    const moved = [
      { id: 's-1', authoritativeSectionId: 'B' as const },
      { id: 's-2', authoritativeSectionId: 'B' as const },
    ];
    const admitted = [...base, { id: 's-3', authoritativeSectionId: null }];
    const left = [base[0]!];

    const baseHash = hashRoster('session', base);
    expect(hashRoster('session', moved)).not.toBe(baseHash);
    expect(hashRoster('session', admitted)).not.toBe(baseHash);
    expect(hashRoster('session', left)).not.toBe(baseHash);
  });

  it('changes across academic sessions', async () => {
    const { hashRoster } = await import('@/app/api/students/placements/auto/route');
    const roster = [{ id: 's-1', authoritativeSectionId: 'A' }];
    expect(hashRoster('session-2026', roster)).not.toBe(hashRoster('session-2027', roster));
  });
});
