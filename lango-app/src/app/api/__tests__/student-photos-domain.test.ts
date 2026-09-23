import { Buffer } from 'node:buffer';
import type { RequestContext } from '@/libs/api/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST, PUT } from '@/app/api/students/photos/route';
import { ApiError } from '@/libs/api/errors';
import { inspectImageBuffer } from '@/libs/api/uploads';

// Mock server environment
vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

// Mock Audit Logger
const mockRecordAudit = vi.fn();
vi.mock('@/libs/api/audit', () => ({
  recordAudit: (...args: any[]) => mockRecordAudit(...args),
}));

// Mock Capabilities
const mockRequireCapability = vi.fn().mockResolvedValue(true);
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: (...args: any[]) => mockRequireCapability(...args),
}));

// Mock Uploads filesystem operations
vi.mock('@/libs/api/uploads', async () => {
  const actual = await vi.importActual<any>('@/libs/api/uploads');
  return {
    ...actual,
    saveUploadedFile: vi.fn(async (_tenantId, _subpath, file, allowedTypes, maxBytes, options) => {
      const ext = allowedTypes[file.type];
      if (!ext) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Format de fichier non supporté.');
      }
      if (file.size <= 0) {
        throw new ApiError(422, 'EMPTY_FILE', 'Le fichier est vide (0 octet).');
      }
      if (file.size > maxBytes) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier trop volumineux.');
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      if (options?.validateImageDimensions) {
        actual.inspectImageBuffer(bytes, ext);
      }
      return ext;
    }),
    deleteUploadedFile: vi.fn(async () => true),
    readUploadedFile: vi.fn(async () => Buffer.from('mock-bytes')),
  };
});

// Mock Request Context
let currentRequestContext: RequestContext | null = null;
vi.mock('@/libs/api/context', async () => {
  const actual = await vi.importActual<any>('@/libs/api/context');
  return {
    ...actual,
    requireRequestContext: vi.fn(async (_req: any, allowedRoles?: string[]) => {
      if (!currentRequestContext) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }
      if (allowedRoles && !allowedRoles.includes(currentRequestContext.role)) {
        throw new ApiError(403, 'FORBIDDEN', 'Insufficient permissions');
      }
      return currentRequestContext;
    }),
    requireTenant: (ctx: any) => {
      if (!ctx?.tenantId) {
        throw new ApiError(400, 'TENANT_REQUIRED', 'Tenant context required');
      }
      return ctx.tenantId;
    },
  };
});

// Fluent chainable query builder helper
function createChainableQuery(resolver: () => any) {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    then: (onResolve: any, onReject: any) => Promise.resolve(resolver()).then(onResolve, onReject),
  };
  return chain;
}

// Hoisted DB mocks
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbTransaction } = vi.hoisted(() => {
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbTransaction: vi.fn((cb: any) => cb({
      select: (...args: any[]) => mockDbSelect(...args),
      insert: vi.fn(() => createChainableQuery(() => ({}))),
      update: vi.fn(() => createChainableQuery(() => ({}))),
      delete: vi.fn(() => createChainableQuery(() => ({}))),
    })),
  };
});

vi.mock('@/libs/DB', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: (...args: any[]) => mockDbDelete(...args),
    transaction: (cb: any) => mockDbTransaction(cb),
  },
}));

// Helper to create valid PNG buffers of specified dimensions
function createPngBuffer(width = 200, height = 200): Buffer {
  const buf = Buffer.alloc(45);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR chunk length 13
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 2; // color type RGB
  buf[26] = 0;
  buf[27] = 0;
  buf[28] = 0;
  buf.writeUInt32BE(0, 29); // CRC
  // IEND chunk
  buf.writeUInt32BE(0, 33);
  buf.write('IEND', 37);
  buf.writeUInt32BE(0xae426082, 41);
  return buf;
}

// Helper to create valid JPEG buffer of specified dimensions
function createJpegBuffer(width = 200, height = 200): Buffer {
  const buf = Buffer.alloc(24);
  buf[0] = 0xff;
  buf[1] = 0xd8; // SOI
  buf[2] = 0xff;
  buf[3] = 0xc0; // SOF0
  buf[4] = 0x00;
  buf[5] = 0x11; // Length 17
  buf[6] = 0x08; // Precision 8
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  buf[11] = 0x03; // 3 components
  // 9 bytes component data
  buf[12] = 1;
  buf[13] = 0x11;
  buf[14] = 0;
  buf[15] = 2;
  buf[16] = 0x11;
  buf[17] = 1;
  buf[18] = 3;
  buf[19] = 0x11;
  buf[20] = 1;
  // EOI
  buf[21] = 0xff;
  buf[22] = 0xd9;
  return buf;
}

// Helper to construct mock File
function createMockFile(name: string, buffer: Buffer, type = 'image/png'): File {
  return new File([new Uint8Array(buffer)], name, { type });
}

