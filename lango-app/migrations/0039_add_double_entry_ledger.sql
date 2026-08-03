DO $$ BEGIN
 CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 CREATE TYPE "public"."fiscal_period_status" AS ENUM('open', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 CREATE TYPE "public"."journal_status" AS ENUM('posted', 'reversed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"parent_account_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chart_of_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "chart_of_accounts_tenant_code_unique" UNIQUE("tenant_id", "code")
);

CREATE TABLE IF NOT EXISTS "fiscal_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "fiscal_period_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"closed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "fiscal_periods_tenant_name_unique" UNIQUE("tenant_id", "name")
);

CREATE TABLE IF NOT EXISTS "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"source_module" varchar(50) DEFAULT 'finance' NOT NULL,
	"source_id" uuid,
	"posted_by_id" text,
	"status" "journal_status" DEFAULT 'posted' NOT NULL,
	"reversed_by_entry_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE restrict,
	CONSTRAINT "journal_entries_reversed_by_entry_id_fk" FOREIGN KEY ("reversed_by_entry_id") REFERENCES "journal_entries"("id") ON DELETE restrict,
	CONSTRAINT "journal_entries_tenant_number_unique" UNIQUE("tenant_id", "entry_number")
);

CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"memo" text,
	CONSTRAINT "journal_line_one_side_positive" CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)),
	CONSTRAINT "journal_entry_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE restrict,
	CONSTRAINT "journal_entry_lines_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE restrict,
	CONSTRAINT "journal_entry_lines_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE restrict
);

CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_name" varchar(150) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"currency" varchar(10) DEFAULT 'MAD' NOT NULL,
	"current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "bank_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"statement_date" date NOT NULL,
	"statement_balance" numeric(12, 2) NOT NULL,
	"reconciled_balance" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"reconciled_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_reconciliations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "bank_reconciliations_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "chart_of_accounts_tenant_type_idx" ON "chart_of_accounts" ("tenant_id", "account_type");
CREATE INDEX IF NOT EXISTS "fiscal_periods_tenant_dates_idx" ON "fiscal_periods" ("tenant_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "journal_entries_tenant_date_idx" ON "journal_entries" ("tenant_id", "entry_date");
CREATE INDEX IF NOT EXISTS "journal_entry_lines_journal_idx" ON "journal_entry_lines" ("journal_entry_id");
CREATE INDEX IF NOT EXISTS "bank_accounts_tenant_idx" ON "bank_accounts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "bank_reconciliations_tenant_bank_idx" ON "bank_reconciliations" ("tenant_id", "bank_account_id");

ALTER TABLE fiscal_periods ADD CONSTRAINT fiscal_periods_date_check CHECK (end_date >= start_date);
ALTER TABLE bank_reconciliations ADD CONSTRAINT bank_reconciliation_status_check CHECK (status IN ('draft', 'completed'));

-- PostgreSQL, not the HTTP route, is the final authority for tenant scope,
-- open periods, active accounts, exact balance, and posted-ledger immutability.
CREATE OR REPLACE FUNCTION enforce_journal_header_integrity()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM fiscal_periods fp
    WHERE fp.tenant_id = NEW.tenant_id AND fp.status = 'open'
      AND NEW.entry_date BETWEEN fp.start_date AND fp.end_date
  ) THEN
    RAISE EXCEPTION 'journal date is not in an open fiscal period' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_header_integrity_trigger
BEFORE INSERT ON journal_entries
FOR EACH ROW EXECUTE FUNCTION enforce_journal_header_integrity();

CREATE OR REPLACE FUNCTION enforce_journal_line_scope()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = NEW.journal_entry_id AND je.tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'journal line references an entry outside its tenant' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts coa WHERE coa.id = NEW.account_id AND coa.tenant_id = NEW.tenant_id AND coa.is_active) THEN
    RAISE EXCEPTION 'journal line references an inactive or cross-tenant account' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_line_scope_trigger
BEFORE INSERT OR UPDATE ON journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION enforce_journal_line_scope();

CREATE OR REPLACE FUNCTION verify_balanced_journal()
RETURNS trigger AS $$
DECLARE target_id uuid; line_count integer; debits numeric(14,2); credits numeric(14,2);
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    target_id := COALESCE(NEW.id, OLD.id);
  ELSE
    target_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  END IF;
  SELECT COUNT(*), COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
    INTO line_count, debits, credits FROM journal_entry_lines WHERE journal_entry_id = target_id;
  IF line_count < 2 OR debits <> credits THEN
    RAISE EXCEPTION 'posted journal must contain at least two balanced lines' USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_header_balance_trigger
AFTER INSERT OR UPDATE ON journal_entries DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_balanced_journal();
CREATE CONSTRAINT TRIGGER journal_lines_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_balanced_journal();

CREATE OR REPLACE FUNCTION prevent_posted_journal_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted journals are immutable; create a reversal entry' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_journal_entry_delete
BEFORE UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_mutation();
CREATE TRIGGER prevent_journal_line_mutation
BEFORE UPDATE OR DELETE ON journal_entry_lines FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_mutation();
