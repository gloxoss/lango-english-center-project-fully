import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/models/Schema';

// ponytail: one pool per process, cached on globalThis so Next's dev HMR does not
// open a new one on every reload until Postgres refuses connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool
  = globalForDb.pool
    ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
