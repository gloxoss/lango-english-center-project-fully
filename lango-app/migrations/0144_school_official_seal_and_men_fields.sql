-- Migration: 0144_school_official_seal_and_men_fields.sql
-- Moroccan School Seal, Director Signature, and Ministry of National Education (MEN) compliance fields

ALTER TABLE "school_settings"
  ADD COLUMN IF NOT EXISTS "men_authorization_number" varchar(100),
  ADD COLUMN IF NOT EXISTS "regional_academy" varchar(255),
  ADD COLUMN IF NOT EXISTS "provincial_direction" varchar(255),
  ADD COLUMN IF NOT EXISTS "official_stamp_url" text,
  ADD COLUMN IF NOT EXISTS "director_signature_url" text;
