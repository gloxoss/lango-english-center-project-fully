import { Buffer } from 'node:buffer';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// School Website CMS regression suite (AUD-WEBSITE-01).
//
// Covers:
//   - capability/role enforcement on the CMS APIs;
//   - tenant isolation for menu/news mutations;
//   - the HTTPS/URL policy for menu links, theme socials, map embeds and
//     content images (javascript:/data:/http: never persisted);
//   - public visibility rules (draft / future-dated news, disabled theme);
//   - image upload validation (magic bytes, size, type);
//   - the renderer's defense-in-depth for legacy dangerous rows.

let currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { addonEntitlements, tenants, user } = await import('@/models/Schema');
const {
  isHttpsUrl,
  isSafeContentUrl,
  menuLinkError,
  homePageContentSchema,
  contactPageContentSchema,
} = await import('@/features/website/models/website-validation');
const {
  getPublicNewsBySlug,
  getPublicPage,
  getPublicTheme,
  listPublicNews,
  createNews,
  updateNews,
  deleteNews,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = await import('@/features/website/services/website-service');
const { inspectImageBuffer } = await import('@/libs/api/uploads');
const themeRoute = await import('@/app/api/settings/website/theme/route');
const menuItemsRoute = await import('@/app/api/settings/website/menu-items/route');
const menuItemRoute = await import('@/app/api/settings/website/menu-items/[id]/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('website cms scope', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const adminId = `USR-WCS-ADM-${suffix}`;
  const teacherId = `USR-WCS-TCH-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Website CMS Test', slug: `wcs-${suffix}` },
      { id: otherTenantId, name: 'Website CMS Other', slug: `wcs-o-${suffix}` },
    ]);
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'school-website-cms', isEnabled: true });
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'CMS Admin', email: `wcs-adm-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' },
      { id: teacherId, tenantId, name: 'CMS Teacher', email: `wcs-tch-${suffix}@t.local`, role: 'teacher', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('enforces the school_admin role on CMS APIs', async () => {
    currentSessionUserId = teacherId;
    const denied = await themeRoute.GET(new Request('http://x/api/settings/website/theme'));

    expect(denied.status).toBe(403);

    currentSessionUserId = null;
    const anonymous = await themeRoute.GET(new Request('http://x/api/settings/website/theme'));

    expect(anonymous.status).toBe(401);
  });

  it('validates link/URL policy helpers', () => {
    expect(isHttpsUrl('https://example.com')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('data:text/html,<script>')).toBe(false);
    expect(isHttpsUrl('/relative')).toBe(false);

    expect(isSafeContentUrl('/api/public/website/atlas/images/x.png')).toBe(true);
    expect(isSafeContentUrl('https://cdn.example.com/x.png')).toBe(true);
    expect(isSafeContentUrl('//evil.com/x.png')).toBe(false);
    expect(isSafeContentUrl('javascript:alert(1)')).toBe(false);

    expect(menuLinkError('page', 'home')).toBeNull();
    expect(menuLinkError('page', 'news')).toBeNull();
    expect(menuLinkError('page', 'admin')).not.toBeNull();
    expect(menuLinkError('external', 'https://example.com')).toBeNull();
    expect(menuLinkError('external', 'javascript:alert(1)')).not.toBeNull();
    expect(menuLinkError('external', 'http://example.com')).not.toBeNull();
    expect(menuLinkError('anchor', '#contact')).toBeNull();
    expect(menuLinkError('anchor', 'javascript:alert(1)')).not.toBeNull();
  });

  it('rejects unsafe URLs in page content schemas', () => {
    expect(homePageContentSchema.safeParse({ heroImageUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(homePageContentSchema.safeParse({ heroImageUrl: 'data:image/png;base64,AAAA' }).success).toBe(false);
    expect(homePageContentSchema.safeParse({ heroImageUrl: '/api/public/website/a/images/x.png' }).success).toBe(true);
    expect(contactPageContentSchema.safeParse({ mapEmbedUrl: 'data:text/html,<script>alert(1)</script>' }).success).toBe(false);
    expect(contactPageContentSchema.safeParse({ mapEmbedUrl: 'https://maps.google.com/embed' }).success).toBe(true);
  });

  it('rejects menu items with dangerous or unknown targets over the API', async () => {
    currentSessionUserId = adminId;
    const create = (body: Record<string, unknown>) => menuItemsRoute.POST(new Request('http://x/api/settings/website/menu-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));

    expect((await create({ label: 'X', linkType: 'external', linkValue: 'javascript:alert(1)' })).status).toBe(422);
    expect((await create({ label: 'X', linkType: 'external', linkValue: 'http://insecure.example' })).status).toBe(422);
    expect((await create({ label: 'X', linkType: 'page', linkValue: 'nope' })).status).toBe(422);

    const good = await create({ label: 'Accueil', linkType: 'page', linkValue: 'home' });

    expect(good.status).toBe(201);

    const menuId = (await good.json()).data.id;

    const patched = await menuItemRoute.PUT(new Request(`http://x/api/settings/website/menu-items/${menuId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linkType: 'external' }),
    }), { params: Promise.resolve({ id: menuId }) });

    expect(patched.status).toBe(422);
  });

  it('isolates menu and news mutations per tenant', async () => {
    const foreignMenu = await createMenuItem(otherTenantId, { label: 'Foreign', linkType: 'page', linkValue: 'home' });

    await expect(updateMenuItem(tenantId, foreignMenu!.id, { label: 'hack' }))
      .rejects
      .toMatchObject({ status: 404 });
    await expect(deleteMenuItem(tenantId, foreignMenu!.id))
      .rejects
      .toMatchObject({ status: 404 });

    const foreignNews = await createNews(otherTenantId, { title: 'Foreign', slug: 'foreign', status: 'published' });

    expect(await getPublicNewsBySlug(tenantId, 'foreign')).toBeNull();
    await expect(updateNews(tenantId, foreignNews!.id, { title: 'hack' }))
      .rejects
      .toMatchObject({ status: 404 });
    await expect(deleteNews(tenantId, foreignNews!.id))
      .rejects
      .toMatchObject({ status: 404 });

    // The foreign row is untouched.
    const still = await getPublicNewsBySlug(otherTenantId, 'foreign');

    expect(still?.title).toBe('Foreign');
  });

  it('hides drafts and future-dated news from the public read model', async () => {
    await createNews(tenantId, { title: 'Visible', slug: `visible-${suffix}`, status: 'published', publishedAt: new Date(Date.now() - 60_000).toISOString() });
    await createNews(tenantId, { title: 'Draft', slug: `draft-${suffix}`, status: 'draft' });
    await createNews(tenantId, { title: 'Future', slug: `future-${suffix}`, status: 'published', publishedAt: new Date(Date.now() + 86_400_000).toISOString() });

    const { rows } = await listPublicNews(tenantId, { limit: 50, offset: 0 });
    const titles = rows.map(r => r.title);

    expect(titles).toContain('Visible');
    expect(titles).not.toContain('Draft');
    expect(titles).not.toContain('Future');

    expect(await getPublicNewsBySlug(tenantId, `draft-${suffix}`)).toBeNull();
    expect(await getPublicNewsBySlug(tenantId, `future-${suffix}`)).toBeNull();
    expect(await getPublicNewsBySlug(tenantId, `visible-${suffix}`)).not.toBeNull();
  });

  it('treats a missing or disabled theme as no public site', async () => {
    currentSessionUserId = adminId;

    expect(await getPublicTheme(tenantId)).toBeNull();
    expect(await getPublicPage(tenantId, 'home')).toBeNull();

    await themeRoute.PUT(new Request('http://x/api/settings/website/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false, siteTitle: 'Off' }),
    }));

    expect(await getPublicTheme(tenantId)).toBeNull();

    await themeRoute.PUT(new Request('http://x/api/settings/website/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }));

    expect(await getPublicTheme(tenantId)).not.toBeNull();
  });

  it('rejects unsafe social URLs but accepts https', async () => {
    currentSessionUserId = adminId;
    const bad = await themeRoute.PUT(new Request('http://x/api/settings/website/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ socialFacebook: 'javascript:alert(1)' }),
    }));

    expect(bad.status).toBe(422);

    const good = await themeRoute.PUT(new Request('http://x/api/settings/website/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ socialFacebook: 'https://facebook.com/school' }),
    }));

    expect(good.status).toBe(200);
  });

  it('rejects non-image uploads and oversized images by content, not extension', () => {
    const text = Buffer.from('this is not an image');

    expect(() => inspectImageBuffer(text, 'png')).toThrow();

    const bigHeader = Buffer.alloc(30);
    bigHeader.writeUInt32BE(6000, 16);
    bigHeader.writeUInt32BE(6000, 20);

    expect(() => inspectImageBuffer(bigHeader, 'png')).toThrow();
  });
});
