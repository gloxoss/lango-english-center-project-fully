-- 0115_school_website_cms.sql — school-website-cms addon (plan #32).
-- Per-tenant public marketing website: theme/site-identity, fixed page
-- types, a flat ordered menu, and a minimal news/blog table. Hand-written,
-- forward-only, idempotent. Never regenerate with drizzle-kit generate.
-- See future-implementation/school-website-cms/SCHOOL-WEBSITE-CMS.md.

--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."website_page_type" AS ENUM('home', 'about', 'gallery', 'faq', 'contact', 'services');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."website_news_status" AS ENUM('draft', 'published');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."website_menu_link_type" AS ENUM('page', 'external', 'anchor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_theme" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"site_title" text DEFAULT '' NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"working_hours" text,
	"footer_about_text" text,
	"copyright_text" text,
	"social_facebook" text,
	"social_twitter" text,
	"social_youtube" text,
	"social_linkedin" text,
	"social_instagram" text,
	"social_pinterest" text,
	"color_primary" text DEFAULT '#2487B8' NOT NULL,
	"color_menu_background" text DEFAULT '#16212B' NOT NULL,
	"color_button_hover" text DEFAULT '#1B6C93' NOT NULL,
	"color_text" text DEFAULT '#16212B' NOT NULL,
	"color_text_secondary" text DEFAULT '#64748B' NOT NULL,
	"color_footer_background" text DEFAULT '#16212B' NOT NULL,
	"color_footer_text" text DEFAULT '#FFFFFF' NOT NULL,
	"color_copyright_background" text DEFAULT '#0F172A' NOT NULL,
	"color_copyright_text" text DEFAULT '#94A3B8' NOT NULL,
	"border_radius" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "website_theme_tenant_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"page_type" "website_page_type" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "website_pages_tenant_type_unique" UNIQUE("tenant_id","page_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"label" text NOT NULL,
	"link_type" "website_menu_link_type" DEFAULT 'page' NOT NULL,
	"link_value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"cover_image_url" text,
	"body" text,
	"status" "website_news_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "website_news_tenant_slug_unique" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_menu_items_tenant_idx" ON "website_menu_items" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_news_tenant_idx" ON "website_news" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_news_tenant_status_idx" ON "website_news" ("tenant_id", "status");
