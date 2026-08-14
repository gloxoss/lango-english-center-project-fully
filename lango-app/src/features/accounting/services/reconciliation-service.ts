import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import {
  accountingReconciliationEvents,
  accountingReconciliationMatches,
  accountingStatementImports,
  accountingStatementLines,
  accountingStatementMatches,
  bankReconciliations,
  chartOfAccounts,
  journalEntryLines,
} from '@/models/Schema';
import { postAccountingVoucher } from './posting-service';

export type ReconciliationPrincipal = { tenantId: string; userId: string };

export type CsvStatementRow = {
  lineDate: string;
  description: string;
  reference: string | null;
  debit: string | null;
  credit: string | null;
};

export type StatementMatchPart = { journalLineId: string; amount: string };

export type FeeInterestInput = {
  kind: 'fee' | 'interest';
  amount: string;
  bankAssetAccountId: string;
  offsetAccountId: string;
  description: string;
  entryDate: string;
  idempotencyKey: string;
  journalCode: string;
  voucherTypeCode: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const MAX_IMPORT_BYTES = 1_000_000;
const MAX_IMPORT_ROWS = 5_000;

// RFC-4180-style parser (quoted fields, escaped quotes). Deliberately bounded:
// the raw size is capped in parseStatementCsv and every field is re-validated.
function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { record.push(field); field = ''; };
  const pushRecord = () => {
    if (record.length > 0 || field !== '') {
      record.push(field); field = '';
      records.push(record); record = [];
    }
  };
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRecord();
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (record.length > 0 || field !== '') pushRecord();
  return records;
}

export function parseStatementCsv(content: string): CsvStatementRow[] {
  if (Buffer.byteLength(content, 'utf8') > MAX_IMPORT_BYTES) {
    throw new ApiError(413, 'IMPORT_TOO_LARGE', 'Le fichier CSV dépasse 1 Mo.');
  }
  const records = parseCsvRecords(content);
  if (records.length < 2) {
    throw new ApiError(422, 'IMPORT_EMPTY', 'Le CSV doit contenir un en-tête et au moins une ligne de relevé.');
  }
  const header = (records[0] ?? []).map(h => h.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);
  const dateIdx = indexOf('date');
  const descriptionIdx = indexOf('description');
  if (dateIdx === -1 || descriptionIdx === -1) {
    throw new ApiError(422, 'IMPORT_INVALID_HEADER', 'Colonnes « date » et « description » requises dans l’en-tête CSV.');
  }
  const debitIdx = indexOf('debit');
  const creditIdx = indexOf('credit');
  if (debitIdx === -1 && creditIdx === -1) {
    throw new ApiError(422, 'IMPORT_INVALID_HEADER', 'Colonnes « debit » ou « credit » requises dans l’en-tête CSV.');
  }
  const referenceIdx = indexOf('reference');
  if (records.length - 1 > MAX_IMPORT_ROWS) {
    throw new ApiError(422, 'IMPORT_TOO_MANY_ROWS', `Le CSV dépasse ${MAX_IMPORT_ROWS} lignes de relevé.`);
  }

  const rows: CsvStatementRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const raw = records[i] ?? [];
    const get = (idx: number): string => (idx >= 0 && idx < raw.length ? (raw[idx] ?? '').trim() : '');
    const lineDate = get(dateIdx);
    const description = get(descriptionIdx);
    const reference = referenceIdx >= 0 ? get(referenceIdx) : '';
    const debit = debitIdx >= 0 ? get(debitIdx) : '';
    const credit = creditIdx >= 0 ? get(creditIdx) : '';
    if (!lineDate && !description && !debit && !credit) continue;
    if (!DATE_PATTERN.test(lineDate) || Number.isNaN(new Date(lineDate).getTime())) {
      throw new ApiError(422, 'IMPORT_INVALID_DATE', `Date invalide à la ligne ${i + 1} : ${lineDate}`);
    }
    if (!description) throw new ApiError(422, 'IMPORT_INVALID_DESCRIPTION', `Libellé manquant à la ligne ${i + 1}.`);
    const hasDebit = debit !== '' && debit !== '0';
    const hasCredit = credit !== '' && credit !== '0';
    if (hasDebit === hasCredit) {
      throw new ApiError(422, 'IMPORT_INVALID_AMOUNT', `Ligne ${i + 1} : exactement un montant débit ou crédit est requis.`);
    }
    const amount = hasDebit ? debit : credit;
    if (!AMOUNT_PATTERN.test(amount)) {
      throw new ApiError(422, 'IMPORT_INVALID_AMOUNT', `Montant invalide à la ligne ${i + 1} : ${amount}`);
    }
    rows.push({ lineDate, description, reference: reference || null, debit: hasDebit ? debit : null, credit: hasCredit ? credit : null });
  }
  if (rows.length === 0) throw new ApiError(422, 'IMPORT_EMPTY', 'Le CSV ne contient aucune ligne de relevé valide.');
  return rows;
}