describe('Student Photos Domain & Security Hardening (G1–G10)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const STUDENT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const STUDENT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue(createChainableQuery(() => []));
    mockDbInsert.mockReturnValue(createChainableQuery(() => ({})));
    mockDbUpdate.mockReturnValue(createChainableQuery(() => ({})));
    mockDbDelete.mockReturnValue(createChainableQuery(() => ({})));
    currentRequestContext = {
      userId: 'user-admin-1',
      tenantId: TENANT_A,
      role: 'school_admin',
      permissions: ['students.update', 'students.read'],
    } as any;
  });

  // ==========================================================================
  // G3: Image Validation & Decoding Engine
  // ==========================================================================
  describe('G3: Image Validation & Decoding Engine', () => {
    it('accepts valid PNG with sane dimensions', () => {
      const png = createPngBuffer(300, 300);
      const info = inspectImageBuffer(png, 'png');
      expect(info.format).toBe('png');
      expect(info.width).toBe(300);
      expect(info.height).toBe(300);
    });

    it('accepts valid JPEG with dimensions within Moroccan photo portrait bounds', () => {
      const jpg = createJpegBuffer(350, 450);
      const info = inspectImageBuffer(jpg, 'jpg');
      expect(info.format).toBe('jpeg');
      expect(info.width).toBe(350);
      expect(info.height).toBe(450);
      const aspect = info.width / info.height;
      expect(aspect).toBeGreaterThanOrEqual(0.35);
      expect(aspect).toBeLessThanOrEqual(2.8);
    });

    it('rejects zero-byte buffer', () => {
      const zeroBuf = Buffer.alloc(0);
      expect(() => inspectImageBuffer(zeroBuf, 'png')).toThrow();
    });

    it('rejects fake image disguised with JPEG extension', () => {
      const fake = Buffer.from('NOT_AN_IMAGE_JUST_TEXT');
      expect(() => inspectImageBuffer(fake, 'jpg')).toThrow();
    });

    it('rejects image with dimensions smaller than 64x64 minimum', () => {
      const tinyPng = createPngBuffer(32, 32);
      expect(() => inspectImageBuffer(tinyPng, 'png')).toThrow(/trop petites/);
    });

    it('rejects image with dimensions larger than 5000x5000 maximum', () => {
      const hugePng = createPngBuffer(5200, 5200);
      expect(() => inspectImageBuffer(hugePng, 'png')).toThrow(/trop grandes/);
    });

    it('rejects image with extreme panoramic aspect ratio', () => {
      const bannerPng = createPngBuffer(1000, 100); // aspect ratio 10.0 (max allowed is 2.8)
      expect(() => inspectImageBuffer(bannerPng, 'png')).toThrow(/Ratio d'aspect/);
    });

    it('rejects truncated/corrupted JPEG missing valid headers', () => {
      const corruptedJpg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
      expect(() => inspectImageBuffer(corruptedJpg, 'jpg')).toThrow();
    });
  });

  // ==========================================================================
  // G1 & G2: Multi-Tenant Isolation & IDOR Protection
  // ==========================================================================
  describe('G1 & G2: Multi-Tenant Isolation & IDOR Guards', () => {
    it('rejects single photo upload targeting a student from another tenant (404/IDOR guard)', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => []));

      const formData = new FormData();
      formData.append('studentId', STUDENT_B);
      formData.append('file', createMockFile('photo.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error?.code).toBe('STUDENT_NOT_FOUND');
    });

    it('rejects photo deletion targeting a student not in the active tenant', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => []));

      const req = new Request(`http://localhost:3000/api/students/photos?id=${STUDENT_B}`, {
        method: 'DELETE',
      });

      const res = await DELETE(req);
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error?.code).toBe('STUDENT_NOT_FOUND');
    });

    it('GET gallery enforces tenant isolation', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => []));

      const req = new Request(`http://localhost:3000/api/students/photos?gallery=true&studentId=${STUDENT_B}`);
      const res = await GET(req);
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error?.code).toBe('STUDENT_NOT_FOUND');
    });
  });

  // ==========================================================================
  // G4: Deterministic Bulk Matching Precedence
  // ==========================================================================
  describe('G4: Bulk Matching Precedence & Ambiguity Resolution', () => {
    const studentList = [
      {
        id: '11111111-1111-1111-1111-111111111101',
        name: 'Amine Benali',
        matricule: 'MAT-2026-001',
        nationalId: 'G134567890',
        photoUrl: null,
      },
      {
        id: '11111111-1111-1111-1111-111111111102',
        name: 'Fatima Zahra El Amrani',
        matricule: 'MAT-2026-002',
        nationalId: 'G134567891',
        photoUrl: 'students/11111111-1111-1111-1111-111111111102/photo.jpg',
      },
      // Two students with identical normalized names (homonyms)
      {
        id: '11111111-1111-1111-1111-111111111103',
        name: 'Youssef Idrissi',
        matricule: 'MAT-2026-003',
        nationalId: 'G134567892',
        photoUrl: null,
      },
      {
        id: '11111111-1111-1111-1111-111111111104',
        name: 'Youssef Idrissi',
        matricule: 'MAT-2026-004',
        nationalId: 'G134567893',
        photoUrl: null,
      },
    ];

    it('matches by UUID exact match (Precedence 1)', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append(
        'files',
        createMockFile('11111111-1111-1111-1111-111111111101.png', createPngBuffer(200, 200)),
      );

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].matchMethod).toBe('uuid');
      expect(json.data.items[0].status).toBe('READY');
      expect(json.data.items[0].matchedStudent.id).toBe('11111111-1111-1111-1111-111111111101');
    });

    it('matches by internal matricule exact match (Precedence 2)', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('MAT-2026-001.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].matchMethod).toBe('matricule');
      expect(json.data.items[0].status).toBe('READY');
      expect(json.data.items[0].matchedStudent.name).toBe('Amine Benali');
    });

    it('matches by Massar exact match (Precedence 3)', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('G134567890.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].matchMethod).toBe('massar');
      expect(json.data.items[0].status).toBe('READY');
      expect(json.data.items[0].matchedStudent.id).toBe('11111111-1111-1111-1111-111111111101');
    });

    it('matches by normalized unique full name (Precedence 4)', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('amine_benali.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].matchMethod).toBe('name');
      expect(json.data.items[0].status).toBe('READY');
      expect(json.data.items[0].matchedStudent.name).toBe('Amine Benali');
    });

    it('flags AMBIGUOUS and avoids auto-linking when duplicate name exists', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('youssef_idrissi.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].status).toBe('AMBIGUOUS');
      expect(json.data.items[0].matchedStudent).toBeNull();
      expect(json.data.items[0].reason).toContain('élèves correspondent au nom');
    });

    it('flags EXISTING_PHOTO when student already has an active profile photo', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('MAT-2026-002.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].status).toBe('EXISTING_PHOTO');
      expect(json.data.items[0].matchedStudent.name).toBe('Fatima Zahra El Amrani');
    });

    it('flags NO_MATCH when filename matches no student', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => studentList));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('unknown_person_99.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].status).toBe('NO_MATCH');
    });
  });

  // ==========================================================================
  // G5: Batch Collision Detection
  // ==========================================================================
  describe('G5: Batch Collision Detection (Multiple files matching same student)', () => {
    it('flags second file as DUPLICATE_FILE_FOR_STUDENT when 2 files match same student', async () => {
      const student = {
        id: '11111111-1111-1111-1111-111111111101',
        name: 'Amine Benali',
        matricule: 'MAT-2026-001',
        nationalId: 'G134567890',
        photoUrl: null,
      };
      mockDbSelect.mockReturnValue(createChainableQuery(() => [student]));

      const formData = new FormData();
      formData.append('action', 'preview');
      formData.append('files', createMockFile('MAT-2026-001.png', createPngBuffer(200, 200)));
      formData.append('files', createMockFile('amine_benali.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.items[0].status).toBe('READY');
      expect(json.data.items[1].status).toBe('DUPLICATE_FILE_FOR_STUDENT');
      expect(json.data.items[1].reason).toContain('Plusieurs fichiers du même lot');
    });
  });

  // ==========================================================================
  // G6: Replacement & Deletion Semantics
  // ==========================================================================
  describe('G6: Safe Replacement & Deletion Semantics', () => {
    it('DELETE /api/students/photos clears photoUrl and logs audit trail', async () => {
      const existingStudent = {
        id: STUDENT_A,
        name: 'Amine Benali',
        photoUrl: `students/${STUDENT_A}/old-photo.jpg`,
      };
      mockDbSelect.mockReturnValue(createChainableQuery(() => [existingStudent]));

      const req = new Request(`http://localhost:3000/api/students/photos?id=${STUDENT_A}`, {
        method: 'DELETE',
      });

      const res = await DELETE(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify audit was called
      expect(mockRecordAudit).toHaveBeenCalledWith(
        expect.anything(),
        'delete',
        'student_photo',
        STUDENT_A,
        expect.anything(),
      );
    });

    it('PUT /api/students/photos promotes photo to profile pointer', async () => {
      const photo = { id: 'photo-123', url: 'students/a/new.jpg' };
      const currentStudent = { id: STUDENT_A, photoUrl: 'old.jpg' };

      // Query 1: find photo, Query 2: find current user
      mockDbSelect
        .mockReturnValueOnce(createChainableQuery(() => [photo]))
        .mockReturnValueOnce(createChainableQuery(() => [currentStudent]));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: STUDENT_A,
          photoId: 'photo-123',
        }),
      });

      const res = await PUT(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify audit record
      expect(mockRecordAudit).toHaveBeenCalledWith(
        expect.anything(),
        'update',
        'student_photo',
        STUDENT_A,
        expect.anything(),
      );
    });
  });

  // ==========================================================================
  // G7: Mathematical Invariants (Total = WithPhoto + WithoutPhoto)
  // ==========================================================================
  describe('G7: Mathematical Counter Invariants', () => {
    it('returns exact total = withPhoto + withoutPhoto under identical scope', async () => {
      const kpis = { total: 5, withPhoto: 2, withoutPhoto: 3 };
      const studentsInDb = [
        { id: '1', name: 'Student 1', photoUrl: 'url1.jpg', matricule: 'M1', nationalId: null },
        { id: '2', name: 'Student 2', photoUrl: 'url2.jpg', matricule: 'M2', nationalId: null },
        { id: '3', name: 'Student 3', photoUrl: null, matricule: 'M3', nationalId: null },
        { id: '4', name: 'Student 4', photoUrl: null, matricule: 'M4', nationalId: null },
        { id: '5', name: 'Student 5', photoUrl: null, matricule: 'M5', nationalId: null },
      ];

      // First query is KPI count, second query is students list
      mockDbSelect
        .mockReturnValueOnce(createChainableQuery(() => [kpis]))
        .mockReturnValueOnce(createChainableQuery(() => studentsInDb));

      const req = new Request('http://localhost:3000/api/students/photos');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      const { kpi } = json;
      expect(kpi.total).toBe(5);
      expect(kpi.withPhoto).toBe(2);
      expect(kpi.withoutPhoto).toBe(3);
      expect(kpi.total).toBe(kpi.withPhoto + kpi.withoutPhoto);
      expect(json.data.length).toBe(5);
    });

    it('preserves mathematical truth when filtered by with_photo', async () => {
      const kpis = { total: 3, withPhoto: 2, withoutPhoto: 1 };
      const studentsInDb = [
        { id: '1', name: 'Student 1', photoUrl: 'url1.jpg', matricule: 'M1', nationalId: null },
        { id: '2', name: 'Student 2', photoUrl: 'url2.jpg', matricule: 'M2', nationalId: null },
      ];

      mockDbSelect
        .mockReturnValueOnce(createChainableQuery(() => [kpis]))
        .mockReturnValueOnce(createChainableQuery(() => studentsInDb));

      const req = new Request('http://localhost:3000/api/students/photos?filter=with_photo');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(2);
      expect(json.kpi.total).toBe(3);
      expect(json.kpi.withPhoto).toBe(2);
      expect(json.kpi.withoutPhoto).toBe(1);
      expect(json.kpi.total).toBe(json.kpi.withPhoto + json.kpi.withoutPhoto);
    });
  });

  // ==========================================================================
  // G8: Role Authorization
  // ==========================================================================
  describe('G8: Role Authorization', () => {
    it('rejects unauthenticated requests (401)', async () => {
      currentRequestContext = null;

      const req = new Request('http://localhost:3000/api/students/photos');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('rejects unauthorized role (e.g. parent) on mutation routes (403)', async () => {
      currentRequestContext = {
        userId: 'parent-1',
        tenantId: TENANT_A,
        role: 'parent',
        permissions: [],
      } as any;

      const req = new Request(`http://localhost:3000/api/students/photos?id=${STUDENT_A}`, {
        method: 'DELETE',
      });
      const res = await DELETE(req);
      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // G9: Cross-Module Projection & Direct Binary Serving
  // ==========================================================================
  describe('G9: Cross-Module Serving & Binary Delivery', () => {
    it('returns 404 when requested student photo does not exist in DB', async () => {
      mockDbSelect.mockReturnValue(createChainableQuery(() => []));

      const req = new Request(`http://localhost:3000/api/students/photos?id=nonexistent`);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // G10: Audit Trail Verification
  // ==========================================================================
  describe('G10: Full Audit Trail Invariant', () => {
    it('records structured audit log on successful photo commit', async () => {
      const student = {
        id: STUDENT_A,
        name: 'Amine Benali',
        photoUrl: null,
      };
      mockDbSelect.mockReturnValue(createChainableQuery(() => [student]));

      const formData = new FormData();
      formData.append('studentId', STUDENT_A);
      formData.append('file', createMockFile('test.png', createPngBuffer(200, 200)));

      const req = new Request('http://localhost:3000/api/students/photos', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRecordAudit).toHaveBeenCalledWith(
        expect.anything(),
        'create',
        'student_photo',
        STUDENT_A,
        expect.objectContaining({
          method: 'single',
        }),
      );
    });
  });
});
