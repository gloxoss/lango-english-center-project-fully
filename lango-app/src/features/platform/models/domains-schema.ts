import { pgTable, text, timestamp, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { tenants, user } from '@/models/Schema';
import { foreignKey, unique } from 'drizzle-orm/pg-core';

export const domainType = pgEnum('domain_type', ['subdomain', 'custom']);
export const domainStatus = pgEnum('domain_status', ['pending', 'verified', 'approved', 'rejected']);

export const tenantDomains = pgTable('tenant_domains', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  domain: text('domain').notNull(),
  domainType: domainType('domain_type').notNull(),
  status: domainStatus('status').default('pending').notNull(),
  verificationToken: text('verification_token'),
  requestedAt: timestamp('requested_at', { mode: 'string' }).defaultNow().notNull(),
  requestedById: text('requested_by_id').notNull(),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  approvedById: text('approved_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('tenant_domains_domain_unique').on(table.domain),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'tenant_domains_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.requestedById],
    foreignColumns: [user.id],
    name: 'tenant_domains_requested_by_id_user_id_fk',
  }),
  foreignKey({
    columns: [table.approvedById],
    foreignColumns: [user.id],
    name: 'tenant_domains_approved_by_id_user_id_fk',
  }).onDelete('set null'),
]);