function signedCentsToBigInt(value: string): bigint {
  const negative = value.startsWith('-');
  const absolute = negative ? value.slice(1) : value;
  return (negative ? -BigInt(1) : BigInt(1)) * moneyToCents(absolute);
}

function statementLineTotalCents(line: { debitAmount: string; creditAmount: string }): bigint {
  return moneyToCents(line.debitAmount) + moneyToCents(line.creditAmount);
}

function journalLineCapacityCents(line: { debitAmount: string; creditAmount: string }): bigint {
  const net = moneyToCents(line.debitAmount) - moneyToCents(line.creditAmount);
  return net < BigInt(0) ? -net : net;
}

async function requireOpenReconciliation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tenantId: string,
  reconciliationId: string,
) {
  const [reconciliation] = await tx.select().from(bankReconciliations).where(and(
    eq(bankReconciliations.tenantId, tenantId),
    eq(bankReconciliations.id, reconciliationId),
  )).for('update');
  if (!reconciliation) throw new ApiError(404, 'RECONCILIATION_NOT_FOUND', 'Rapprochement bancaire introuvable.');
  if (reconciliation.status === 'completed') {
    throw new ApiError(409, 'RECONCILIATION_CLOSED', 'Ce rapprochement est déjà clôturé.');
  }
  return reconciliation;
}

