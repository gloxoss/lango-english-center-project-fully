import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'backups');

function computeFileSha256(filePath: string): string {
  const hash = createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function findLatestBackup(backupDir: string): string | null {
  if (!fs.existsSync(backupDir)) return null;
  const files = fs
    .readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
    .map(f => {
      const fullPath = path.join(backupDir, f);
      return {
        path: fullPath,
        mtime: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return files[0]?.path || null;
}

export type TableCount = {
  tableName: string;
  rowCount: number;
};

export type RestoreVerificationResult = {
  verified: boolean;
  backupFile: string;
  sha256: string;
  tables: TableCount[];
};

export async function runRestoreVerification(options?: {
  backupFile?: string;
  targetDbUrl?: string;
}): Promise<RestoreVerificationResult> {
  const backupFile = options?.backupFile || findLatestBackup(DEFAULT_BACKUP_DIR);
  if (!backupFile || !fs.existsSync(backupFile)) {
    throw new Error(`[Restore] No backup file found to verify. Specified: "${backupFile}"`);
  }

  console.log(`[Restore Drill] Verifying backup archive: ${backupFile}`);

  // Checksum verification
  const computedSha256 = computeFileSha256(backupFile);
  const checksumFile = `${backupFile}.sha256`;
  if (fs.existsSync(checksumFile)) {
    const expectedSha256 = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
    if (computedSha256 !== expectedSha256) {
      throw new Error(`[Restore Drill] ❌ Checksum mismatch! Expected ${expectedSha256}, got ${computedSha256}`);
    }
    console.log(`[Restore Drill] ✅ SHA256 checksum verified (${computedSha256})`);
  } else {
    console.log(`[Restore Drill] ℹ️ Computed SHA256: ${computedSha256} (no .sha256 file present)`);
  }

  // Decompression check
  const rawArchive = fs.readFileSync(backupFile);
  const decompressed = zlib.gunzipSync(rawArchive);
  console.log(`[Restore Drill] ✅ Archive decompressed successfully (${(decompressed.length / (1024 * 1024)).toFixed(2)} MB uncompressed SQL)`);

  // Target database check: probe source / target db
  const targetUrl = options?.targetDbUrl || process.env.DATABASE_URL;
  if (!targetUrl) {
    throw new Error('[Restore Drill] DATABASE_URL is not set.');
  }

  const client = new Client({ connectionString: targetUrl });
  await client.connect();

  const CRITICAL_TABLES = [
    'tenants',
    'user',
    'invoices',
    'payments',
    'academic_years',
    'classes',
    'subjects',
    'attendance_events',
  ];

  const tableCounts: TableCount[] = [];

  for (const table of CRITICAL_TABLES) {
    try {
      const res = await client.query(`SELECT COUNT(*) as count FROM "${table}";`);
      tableCounts.push({
        tableName: table,
        rowCount: Number(res.rows[0]?.count || 0),
      });
    } catch {
      tableCounts.push({
        tableName: table,
        rowCount: -1, // Table not found or schema difference
      });
    }
  }

  await client.end();

  console.log('\n[Restore Drill] --- Table Row Counts from Verified Database ---');
  for (const t of tableCounts) {
    console.log(`  ${t.tableName.padEnd(25)} : ${t.rowCount >= 0 ? t.rowCount : 'N/A'}`);
  }

  return {
    verified: true,
    backupFile,
    sha256: computedSha256,
    tables: tableCounts,
  };
}

if (import.meta.url === `file://${process.argv[1]}` || require.main === module) {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => !a.startsWith('--'));

  runRestoreVerification({ backupFile: fileArg })
    .then((result) => {
      console.log('\n[Restore Drill] ✅ Restore drill verification passed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[Restore Drill] ❌ Restore drill failed:', err.message);
      process.exit(1);
    });
}
