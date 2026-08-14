-- ============================================================
-- Migration 0044: PF-03 Organisation & Identité schema
-- ============================================================
-- Extends school_settings with 14 new columns for the
-- Organisation & Identité settings page.
-- Adds favicon_url to tenants.
-- Does NOT touch session_years (academic year tracking).
-- ============================================================

-- tenants: add favicon storage column
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- school_settings: add new identity + contact + locale columns
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS short_name               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS website                  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS country                  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rc                       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tax_id                   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS director_email           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS director_phone           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS financial_contact_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS financial_contact_email  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS financial_contact_phone  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS admissions_contact_name  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admissions_contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admissions_contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS locale_timezone          VARCHAR(100) DEFAULT 'Africa/Casablanca',
  ADD COLUMN IF NOT EXISTS date_format              VARCHAR(50)  DEFAULT 'dd/mm/yyyy',
  ADD COLUMN IF NOT EXISTS document_header_style    VARCHAR(50)  DEFAULT 'classique';