async function recomputeReconciledBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tenantId: string,
  reconciliationId: string,
): Promise<string> {
  const [statementSum] = await tx.select({
    amount: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text`,
  }).from(accountingStatementMatches).where(and(
    eq(accountingStatementMatches.tenantId, tenantId),
    eq(accountingStatementMatches.reconciliationId, reconciliationId),
  ));
  const [legacySum] = await tx.select({
    amount: sql<string>`coalesce(sum(${accountingReconciliationMatches.matchedAmount}),0)::text`,
  }).from(accountingReconciliationMatches).where(and(
    eq(accountingReconciliationMatches.tenantId, tenantId),
    eq(accountingReconciliationMatches.reconciliationId, reconciliationId),
  ));
  const total = centsToMoney(
    signedCentsToBigInt(statementSum?.amount ?? '0') + signedCentsToBigInt(legacySum?.amount ?? '0'),
  );
  await tx.update(bankReconciliations).set({ reconciledBalance: total }).where(and(
    eq(bankReconciliations.tenantId, tenantId),
    eq(bankReconciliations.id, reconciliationId),
  ));
  return total;
}

// Replay-safe CSV import: content is fingerprinted (SHA-256) and re-imports of
// identical content are rejected, so accidental double uploads / network retries
// cannot double-post statement lines.
export async function importStatementLines(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  filename: string,
  content: string,
): Promise<{ rowsImported: number; fingerprint: string; alreadyImported: boolean }> {
  const rows = parseStatementCsv(content);
  const fingerprint = createHash('sha256').update(content).digest('hex');
  const values = rows.map(row => ({
    tenantId: principal.tenantId,
    reconciliationId,
    lineDate: row.lineDate,
    description: row.description,
    reference: row.reference,
    debitAmount: row.debit ?? '0.00',
    creditAmount: row.credit ?? '0.00',
    status: 'unmatched',
  }));
  return db.transaction(async (tx) => {
    await requireOpenReconciliation(tx, principal.tenantId, reconciliationId);
    const [prior] = await tx.select({ id: accountingStatementImports.id }).from(accountingStatementImports).where(and(
      eq(accountingStatementImports.tenantId, principal.tenantId),
      eq(accountingStatementImports.reconciliationId, reconciliationId),
      eq(accountingStatementImports.contentFingerprint, fingerprint),
    )).limit(1);
    if (prior) return { rowsImported: 0, fingerprint, alreadyImported: true };
    try {
      const inserted = await tx.insert(accountingStatementLines).values(values).returning({ id: accountingStatementLines.id });
      await tx.insert(accountingStatementImports).values({
        tenantId: principal.tenantId,
        reconciliationId,
        filename,
        contentFingerprint: fingerprint,
        rowsImported: inserted.length,
        importedById: principal.userId,
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(409, 'IMPORT_REPLAY_REJECTED', 'Ce relevé a déjà été importé (contenu identique).');
      }
      throw error;
    }
    await tx.insert(accountingReconciliationEvents).values({
      tenantId: principal.tenantId,
      reconciliationId,
      eventType: 'imported',
      actorId: principal.userId,
      reason: filename,
      metadata: { fingerprint, rows: rows.length },
    });
    return { rowsImported: rows.length, fingerprint, alreadyImported: false };
  });
}

export async function getReconciliationDetail(principal: ReconciliationPrincipal, reconciliationId: string) {
  const [reconciliation] = await db.select().from(bankReconciliations).where(and(
    eq(bankReconciliations.tenantId, principal.tenantId),
    eq(bankReconciliations.id, reconciliationId),
  )).limit(1);
  if (!reconciliation) throw new ApiError(404, 'RECONCILIATION_NOT_FOUND', 'Rapprochement bancaire introuvable.');
  const [lines, matches, imports, events] = await Promise.all([
    db.select().from(accountingStatementLines).where(and(
      eq(accountingStatementLines.tenantId, principal.tenantId),
      eq(accountingStatementLines.reconciliationId, reconciliationId),
    )).orderBy(asc(accountingStatementLines.lineDate), asc(accountingStatementLines.createdAt)),
    db.select().from(accountingStatementMatches).where(and(
      eq(accountingStatementMatches.tenantId, principal.tenantId),
      eq(accountingStatementMatches.reconciliationId, reconciliationId),
    )).orderBy(asc(accountingStatementMatches.createdAt)),
    db.select().from(accountingStatementImports).where(and(
      eq(accountingStatementImports.tenantId, principal.tenantId),
      eq(accountingStatementImports.reconciliationId, reconciliationId),
    )).orderBy(desc(accountingStatementImports.createdAt)),
    db.select().from(accountingReconciliationEvents).where(and(
      eq(accountingReconciliationEvents.tenantId, principal.tenantId),
      eq(accountingReconciliationEvents.reconciliationId, reconciliationId),
    )).orderBy(asc(accountingReconciliationEvents.createdAt)),
  ]);
  return { reconciliation, lines, matches, imports, events };
}

// Match one statement line to one journal line. Supports partial matching
// (amount defaults to the full statement line) — the same primitive underlies
// split (many journal lines per statement line) and merge (many statement lines
// per journal line). Both sides are guarded against over-consumption.
export async function matchStatementLine(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  statementLineId: string,
  journalLineId: string,
  amount?: string,
): Promise<{ matchedAmount: string; lineStatus: string; reconciledBalance: string }> {
  return db.transaction(async (tx) => {
    await requireOpenReconciliation(tx, principal.tenantId, reconciliationId);
    const [line] = await tx.select().from(accountingStatementLines).where(and(
      eq(accountingStatementLines.tenantId, principal.tenantId),
      eq(accountingStatementLines.reconciliationId, reconciliationId),
      eq(accountingStatementLines.id, statementLineId),
    )).for('update');
    if (!line) throw new ApiError(404, 'STATEMENT_LINE_NOT_FOUND', 'Ligne de relevé introuvable.');
    const [journalLine] = await tx.select().from(journalEntryLines).where(and(
      eq(journalEntryLines.tenantId, principal.tenantId),
      eq(journalEntryLines.id, journalLineId),
    )).for('update');
    if (!journalLine) throw new ApiError(404, 'JOURNAL_LINE_NOT_FOUND', 'Ligne du grand livre introuvable.');

    const lineCents = statementLineTotalCents(line);
    const matched = amount ? moneyToCents(amount) : lineCents;
    if (matched <= BigInt(0)) throw new ApiError(422, 'INVALID_MATCH_AMOUNT', 'Le montant rapproché doit être positif.');

    const [statementUsedRow] = await tx.select({ sum: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text` })
      .from(accountingStatementMatches).where(and(
        eq(accountingStatementMatches.tenantId, principal.tenantId),
        eq(accountingStatementMatches.statementLineId, statementLineId),
      ));
    const statementUsed = signedCentsToBigInt(statementUsedRow?.sum ?? '0');
    if (statementUsed + matched > lineCents) {
      throw new ApiError(409, 'STATEMENT_LINE_OVERMATCHED', 'Le montant rapproché dépasse le solde de la ligne de relevé.');
    }

    const [journalUsedRow] = await tx.select({ sum: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text` })
      .from(accountingStatementMatches).where(and(
        eq(accountingStatementMatches.tenantId, principal.tenantId),
        eq(accountingStatementMatches.journalLineId, journalLineId),
      ));
    const journalUsed = signedCentsToBigInt(journalUsedRow?.sum ?? '0');
    if (journalUsed + matched > journalLineCapacityCents(journalLine)) {
      throw new ApiError(409, 'JOURNAL_LINE_OVERMATCHED', 'Le total rapproché dépasse le montant de la ligne du grand livre.');
    }

    const [existing] = await tx.select({ id: accountingStatementMatches.id }).from(accountingStatementMatches).where(and(
      eq(accountingStatementMatches.tenantId, principal.tenantId),
      eq(accountingStatementMatches.statementLineId, statementLineId),
      eq(accountingStatementMatches.journalLineId, journalLineId),
    )).limit(1);
    if (existing) throw new ApiError(409, 'MATCH_ALREADY_EXISTS', 'Ce rapprochement ligne/relevé existe déjà.');

    await tx.insert(accountingStatementMatches).values({
      tenantId: principal.tenantId,
      reconciliationId,
      statementLineId,
      journalLineId,
      matchedAmount: centsToMoney(matched),
      matchedById: principal.userId,
    });
    const newStatus = statementUsed + matched >= lineCents ? 'matched' : 'partial';
    await tx.update(accountingStatementLines).set({ status: newStatus }).where(eq(accountingStatementLines.id, statementLineId));
    const reconciledBalance = await recomputeReconciledBalance(tx, principal.tenantId, reconciliationId);
    await tx.insert(accountingReconciliationEvents).values({
      tenantId: principal.tenantId,
      reconciliationId,
      eventType: 'matched',
      actorId: principal.userId,
      reason: journalLine.memo,
      metadata: { statementLineId, journalLineId, amount: centsToMoney(matched), status: newStatus },
    });
    return { matchedAmount: centsToMoney(matched), lineStatus: newStatus, reconciledBalance };
  });
}

export async function unmatchStatementLine(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  statementLineId: string,
  journalLineId?: string,
): Promise<{ removed: number; lineStatus: string; reconciledBalance: string }> {
  return db.transaction(async (tx) => {
    await requireOpenReconciliation(tx, principal.tenantId, reconciliationId);
    const [line] = await tx.select().from(accountingStatementLines).where(and(
      eq(accountingStatementLines.tenantId, principal.tenantId),
      eq(accountingStatementLines.reconciliationId, reconciliationId),
      eq(accountingStatementLines.id, statementLineId),
    )).for('update');
    if (!line) throw new ApiError(404, 'STATEMENT_LINE_NOT_FOUND', 'Ligne de relevé introuvable.');
    const conditions = [
      eq(accountingStatementMatches.tenantId, principal.tenantId),
      eq(accountingStatementMatches.statementLineId, statementLineId),
    ];
    if (journalLineId) conditions.push(eq(accountingStatementMatches.journalLineId, journalLineId));
    const deleted = await tx.delete(accountingStatementMatches).where(and(...conditions)).returning({ id: accountingStatementMatches.id });
    if (deleted.length === 0) throw new ApiError(404, 'MATCH_NOT_FOUND', 'Aucun rapprochement à annuler.');

    const [remaining] = await tx.select({ sum: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text` })
      .from(accountingStatementMatches).where(and(
        eq(accountingStatementMatches.tenantId, principal.tenantId),
        eq(accountingStatementMatches.statementLineId, statementLineId),
      ));
    const used = signedCentsToBigInt(remaining?.sum ?? '0');
    const newStatus = used === BigInt(0) ? 'unmatched' : (used >= statementLineTotalCents(line) ? 'matched' : 'partial');
    await tx.update(accountingStatementLines).set({ status: newStatus }).where(eq(accountingStatementLines.id, statementLineId));
    const reconciledBalance = await recomputeReconciledBalance(tx, principal.tenantId, reconciliationId);
    await tx.insert(accountingReconciliationEvents).values({
      tenantId: principal.tenantId,
      reconciliationId,
      eventType: 'unmatched',
      actorId: principal.userId,
      reason: journalLineId ? 'Rapprochement annulé' : 'Ligne de relevé entièrement dé-rapprochée',
      metadata: { statementLineId, journalLineId: journalLineId ?? null, removed: deleted.length, status: newStatus },
    });
    return { removed: deleted.length, lineStatus: newStatus, reconciledBalance };
  });
}

