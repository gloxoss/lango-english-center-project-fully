import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Parent Portal — feature-local schema. Kept out of the shared Schema.ts barrel
// so a new table never collides with concurrent agents' migration work.
// `parent_requests` is the parent → school request inbox (profile correction,
// leave/permission, document request, other). It records intent only — the
// destination module (academics/admin) performs the actual change in its own
// table, mirroring the receptionist-handoff rule.
// ---------------------------------------------------------------------------

export const parentRequests = pgTable('parent_requests', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  guardianId: uuid('guardian_id').notNull(),
  studentId: text('student_id').notNull(),
  requestType: varchar('request_type', { length: 30 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  decidedById: text('decided_by_id'),
  decisionNotes: text('decision_notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('parent_requests_tenant_status_idx').on(table.tenantId, table.status),
  index('parent_requests_tenant_student_idx').on(table.tenantId, table.studentId),
]);
