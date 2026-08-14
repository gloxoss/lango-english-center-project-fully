-- Office Accounting WA2: chart-of-accounts mutation guard.
--
-- Baseline discovery (verified against the live DB, 2026-08-09): migration 0039
-- ALREADY enforces the core ledger invariants at the DB layer for ALL sources:
--   * exactly one positive side per line  -> row CHECK journal_line_one_side_positive
--   * >=2 lines + exact debit=credit at COMMIT -> DEFERRABLE constraint triggers
--     journal_header_balance_trigger / journal_lines_balance_trigger
--   * posted entry/line immutability (UPDATE/DELETE blocked) -> BEFORE triggers
--     prevent_journal_entry_delete / prevent_journal_line_mutation
--   * entry date inside an open fiscal period, same-tenant active-account scope ->
--     enforce_journal_header_integrity / enforce_journal_line_scope
-- 0085/0089 add atomic numbering, payload-bound idempotency, source versioning,
-- one-sided-line CHECKs on accounting source documents, and immutable voucher
-- events. A global deferred balance trigger was therefore already present; an
-- earlier draft of this migration duplicated it with a source-scoped trigger.
-- That draft's premise (that legacy finance/payroll rows could post unbalanced or
-- zero-amount lines) is false: 0039's CHECK + deferred triggers reject those for
-- every source, so no carve-out is needed and none is granted.
--
-- This migration therefore adds ONLY what was actually missing:
--
--   (e) chart-of-accounts mutation guard:
--       - an account that has posted lines or active children cannot be DELETEd;
--       - its account_type cannot change once it has posted lines;
--       - it can only be archived (is_active=false) once it has no active children
--         and a zero net balance.
--
-- Pre-existing issue surfaced by the audit, NOT changed here (payroll tables and
-- workflow are off-limits): the payroll lock route (source_module 'payroll') posts
-- 6111 -> 4432/4441/4442 without an IR-payable line, so when IR>0 the journal is
-- unbalanced by the IR amount and 0039's COMMIT balance trigger ALREADY rejects it.
-- Resolving that belongs to the WA6 versioned-posting-contract handoff.
-- Drops from the superseded draft of this migration; idempotent.
-- Triggers must be dropped before their functions (dependency order).
DROP TRIGGER IF EXISTS journal_entry_lines_integrity_trigger ON journal_entry_lines;
DROP TRIGGER IF EXISTS journal_entries_immutable_trigger ON journal_entries;
DROP TRIGGER IF EXISTS journal_entry_lines_immutable_trigger ON journal_entry_lines;
DROP FUNCTION IF EXISTS enforce_accounting_entry_integrity();
DROP FUNCTION IF EXISTS prevent_journal_entry_mutation();
DROP FUNCTION IF EXISTS prevent_journal_line_mutation();

-- (e): chart of accounts mutation guard (delete / type-change / archive).
CREATE OR REPLACE FUNCTION guard_chart_of_accounts_mutation()
RETURNS trigger AS $$
DECLARE
  posted_lines bigint;
  active_children bigint;
  net_balance numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT count(*) INTO posted_lines FROM journal_entry_lines WHERE account_id = OLD.id;
    SELECT count(*) INTO active_children FROM chart_of_accounts WHERE parent_account_id = OLD.id;
    IF posted_lines > 0 OR active_children > 0 THEN
      RAISE EXCEPTION 'account % is in use and cannot be deleted', OLD.code USING ERRCODE='55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.account_type IS DISTINCT FROM NEW.account_type THEN
    SELECT count(*) INTO posted_lines FROM journal_entry_lines WHERE account_id = OLD.id;
    IF posted_lines > 0 THEN
      RAISE EXCEPTION 'cannot change the type of account % that has posted lines', OLD.code USING ERRCODE='55000';
    END IF;
  END IF;

  IF OLD.is_active AND NOT NEW.is_active THEN
    SELECT count(*) INTO active_children FROM chart_of_accounts WHERE parent_account_id = OLD.id AND is_active;
    IF active_children > 0 THEN
      RAISE EXCEPTION 'cannot archive account % while it has active children', OLD.code USING ERRCODE='55000';
    END IF;
    SELECT count(*) INTO posted_lines FROM journal_entry_lines WHERE account_id = OLD.id;
    IF posted_lines > 0 THEN
      SELECT coalesce(sum(debit_amount - credit_amount), 0) INTO net_balance
        FROM journal_entry_lines WHERE account_id = OLD.id;
      IF net_balance <> 0 THEN
        RAISE EXCEPTION 'cannot archive account % with a non-zero balance', OLD.code USING ERRCODE='55000';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS chart_of_accounts_mutation_guard_trigger ON chart_of_accounts;
CREATE TRIGGER chart_of_accounts_mutation_guard_trigger
BEFORE UPDATE OR DELETE ON chart_of_accounts
FOR EACH ROW EXECUTE FUNCTION guard_chart_of_accounts_mutation();