// Split: one statement line across several journal lines, atomically.
export async function splitStatementLine(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  statementLineId: string,
  parts: StatementMatchPart[],
): Promise<{ parts: number; lineStatus: string; reconciledBalance: string }> {
  if (parts.length < 2) throw new ApiError(422, 'SPLIT_REQUIRES_TWO', 'Un éclatement nécessite au moins deux lignes du grand livre.');
  return db.transaction(async (tx) => {
    await requireOpenReconciliation(tx, principal.tenantId, reconciliationId);
    const [line] = await tx.select().from(accountingStatementLines).where(and(
      eq(accountingStatementLines.tenantId, principal.tenantId),
      eq(accountingStatementLines.reconciliationId, reconciliationId),
      eq(accountingStatementLines.id, statementLineId),
    )).for('update');
    if (!line) throw new ApiError(404, 'STATEMENT_LINE_NOT_FOUND', 'Ligne de relevé introuvable.');
    const lineCents = statementLineTotalCents(line);
    const [statementUsedRow] = await tx.select({ sum: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text` })
      .from(accountingStatementMatches).where(and(
        eq(accountingStatementMatches.tenantId, principal.tenantId),
        eq(accountingStatementMatches.statementLineId, statementLineId),
      ));
    let statementUsed = signedCentsToBigInt(statementUsedRow?.sum ?? '0');
    const partsTotal = parts.reduce((sum, part) => sum + moneyToCents(part.amount), BigInt(0));
    for (const part of parts) {
      if (moneyToCents(part.amount) <= BigInt(0)) throw new ApiError(422, 'INVALID_MATCH_AMOUNT', 'Les montants de l’éclatement doivent être positifs.');
    }
    if (statementUsed + partsTotal > lineCents) {
      throw new ApiError(409, 'STATEMENT_LINE_OVERMATCHED', 'L’éclatement dépasse le solde de la ligne de relevé.');
    }
    for (const part of parts) {
      const amountCents = moneyToCents(part.amount);
      const [journalLine] = await tx.select().from(journalEntryLines).where(and(
        eq(journalEntryLines.tenantId, principal.tenantId),
        eq(journalEntryLines.id, part.journalLineId),
      )).for('update');
      if (!journalLine) throw new ApiError(404, 'JOURNAL_LINE_NOT_FOUND', 'Ligne du grand livre introuvable.');
      const [journalUsedRow] = await tx.select({ sum: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text` })
        .from(accountingStatementMatches).where(and(
          eq(accountingStatementMatches.tenantId, principal.tenantId),
          eq(accountingStatementMatches.journalLineId, part.journalLineId),
        ));
      const journalUsed = signedCentsToBigInt(journalUsedRow?.sum ?? '0');
      if (journalUsed + amountCents > journalLineCapacityCents(journalLine)) {
        throw new ApiError(409, 'JOURNAL_LINE_OVERMATCHED', 'Une ligne du grand livre serait dépassée par l’éclatement.');
      }
      await tx.insert(accountingStatementMatches).values({
        tenantId: principal.tenantId,
        reconciliationId,
        statementLineId,
        journalLineId: part.journalLineId,
        matchedAmount: centsToMoney(amountCents),
        matchedById: principal.userId,
      });
      statementUsed += amountCents;
    }
    const newStatus = statementUsed >= lineCents ? 'matched' : 'partial';
    await tx.update(accountingStatementLines).set({ status: newStatus }).where(eq(accountingStatementLines.id, statementLineId));
    const reconciledBalance = await recomputeReconciledBalance(tx, principal.tenantId, reconciliationId);
    await tx.insert(accountingReconciliationEvents).values({
      tenantId: principal.tenantId,
      reconciliationId,
      eventType: 'split',
      actorId: principal.userId,
      reason: `Éclatement en ${parts.length} lignes`,
      metadata: { statementLineId, parts: parts.length, status: newStatus },
    });
    return { parts: parts.length, lineStatus: newStatus, reconciledBalance };
  });
}

