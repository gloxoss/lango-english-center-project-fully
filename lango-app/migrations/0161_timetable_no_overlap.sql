CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "class_schedule_slots"
ADD CONSTRAINT "class_schedule_slots_teacher_no_overlap"
EXCLUDE USING gist (
  tenant_id WITH =,
  version_id WITH =,
  day_of_week WITH =,
  teacher_id WITH =,
  int4range(
    split_part(start_time, ':', 1)::int * 60 + split_part(start_time, ':', 2)::int,
    split_part(end_time, ':', 1)::int * 60 + split_part(end_time, ':', 2)::int,
    '[)'
  ) WITH &&
);
--> statement-breakpoint
ALTER TABLE "class_schedule_slots"
ADD CONSTRAINT "class_schedule_slots_section_no_overlap"
EXCLUDE USING gist (
  tenant_id WITH =,
  version_id WITH =,
  day_of_week WITH =,
  class_section_id WITH =,
  int4range(
    split_part(start_time, ':', 1)::int * 60 + split_part(start_time, ':', 2)::int,
    split_part(end_time, ':', 1)::int * 60 + split_part(end_time, ':', 2)::int,
    '[)'
  ) WITH &&
);
