import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pruneOldBackups } from '../../../scripts/backup-db';

// W2: the retention policy (BACKUP_RETAIN_DAILY=7 + BACKUP_RETAIN_WEEKLY=4 = 11)
// had no test, so nothing proved it ever deleted a file. A retention policy that
// silently retains everything fills the disk and looks healthy while doing it.
// These assertions fail if pruning stops working in either direction.

const RETAIN_TOTAL = 11;
let dir: string;

function makeBackups(count: number): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-retention-'));
  for (let i = 0; i < count; i++) {
    const file = path.join(dir, `backup-2026-08-${String(i + 1).padStart(2, '0')}.sql.gz`);
    fs.writeFileSync(file, 'dump');
    fs.writeFileSync(`${file}.sha256`, 'checksum');
    // Newest first: index 0 is today, each later index one day older.
    const seconds = (Date.now() - i * 86_400_000) / 1000;
    fs.utimesSync(file, seconds, seconds);
  }
  return dir;
}

function countBackups(target: string): number {
  return fs.readdirSync(target).filter(f => f.endsWith('.sql.gz')).length;
}

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe('backup retention', () => {
  it('prunes backups beyond the retention window and keeps the newest', () => {
    const target = makeBackups(15);
    expect(countBackups(target)).toBe(15);

    const result = pruneOldBackups(target);

    expect(result.pruned).toBe(4);
    expect(result.retained).toBe(RETAIN_TOTAL);
    expect(countBackups(target)).toBe(RETAIN_TOTAL);

    // The survivors must be the newest ones, not an arbitrary 11.
    const remaining = fs.readdirSync(target).filter(f => f.endsWith('.sql.gz')).sort();
    expect(remaining).toContain('backup-2026-08-01.sql.gz'); // newest (mtime today)
    expect(remaining).not.toContain('backup-2026-08-15.sql.gz'); // oldest
  });

  it('deletes the .sha256 sidecar alongside each pruned dump', () => {
    const target = makeBackups(15);
    pruneOldBackups(target);
    expect(fs.existsSync(path.join(target, 'backup-2026-08-15.sql.gz.sha256'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'backup-2026-08-01.sql.gz.sha256'))).toBe(true);
  });

  it('keeps everything when under the retention limit', () => {
    const target = makeBackups(5);
    const result = pruneOldBackups(target);
    expect(result.pruned).toBe(0);
    expect(countBackups(target)).toBe(5);
  });

  it('is a no-op on a missing directory rather than throwing', () => {
    expect(pruneOldBackups(path.join(os.tmpdir(), 'does-not-exist-backup-dir'))).toEqual({
      retained: 0,
      pruned: 0,
    });
  });
});