// Merge: several statement lines onto one journal line, atomically.
export async function mergeStatementLines(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  statementLineIds: string[],
  journalLineId: string,
): Promise<{ lines: number; reconciledBalance: string }> {
  if (statementLineIds.length < 2) throw new ApiError(422, 'MERGE_REQUIRES_TWO', 'Une fusion nécessite au moins deux lignes de relevé.');
  return db.transaction(async (tx) => {
    await requireOpenReconciliation(tx, principal.tenantId, reconciliationId);
    const [journalLine] = await tx.select().from(journalEntryLines).where(and(
      eq(journalEntryLines.tenantId, principal.tenantId),
      eq(journalEntryLines.id, journalLineId),
    )).for('update');
    if (!journalLine) throw new ApiError(404, 'JOURNAL_LINE_NOT_FOUND', 'Ligne du grand livre introuvable.');
    const [journalUsedRow] = await tx.select({ sum: sql<string>`coalesce(sum(${accountingStatementMatches.matchedAmount}),0)::text` })
      .from(accountingStatementMatches).where(and(
        eq(accountingStatementMatches.tenantId, principal.tenantId),
        eq(accountingStatementMatches.journalLineId, journalLineId),
      ));
    let journalUsed = signedCentsToBigInt(journalUsedRow?.sum ?? '0');
    const lines = await tx.select().from(accountingStatementLines).where(and(
      eq(accountingStatementLines.tenantId, principal.tenantId),
      eq(accountingStatementLines.reconciliationId, reconciliationId),
      inArray(accountingStatementLines.id, statementLineIds),
    )).for('update');
    if (lines.length !== statementLineIds.length) {
      throw new ApiError(404, 'STATEMENT_LINE_NOT_FOUND', 'Certaines lignes de relevé sont introuvables.');
    }
    for (const line of lines) {
      const lineCents = statementLineTotalCents(line);
      if (journalUsed + lineCents > journalLineCapacityCents(journalLine)) {
        throw new ApiError(409, 'JOURNAL_LINE_OVERMATCHED', 'La fusion dépasse le montant de la ligne du grand livre.');
      }
      await tx.insert(accountingStatementMatches).values({
        tenantId: principal.tenantId,
        reconciliationId,
        statementLineId: line.id,
        journalLineId,
        matchedAmount: centsToMoney(lineCents),
        matchedById: principal.userId,
      });
      journalUsed += lineCents;
      await tx.update(accountingStatementLines).set({ status: 'matched' }).where(eq(accountingStatementLines.id, line.id));
    }
    const reconciledBalance = await recomputeReconciledBalance(tx, principal.tenantId, reconciliationId);
    await tx.insert(accountingReconciliationEvents).values({
      tenantId: principal.tenantId,
      reconciliationId,
      eventType: 'merged',
      actorId: principal.userId,
      reason: `Fusion de ${lines.length} lignes de relevé`,
      metadata: { journalLineId, lines: lines.length },
    });
    return { lines: lines.length, reconciledBalance };
  });
}

