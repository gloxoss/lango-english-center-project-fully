-- 0070: Align issued_certificates with the Drizzle schema.
-- The Drizzle schema (certificates-schema.ts) declares file_ext varchar(10) NOT NULL
-- and uses hash-only verification (no raw token column). Migration 0065 created the
-- table with the opposite shape: verification_token NOT NULL and no file_ext.
-- The app stores only verification_token_hash and inserts fileExt: 'pdf'.

ALTER TABLE "issued_certificates" ADD COLUMN IF NOT EXISTS "file_ext" varchar(10) NOT NULL DEFAULT 'pdf';

ALTER TABLE "issued_certificates" DROP COLUMN IF EXISTS "verification_token";
