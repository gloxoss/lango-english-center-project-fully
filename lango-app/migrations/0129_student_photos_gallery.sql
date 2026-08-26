-- 0129_student_photos_gallery.sql — student photo gallery (Part 2, item 2).
-- A student can now hold several photos; `user.photoUrl` stays the single
-- "profile" photo. `url` stores the tenant-namespaced upload subpath
-- ({studentId}/{photoId}.{ext}) under src/libs/api/uploads.ts. Hand-written,
-- idempotent.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS student_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id text NOT NULL,
  url text NOT NULL,
  uploaded_at timestamp DEFAULT now() NOT NULL,
  uploaded_by text,
  CONSTRAINT student_photos_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT student_photos_student_id_user_id_fk FOREIGN KEY (student_id) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT student_photos_uploaded_by_user_id_fk FOREIGN KEY (uploaded_by) REFERENCES "user"(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS student_photos_tenant_student_idx ON student_photos (tenant_id, student_id);
