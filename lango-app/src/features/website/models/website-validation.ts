import { z } from 'zod';

// Per-page-type content shapes. Deliberately fixed/typed (not a generic
// "blocks" JSON blob) - see future-implementation/school-website-cms/
// SCHOOL-WEBSITE-CMS.md "Scope warning" section.

const urlText = z.string().trim().max(2000);
const shortText = z.string().trim().max(255);
const longText = z.string().trim().max(5000);

const slideSchema = z.object({
  imageUrl: urlText,
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
  heroImageUrl: urlText.optional(),
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
  imageUrl: urlText,
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
  mapEmbedUrl: urlText.optional(),
}).strict();

const serviceItemSchema = z.object({
  title: shortText,
  description: z.string().trim().max(2000),
  imageUrl: urlText.optional(),
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
