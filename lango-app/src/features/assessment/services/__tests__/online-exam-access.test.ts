// P3 follow-up: the answer-key authoring view is limited to the exam's author,
// an assigned subject teacher, or an admin — not every teacher in the school.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/DB', () => ({ db: { select: vi.fn() } }));

const { db } = await import('@/libs/DB');
const { assertOnlineExamAuthoringAccess } = await import('@/features/assessment/services/online-exam-access');

const EXAM = { id: 'exam-1', createdById: 'author-1', classSubjectId: 'cs-1' };

/** Queue the rows returned by successive select chains (plain or with joins). */
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

const ctx = (role: string, userId: string) => ({ role, userId }) as never;

beforeEach(() => vi.clearAllMocks());

describe('assertOnlineExamAuthoringAccess', () => {
  it('lets the author and admins in', async () => {
    queue([EXAM], [{ branchId: null }]);
    await expect(assertOnlineExamAuthoringAccess(ctx('teacher', 'author-1'), 't', 'exam-1')).resolves.toBe('exam-1');
    queue([EXAM], [{ branchId: null }]);
    await expect(assertOnlineExamAuthoringAccess(ctx('school_admin', 'adm'), 't', 'exam-1')).resolves.toBe('exam-1');
  });

  it('lets an assigned subject teacher in', async () => {
    queue([EXAM], [{ branchId: null }], [{ id: 'st-1' }]); // campus row consumed first
    await expect(assertOnlineExamAuthoringAccess(ctx('teacher', 'other-t'), 't', 'exam-1')).resolves.toBe('exam-1');
  });

  it('hides the exam from an unrelated teacher with a 404', async () => {
    queue([EXAM], []);
    await expect(assertOnlineExamAuthoringAccess(ctx('teacher', 'stranger'), 't', 'exam-1'))
      .rejects.toMatchObject({ status: 404, code: 'EXAM_NOT_FOUND' });
  });

  it('404s an exam outside the tenant', async () => {
    queue([]);
    await expect(assertOnlineExamAuthoringAccess(ctx('school_admin', 'adm'), 't', 'nope'))
      .rejects.toMatchObject({ status: 404 });
  });
});
