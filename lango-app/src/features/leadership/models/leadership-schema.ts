import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { branches, tenants, user } from '@/models/Schema';
import { departments } from '@/features/hr/models/hr-schema';

export const leadershipScopeAssignments = pgTable('leadership_scope_assignments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  scopeType: varchar('scope_type', { length: 20 }).notNull(),
  branchId: uuid('branch_id'),
  departmentId: uuid('department_id'),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'leadership_scope_assignments_tenant_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'leadership_scope_assignments_user_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.branchId], foreignColumns: [branches.id], name: 'leadership_scope_assignments_branch_fk' }).onDelete('restrict'),
  foreignKey({ columns: [table.departmentId], foreignColumns: [departments.id], name: 'leadership_scope_assignments_department_fk' }).onDelete('restrict'),
  foreignKey({ columns: [table.createdById], foreignColumns: [user.id], name: 'leadership_scope_assignments_creator_fk' }).onDelete('restrict'),
  check('leadership_scope_assignments_type_check', sql`${table.scopeType} in ('tenant', 'branch', 'department')`),
  check('leadership_scope_assignments_status_check', sql`${table.status} in ('active', 'revoked', 'expired')`),
  check('leadership_scope_assignments_target_check', sql`(${table.scopeType} = 'tenant' and ${table.branchId} is null and ${table.departmentId} is null) or (${table.scopeType} = 'branch' and ${table.branchId} is not null and ${table.departmentId} is null) or (${table.scopeType} = 'department' and ${table.departmentId} is not null)`),
  check('leadership_scope_assignments_dates_check', sql`${table.endsOn} is null or ${table.endsOn} >= ${table.startsOn}`),
  unique('leadership_scope_assignments_tenant_id_unique').on(table.tenantId, table.id),
  index('leadership_scope_assignments_actor_active_idx').on(table.tenantId, table.userId, table.status, table.startsOn, table.endsOn),
]);

export const leadershipApprovalAuthorities = pgTable('leadership_approval_authorities', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  assignmentId: uuid('assignment_id').notNull(),
  domain: varchar('domain', { length: 30 }).notNull(),
  action: varchar('action', { length: 60 }).notNull(),
  maxAmount: numeric('max_amount', { precision: 14, scale: 2 }),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on'),
  delegatedFromAuthorityId: uuid('delegated_from_authority_id'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'leadership_approval_authorities_tenant_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.assignmentId], foreignColumns: [leadershipScopeAssignments.id], name: 'leadership_approval_authorities_assignment_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.delegatedFromAuthorityId], foreignColumns: [table.id], name: 'leadership_approval_authorities_delegated_from_fk' }).onDelete('restrict'),
  foreignKey({ columns: [table.createdById], foreignColumns: [user.id], name: 'leadership_approval_authorities_creator_fk' }).onDelete('restrict'),
  check('leadership_approval_authorities_domain_check', sql`${table.domain} in ('academics', 'attendance', 'finance', 'workforce', 'operations', 'reporting')`),
  check('leadership_approval_authorities_status_check', sql`${table.status} in ('active', 'revoked', 'expired')`),
  check('leadership_approval_authorities_amount_check', sql`${table.maxAmount} is null or ${table.maxAmount} >= 0`),
  check('leadership_approval_authorities_dates_check', sql`${table.endsOn} is null or ${table.endsOn} >= ${table.startsOn}`),
  unique('leadership_approval_authorities_tenant_id_unique').on(table.tenantId, table.id),
  index('leadership_approval_authorities_assignment_idx').on(table.tenantId, table.assignmentId, table.domain, table.action, table.status),
]);
