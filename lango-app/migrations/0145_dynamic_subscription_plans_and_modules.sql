-- Migration: 0145_dynamic_subscription_plans_and_modules.sql
-- Converts plan_tier to varchar(50) for dynamic plan creation and adds full commercial & module configuration fields

-- 1. Alter existing tables to varchar(50)
ALTER TABLE "plan_limits" ALTER COLUMN "plan_tier" TYPE varchar(50) USING "plan_tier"::varchar(50);
ALTER TABLE "tenants" ALTER COLUMN "plan_tier" TYPE varchar(50) USING "plan_tier"::varchar(50);
ALTER TABLE "license_payments" ALTER COLUMN "plan_tier" TYPE varchar(50) USING "plan_tier"::varchar(50);

-- 2. Add full subscription plan attributes to plan_limits
ALTER TABLE "plan_limits"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "price_monthly" numeric(10, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "price_yearly" numeric(10, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "currency" varchar(10) DEFAULT 'MAD' NOT NULL,
  ADD COLUMN IF NOT EXISTS "trial_days" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_trial" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "max_branches" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "included_addons" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS "features" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_popular" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;

-- 3. Seed default commercial & module values for existing standard tiers
UPDATE "plan_limits"
SET
  "description" = 'Formule d''essai gratuit complète pour tester SchoolOS sans engagement.',
  "price_monthly" = 0,
  "price_yearly" = 0,
  "trial_days" = 14,
  "is_trial" = true,
  "max_branches" = 1,
  "included_addons" = ARRAY['transport', 'library', 'human-resources', 'advanced-reporting', 'card-management', 'certificate-management', 'lead-crm'],
  "features" = ARRAY['Jusqu''à 50 élèves', '512 Mo de stockage', 'Accès aux modules pédagogiques', 'Support communautaire'],
  "sort_order" = 0
WHERE "plan_tier" = 'trial';

UPDATE "plan_limits"
SET
  "description" = 'Idéal pour les petits établissements scolaires et centres éducatifs.',
  "price_monthly" = 490,
  "price_yearly" = 4900,
  "trial_days" = 0,
  "is_trial" = false,
  "max_branches" = 1,
  "included_addons" = ARRAY['transport', 'library', 'human-resources', 'card-management', 'certificate-management', 'event-management'],
  "features" = ARRAY['Jusqu''à 200 élèves', '2 Go de stockage', 'Gestion administrative & scolaire', 'Support par email'],
  "sort_order" = 1
WHERE "plan_tier" = 'basic';

UPDATE "plan_limits"
SET
  "description" = 'La formule la plus populaire pour les écoles privées en pleine croissance.',
  "price_monthly" = 990,
  "price_yearly" = 9900,
  "trial_days" = 0,
  "is_trial" = false,
  "is_popular" = true,
  "max_branches" = 2,
  "included_addons" = ARRAY['transport', 'library', 'hostel', 'human-resources', 'payroll-workforce', 'advanced-reporting', 'card-management', 'certificate-management', 'event-management', 'inventory', 'lead-crm'],
  "features" = ARRAY['Jusqu''à 1000 élèves', '10 Go de stockage', 'Paie & RH conformes Maroc', 'Support prioritaire 6j/7'],
  "sort_order" = 2
WHERE "plan_tier" = 'standard';

UPDATE "plan_limits"
SET
  "description" = 'Puissance illimitée et suite complète pour grands groupes scolaires et campus.',
  "price_monthly" = 1990,
  "price_yearly" = 19900,
  "trial_days" = 0,
  "is_trial" = false,
  "max_branches" = 10,
  "included_addons" = ARRAY['transport', 'library', 'hostel', 'human-resources', 'payroll-workforce', 'advanced-reporting', 'card-management', 'certificate-management', 'event-management', 'inventory', 'lead-crm', 'live-classrooms'],
  "features" = ARRAY['Élèves illimités', 'Stockage illimité', 'Multi-campus inclus', 'Tous les modules inclus', 'Gestionnaire de compte dédié'],
  "sort_order" = 3
WHERE "plan_tier" = 'premium';