// Controlled fee/interest posting: the offset account must be an expense account
// for fees / a revenue account for interest, and the bank side must be an asset
// account — all validated tenant-scoped and active. The actual journal entry is
// created by the canonical posting service (balanced, numbered, immutable), so a
// fee/interest never bypasses the ledger.
export async function postReconciliationFeeOrInterest(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  input: FeeInterestInput,
) {
  const [reconciliation] = await db.select().from(bankReconciliations).where(and(
    eq(bankReconciliations.tenantId, principal.tenantId),
    eq(bankReconciliations.id, reconciliationId),
  )).limit(1);
  if (!reconciliation) throw new ApiError(404, 'RECONCILIATION_NOT_FOUND', 'Rapprochement bancaire introuvable.');
  if (reconciliation.status === 'completed') {
    throw new ApiError(409, 'RECONCILIATION_CLOSED', 'Ce rapprochement est déjà clôturé.');
  }

  const [bankAsset] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(
    eq(chartOfAccounts.tenantId, principal.tenantId),
    eq(chartOfAccounts.id, input.bankAssetAccountId),
    eq(chartOfAccounts.isActive, true),
  )).limit(1);
  if (!bankAsset) throw new ApiError(422, 'INVALID_BANK_ASSET_ACCOUNT', 'Compte d’actif bancaire introuvable ou inactif.');
  const expectedType = input.kind === 'fee' ? 'expense' : 'revenue';
  const [offset] = await db.select({ id: chartOfAccounts.id, accountType: chartOfAccounts.accountType }).from(chartOfAccounts).where(and(
    eq(chartOfAccounts.tenantId, principal.tenantId),
    eq(chartOfAccounts.id, input.offsetAccountId),
    eq(chartOfAccounts.isActive, true),
  )).limit(1);
  if (!offset) throw new ApiError(422, 'INVALID_OFFSET_ACCOUNT', 'Compte de contrepartie introuvable ou inactif.');
  if (offset.accountType !== expectedType) {
    throw new ApiError(422, 'INVALID_OFFSET_ACCOUNT_TYPE', input.kind === 'fee'
      ? 'Les frais bancaires doivent être imputés sur un compte de charge.'
      : 'Les intérêts doivent être crédités sur un compte de produit.');
  }

  if (moneyToCents(input.amount) <= BigInt(0)) throw new ApiError(422, 'INVALID_AMOUNT', 'Le montant doit être positif.');
  const amount = input.amount;
  const fee = input.kind === 'fee';
  const result = await postAccountingVoucher({
    tenantId: principal.tenantId,
    actorId: principal.userId,
    entryDate: input.entryDate,
    description: input.description,
    sourceModule: 'bank_reconciliation',
    sourceDocumentId: `${reconciliationId}:${input.kind}`,
    sourceVersion: 1,
    idempotencyKey: input.idempotencyKey,
    journalCode: input.journalCode,
    voucherTypeCode: input.voucherTypeCode,
    lines: fee
      ? [
          { accountId: input.offsetAccountId, debitAmount: amount, creditAmount: '0', memo: input.description },
          { accountId: input.bankAssetAccountId, debitAmount: '0', creditAmount: amount, memo: input.description },
        ]
      : [
          { accountId: input.bankAssetAccountId, debitAmount: amount, creditAmount: '0', memo: input.description },
          { accountId: input.offsetAccountId, debitAmount: '0', creditAmount: amount, memo: input.description },
        ],
  });
  await db.insert(accountingReconciliationEvents).values({
    tenantId: principal.tenantId,
    reconciliationId,
    eventType: fee ? 'fee_posted' : 'interest_posted',
    actorId: principal.userId,
    reason: input.description,
    metadata: { journalEntryId: result.entry.id, entryNumber: result.entry.entryNumber, amount },
  });
  return { eventType: fee ? 'fee_posted' : 'interest_posted', journalEntryId: result.entry.id, entryNumber: result.entry.entryNumber, idempotent: result.idempotent };
}

