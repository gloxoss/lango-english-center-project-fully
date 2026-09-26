import { beforeEach, describe, expect, it, vi } from 'vitest';

// BRANCH-SCOPE-01 W3: the online-exam authoring gate applies the campus lock
// (assertBranchScope) against the class behind the exam's subject — centrally,
// so every authoring subroute inherits it.

vi.mock('@/libs/DB', () => ({ db: { select: vi.fn() } }));

const { db } = await import('@/libs/DB');
const { assertOnlineExamAuthoringAccess } = await import('@/features/assessment/services/online-exam-access');

const EXAM = { id: 'exam-1', createdById: 'author-1', classSubjectId: 'cs-1' };

function queue(...results: unknown[][]) {
  let i = 0;
  const chain: Record<string, unknown> = {
    where: () => ({ limit: async () => results[i++] ?? [] }),
  };
  chain.innerJoin = () => chain;
  chain.leftJoin = () => chain;
  vi.mocked(db.select).mockImplementation((() => ({
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
  })) as never);
}

const ctx = (role: string, userId: string, branchId: string | null) =>
  ({ role, userId, tenantId: 't1', branchId, branchLocked: branchId !== null }) as never;

beforeEach(() => vi.clearAllMocks());

describe('assertOnlineExamAuthoringAccess — campus lock (W3)', () => {
  it('refuses a locked author whose campus is not the exam\'s (403)', async () => {
    queue([EXAM], [{ branchId: 'branch-B' }]);
    await expect(
      assertOnlineExamAuthoringAccess(ctx('school_admin', 'author-1', 'branch-A'), 't1', 'exam-1'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lets a locked author whose campus matches the exam\'s', async () => {
    queue([EXAM], [{ branchId: 'branch-A' }]);
    await expect(
      assertOnlineExamAuthoringAccess(ctx('school_admin', 'author-1', 'branch-A'), 't1', 'exam-1'),
    ).resolves.toBe('exam-1');
  });

  it('lets a whole-school author regardless of campus ("Tous les sites")', async () => {
    queue([EXAM], [{ branchId: 'branch-B' }]);
    await expect(
      assertOnlineExamAuthoringAccess(ctx('school_admin', 'author-1', null), 't1', 'exam-1'),
    ).resolves.toBe('exam-1');
  });
});
