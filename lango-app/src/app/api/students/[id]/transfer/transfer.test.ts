import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async (_req: Request) => ({
    userId: 'usr_admin_test',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'school_admin',
    user: { id: 'usr_admin_test', role: 'school_admin', tenantId: '00000000-0000-0000-0000-000000000001' },
  })),
  requireTenant: vi.fn(() => '00000000-0000-0000-0000-000000000001'),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => Promise.resolve()),
}));

vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn(),
}));

describe('Student Inter-Campus Transfer Route', () => {
  it('rejects POST with non-uuid branchId', async () => {
    const req = new NextRequest('http://localhost:3000/api/students/stu-123/transfer', {
      method: 'POST',
      body: JSON.stringify({
        branchId: 'invalid-branch-id',
      }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: 'stu-123' }) });
    expect(response.status).toBe(422);

    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it('rejects unrecognized extra keys with strict schema', async () => {
    const req = new NextRequest('http://localhost:3000/api/students/stu-123/transfer', {
      method: 'POST',
      body: JSON.stringify({
        branchId: '11111111-1111-1111-1111-111111111111',
        maliciousKey: true,
      }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: 'stu-123' }) });
    expect(response.status).toBe(422);

    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it('accepts valid transfer payload with reason, effectiveDate, and flags without 422 schema error', async () => {
    const validBranchId = 'a0000000-0000-4000-a000-000000000001';
    const validClassSectionId = 'b0000000-0000-4000-a000-000000000002';
    const req = new NextRequest('http://localhost:3000/api/students/stu-123/transfer', {
      method: 'POST',
      body: JSON.stringify({
        branchId: validBranchId,
        classSectionId: validClassSectionId,
        reason: 'Déménagement familial',
        effectiveDate: '2026-09-15',
        notifyGuardian: true,
        generateCertificate: true,
      }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: 'stu-nonexistent' }) });
    // It passes schema validation (not 422 schema error) and reaches DB check (422 INVALID_REFERENCE for nonexistent student)
    const json = await response.json();
    expect(json.error?.code).toBe('INVALID_REFERENCE');
  });
});
