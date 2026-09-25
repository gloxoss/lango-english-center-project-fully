import { z } from 'zod';

// Per-page-type content shapes. Deliberately fixed/typed (not a generic
// "blocks" JSON blob) - see future-implementation/school-website-cms/
// SCHOOL-WEBSITE-CMS.md "Scope warning" section.
//
// URL policy (website-owned content is rendered on an unauthenticated public
// site): external links, social profiles and the map embed are HTTPS-only,
// following the project's established external-link rule (see
// features/live-classrooms/providers/external-link-provider.ts: "must be
// HTTPS-only (reject javascript:/data:/file:/http:)"). Image URLs additionally
// accept same-origin relative paths because that is what the CMS uploader
// returns (/api/public/website/<slug>/images/<file>).

/** Absolute https:// URL. */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Absolute https URL or a same-origin path starting with a single '/'. */
export function isSafeContentUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) {
    return true;
  }
  return isHttpsUrl(value);
}

const urlText = z.string().trim().max(2000);
// Empty string clears the field (the admin forms submit every key).
const httpsUrlText = urlText.refine(v => !v || isHttpsUrl(v), 'URL HTTPS requise (https://…)');
const contentUrlText = urlText.refine(v => !v || isSafeContentUrl(v), 'URL d\'image invalide (chemin interne ou https:// requis)');
const shortText = z.string().trim().max(255);
const longText = z.string().trim().max(5000);

const slideSchema = z.object({
  imageUrl: contentUrlText,
  headline: shortText,
  subtext: z.string().trim().max(1000).optional(),
}).strict();

const featureSchema = z.object({
  icon: z.string().trim().max(100),
  title: shortText,
  description: z.string().trim().max(1000),
}).strict();

const testimonialSchema = z.object({
  quote: z.string().trim().max(2000),
  author: shortText,
  role: shortText.optional(),
}).strict();

export const homePageContentSchema = z.object({
  heroTitle: shortText.optional(),
  heroSubtitle: z.string().trim().max(1000).optional(),
  heroImageUrl: contentUrlText.optional(),
  slides: z.array(slideSchema).max(20).optional(),
  features: z.array(featureSchema).max(20).optional(),
  testimonials: z.array(testimonialSchema).max(20).optional(),
}).strict();

export const aboutPageContentSchema = z.object({
  body: longText.optional(),
  missionText: z.string().trim().max(2000).optional(),
  historyText: z.string().trim().max(2000).optional(),
}).strict();

const galleryItemSchema = z.object({
  imageUrl: contentUrlText,
  caption: shortText.optional(),
  category: shortText.optional(),
}).strict();

export const galleryPageContentSchema = z.object({
  categories: z.array(z.object({ name: shortText }).strict()).max(50).optional(),
  items: z.array(galleryItemSchema).max(200).optional(),
}).strict();

const faqItemSchema = z.object({
  question: shortText,
  answer: z.string().trim().max(3000),
}).strict();

export const faqPageContentSchema = z.object({
  items: z.array(faqItemSchema).max(100).optional(),
}).strict();

export const contactPageContentSchema = z.object({
  intro: z.string().trim().max(2000).optional(),
  mapEmbedUrl: httpsUrlText.optional(),
}).strict();

const serviceItemSchema = z.object({
  title: shortText,
  description: z.string().trim().max(2000),
  imageUrl: contentUrlText.optional(),
  priceLabel: shortText.optional(),
}).strict();

export const servicesPageContentSchema = z.object({
  items: z.array(serviceItemSchema).max(100).optional(),
}).strict();

export const websitePageContentSchemas = {
  home: homePageContentSchema,
  about: aboutPageContentSchema,
  gallery: galleryPageContentSchema,
  faq: faqPageContentSchema,
  contact: contactPageContentSchema,
  services: servicesPageContentSchema,
} as const;

export const websitePageUpdateSchema = z.object({
  title: z.string().trim().max(255).optional(),
  content: z.unknown().optional(),
  published: z.boolean().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Reusable URL field schemas for the non-page endpoints (theme, menu, news).
// ---------------------------------------------------------------------------

export const optionalHttpsUrl = httpsUrlText.optional().nullable();
export const optionalContentUrl = contentUrlText.optional().nullable();

// Menu links: 'page' must name a real public page, 'external' must be an
// absolute https URL, 'anchor' a fragment. Same rule at create and update so a
// later PUT cannot smuggle a javascript: URL past the create-time check.
export const MENU_LINK_PAGE_VALUES = ['home', 'about', 'gallery', 'faq', 'contact', 'services', 'news'] as const;

export function menuLinkError(linkType: 'page' | 'external' | 'anchor', linkValue: string): string | null {
  if (linkType === 'page') {
    return (MENU_LINK_PAGE_VALUES as readonly string[]).includes(linkValue)
      ? null
      : 'Page inconnue : choisissez une page du site.';
  }
  if (linkType === 'external') {
    return isHttpsUrl(linkValue) ? null : 'URL externe HTTPS requise (https://…).';
  }
  return /^#?[A-Za-z][\w:-]*$/.test(linkValue) ? null : 'Ancre invalide (ex. #section).';
}
