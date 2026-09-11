import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// tenants.logoUrl has one job: name a file in the tenant's upload directory.
// It does not hold a URL, and it is not proof that a file exists - the seed
// still names a path, and any upload deleted from the volume leaves the column
// set. These pin the two things every reader depends on: turning a stored value
// into the file key the endpoints serve, and refusing to hand back a URL when
// there is nothing behind it.
//
// UPLOADS_ROOT is read at module load, so the temp directory has to be in the
// environment before the module under test is imported.
const UPLOADS_DIR = path.join(os.tmpdir(), `lango-branding-test-${crypto.randomUUID()}`);
process.env.UPLOADS_DIR = UPLOADS_DIR;

const WITH_LOGO = crypto.randomUUID();
const EMPTY_TENANT = crypto.randomUUID();
const SLUG = 'atlas';

// The helpers only stat the file, so the bytes never have to be a real image.
const SOME_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe('branding resolution', () => {
  let brandingFileKey: (storedValue: string, kind: 'logo' | 'favicon') => string;
  let publicBrandingUrl: (
    tenant: { id: string; slug: string; logoUrl?: string | null; faviconUrl?: string | null },
    kind?: 'logo' | 'favicon',
  ) => Promise<string | null>;

  beforeAll(async () => {
    await mkdir(path.join(UPLOADS_DIR, WITH_LOGO), { recursive: true });
    await mkdir(path.join(UPLOADS_DIR, EMPTY_TENANT), { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, WITH_LOGO, 'logo.png'), SOME_BYTES);
    await writeFile(path.join(UPLOADS_DIR, WITH_LOGO, 'favicon.png'), SOME_BYTES);

    ({ brandingFileKey, publicBrandingUrl } = await import('@/libs/api/uploads'));
  });

  afterAll(async () => {
    await rm(UPLOADS_DIR, { recursive: true, force: true });
  });

  describe('brandingFileKey', () => {
    it('keeps the bare filename the upload endpoint writes', () => {
      expect(brandingFileKey('logo.png', 'logo')).toBe('logo.png');
      expect(brandingFileKey('favicon.jpg', 'favicon')).toBe('favicon.jpg');
    });

    it('reads only the extension out of a seeded path', () => {
      // The value seed-full.ts used to write. A path is not a location here -
      // the file is always stored as `${kind}.${ext}` - so the extension is the
      // only part that survives.
      expect(brandingFileKey('/uploads/seed/atlas-logo.png', 'logo')).toBe('logo.png');
    });

    it('is not fooled by a dotted directory or a missing extension', () => {
      // split('.').pop() returns '2/atlas-logo' for the first of these.
      expect(brandingFileKey('/uploads/v1.2/atlas-logo.jpg', 'logo')).toBe('logo.jpg');
      expect(brandingFileKey('logo', 'logo')).toBe('logo.png');
    });

    it('normalises case', () => {
      expect(brandingFileKey('LOGO.PNG', 'logo')).toBe('logo.png');
    });
  });

  describe('publicBrandingUrl', () => {
    it('points at the public endpoint when the uploaded file is there', async () => {
      await expect(publicBrandingUrl({ id: WITH_LOGO, slug: SLUG, logoUrl: 'logo.png' }))
        .resolves.toBe(`/api/public/website/${SLUG}/logo`);
    });

    it('returns null for the seeded path, so nothing renders a broken image', async () => {
      // Exactly the value the seed wrote: a path, with no file behind it.
      await expect(publicBrandingUrl({ id: EMPTY_TENANT, slug: SLUG, logoUrl: '/uploads/seed/atlas-logo.png' }))
        .resolves.toBeNull();
    });

    it('returns null when the column is empty or unset', async () => {
      await expect(publicBrandingUrl({ id: WITH_LOGO, slug: SLUG, logoUrl: null })).resolves.toBeNull();
      await expect(publicBrandingUrl({ id: WITH_LOGO, slug: SLUG })).resolves.toBeNull();
    });

    it('resolves against the given tenant, so one school cannot borrow another’s file', async () => {
      // Same stored filename, different tenant, no file there.
      await expect(publicBrandingUrl({ id: EMPTY_TENANT, slug: SLUG, logoUrl: 'logo.png' }))
        .resolves.toBeNull();
    });

    it('resolves a favicon to the favicon URL', async () => {
      await expect(publicBrandingUrl({ id: WITH_LOGO, slug: SLUG, faviconUrl: 'favicon.png' }, 'favicon'))
        .resolves.toBe(`/api/public/website/${SLUG}/logo?type=favicon`);
    });
  });
});
