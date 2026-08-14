import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AppRole } from './context';

const mocks = vi.hoisted(() => ({
  getServerUserContext: vi.fn(),
  hasCapability: vi.fn(),
}));

vi.mock('@/libs/auth/server-context', () => ({
  getServerUserContext: mocks.getServerUserContext,
}));

vi.mock('@/libs/api/permissions', () => ({
  hasCapability: mocks.hasCapability,
}));

const { requireServerPage } = await import('./page-guard');

const baseCtx = {
  userId: 'u1',
  tenantId: 't1',
  branchId: null,
  role: 'school_admin' as const,
  name: 'A',
  email: 'a@t.local',
  sessionId: 's1',
};

async function captureRedirect(promise: Promise<unknown>): Promise<{ digest: string }> {
  try {
    await promise;
  } catch (err) {
    return { digest: String((err as { digest?: string })?.digest ?? '') };
  }
  throw new Error('Expected requireServerPage to redirect, but it resolved.');
}

beforeEach(() => {
  mocks.getServerUserContext.mockReset();
  mocks.hasCapability.mockReset();
  mocks.hasCapability.mockResolvedValue(true);
});

describe('requireServerPage', () => {
  it('redirects to login when unauthenticated or the account is disabled', async () => {
    mocks.getServerUserContext.mockResolvedValue(null);
    const { digest } = await captureRedirect(
      requireServerPage('fr', { allowedRoles: ['school_admin', 'super_admin'] }),
    );
    expect(digest).toContain('/fr/login');
  });

  it('redirects to the dashboard home when the role is not allowed', async () => {
    mocks.getServerUserContext.mockResolvedValue({ ...baseCtx, role: 'teacher' });
    const { digest } = await captureRedirect(
      requireServerPage('fr', { allowedRoles: ['school_admin', 'super_admin'] }),
    );
    expect(digest).toContain('/fr');
  });

  it('rejects every non-admin role (teacher, student, parent, receptionist, accountant)', async () => {
    const blocked: AppRole[] = [
      'teacher', 'student', 'parent', 'receptionist', 'accountant', 'alumni', 'guard',
    ];
    for (const role of blocked) {
      mocks.getServerUserContext.mockReset();
      mocks.getServerUserContext.mockResolvedValue({ ...baseCtx, role });
      const { digest } = await captureRedirect(
        requireServerPage('fr', { allowedRoles: ['school_admin', 'super_admin'] }),
      );
      expect(digest).toContain('/fr');
    }
  });

  it('redirects when the required capability is missing', async () => {
    mocks.getServerUserContext.mockResolvedValue(baseCtx);
    mocks.hasCapability.mockResolvedValue(false);
    const { digest } = await captureRedirect(
      requireServerPage('fr', { allowedRoles: ['school_admin'], requiredCapability: 'analytics.read' }),
    );
    expect(digest).toContain('/fr');
    expect(mocks.hasCapability).toHaveBeenCalledWith('u1', 't1', 'school_admin', 'analytics.read');
  });

  it('returns the context when the role and capability are allowed', async () => {
    mocks.getServerUserContext.mockResolvedValue(baseCtx);
    const ctx = await requireServerPage('fr', {
      allowedRoles: ['school_admin'],
      requiredCapability: 'analytics.read',
    });
    expect(ctx).toEqual(baseCtx);
    expect(mocks.hasCapability).toHaveBeenCalledWith('u1', 't1', 'school_admin', 'analytics.read');
  });
});
