import { describe, expect, it } from 'vitest';
import { contentTypeFor, resolveTenantPath, UPLOADS_ROOT } from '../uploads';
import { ApiError } from '../errors';
import path from 'node:path';

describe('M-3: Uploads path-traversal protection', () => {
  const tenantId = 'test-tenant-123';

  it('resolves valid subpaths within tenant directory', () => {
    const resolved = resolveTenantPath(tenantId, 'photos/student.jpg');
    const expected = path.resolve(UPLOADS_ROOT, tenantId, 'photos/student.jpg');
    expect(resolved).toBe(expected);
  });

  it('rejects path traversal attempts with ../ escaping the tenant root', () => {
    expect(() => resolveTenantPath(tenantId, '../../etc/passwd')).toThrow(ApiError);
    expect(() => resolveTenantPath(tenantId, '../other-tenant/file.png')).toThrow(ApiError);
    expect(() => resolveTenantPath(tenantId, 'sub/../../../../secret')).toThrow(ApiError);
  });

  it('maps known file extensions to proper MIME types and unknown to application/octet-stream', () => {
    expect(contentTypeFor('png')).toBe('image/png');
    expect(contentTypeFor('pdf')).toBe('application/pdf');
    expect(contentTypeFor('jpg')).toBe('image/jpeg');
    expect(contentTypeFor('jpeg')).toBe('image/jpeg');
    expect(contentTypeFor('webp')).toBe('image/webp');
    expect(contentTypeFor('exe')).toBe('application/octet-stream');
    expect(contentTypeFor('sh')).toBe('application/octet-stream');
  });
});
