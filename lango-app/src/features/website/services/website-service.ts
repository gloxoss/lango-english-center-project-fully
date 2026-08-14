import { and, asc, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import {
  websiteMenuItems,
  websiteNews,
  websitePages,
  websiteTheme,
} from '@/features/website/models/website-schema';
import { tenants } from '@/models/Schema';

export const FIXED_PAGE_TYPES = ['home', 'about', 'gallery', 'faq', 'contact', 'services'] as const;
export type WebsitePageType = (typeof FIXED_PAGE_TYPES)[number];

// ---------------------------------------------------------------------------
// Theme / site identity
// ---------------------------------------------------------------------------

export type ThemeInput = {
  enabled?: boolean;
  siteTitle?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  workingHours?: string | null;
  footerAboutText?: string | null;
  copyrightText?: string | null;
  socialFacebook?: string | null;
  socialTwitter?: string | null;
  socialYoutube?: string | null;
  socialLinkedin?: string | null;
  socialInstagram?: string | null;
  socialPinterest?: string | null;
  colorPrimary?: string;
  colorMenuBackground?: string;
  colorButtonHover?: string;
  colorText?: string;
  colorTextSecondary?: string;
  colorFooterBackground?: string;
  colorFooterText?: string;
  colorCopyrightBackground?: string;
  colorCopyrightText?: string;
  borderRadius?: number;
};

export async function getTheme(tenantId: string) {
  const [row] = await db.select().from(websiteTheme).where(eq(websiteTheme.tenantId, tenantId)).limit(1);
  return row ?? null;
}

export async function upsertTheme(tenantId: string, input: ThemeInput) {
  const [row] = await db
    .insert(websiteTheme)
    .values({ tenantId, ...input })
    .onConflictDoUpdate({
      target: websiteTheme.tenantId,
      set: { ...input, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Pages (fixed types)
// ---------------------------------------------------------------------------

export async function listPages(tenantId: string) {
  const rows = await db.select().from(websitePages).where(eq(websitePages.tenantId, tenantId));
  const byType = new Map(rows.map(r => [r.pageType, r]));
  return FIXED_PAGE_TYPES.map(pageType => byType.get(pageType) ?? {
    id: null,
    tenantId,
    pageType,
    title: '',
    content: {},
    published: true,
    createdAt: null,
    updatedAt: null,
  });
}

export async function getPage(tenantId: string, pageType: WebsitePageType) {
  const [row] = await db
    .select()
    .from(websitePages)
    .where(and(eq(websitePages.tenantId, tenantId), eq(websitePages.pageType, pageType)))
    .limit(1);
  return row ?? null;
}

export async function upsertPage(
  tenantId: string,
  pageType: WebsitePageType,
  input: { title?: string; content?: unknown; published?: boolean },
) {
  const [row] = await db
    .insert(websitePages)
    .values({ tenantId, pageType, ...input })
    .onConflictDoUpdate({
      target: [websitePages.tenantId, websitePages.pageType],
      set: { ...input, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

export async function listMenuItems(tenantId: string) {
  return db
    .select()
    .from(websiteMenuItems)
    .where(eq(websiteMenuItems.tenantId, tenantId))
    .orderBy(asc(websiteMenuItems.sortOrder), asc(websiteMenuItems.createdAt));
}

export async function createMenuItem(tenantId: string, input: { label: string; linkType: 'page' | 'external' | 'anchor'; linkValue: string; sortOrder?: number }) {
  const [row] = await db.insert(websiteMenuItems).values({ tenantId, ...input }).returning();
  return row;
}

async function assertMenuItemOwnedByTenant(tenantId: string, id: string) {
  const [row] = await db
    .select({ id: websiteMenuItems.id })
    .from(websiteMenuItems)
    .where(and(eq(websiteMenuItems.id, id), eq(websiteMenuItems.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Élément de menu introuvable.');
  }
}

export async function updateMenuItem(tenantId: string, id: string, input: { label?: string; linkType?: 'page' | 'external' | 'anchor'; linkValue?: string; sortOrder?: number }) {
  await assertMenuItemOwnedByTenant(tenantId, id);
  const [row] = await db
    .update(websiteMenuItems)
    .set({ ...input, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(websiteMenuItems.id, id), eq(websiteMenuItems.tenantId, tenantId)))
    .returning();
  return row;
}

export async function deleteMenuItem(tenantId: string, id: string) {
  await assertMenuItemOwnedByTenant(tenantId, id);
  await db.delete(websiteMenuItems).where(and(eq(websiteMenuItems.id, id), eq(websiteMenuItems.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export type NewsInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  body?: string | null;
  status?: 'draft' | 'published';
  publishedAt?: string | null;
};

export async function listNews(tenantId: string, opts: { limit: number; offset: number }) {
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(websiteNews)
      .where(eq(websiteNews.tenantId, tenantId))
      .orderBy(desc(websiteNews.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(websiteNews)
      .where(eq(websiteNews.tenantId, tenantId)),
  ]);
  return { rows, total: countRows[0]?.count ?? 0 };
}

export async function getNewsById(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(websiteNews)
    .where(and(eq(websiteNews.id, id), eq(websiteNews.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function createNews(tenantId: string, input: NewsInput) {
  const [row] = await db.insert(websiteNews).values({ tenantId, ...input }).returning();
  return row;
}

export async function updateNews(tenantId: string, id: string, input: Partial<NewsInput>) {
  const [row] = await db
    .update(websiteNews)
    .set({ ...input, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(websiteNews.id, id), eq(websiteNews.tenantId, tenantId)))
    .returning();
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Actualité introuvable.');
  }
  return row;
}

export async function deleteNews(tenantId: string, id: string) {
  const result = await db
    .delete(websiteNews)
    .where(and(eq(websiteNews.id, id), eq(websiteNews.tenantId, tenantId)))
    .returning({ id: websiteNews.id });
  if (result.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Actualité introuvable.');
  }
}

// ---------------------------------------------------------------------------
// Public (unauthenticated) reads - strictly scoped by resolved tenantId,
// visibility filters applied server-side (published only, publishedAt<=now).
// ---------------------------------------------------------------------------

export async function resolveTenantBySlug(slug: string) {
  const [row] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, logoUrl: tenants.logoUrl, faviconUrl: tenants.faviconUrl, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!row || !row.isActive) {
    return null;
  }
  return row;
}

export async function getPublicTheme(tenantId: string) {
  const theme = await getTheme(tenantId);
  if (!theme || !theme.enabled) {
    return null;
  }
  return theme;
}

export async function getPublicMenuItems(tenantId: string) {
  return listMenuItems(tenantId);
}

export async function getPublicPage(tenantId: string, pageType: WebsitePageType) {
  const row = await getPage(tenantId, pageType);
  if (!row || !row.published) {
    return null;
  }
  return row;
}

export async function listPublicNews(tenantId: string, opts: { limit: number; offset: number }) {
  const now = new Date().toISOString();
  const visibility = and(
    eq(websiteNews.tenantId, tenantId),
    eq(websiteNews.status, 'published'),
    or(isNull(websiteNews.publishedAt), lte(websiteNews.publishedAt, now)),
  );
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(websiteNews)
      .where(visibility)
      .orderBy(desc(sql`coalesce(${websiteNews.publishedAt}, ${websiteNews.createdAt})`))
      .limit(opts.limit)
      .offset(opts.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(websiteNews).where(visibility),
  ]);
  return { rows, total: countRows[0]?.count ?? 0 };
}

export async function getPublicNewsBySlug(tenantId: string, slug: string) {
  const now = new Date().toISOString();
  const [row] = await db
    .select()
    .from(websiteNews)
    .where(and(
      eq(websiteNews.tenantId, tenantId),
      eq(websiteNews.slug, slug),
      eq(websiteNews.status, 'published'),
      or(isNull(websiteNews.publishedAt), lte(websiteNews.publishedAt, now)),
    ))
    .limit(1);
  return row ?? null;
}
