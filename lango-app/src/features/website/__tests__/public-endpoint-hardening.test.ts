// Public-endpoint hardening regression suite (AUD-PUBLIC-01).
//
// Every route under src/app/api/public is unauthenticated and reachable by
// anyone on the internet, so two properties have to hold and are easy to lose:
//
//   1. A rate limit must key on a NORMALIZED client IP. Keying on the raw
//      X-Forwarded-For header lets a client send a different value on every
//      request and get a fresh bucket each time, so the limit never trips.
//   2. Free-text fields on unauthenticated write endpoints must be BOUNDED, so
//      one request cannot park megabytes of text in the database.
//
// These are static checks on purpose: they cover every public route at once and
// fail loudly when a new one is added without the same protections.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC_API = path.resolve(process.cwd(), 'src/app/api/public');

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}
const rel = (p: string) => path.relative(process.cwd(), p).split(path.sep).join('/');

describe('Public endpoint hardening', () => {
  const files = routeFiles(PUBLIC_API);

  it('finds the public API surface to audit', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('normalizes X-Forwarded-For before using it as a rate-limit key', () => {
    // The bug: `request.headers.get('x-forwarded-for')` used verbatim as the
    // limiter key. Normalizing to one entry keeps the key stable.
    const offenders = files
      .filter((f) => {
        const src = fs.readFileSync(f, 'utf8');
        if (!src.includes('checkRateLimit')) return false;
        return /headers\.get\(['"]x-forwarded-for['"]\)\s*(\|\||\?\?)/.test(src);
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it('bounds free-text fields on the public inquiry submission', () => {
    const src = fs.readFileSync(
      path.join(PUBLIC_API, 'inquiries/[tenantSlug]/route.ts'),
      'utf8',
    );
    // Unbounded .optional() strings on a no-login write endpoint are a storage
    // and memory abuse vector.
    expect(/notes:\s*z\.string\(\)[^\n]*\.max\(\d+\)/.test(src)).toBe(true);
    expect(/phone:\s*z\.string\(\)[^\n]*\.max\(\d+\)/.test(src)).toBe(true);
  });

  it('rate-limits every public route that looks up a secret by token or code', () => {
    // Token/code lookups must carry a rate limit or they are brute-forceable.
    const needsLimit = files.filter((f) =>
      /token|verify/.test(f) && !/images|logo/.test(f),
    );
    const missing = needsLimit.filter((f) => !fs.readFileSync(f, 'utf8').includes('checkRateLimit')).map(rel);

    expect(missing).toEqual([]);
  });
});