// Signed close: every statement line must be fully matched; the reconciled
// balance must equal the statement balance unless an explicit variance reason is
// provided (recorded in the immutable 'closed' event). Idempotent for an
// already-completed reconciliation. After close, the DB triggers make every
// statement artifact immutable.
export async function closeReconciliation(
  principal: ReconciliationPrincipal,
  reconciliationId: string,
  varianceReason?: string,
): Promise<{ reconciliation: typeof bankReconciliations.$inferSelect; alreadyClosed: boolean }> {
  return db.transaction(async (tx) => {
    const [reconciliation] = await tx.select().from(bankReconciliations).where(and(
      eq(bankReconciliations.tenantId, principal.tenantId),
      eq(bankReconciliations.id, reconciliationId),
    )).for('update');
    if (!reconciliation) throw new ApiError(404, 'RECONCILIATION_NOT_FOUND', 'Rapprochement bancaire introuvable.');
    if (reconciliation.status === 'completed') return { reconciliation, alreadyClosed: true };

    const [unmatched] = await tx.select({ count: sql<number>`count(*)::int` }).from(accountingStatementLines).where(and(
      eq(accountingStatementLines.tenantId, principal.tenantId),
      eq(accountingStatementLines.reconciliationId, reconciliationId),
      inArray(accountingStatementLines.status, ['unmatched', 'partial']),
    ));
    if ((unmatched?.count ?? 0) > 0) {
      throw new ApiError(409, 'RECONCILIATION_UNMATCHED_LINES', 'Des lignes de relevé restent non rapprochées.');
    }

    const reconciledBalance = await recomputeReconciledBalance(tx, principal.tenantId, reconciliationId);
    const variance = signedCentsToBigInt(reconciledBalance) - moneyToCents(reconciliation.statementBalance);
    if (variance !== BigInt(0) && !varianceReason?.trim()) {
      throw new ApiError(409, 'RECONCILIATION_VARIANCE', 'Le solde rapproché diffère du solde du relevé. Fournissez un motif d’écart.');
    }

    const [updated] = await tx.update(bankReconciliations).set({
      status: 'completed',
      reconciledBalance,
      reconciledById: principal.userId,
      reconciledAt: new Date().toISOString(),
    }).where(and(
      eq(bankReconciliations.tenantId, principal.tenantId),
      eq(bankReconciliations.id, reconciliationId),
      eq(bankReconciliations.status, 'draft'),
    )).returning();
    if (!updated) throw new ApiError(409, 'RECONCILIATION_CLOSE_RACE', 'Le rapprochement a changé pendant la clôture.');

    await tx.insert(accountingReconciliationEvents).values({
      tenantId: principal.tenantId,
      reconciliationId,
      eventType: 'closed',
      actorId: principal.userId,
      reason: varianceReason?.trim() || 'Solde équilibré',
      metadata: { variance: centsToMoney(variance), reconciledBalance },
    });
    return { reconciliation: updated, alreadyClosed: false };
  });
}
