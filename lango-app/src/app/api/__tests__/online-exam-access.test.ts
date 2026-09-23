import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security audit P0-B: the exam authoring route returned isCorrect for every
// option to anyone holding grading.read — including students and parents.
// The authoring route is now staff-only and the student view ([examId]/take)
// never exposes isCorrect, only opens inside the exam window, and only for
// students placed in the exam's class.

const currentSession = vi.fn();

vi.mock('@/libs/auth', () => ({
  auth: { api: { getSession: async () => {
    const userId = currentSession();
    return userId ? { user: { id: userId }, session: { id: 's1' } } : null;
  } } },
}));

vi.mock('@/libs/DB', () => ({ db: {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} }));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: vi.fn(async () => null),
}));

const mockedDB = vi.mocked(await import('@/libs/DB'));

const STUDENT = 'stu-1';

function principal(userId: string, role = roleOf(userId)) {
  return {
    id: userId,
    tenantId: 'tenant-1',
    branchId: null,
    role,
    status: 'active',
    name: 'U',
    email: 'u@test.local',
    tenantActive: true,
    tenantSubscriptionStatus: 'active',
  };
}

function roleOf(userId: string): string {
  if (userId === STUDENT) return 'student';
  if (userId === 'staff-1') return 'teacher';
  return 'parent';
}

function mockPrincipalRow(userId: string) {
  vi.mocked(mockedDB.db.select).mockImplementationOnce((() => ({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          limit: async () => [principal(userId)],
        }),
      }),
    }),
  })) as never);
}

const EXAM = {
  id: 'exam-1',
  tenantId: 'tenant-1',
  classSubjectId: 'cs-1',
  title: 'Contrôle n°3',
  durationMinutes: 60,
  totalMarks: '20',
  startsAt: new Date(Date.now() - 3600_000).toISOString(),
  endsAt: new Date(Date.now() + 3600_000).toISOString(),
  createdById: 'staff-1',
  createdAt: new Date().toISOString(),
};

const QUESTION = {
  id: 'q-1',
  tenantId: 'tenant-1',
  onlineExamId: 'exam-1',
  questionText: 'Capitale du Maroc ?',
  marks: '2',
  orderIndex: 0,
  sectionLabel: null,
  difficulty: 'facile',
  subjectId: null,
  cycle: null,
};

const OPTION = {
  id: 'opt-1',
  questionId: 'q-1',
  optionText: 'Rabat',
  isCorrect: true,
};

/** Queue of async result resolvers consumed in call order; every chain method is universal. */
function queuedSelect() {
  const steps: Array<() => Promise<unknown[]>> = [];
  const chain = () => {
    const next = steps.shift() ?? (async () => []);
    let resolved: Promise<unknown[]> | null = null;
    const consume = () => {
      if (!resolved) resolved = next();
      return resolved;
    };
    const builder: Record<string, unknown> = {
      // Queries without a terminal .limit() (e.g. .orderBy(...) only) are
      // awaited directly — make the builder thenable.
      then: (onFulfilled: (v: unknown[]) => unknown, onRejected: (e: unknown) => unknown) =>
        consume().then(onFulfilled, onRejected),
    };
    const self = () => builder;
    for (const method of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset']) {
      builder[method] = (..._args: unknown[]) => {
        void _args;
        return method === 'limit' ? consume() : self();
      };
    }
    return builder;
  };
  return {
    push: (fn: () => Promise<unknown[]>) => steps.push(fn),
    impl: () => ((): unknown => chain()) as never,
  };
}

/** Queue of select results for the take route: exam, student, enrollment, attempt, questions, options. */
function queueTakeRoute() {
  const q = queuedSelect();
  q.push(async () => [EXAM]);
  q.push(async () => [{ classSectionId: 'sec-1' }]);
  q.push(async () => [{ id: 'sec-1' }]);
  q.push(async () => [{ startedAt: new Date().toISOString(), submittedAt: null, status: 'in_progress' }]);
  q.push(async () => [QUESTION]);
  // The route selects an explicit projection (id, questionId, optionText) —
  // the row shape the real driver returns; isCorrect never leaves the DB.
  q.push(async () => [{ id: 'opt-1', questionId: 'q-1', optionText: 'Rabat' }]);
  vi.mocked(mockedDB.db.select).mockImplementation(q.impl());
  vi.mocked(mockedDB.db.insert).mockReturnValue({
    values: () => ({
      onConflictDoNothing: async () => [],
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSession.mockReturnValue(STUDENT);
});

describe('online exam answer-key access (P0-B) + submission integrity (P1-D)', () => {
  it('student GET on the authoring questions route is refused with 403', async () => {
    mockPrincipalRow(STUDENT);
    const { GET } = await import('@/app/api/academics/online-exams/[examId]/questions/route');
    const res = await GET(new Request('http://localhost/api/academics/online-exams/exam-1/questions') as any, { params: Promise.resolve({ examId: 'exam-1' }) } as never);
    expect(res.status).toBe(403);
  });

  it('student GET on the take route NEVER contains isCorrect', async () => {
    currentSession.mockReturnValue(STUDENT);
    mockPrincipalRow(STUDENT);
    queueTakeRoute();
    const { GET } = await import('@/app/api/academics/online-exams/[examId]/take/route');
    const res = await GET(new Request('http://localhost/api/academics/online-exams/exam-1/take') as any, { params: Promise.resolve({ examId: 'exam-1' }) } as never);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('isCorrect');
    const json = JSON.parse(text);
    expect(json.data.questions[0].options[0]).toEqual({ id: 'opt-1', questionId: 'q-1', optionText: 'Rabat' });
  });

  it('take route refuses a student before startsAt with 422 EXAM_NOT_OPEN', async () => {
    currentSession.mockReturnValue(STUDENT);
    mockPrincipalRow(STUDENT);
    const q = queuedSelect();
    q.push(async () => [{ ...EXAM, startsAt: new Date(Date.now() + 3600_000).toISOString() }]);
    vi.mocked(mockedDB.db.select).mockImplementation(q.impl());
    const { GET } = await import('@/app/api/academics/online-exams/[examId]/take/route');
    const res = await GET(new Request('http://localhost/api/academics/online-exams/exam-1/take') as any, { params: Promise.resolve({ examId: 'exam-1' }) } as never);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('EXAM_NOT_OPEN');
  });

  it('take route refuses a student of another class with 403 EXAM_NOT_ASSIGNED', async () => {
    currentSession.mockReturnValue(STUDENT);
    mockPrincipalRow(STUDENT);
    const q = queuedSelect();
    q.push(async () => [EXAM]);
    q.push(async () => [{ classSectionId: 'sec-other' }]);
    q.push(async () => []);
    vi.mocked(mockedDB.db.select).mockImplementation(q.impl());
    const { GET } = await import('@/app/api/academics/online-exams/[examId]/take/route');
    const res = await GET(new Request('http://localhost/api/academics/online-exams/exam-1/take') as any, { params: Promise.resolve({ examId: 'exam-1' }) } as never);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('EXAM_NOT_ASSIGNED');
  });

  it('submit route refuses non-students (P1-D role check)', async () => {
    currentSession.mockReturnValue('parent-1');
    mockPrincipalRow('parent-1');
    const { POST } = await import('@/app/api/academics/online-exams/submit/route');
    const res = await POST(new Request('http://localhost/api/academics/online-exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId: 'exam-1', answers: [] }),
    }) as any);
    expect(res.status).toBe(403);
  });
});
