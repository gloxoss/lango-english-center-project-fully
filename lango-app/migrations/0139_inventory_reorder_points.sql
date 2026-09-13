-- 0139_inventory_reorder_points.sql — per-product reorder policy.
--
-- Reorder suggestions previously compared every product against one hardcoded
-- threshold of 5 units and proposed a fixed max(10, 25 - stock), which is wrong
-- in both directions: a box of chalk and a laptop cart do not reorder alike.
--
-- Both columns are nullable on purpose. NULL means "no policy set" and falls
-- back to the tenant-wide threshold, which is what every existing row wants;
-- an explicit 0 means "let it run to empty" and must not be read as unset.
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "reorder_point" numeric(14, 3);
--> statement-breakpoint
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "reorder_quantity" numeric(14, 3);
--> statement-breakpoint
ALTER TABLE "inventory_products" DROP CONSTRAINT IF EXISTS "inventory_products_reorder_point_nonneg";
--> statement-breakpoint
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_reorder_point_nonneg"
  CHECK ("reorder_point" IS NULL OR "reorder_point" >= 0);
--> statement-breakpoint
ALTER TABLE "inventory_products" DROP CONSTRAINT IF EXISTS "inventory_products_reorder_quantity_positive";
--> statement-breakpoint
-- A reorder quantity of 0 would raise a purchase order for nothing, so unlike
-- the reorder point it must be strictly positive when set at all.
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_reorder_quantity_positive"
  CHECK ("reorder_quantity" IS NULL OR "reorder_quantity" > 0);
