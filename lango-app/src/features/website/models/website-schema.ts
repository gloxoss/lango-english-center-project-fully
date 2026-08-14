import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

// Per-school public marketing website CMS. See
// future-implementation/school-website-cms/SCHOOL-WEBSITE-CMS.md - fixed
// page types (not a generic block/page builder), a small ~10-field theme
// table, a flat ordered menu, and a minimal news/blog table.
//
// Tenant resolution for the public site reuses `tenants.slug` (already
// unique platform-wide) and `tenants.logoUrl` / `tenants.faviconUrl`
// (already exist) rather than duplicating them here.

export const websitePageType = pgEnum('website_page_type', [
  'home',
  'about',
  'gallery',
  'faq',
  'contact',
  'services',
]);

export const websiteNewsStatus = pgEnum('website_news_status', ['draft', 'published']);

export const websiteMenuLinkType = pgEnum('website_menu_link_type', ['page', 'external', 'anchor']);

// One row per tenant: site enable/disable, contact/footer content, and the
// ~10 discrete theme color fields from the reference product's Website
// Settings screen. Discrete columns (not a JSON blob) so each is easy to
// validate as a hex color at the API layer.
export const websiteTheme = pgTable('website_theme', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  siteTitle: text('site_title').notNull().default(''),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  workingHours: text('working_hours'),
  footerAboutText: text('footer_about_text'),
  copyrightText: text('copyright_text'),
  socialFacebook: text('social_facebook'),
  socialTwitter: text('social_twitter'),
  socialYoutube: text('social_youtube'),
  socialLinkedin: text('social_linkedin'),
  socialInstagram: text('social_instagram'),
  socialPinterest: text('social_pinterest'),
  colorPrimary: text('color_primary').notNull().default('#2487B8'),
  colorMenuBackground: text('color_menu_background').notNull().default('#16212B'),
  colorButtonHover: text('color_button_hover').notNull().default('#1B6C93'),
  colorText: text('color_text').notNull().default('#16212B'),
  colorTextSecondary: text('color_text_secondary').notNull().default('#64748B'),
  colorFooterBackground: text('color_footer_background').notNull().default('#16212B'),
  colorFooterText: text('color_footer_text').notNull().default('#FFFFFF'),
  colorCopyrightBackground: text('color_copyright_background').notNull().default('#0F172A'),
  colorCopyrightText: text('color_copyright_text').notNull().default('#94A3B8'),
  borderRadius: integer('border_radius').notNull().default(8),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, table => [
  unique('website_theme_tenant_unique').on(table.tenantId),
]);

// One row per tenant per fixed page type. `content` shape is documented
// (not enforced in the DB) per pageType and validated per-type by the Zod
// schema in the admin API route - see
// src/libs/api/validation.ts websitePageContentSchemas comment block:
//   home:     { heroTitle, heroSubtitle, heroImageUrl, slides[], features[], testimonials[] }
//   about:    { body, missionText, historyText }
//   gallery:  { categories[{name}], items[{imageUrl, caption, category}] }
//   faq:      { items[{question, answer}] }
//   contact:  { intro, mapEmbedUrl } (address/phone/email come from websiteTheme)
//   services: { items[{title, description, imageUrl, priceLabel}] }
export const websitePages = pgTable('website_pages', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  pageType: websitePageType('page_type').notNull(),
  title: text('title').notNull().default(''),
  content: jsonb('content').notNull().default({}),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, table => [
  unique('website_pages_tenant_type_unique').on(table.tenantId, table.pageType),
]);

// Flat, ordered nav list - deliberately not nested (see plan doc: "keep this
// genuinely simple - a flat list, not nested dropdown menus").
export const websiteMenuItems = pgTable('website_menu_items', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  label: text('label').notNull(),
  linkType: websiteMenuLinkType('link_type').notNull().default('page'),
  // linkType='page' -> a websitePageType value or 'news'; 'external' -> full URL; 'anchor' -> '#id'
  linkValue: text('link_value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, table => [
  index('website_menu_items_tenant_idx').on(table.tenantId),
]);

// Minimal blog/news list+detail. publishedAt can be future-dated - visibility
// is checked on read (status='published' AND publishedAt <= now()), no cron.
export const websiteNews = pgTable('website_news', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  excerpt: text('excerpt'),
  coverImageUrl: text('cover_image_url'),
  body: text('body'),
  status: websiteNewsStatus('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, table => [
  unique('website_news_tenant_slug_unique').on(table.tenantId, table.slug),
  index('website_news_tenant_idx').on(table.tenantId),
  index('website_news_tenant_status_idx').on(table.tenantId, table.status),
]);
