import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project directory. Without this, Next.js's
  // workspace-root auto-detection walks up from cwd and picks up a stray
  // package-lock.json/package.json that live at C:\Users\oussama (outside
  // this repo entirely, unrelated to this project). On this OneDrive path
  // that misdetected root also contains a CJK directory segment
  // (雪玲团队), which crashes Turbopack's Rust path-slicing with
  // "start byte index N is not a char boundary" during `next build` -
  // reproduced verbatim without this option, fixed verbatim with it.
  // Verified 2026-08-13: online-exam-addon-cleanup pass, needed to satisfy
  // this repo's standing "npx next build must exit 0" rule (CLAUDE.md #2),
  // unrelated to that pass's actual code changes.
  turbopack: {
    root: path.join(__dirname),
  },
  output: 'standalone', // Required by the Dockerfile runner stage
  // pdfkit resolves its built-in font metrics (.afm files) via __dirname at
  // runtime. Turbopack's server bundling rewrites __dirname to a virtual
  // build-time root, which breaks that lookup (ENOENT at a nonexistent
  // /ROOT/... path) even when the real files are present on disk.
  // serverExternalPackages tells Next.js to require() pdfkit natively
  // instead of bundling it, preserving its real filesystem resolution.
  // future-implementation/advanced-reporting remediation, section-10
  // (found via live verification - neither tsc nor a dev-mode run surfaces
  // this, since dev mode doesn't bundle server routes through Turbopack the
  // same way the standalone production build does).
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/addons/reporting/**': ['./node_modules/pdfkit/js/data/**'],
  },
  devIndicators: {
    position: 'bottom-right',
  },
  // Type-checking is verified separately (tsc --noEmit / host `next build`) and
  // skipped inside the Docker image build to keep peak memory inside BuildKit
  // within Docker Desktop's VM. Env-gated so host/CI builds still typecheck.
  typescript: { ignoreBuildErrors: process.env.NEXT_IGNORE_TYPES === '1' },
  // Caps the worker pool used for "Collecting page data" (~280 routes) to 2
  // instead of auto-detecting all cores - that phase pegging every core at
  // 100% for minutes is what's been driving Docker Desktop's BuildKit builds
  // to crash and, worse, causing thermal shutdowns on the build machine.
  // Slower build, much lower peak heat/CPU draw.
  experimental: { cpus: 2 },
  poweredByHeader: false,
  reactStrictMode: true,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    },
  ],
};

export default nextConfig;
