CREATE TABLE IF NOT EXISTS "academic_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"capacity" integer,
	"room_type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_rooms_tenant_name_unique" UNIQUE("tenant_id","name")
);

ALTER TABLE "academic_rooms" DROP CONSTRAINT IF EXISTS "academic_rooms_tenant_id_tenants_id_fk";
ALTER TABLE "academic_rooms" ADD CONSTRAINT "academic_rooms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
