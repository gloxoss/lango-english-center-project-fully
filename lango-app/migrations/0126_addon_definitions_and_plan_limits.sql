-- 0126_addon_definitions_and_plan_limits.sql — §22.6 + §1.3: the addon catalog
-- becomes DB-driven (addon_definitions) and tenants.planTier gains real limits
-- (plan_limits). Hand-written. Idempotent (CREATE ... IF NOT EXISTS + ON CONFLICT
-- DO NOTHING) so re-running against an already-migrated DB is a no-op.
--
-- The catalog is seeded from src/addons/registry.ts so the DB and code fallback
-- stay in sync until a super-admin edits a row through the new UI.

CREATE TABLE IF NOT EXISTS "addon_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"requires" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "plan_limits" (
	"plan_tier" "plan_tier" PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL,
	"max_students" integer,
	"max_storage_mb" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Seed the addon catalog (mirrors src/addons/registry.ts).
INSERT INTO "addon_definitions" ("id", "name", "description", "enabled", "requires", "sort_order") VALUES
	('multi-branch', 'Multi-Succursales', 'Plusieurs succursales/campus par établissement.', true, '{}', 0),
	('whatsapp', 'WhatsApp Communication', 'Boîte de réception et campagnes WhatsApp.', false, '{}', 1),
	('hostel', 'Gestion de l''internat', 'Résidences, chambres/lits, allocations, appels, congés et incidents.', true, '{}', 2),
	('transport', 'Gestion du transport', 'Lignes/arrêts, véhicules/équipage, allocations, trajets et suivi GPS.', true, '{}', 3),
	('library', 'Gestion de la bibliothèque', 'Catalogue, exemplaires, circulation, réservations et rapports.', true, '{}', 4),
	('event-management', 'Gestion des événements', 'Types d''événements, cycle de vie, lieux, RSVP et calendrier.', true, '{}', 5),
	('inventory', 'Gestion des stocks', 'Catalogue produits, fournisseurs, achats, ventes et prêts.', true, '{}', 6),
	('human-resources', 'Ressources humaines', 'Départements, postes, profils employés et cycle de vie.', true, '{}', 7),
	('payroll-workforce', 'Paie & main-d''œuvre', 'Structures de paie, bulletins, congés et avances. Nécessite Ressources humaines.', true, '{human-resources}', 8),
	('card-management', 'Gestion des cartes', 'Cartes étudiant/employé, cartes d''examen et vérification QR.', true, '{}', 9),
	('certificate-management', 'Émission de certificats', 'Définitions, modèles, workflows d''approbation et vérification QR.', true, '{}', 10),
	('live-classrooms', 'Classes virtuelles', 'Planification de classes virtuelles, jointures sécurisées et rapports.', true, '{}', 11),
	('attachments-book', 'Cahier de pièces jointes', 'Bibliothèque de ressources académiques, versions et quotas.', true, '{}', 12),
	('online-examinations', 'Examens en ligne', 'Banques de questions, formulaires et correction en ligne.', false, '{}', 13),
	('lead-crm', 'CRM des leads', 'Pipeline des prospects d''inscription (kanban, profil, capture).', true, '{}', 14),
	('broadcast-messaging', 'Messagerie de diffusion', 'Campagnes SMS/email/WhatsApp, segments et rapports de livraison.', true, '{}', 15),
	('advanced-reporting', 'Rapports avancés', 'Catalogue de rapports, exports planifiés et instantanés.', true, '{}', 16),
	('school-website-cms', 'Site Web École', 'Site public par établissement (pages, menu, actualités).', true, '{}', 17)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- Seed plan-tier capacity caps (null = unlimited).
INSERT INTO "plan_limits" ("plan_tier", "label", "max_students", "max_storage_mb") VALUES
	('trial', 'Essai', 50, 512),
	('basic', 'Basique', 200, 2048),
	('standard', 'Standard', 1000, 10240),
	('premium', 'Premium', NULL, NULL)
ON CONFLICT ("plan_tier") DO NOTHING;
