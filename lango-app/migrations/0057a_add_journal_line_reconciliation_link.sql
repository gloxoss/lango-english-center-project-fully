ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "journal_entry_lines_account_id_fk";
--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD COLUMN "reconciliation_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."bank_reconciliations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;