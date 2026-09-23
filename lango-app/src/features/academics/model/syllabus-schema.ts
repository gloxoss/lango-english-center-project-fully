import { jsonb, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Chapter } from '../data/syllabus-config';

// ponytail: class_subject_syllabi persists chapter breakdown, progress, and resources
// per classSubject offering. JSONB chapters allow teachers to structure units cleanly
// without an oversized multi-table relational schema.
export const classSubjectSyllabi = pgTable('class_subject_syllabi', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  chapters: jsonb('chapters').$type<Chapter[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('class_subject_syllabi_tenant_subj_uq').on(table.tenantId, table.classSubjectId),
]);
