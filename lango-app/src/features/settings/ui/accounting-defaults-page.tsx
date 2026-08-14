// accounting-defaults-page.tsx
// SERVER COMPONENT — pre-fetches accounting defaults (tenant-scoped), PCG mapping
// status against the real chart of accounts, the real journal trial balance, and
// the finance/settings audit feed server-side.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getServerUserContext } from '@/libs/auth/server-context';
import { auditLogs, chartOfAccounts, journalEntries, journalEntryLines, user } from '@/models/Schema';
import { getEffectiveValue } from '@/libs/settings/registry';
import { PCG_MAPPINGS, DEFAULT_ACCOUNTING_SETTINGS } from '@/features/settings/data/accounting-defaults-config';
import {
  AccountingDefaultsClient, PcgMapping, AccountingSettingsState,
  TrialBalanceRow, AuditFeedItem,
} from './accounting-defaults-client';

const FINANCE_ENTITY_TYPES = [
  'setting', 'settings', 'setting_rollback', 'expense', 'invoice', 'payment', 'payment_reminder',
] as const;

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 30) return `Il y a ${days} jours`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

const ACTION_VERBS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  settings_change: 'Modification de paramètre',
  export: 'Export',
  import: 'Import',
};

const ENTITY_NOUNS: Record<string, string> = {
  setting: 'des paramètres comptables',
  settings: 'des paramètres comptables',
  setting_rollback: 'de rollback des paramètres comptables',
  expense: "d'une dépense",
  invoice: "d'une facture",
  payment: "d'un paiement",
  payment_reminder: "d'un rappel de paiement",
};

function auditLabel(action: string, entityType: string): string {
  const verb = ACTION_VERBS[action] ?? `Opération ${action}`;
  const noun = ENTITY_NOUNS[entityType] ?? entityType;
  return `${verb} ${noun}`;
}

export async function AccountingDefaultsPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialSettings: AccountingSettingsState = { ...DEFAULT_ACCOUNTING_SETTINGS };
  let initialMappings: PcgMapping[] = Array.from(PCG_MAPPINGS) as PcgMapping[];
  let initialTrialBalance: TrialBalanceRow[] = [];
  let initialAuditFeed: AuditFeedItem[] = [];
  let mappedCount = 0;
  const totalCount = PCG_MAPPINGS.length;

  try {
    if (tenantId && ctx) {
      // Read-only: when the tenant has never saved accounting defaults, render the
      // PCG config seed. Persistence happens on the first user save (PATCH), never
      // during a plain page render.
      const effective = await getEffectiveValue(tenantId, ctx.branchId, 'accounting.defaults');
      const stored = effective.source === 'default' ? {} : (effective.value as Record<string, unknown>);
      initialSettings = { ...DEFAULT_ACCOUNTING_SETTINGS, ...stored } as AccountingSettingsState;

      // Mapping status derived from the real chart of accounts.
      const chartRows = await db
        .select({ code: chartOfAccounts.code })
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.tenantId, tenantId));
      const chartCodes = new Set(chartRows.map(r => r.code));
      initialMappings = (Array.from(PCG_MAPPINGS) as PcgMapping[]).map(m => ({
        ...m,
        status: chartCodes.has(m.pcgCode) ? 'mapped' : 'unmapped',
      }));
      mappedCount = initialMappings.filter(m => m.status === 'mapped').length;

      // Real trial balance aggregated per chart account (latest entries first).
      const lineRows = await db
        .select({
          code: chartOfAccounts.code,
          accountName: chartOfAccounts.name,
          debit: journalEntryLines.debitAmount,
          credit: journalEntryLines.creditAmount,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
        .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
        .where(eq(journalEntryLines.tenantId, tenantId))
        .orderBy(desc(journalEntries.entryDate))
        .limit(200);

      const byCode = new Map<string, TrialBalanceRow>();
      for (const row of lineRows) {
        const current = byCode.get(row.code) ?? { code: row.code, label: row.accountName, debit: 0, credit: 0 };
        current.debit += Number(row.debit ?? 0);
        current.credit += Number(row.credit ?? 0);
        byCode.set(row.code, current);
      }
      initialTrialBalance = [...byCode.values()];

      // Real finance/settings audit feed.
      const auditRows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          createdAt: auditLogs.createdAt,
          actorName: user.name,
        })
        .from(auditLogs)
        .leftJoin(user, eq(auditLogs.actorId, user.id))
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          inArray(auditLogs.entityType, FINANCE_ENTITY_TYPES),
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(8);

      initialAuditFeed = auditRows.map(r => ({
        id: r.id,
        action: auditLabel(r.action, r.entityType),
        user: r.actorName ?? 'Système',
        timestamp: relativeTime(r.createdAt),
      }));
    }
  } catch (err) {
    console.error('Failed to pre-fetch accounting defaults server-side:', err);
  }

  return (
    <AccountingDefaultsClient
      initialSettings={initialSettings}
      initialMappings={initialMappings}
      initialTrialBalance={initialTrialBalance}
      initialAuditFeed={initialAuditFeed}
      mappedCount={mappedCount}
      totalCount={totalCount}
    />
  );
}
