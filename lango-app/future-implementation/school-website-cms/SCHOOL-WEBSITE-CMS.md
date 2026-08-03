# Per-School Website CMS — Future Feature

**Status: not started, deliberately deferred.** The biggest of the four
future-implementation items so far in terms of new surface area. Read
`AGENT-HANDOFF.md` first, and `future-implementation/custom-domain/` —
this feature and custom domains are natural partners (a school's public
site is what would actually live at their branded domain).

## What the reference screenshots show

Two RamomSchool views, shared 2026-08-01 (not saved to this repo — inline
in the conversation that produced this doc): a **"Frontend" module** in
the sidebar with sub-items Setting, Menu, Page Section, Manage Page,
Slider, Features, Testimonial, Service, Faq, Gallery Category, Gallery,
News — and its main **"Website Settings"** page, a large form covering:

- Site identity: CMS Title, URL Alias, Enable/Disable toggle, Online
  Admission toggle, logo + favicon upload
- Contact/footer content: address, phone, email, fax, working hours,
  footer about text, copyright text, social media links (Facebook,
  Twitter, YouTube, LinkedIn, Pinterest, Instagram)
- **Theme customization** — live color pickers for Primary Color, Menu
  Background, Button Hover, Text Color, Text Secondary, Footer BG/Text,
  Copyright BG/Text, plus a Border Radius value
- Misc: Google Analytics ID, captcha toggle, receive-email-to address

The sidebar sub-items imply a genuinely structured CMS behind this: each
school can manage their own pages, navigation menu, homepage slider,
feature blocks, testimonials, service listings, an FAQ, a photo gallery
(with categories), and a news/blog feed — all without a developer.

## Two related but distinct scopes (the user asked for both)

1. **A public marketing/content website per school**, editable by that
   school's own admin — this is what the screenshots show.
2. **The same underlying engine powering SchoolOS's own marketing site**
   (currently `src/app/[locale]/(marketing)/`, confirmed 100% static —
   `marketing-content.ts` and `marketing-home-view.tsx` both have zero
   `fetch()` calls). Building one real CMS engine and using it for both
   avoids building two separate systems.

## Why this matters for the business

Same underlying goal as `subscription-licensing/` and `custom-domain/`:
once SchoolOS is sold to independent schools, each one wants their own
public identity, not just an internal admin tool. A school's own website
— their story, their programs, their news, a way for prospective parents
to find them — is a real value-add on top of "we manage attendance and
grades for you." Paired with a custom domain, this is what turns SchoolOS
from "a backend tool" into "your school's whole digital presence."

## The real starting point (verified, not assumed)

- `tenants.logoUrl` already exists in schema (confirmed unused elsewhere)
  — directly reusable for per-school branding rather than adding a
  duplicate field.
- No theme-color fields exist anywhere in the schema — this part is
  fully new.
- SchoolOS's own marketing site already lives at a real route group
  (`src/app/[locale]/(marketing)/`) with real components
  (`hero-section.tsx`, `pricing-section.tsx`, `testimonials-section.tsx`,
  etc.) — these are a genuinely good starting shape to generalize *into* a
  CMS rather than throwing away and rebuilding from scratch.
- No per-tenant public route group exists yet — every current route is
  either `(dashboard)` (authenticated) or `(marketing)` (SchoolOS's own
  static site). A per-school public site is a new route shape entirely.

## Scope warning — the single biggest design decision here

**Do not build a generic drag-and-drop page builder.** That's a huge,
open-ended engineering commitment (arbitrary block types, a visual editor,
undo/redo, versioning) that most schools will never fully use, and it's
the kind of scope that never actually finishes. The reference product's
own sidebar structure already suggests the better-scoped alternative:

