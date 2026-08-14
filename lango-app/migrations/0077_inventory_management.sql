-- Inventory Management add-on. Hand-written (never drizzle-kit generate).
-- Idempotent: safe to rerun. Creates enums, master data, document tables and
-- the append-only movement ledger + balance projection for the inventory
-- feature (src/features/inventory). Stock invariants:
--   * products have NO stock column (stock = SUM of ledger movements)
--   * inventory_stock_movements is append-only; reversals add compensating rows
--   * unique(tenant_id, idempotency_key) on movements makes double-posting
--     physically impossible (a retry hits 23505 and is downgraded)
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_movement_type" AS ENUM('receipt', 'sale', 'sale_reversal', 'issue', 'issue_return', 'adjustment_in', 'adjustment_out', 'transfer_out', 'transfer_in');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_purchase_status" AS ENUM('ordered', 'received', 'reversed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_sale_status" AS ENUM('completed', 'reversed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_sale_to_role" AS ENUM('student', 'staff', 'guest');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_issue_status" AS ENUM('issued', 'returned', 'overdue', 'lost', 'damaged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_adjustment_type" AS ENUM('count_correction', 'damage', 'loss', 'donation', 'write_off');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_transfer_status" AS ENUM('pending', 'completed', 'reversed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"abbreviation" varchar(20),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(50) NOT NULL,
	"branch_id" uuid,
	"mobile" varchar(50),
	"address" text,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"company_name" varchar(255),
	"address" text,
	"contact_name" varchar(120),
	"phone" varchar(50),
	"email" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(40) NOT NULL,
	"category_id" uuid,
	"purchase_unit_id" uuid,
	"sale_unit_id" uuid,
	"unit_ratio" numeric(14, 3) DEFAULT '1' NOT NULL,
	"purchase_price" numeric(14, 2),
	"sale_price" numeric(14, 2),
	"remarks" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_number" varchar(50) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"status" "inventory_purchase_status" DEFAULT 'ordered' NOT NULL,
	"order_date" date NOT NULL,
	"received_at" timestamp,
	"net_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"payment_method" "payment_method",
	"payment_reference" varchar(100),
	"expense_id" uuid,
	"recorded_by_id" text,
	"idempotency_key" varchar(160),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_purchase_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_in_purchase_unit" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_number" varchar(50) NOT NULL,
	"store_id" uuid NOT NULL,
	"sale_to_role" "inventory_sale_to_role" NOT NULL,
	"student_id" text,
	"customer_name" varchar(255),
	"sale_date" date NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"payment_method" "payment_method",
	"payment_reference" varchar(100),
	"status" "inventory_sale_status" DEFAULT 'completed' NOT NULL,
	"invoice_id" uuid,
	"recorded_by_id" text NOT NULL,
	"reversed_by_id" text,
	"reversed_at" timestamp,
	"reversal_reason" text,
	"idempotency_key" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"invoice_item_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"issue_number" varchar(50) NOT NULL,
	"store_id" uuid NOT NULL,
	"issue_to_role" "inventory_sale_to_role" NOT NULL,
	"student_id" text,
	"issue_to_name" varchar(255),
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"return_date" date,
	"status" "inventory_issue_status" DEFAULT 'issued' NOT NULL,
	"recorded_by_id" text,
	"idempotency_key" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_issue_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"adjustment_number" varchar(50) NOT NULL,
	"store_id" uuid NOT NULL,
	"type" "inventory_adjustment_type" NOT NULL,
	"reason" text,
	"note" text,
	"status" varchar(20) DEFAULT 'applied' NOT NULL,
	"created_by_id" text,
	"idempotency_key" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_adjustment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"direction" varchar(10) DEFAULT 'in' NOT NULL,
	"qty" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transfer_number" varchar(50) NOT NULL,
	"from_store_id" uuid NOT NULL,
	"to_store_id" uuid NOT NULL,
	"reason" text,
	"status" "inventory_transfer_status" DEFAULT 'pending' NOT NULL,
	"created_by_id" text,
	"completed_at" timestamp,
	"completed_by_id" text,
	"cancelled_at" timestamp,
	"cancelled_by_id" text,
	"idempotency_key" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_transfers_from_neq_to_check" CHECK ("from_store_id" <> "to_store_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_transfer_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"movement_type" "inventory_movement_type" NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"ref_type" varchar(20) NOT NULL,
	"ref_id" uuid NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"actor_id" text,
	"reason" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_categories_tenant_name_unique" ON "inventory_categories" ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_units_tenant_name_unique" ON "inventory_units" ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stores_tenant_code_unique" ON "inventory_stores" ("tenant_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_suppliers_tenant_name_unique" ON "inventory_suppliers" ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_products_tenant_code_unique" ON "inventory_products" ("tenant_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_purchases_tenant_number_unique" ON "inventory_purchases" ("tenant_id","purchase_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_purchases_tenant_idempotency_key_unique" ON "inventory_purchases" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_sales_tenant_number_unique" ON "inventory_sales" ("tenant_id","sale_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_sales_tenant_idempotency_key_unique" ON "inventory_sales" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_issues_tenant_number_unique" ON "inventory_issues" ("tenant_id","issue_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_issues_tenant_idempotency_key_unique" ON "inventory_issues" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_adjustments_tenant_number_unique" ON "inventory_adjustments" ("tenant_id","adjustment_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_adjustments_tenant_idempotency_key_unique" ON "inventory_adjustments" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transfers_tenant_number_unique" ON "inventory_transfers" ("tenant_id","transfer_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transfers_tenant_idempotency_key_unique" ON "inventory_transfers" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stock_movements_tenant_idempotency_key_unique" ON "inventory_stock_movements" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stock_balances_tenant_store_product_unique" ON "inventory_stock_balances" ("tenant_id","store_id","product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_purchase_lines_purchase_idx" ON "inventory_purchase_lines" ("tenant_id","purchase_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_sale_lines_sale_idx" ON "inventory_sale_lines" ("tenant_id","sale_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_issue_lines_issue_idx" ON "inventory_issue_lines" ("tenant_id","issue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_adjustment_lines_adjustment_idx" ON "inventory_adjustment_lines" ("tenant_id","adjustment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_transfer_lines_transfer_idx" ON "inventory_transfer_lines" ("tenant_id","transfer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_stock_movements_tenant_store_product_idx" ON "inventory_stock_movements" ("tenant_id","store_id","product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_stock_movements_tenant_ref_idx" ON "inventory_stock_movements" ("tenant_id","ref_type","ref_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_stock_movements_tenant_recorded_at_idx" ON "inventory_stock_movements" ("tenant_id","recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_stock_balances_tenant_product_idx" ON "inventory_stock_balances" ("tenant_id","product_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stores" ADD CONSTRAINT "inventory_stores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stores" ADD CONSTRAINT "inventory_stores_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_suppliers" ADD CONSTRAINT "inventory_suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_purchase_unit_id_inventory_units_id_fk" FOREIGN KEY ("purchase_unit_id") REFERENCES "inventory_units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_sale_unit_id_inventory_units_id_fk" FOREIGN KEY ("sale_unit_id") REFERENCES "inventory_units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_store_id_inventory_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchase_lines" ADD CONSTRAINT "inventory_purchase_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchase_lines" ADD CONSTRAINT "inventory_purchase_lines_purchase_id_inventory_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "inventory_purchases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_purchase_lines" ADD CONSTRAINT "inventory_purchase_lines_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_store_id_inventory_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_reversed_by_id_user_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sale_lines" ADD CONSTRAINT "inventory_sale_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sale_lines" ADD CONSTRAINT "inventory_sale_lines_sale_id_inventory_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "inventory_sales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sale_lines" ADD CONSTRAINT "inventory_sale_lines_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_sale_lines" ADD CONSTRAINT "inventory_sale_lines_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_store_id_inventory_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_issue_id_inventory_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "inventory_issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_store_id_inventory_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_adjustment_id_inventory_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "inventory_adjustments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_store_id_inventory_stores_id_fk" FOREIGN KEY ("from_store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_store_id_inventory_stores_id_fk" FOREIGN KEY ("to_store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_completed_by_id_user_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_cancelled_by_id_user_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_transfer_id_inventory_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_store_id_inventory_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "inventory_stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_balances" ADD CONSTRAINT "inventory_stock_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_balances" ADD CONSTRAINT "inventory_stock_balances_store_id_inventory_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "inventory_stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_stock_balances" ADD CONSTRAINT "inventory_stock_balances_product_id_inventory_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
