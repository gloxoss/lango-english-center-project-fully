// Support-attachment security regression suite (AUD-SUPPORT-RECEPTION-01).
//
// The bug this exists to prevent: GET /api/support/upload served support
// attachments with NO authentication and `Cache-Control: public, max-age=31536000,
// immutable`. The global middleware matcher excludes /api entirely, so nothing
// else stood in front of it — any anonymous visitor who knew a fileKey could
// download another school's support evidence (screenshots, PDFs, videos), and
// every shared proxy was told to cache it for a year.
//
// Static checks over the API tree so a new unauthenticated file endpoint or a new
// `public` cache header on confidential content fails the build.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = path.resolve(process.cwd(), 'src/app/api');
const UPLOAD_ROUTE = path.join(API_ROOT, 'support/upload/route.ts');

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

// A file-serving route must resolve an authenticated context before it reads
// bytes. Modules wrap that differently (broadcastGuard, requireParentContext,
// requireLibrarySelfContext, ...), so accept any of them rather than demanding
// the raw requireRequestContext call.
const RESOLVES_CONTEXT = /requireRequestContext|require\w+Context|broadcastGuard/;

describe('Support attachment security', () => {
  it('authenticates every handler in the upload route', () => {
    const src = fs.readFileSync(UPLOAD_ROUTE, 'utf8');
    const handlers = (src.match(/export async function (GET|POST)/g) ?? []).length;
    expect(handlers).toBe(2);
    // Both POST and GET must resolve a session.
    expect((src.match(/requireRequestContext\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an unauthenticated download and scopes it to the caller', () => {
    const src = fs.readFileSync(UPLOAD_ROUTE, 'utf8');
    const getBody = src.split('export async function GET')[1] ?? '';
    expect(getBody).toContain('requireRequestContext(');
    expect(getBody).toContain('requireTenant(');
  });

  it('never marks support attachments as publicly cacheable', () => {
    const src = fs.readFileSync(UPLOAD_ROUTE, 'utf8');
    expect(src).not.toMatch(/Cache-Control['"]?\s*[:=]\s*['"]public/i);
    expect(src).not.toContain('max-age=31536000');
  });

  it('stores uploads under the owning tenant folder', () => {
    const src = fs.readFileSync(UPLOAD_ROUTE, 'utf8');
    expect(src).toMatch(/path\.resolve\(SUPPORT_UPLOADS_ROOT,\s*tenantId,\s*subfolder\)/);
  });

  it('keeps the path-traversal guard on downloads', () => {
    const src = fs.readFileSync(UPLOAD_ROUTE, 'utf8');
    expect(src).toContain('path.normalize(fileKey)');
    expect(src).toMatch(/startsWith\(SUPPORT_UPLOADS_ROOT \+ path\.sep\)/);
  });

  it('never serves files without resolving a caller first', () => {
    // Broad invariant across all of /api. `api/public/**` is the one intentional
    // exception: public site branding is served unauthenticated, and those routes
    // are scoped by tenant slug (verified in AUD-PUBLIC-01).
    const offenders = routeFiles(API_ROOT)
      .filter((f) => !rel(f).startsWith('src/app/api/public/'))
      .filter((f) => {
        const src = fs.readFileSync(f, 'utf8');
        return /createReadStream|readUploadedFile|readFile\(/.test(src) && !RESOLVES_CONTEXT.test(src);
      })
      .map(rel);

    expect(offenders).toEqual([]);
  });
});