**A fixed set of page *types* with editable fields/sections per type** —
Home (hero text, slider images, feature blocks, testimonial list),
About, Admissions info, News (list + detail, basically a simple blog),
Gallery (categorized photo albums), FAQ, Contact — each with a real,
bounded schema (not a generic "blocks" JSON blob), edited through normal
forms like every other admin page in this app already does. This covers
the large majority of real value at a small fraction of the engineering
cost, and matches this app's own established pattern (`model → data → ui
→ api`, plain typed forms) instead of introducing a whole new
page-builder paradigm the rest of the codebase doesn't share.

## Rough scope if this is picked up

1. New tables: `schoolWebsitePages` (or one table per page type, cleaner
   given the "fixed types" decision above — e.g. `websiteNews`,
   `websiteTestimonials`, `websiteGalleryItems`, `websiteFaqs`,
   `websiteMenuItems`), plus theme fields (either new columns on
   `schoolSettings` or a small `websiteTheme` table: tenantId + the ~10
   color fields the screenshot shows + borderRadius).
2. New **public, unauthenticated** route group,
   `src/app/[locale]/(school-site)/[tenantSlug]/...` (or resolved by
   custom domain once that feature exists) — a real architectural
   addition, not a page under `(dashboard)`. Needs its own tenant
   resolution (by slug or domain, not by session, since visitors aren't
   logged in) and its own layout/theming applied from the tenant's stored
   colors.
3. Admin-facing editing UI under the school's own dashboard settings —
   standard CRUD forms per content type, reusing `src/libs/api/uploads.ts`
   for logo/gallery/slider image uploads (same tenant-namespaced pattern
   as everywhere else in this app).
4. Generalize SchoolOS's own `(marketing)` site to optionally read from
   the same content tables (for a "SchoolOS's own site is tenant zero"
   approach) — only worth doing once the per-school version is proven out,
   not on day one.

## Page-by-page business logic (implementation-ready detail)

Per the "fixed page types, not a generic builder" decision above, these
are the actual pages to build — a curated, bounded set rather than a
literal copy of the reference product's 12-item sidebar.

### 1. Website Settings (site identity + theme)

- Site title, URL alias/slug (must be unique platform-wide, this is what
  resolves the public site before `custom-domain/` exists — e.g.
  `yourdomain.com/sites/{slug}`), enable/disable toggle (a disabled site
  shows a simple "coming soon" or 404, not a broken half-page), logo +
  favicon upload (reuse `src/libs/api/uploads.ts`, and reuse
  `tenants.logoUrl` rather than duplicating it in a new table).
- Contact/footer block: address, phone, email, working hours, footer
  about text, copyright text, social links.
- **Theme colors**: primary, menu background, button hover, text
  (primary/secondary), footer background/text, copyright bar
  background/text, border radius. Store as one JSON column or ~10
  discrete columns on a new `websiteTheme` table (tenantId +
  these fields) — discrete columns are more honest about what's actually
  configurable and easier to validate (hex-color format) than a loose
  JSON blob.
- **Business logic**: live preview while editing (color pickers should
  update a preview pane, not require a full save-and-reload cycle to see
  the effect) — this is the one place in this feature where the editing
  UX genuinely matters more than most admin forms elsewhere in this app.

### 2. Menu Builder

- Ordered list of nav items, each: label, link target (a page on the
  school's own site, an external URL, or an anchor), sort order.
- **Business logic**: drag-to-reorder (or simple up/down buttons if
  drag-and-drop feels like scope creep) updates a `sortOrder` integer;
  the public site renders strictly in that order. Keep this genuinely
  simple — a flat list, not nested dropdown menus, unless a real need for
  sub-menus shows up later.

### 3. Homepage Content (consolidates the reference product's separate
Slider / Features / Testimonial pages into one page with sections, since
they're all "homepage blocks" conceptually)

- **Hero/slider**: ordered list of slide images + headline/subtext per
  slide (new `websiteSliderItems` table).
- **Feature blocks**: icon + title + description, ordered
  (`websiteFeatures`).
- **Testimonials**: quote + author name + role/relation (parent, alum,
  etc.), ordered (`websiteTestimonials`).
- **Business logic**: each block type has a fixed shape (not a generic
  "content block" system) — this is the direct application of the
  "fixed types over a generic builder" decision at the field level, not
  just the page level.

### 4. Services

- List of programs/services offered (e.g. "English B1 Course",
  "After-school tutoring"), each: title, description, optional image,
  optional price-display text (not a real billing integration — just
  marketing copy like "Starting at 800 MAD/month").
- **Business logic**: purely informational/marketing content, no
  connection to the real `feeStructures`/`invoices` schema — don't let
  this drift into "actually configures real pricing," that's a different,
  much bigger integration this feature shouldn't attempt.

### 5. FAQ

- Question/answer pairs, ordered. The simplest page in the set —
  standard list + add/edit/delete, no special business logic beyond
  ordering.

### 6. Gallery (+ Category)

- Categories: flat named list (matches the Inventory module's Category
  pattern — reuse that exact UI shape rather than inventing a new one).
- Gallery items: image + optional caption + category, uploaded via the
  same tenant-namespaced upload pattern as everything else in this app.

### 7. News (list + detail — effectively a minimal blog)

- List page: title, excerpt, publish date, cover image, published/draft
  status.
- Detail page: full body content (rich text or structured
  paragraph/image blocks — recommend a simple rich-text field over a
  custom block editor, keeping with the "don't build a generic builder"
  principle) plus the same list-page metadata.
- **Business logic**: `published` vs `draft` status — drafts visible only
  in the admin preview, not on the real public site. Publish date can be
  future-dated (schedule a post to go live later) — check on read
  (`publishedAt <= now()`), don't require a cron job to "activate" it.

## Addon or plan-tier gate?

Same reasoning as `custom-domain/`: this is branding/presence polish, not
core school-operations functionality — reasonable to gate by plan tier
once `subscription-licensing/` gating exists, likely bundled with custom
domain as one "professional presence" tier rather than sold completely
separately.

## Sequencing note

Natural build order across the four future-implementation docs so far:
`subscription-licensing/` (plan-tier gating exists) → `custom-domain/`
(a school gets a real address) → `school-website-cms/` (something real
lives at that address). Building this before the other two would mean
building a public site with nowhere distinctive to put it.
