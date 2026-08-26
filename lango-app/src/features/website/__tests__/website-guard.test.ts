// School-website-cms guard + public-route tenant-isolation + page completeness.
//
// Guard: `requireAddon(tenantId, 'school-website-cms')` is the gate behind every
// api/settings/website/** route. The public site is slug-resolved and strictly
// scoped by tenantId, so the single most important property is that tenant A's
// public content is never served to tenant B (and vice-versa).
//
// Isolation is enforced in the public read helpers (`resolveTenantBySlug`,
// `getPublicPage`, `listPublicNews`, `getPublicNewsBySlug`) — all scoped by the
// resolved tenantId. Page-type completeness (`listPages`) must return all six
// fixed types with honest empty-state fallbacks on a fresh tenant, never throw.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { addonEntitlements, tenants } from '@/models/Schema';
import { websiteNews, websitePages, websiteTheme } from '@/features/website/models/website-schema';
import {
  createNews,
  getPublicNewsBySlug,
  getPublicPage,
  listPages,
  listPublicNews,
  resolveTenantBySlug,
  upsertPage,
} from '@/features/website/services/website-service';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('school-website-cms guard + isolation + completeness', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const slugA = `site-a-${suffix}`;
  const slugB = `site-b-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Site School A ${suffix}`, slug: slugA },
      { id: tenantB, name: `Site School B ${suffix}`, slug: slugB },
    ]);
  }, 30_000);

  afterAll(async () => {
    await db.delete(websiteNews).where(eq(websiteNews.tenantId, tenantA));
    await db.delete(websiteNews).where(eq(websiteNews.tenantId, tenantB));
    await db.delete(websitePages).where(eq(websitePages.tenantId, tenantA));
    await db.delete(websitePages).where(eq(websitePages.tenantId, tenantB));
    await db.delete(websiteTheme).where(eq(websiteTheme.tenantId, tenantA));
    await db.delete(websiteTheme).where(eq(websiteTheme.tenantId, tenantB));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  }, 30_000);

  describe('entitlement guard', () => {
    it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
      await expect(requireAddon(tenantA, 'school-website-cms')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
    });

    it('allows once enabled, then denies again after being disabled', async () => {
      await db.insert(addonEntitlements).values({ tenantId: tenantA, addonId: 'school-website-cms', isEnabled: true });
      await expect(requireAddon(tenantA, 'school-website-cms')).resolves.toBeUndefined();

      await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantA));
      await expect(requireAddon(tenantA, 'school-website-cms')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
    });
  });

  describe('public tenant isolation', () => {
    it('resolves each slug to its own tenant and null for unknown slugs', async () => {
      const a = await resolveTenantBySlug(slugA);
      const b = await resolveTenantBySlug(slugB);
      const missing = await resolveTenantBySlug(`no-such-${suffix}`);
      expect(a?.id).toBe(tenantA);
      expect(b?.id).toBe(tenantB);
      expect(missing).toBeNull();
    });

    it('never serves tenant A page content to tenant B', async () => {
      await upsertPage(tenantA, 'home', { title: `A Home ${suffix}`, content: { heroTitle: 'Only for A' } });

      const aHome = await getPublicPage(tenantA, 'home');
      const bHome = await getPublicPage(tenantB, 'home');

      expect(aHome).not.toBeNull();
      expect(aHome!.title).toBe(`A Home ${suffix}`);
      expect(bHome).toBeNull();
    });

    it('never leaks tenant A news to tenant B (list or slug lookup)', async () => {
      const newsSlug = `a-news-${suffix}`;
      await createNews(tenantA, { title: 'A News', slug: newsSlug, status: 'published' });

      const aNews = await listPublicNews(tenantA, { limit: 10, offset: 0 });
      const bNews = await listPublicNews(tenantB, { limit: 10, offset: 0 });
      const bLookup = await getPublicNewsBySlug(tenantB, newsSlug);

      expect(aNews.total).toBe(1);
      expect(aNews.rows[0]!.slug).toBe(newsSlug);
      expect(bNews.total).toBe(0);
      expect(bLookup).toBeNull();
    });
  });

  describe('page-type completeness', () => {
    it('returns all six fixed page types with honest empty-state fallbacks on a fresh tenant', async () => {
      const pages = await listPages(tenantB);
      expect(pages.map(p => p.pageType)).toEqual(['home', 'about', 'gallery', 'faq', 'contact', 'services']);
      // Fresh tenant: every type is an empty fallback, no rows, no throw.
      expect(pages.every(p => p.id === null)).toBe(true);
      expect(pages.every(p => p.title === '')).toBe(true);
    });
  });
});
