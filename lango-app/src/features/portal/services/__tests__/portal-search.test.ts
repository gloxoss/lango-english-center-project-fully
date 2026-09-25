import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchPortal } from '@/features/portal/services/portal-search';
import type { RequestContext } from '@/libs/api/context';

// ENH-ADMIN-DASH-01: the header search must be tenant-scoped, branch-scoped,
// capability-gated and relevant. These tests pin the security-critical paths.

vi.mock('@/libs/DB', () => {
  const chain = (rows: unknown[]) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        groupBy: vi.fn().mockReturnThis(),
      }),
    }),
    innerJoin: vi.fn().mockReturnThis(),
  });
  return { db: { select: vi.fn(() => chain([])) } };
});

vi.mock('@/libs/api/permissions', () => ({
  hasCapability: vi.fn().mockResolvedValue(true),
}));

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: 'usr-admin-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Director',
    email: 'director@atlas.ma',
    ...overrides,
  } as RequestContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('portal search — branch scoping', () => {
  it('rejects a foreign-tenant / non-existent branch with 403 (never leaks rows)', async () => {
    const { db } = await import('@/libs/DB');
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    await expect(
      searchPortal(ctx(), 'yousse', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('accepts a branch that exists in the tenant and scopes queries to it', async () => {
    const { db } = await import('@/libs/DB');
    const siegeId = '00000000-0000-0000-0000-000000000002';
    // First select = branch validation; second = student search.
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: siegeId }]),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 'STU-0053', name: 'Youssef Chraibi', email: 'e1@x.ma', matricule: 'ATL-2526-0053', className: '3ème A', total: 2 },
            ]),
          }),
        }),
      } as any);

    const result = await searchPortal(ctx(), 'yousse', siegeId);
    expect(result.students).toHaveLength(1);
    expect(result.students[0]!.name).toContain('Youssef');
  });

  it('confines a branch-pinned principal to their own branch even if another is requested', async () => {
    const { db } = await import('@/libs/DB');
    const pinned = '00000000-0000-0000-0000-000000000003';
    const requested = '00000000-0000-0000-0000-000000000004';
    // Pinned ctx: the branch-validation select must NEVER run; only the three
    // entity searches run (students, teachers, invoices), all pinned.
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const result = await searchPortal(ctx({ branchId: pinned }), 'yousse', requested);
    expect(result.students).toEqual([]);
    // exactly 3 selects (students/teachers/invoices) — no branch validation.
    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(3);
  });
});

describe('portal search — role scoping', () => {
  it('gives a parent only linked children and never staff or invoice rows', async () => {
    const { db } = await import('@/libs/DB');
    const linked = { id: 'STU-1', name: 'Enfant Linked', email: 'e@x.ma', matricule: 'M-1', className: '3ème A', total: 1 };
    // Parent path: exactly one select (the guardian-joined student query).
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([linked]),
            }),
          }),
        }),
      }),
    } as any);

    const result = await searchPortal(ctx({ role: 'parent', baseRole: 'parent' }), 'enfant');
    expect(result.students).toHaveLength(1);
    expect(result.students[0]!.name).toBe('Enfant Linked');
    expect(result.teachers).toEqual([]);
    expect(result.invoices).toEqual([]);
  });

  it('skips entity types the role cannot read (deny-by-default)', async () => {
    const { db } = await import('@/libs/DB');
    const { hasCapability } = await import('@/libs/api/permissions');
    vi.mocked(hasCapability).mockImplementation(async (_u, _t, _r, cap) => cap === 'students.read');

    // 1 select: students only (no branch requested → no validation select).
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const result = await searchPortal(ctx(), 'anything');
    expect(result.students).toEqual([]);
    expect(result.teachers).toEqual([]);
    expect(result.invoices).toEqual([]);
    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
  });

  it('keeps student/alumni self-scoped (they can only ever find themselves)', async () => {
    const { db } = await import('@/libs/DB');
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const result = await searchPortal(ctx({ role: 'student', baseRole: 'student', userId: 'usr-stu-1' }), 'someone else');
    expect(result.students).toEqual([]);
    expect(result.teachers).toEqual([]);
    expect(result.invoices).toEqual([]);
  });
});
