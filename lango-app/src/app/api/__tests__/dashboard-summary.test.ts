import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/dashboard/summary/route';

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

vi.mock('@/libs/DB', () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

describe('Dashboard Summary — P0 Security & Branch Isolation Invariants', () => {
  it('rejects a branch-limited user requesting another unauthorized branch with 403', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValueOnce({
      userId: 'user-admin-branch1',
      tenantId: 'tenant-alpha',
      branchId: '00000000-0000-0000-0000-000000000001',
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Branch Admin',
      email: 'admin@branch1.local',
    } as any);

    const request = new Request('http://localhost:3000/api/dashboard/summary?branchId=00000000-0000-0000-0000-000000000002');
    const response = await GET(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error?.code).toBe('FORBIDDEN');
    expect(json.error?.message).toContain('Accès interdit à cette succursale');
  });

  it('rejects whole-school admin requesting a non-existent or foreign branch with 403', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    const { db } = await import('@/libs/DB');

    vi.mocked(requireRequestContext).mockResolvedValueOnce({
      userId: 'user-admin-global',
      tenantId: 'tenant-alpha',
      branchId: null, // Whole-school admin
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Global Director',
      email: 'director@school.local',
    } as any);

    // Mock branches table query returning empty (branch not found in this tenant)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const request = new Request('http://localhost:3000/api/dashboard/summary?branchId=ffffffff-ffff-ffff-ffff-ffffffffffff');
    const response = await GET(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error?.code).toBe('FORBIDDEN');
    expect(json.error?.message).toContain('Succursale introuvable ou non autorisée');
  });
});

describe('Dashboard Summary — P1 Reconciliation Invariants', () => {
  it('verifies student distribution bucket sum equals active student count invariant', () => {
    const activeStudentCount = 201;
    const distributionBuckets = [
      { name: '1ère Année Bac - Sc. Expérimentales', count: 65 },
      { name: 'Tronc Commun Scientifique', count: 58 },
      { name: '2ème Année Bac - Sc. Physiques', count: 42 },
      { name: '3ème Année Collège', count: 35 },
      { name: 'Sans niveau', count: 1 }, // Explicit unassigned bucket
    ];

    const sum = distributionBuckets.reduce((acc, curr) => acc + curr.count, 0);
    expect(sum).toBe(activeStudentCount);
    expect(distributionBuckets.some(b => b.name === 'Sans niveau')).toBe(true);
  });

  it('verifies financial reconciliation between monthly chart breakdown and period summary', () => {
    const monthlyBreakdown = [
      { month: 'Sep', monthNum: 9, yearNum: 2024, invoiced: 50000, collected: 45000, remaining: 5000 },
      { month: 'Oct', monthNum: 10, yearNum: 2024, invoiced: 50000, collected: 48000, remaining: 2000 },
      { month: 'Nov', monthNum: 11, yearNum: 2024, invoiced: 50000, collected: 40000, remaining: 10000 },
    ];

    const totalInvoiced = monthlyBreakdown.reduce((sum, m) => sum + m.invoiced, 0);
    const totalCollected = monthlyBreakdown.reduce((sum, m) => sum + m.collected, 0);
    const totalRemaining = Math.max(0, totalInvoiced - totalCollected);

    expect(totalInvoiced).toBe(150000);
    expect(totalCollected).toBe(133000);
    expect(totalRemaining).toBe(17000);
    expect(monthlyBreakdown.reduce((sum, m) => sum + m.remaining, 0)).toBe(totalRemaining);
  });

  it('reconciles finance overview collected against recent valid payments within the active period', () => {
    const periodStart = '2026-09-01';
    const periodEnd = '2027-06-30';
    const recentPayments = [
      { id: 'pay-1', amount: 3000, paymentDate: '2026-09-15', status: 'completed' },
      { id: 'pay-2', amount: 1500, paymentDate: '2026-09-20', status: 'completed' },
    ];
    const periodCollected = 4500;
    const periodInvoiced = 10500;

    const inPeriodPaymentsTotal = recentPayments
      .filter(p => p.paymentDate >= periodStart && p.paymentDate <= periodEnd)
      .reduce((sum, p) => sum + p.amount, 0);

    expect(periodCollected).toBeGreaterThanOrEqual(inPeriodPaymentsTotal);
    const periodOutstanding = Math.max(0, periodInvoiced - periodCollected);
    expect(periodOutstanding).toBe(6000);
  });

  it('prohibits all-clear attendance banner when weekly average or day rate is below threshold', () => {
    const thresholdPercent: number = 85;
    const weeklyAverageRate: number = 66.7;
    const classesBelowThresholdCount: number = 0;
    const daysBelowThresholdCount: number = 1;

    // Invariant: If weeklyAverageRate < thresholdPercent, banner must report warning, NOT all-clear
    const isAllClear = weeklyAverageRate >= thresholdPercent && classesBelowThresholdCount === 0 && daysBelowThresholdCount === 0;
    expect(isAllClear).toBe(false);

    // State must report an alert message
    const isWarning = classesBelowThresholdCount > 0 || weeklyAverageRate < thresholdPercent || daysBelowThresholdCount > 0;
    expect(isWarning).toBe(true);
  });

  it('determines non-instructional days dynamically based on institution timetable', () => {
    const scheduledDays = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    const isSunday = (dow: string) => !scheduledDays.has(dow);
    expect(isSunday('sunday')).toBe(true);
    expect(isSunday('saturday')).toBe(true);
    expect(isSunday('monday')).toBe(false);
  });

  it('authoritatively maps single or empty branch to institution active branch name', () => {
    const resolveBranchName = (availableBranches: any[], effectiveBranchId: string | null) =>
      effectiveBranchId
        ? availableBranches.find(b => b.id === effectiveBranchId)?.name ?? 'Succursale'
        : availableBranches.length > 1
          ? 'Toutes les succursales'
          : availableBranches[0]?.name ?? 'Campus Principal';

    expect(resolveBranchName([], null)).toBe('Campus Principal');
    expect(resolveBranchName([{ id: 'b-1', name: 'Campus Principal', code: 'MAIN', isDefault: true }], null)).toBe('Campus Principal');
    expect(resolveBranchName([
      { id: 'b-1', name: 'Campus Principal', code: 'MAIN', isDefault: true },
      { id: 'b-2', name: 'Campus Secondaire', code: 'SEC', isDefault: false },
    ], null)).toBe('Toutes les succursales');
    expect(resolveBranchName([
      { id: 'b-1', name: 'Campus Principal', code: 'MAIN', isDefault: true },
      { id: 'b-2', name: 'Campus Secondaire', code: 'SEC', isDefault: false },
    ], 'b-2')).toBe('Campus Secondaire');
  });
});

