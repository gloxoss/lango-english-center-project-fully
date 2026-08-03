import { describe, expect, it, vi } from 'vitest';
import { getPortalManifest } from '@/libs/api/portal-manifest';
import type { RequestContext } from '@/libs/api/context';

vi.mock('@/libs/api/permissions', () => ({
  hasCapability: vi.fn().mockResolvedValue(true),
}));

describe('Phase 5 Primary Dedicated Role Portals Manifest & Scopes', () => {
  it('returns teacher specific home widgets and navigation', async () => {
    const context: RequestContext = {
      userId: 'usr_teacher_1',
      tenantId: '00000000-0000-0000-0000-000000000001',
      branchId: null,
      role: 'teacher',
      name: 'Teacher Test',
      email: 'teacher@schoolos.com',
    };

    const manifest = await getPortalManifest(context);

    expect(manifest.role).toBe('teacher');
    expect(manifest.homeWidgets).toContain('today-schedule');
    expect(manifest.homeWidgets).toContain('my-classes');
  });

  it('returns student specific home widgets and navigation', async () => {
    const context: RequestContext = {
      userId: 'usr_student_1',
      tenantId: '00000000-0000-0000-0000-000000000001',
      branchId: null,
      role: 'student',
      name: 'Student Test',
      email: 'student@schoolos.com',
    };

    const manifest = await getPortalManifest(context);

    expect(manifest.role).toBe('student');
    expect(manifest.homeWidgets).toContain('my-schedule');
    expect(manifest.homeWidgets).toContain('my-grades');
  });

  it('returns parent specific home widgets', async () => {
    const context: RequestContext = {
      userId: 'usr_parent_1',
      tenantId: '00000000-0000-0000-0000-000000000001',
      branchId: null,
      role: 'parent',
      name: 'Parent Test',
      email: 'parent@schoolos.com',
    };

    const manifest = await getPortalManifest(context);

    expect(manifest.role).toBe('parent');
    expect(manifest.homeWidgets).toContain('children-overview');
    expect(manifest.homeWidgets).toContain('payment-status');
  });

  it('returns accountant specific home widgets', async () => {
    const context: RequestContext = {
      userId: 'usr_accountant_1',
      tenantId: '00000000-0000-0000-0000-000000000001',
      branchId: null,
      role: 'accountant',
      name: 'Accountant Test',
      email: 'accountant@schoolos.com',
    };

    const manifest = await getPortalManifest(context);

    expect(manifest.role).toBe('accountant');
    expect(manifest.homeWidgets).toContain('finance-overview');
  });

  it('returns receptionist specific home widgets', async () => {
    const context: RequestContext = {
      userId: 'usr_receptionist_1',
      tenantId: '00000000-0000-0000-0000-000000000001',
      branchId: null,
      role: 'receptionist',
      name: 'Receptionist Test',
      email: 'receptionist@schoolos.com',
    };

    const manifest = await getPortalManifest(context);

    expect(manifest.role).toBe('receptionist');
    expect(manifest.homeWidgets).toContain('inquiry-intake');
    expect(manifest.homeWidgets).toContain('visitor-log');
  });
});
