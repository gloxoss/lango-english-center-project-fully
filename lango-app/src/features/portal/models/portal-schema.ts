import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from '../../../models/Schema';

// ---------------------------------------------------------------------------
// Role Portals Foundation — shared portal data.
// All tables carry tenantId (uuid, matching the rest of the schema) and are
// written/read exclusively through the tenant-scoped portal services.
// active_role is varchar, not a pgEnum: it reuses the AppRole values and must
// stay aligned with src/libs/api/context.ts without coupling schema to it.
// ---------------------------------------------------------------------------

// Server-owned per-session active context. Keyed by sessionId (Better-Auth
// session id) so the active role is bound to the real authenticated session,
// never to a browser cookie, localStorage, or query parameter. A row is
// created lazily on first portal request (defaults to the user's base role)
// and updated only by POST /api/portal/role after server-side validation.
export const portalActiveContexts = pgTable('portal_active_contexts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  activeRole: varchar('active_role', { length: 30 }).notNull(),
  activeBranchId: uuid('active_branch_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'portal_active_contexts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('portal_active_contexts_session_id_unique').on(table.sessionId),
  index('portal_active_contexts_user_idx').on(table.userId),
]);

// Key/value portal preferences (notification prefs, locale, theme, home
// widget layout…). Value is jsonb so scalar + structured preferences coexist.
export const portalPreferences = pgTable('portal_preferences', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  prefKey: varchar('pref_key', { length: 120 }).notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'portal_preferences_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('portal_preferences_tenant_user_key_unique').on(table.tenantId, table.userId, table.prefKey),
]);

// Audit trail for portal activity (role switches, privileged actions). Never
// stores secrets or raw credentials.
export const portalActivityEvents = pgTable('portal_activity_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  role: varchar('role', { length: 30 }).notNull(),
  action: varchar('action', { length: 60 }).notNull(),
  entityType: varchar('entity_type', { length: 60 }).notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'portal_activity_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('portal_activity_events_tenant_user_created_idx').on(table.tenantId, table.userId, table.createdAt),
]);
