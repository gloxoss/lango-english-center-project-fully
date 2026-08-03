import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';

describe('Exact money helpers', () => {
  it('adds decimal values without IEEE-754 rounding', () => {
    expect(centsToMoney(moneyToCents('0.10') + moneyToCents('0.20'))).toBe('0.30');
  });

  it('rejects excess precision and negative amounts', () => {
    expect(() => moneyToCents('1.001')).toThrow();
    expect(() => moneyToCents('-1.00')).toThrow();
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Finance ledger PostgreSQL invariants', () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const tenantId = crypto.randomUUID();
  const accountA = crypto.randomUUID();
  const accountB = crypto.randomUUID();

  beforeAll(async () => {
    await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [tenantId, 'Ledger Test', `ledger-${tenantId}`]);
    await pool.query(`INSERT INTO fiscal_periods (tenant_id, name, start_date, end_date) VALUES ($1, 'FY', '2026-01-01', '2026-12-31')`, [tenantId]);
    await pool.query(`INSERT INTO chart_of_accounts (id, tenant_id, code, name, account_type) VALUES ($1,$3,'1000','Cash','asset'), ($2,$3,'1100','Receivable','asset')`, [accountA, accountB, tenantId]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM chart_of_accounts WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM fiscal_periods WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it('stores the active money path as numeric, not floating point', async () => {
    const result = await pool.query<{ table_name: string; data_type: string }>(`
      SELECT table_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND column_name='amount'
        AND table_name IN ('expenses','fee_components','fee_structures','invoice_items','invoices','payments')
    `);

    expect(result.rows).toHaveLength(6);
    expect(result.rows.every(row => row.data_type === 'numeric')).toBe(true);
  });

  it('accepts a balanced journal and rejects an unbalanced journal at commit', async () => {
    const balanced = await pool.connect();
    try {
      await balanced.query('BEGIN');
      const entry = await balanced.query<{ id: string }>(`INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description) VALUES ($1,$2,'2026-03-01','balanced') RETURNING id`, [tenantId, `JE-B-${crypto.randomUUID()}`]);
      await balanced.query(`INSERT INTO journal_entry_lines (tenant_id,journal_entry_id,account_id,debit_amount,credit_amount) VALUES ($1,$2,$3,10.10,0),($1,$2,$4,0,10.10)`, [tenantId, entry.rows[0]!.id, accountA, accountB]);

      await expect(balanced.query('SET CONSTRAINTS ALL IMMEDIATE')).resolves.toBeDefined();
    } finally {
      await balanced.query('ROLLBACK');
      balanced.release();
    }

    const unbalanced = await pool.connect();
    try {
      await unbalanced.query('BEGIN');
      const entry = await unbalanced.query<{ id: string }>(`INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description) VALUES ($1,$2,'2026-03-01','unbalanced') RETURNING id`, [tenantId, `JE-U-${crypto.randomUUID()}`]);
      await unbalanced.query(`INSERT INTO journal_entry_lines (tenant_id,journal_entry_id,account_id,debit_amount,credit_amount) VALUES ($1,$2,$3,10.00,0),($1,$2,$4,0,9.99)`, [tenantId, entry.rows[0]!.id, accountA, accountB]);

      await expect(unbalanced.query('SET CONSTRAINTS ALL IMMEDIATE')).rejects.toMatchObject({ code: '23514' });
    } finally {
      await unbalanced.query('ROLLBACK');
      unbalanced.release();
    }
  });

  it('rejects cross-tenant account references', async () => {
    const otherTenant = crypto.randomUUID();
    const otherAccount = crypto.randomUUID();
    await pool.query(`INSERT INTO tenants (id,name,slug) VALUES ($1,'Other Ledger',$2)`, [otherTenant, `other-${otherTenant}`]);
    await pool.query(`INSERT INTO chart_of_accounts (id,tenant_id,code,name,account_type) VALUES ($1,$2,'9999','Other','asset')`, [otherAccount, otherTenant]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const entry = await client.query<{ id: string }>(`INSERT INTO journal_entries (tenant_id,entry_number,entry_date,description) VALUES ($1,$2,'2026-03-01','scope') RETURNING id`, [tenantId, `JE-X-${crypto.randomUUID()}`]);

      await expect(client.query(`INSERT INTO journal_entry_lines (tenant_id,journal_entry_id,account_id,debit_amount,credit_amount) VALUES ($1,$2,$3,1,0)`, [tenantId, entry.rows[0]!.id, otherAccount])).rejects.toMatchObject({ code: '23514' });
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.query(`DELETE FROM chart_of_accounts WHERE tenant_id=$1`, [otherTenant]);
      await pool.query(`DELETE FROM tenants WHERE id=$1`, [otherTenant]);
    }
  });
});
