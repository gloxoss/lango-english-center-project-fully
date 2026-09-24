import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

// W9: without this plugin, next-intl's build alias for the request config
// (src/i18n/request.ts) never exists, so any server render touching
// NextIntlClientProvider throws "Couldn't find next-intl config file" —
// verified 2026-08-27: /fr/login, /ar/login, /en/login all 500ed with the
// request config present but the plugin absent.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Audit builds go somewhere of their own. scripts/audit-ui-browser.mjs serves
  // a production build with `next start`, and it must own that directory: a
  // concurrent `next build` rewrites the chunk names under a running server, so
  // every script the served HTML references starts 404ing and the audit reports
  // a broken page that is really a half-written build directory. Verified
  // 2026-09-11 — that is exactly how it failed the first time. Default is
  // unchanged; only the audit sets NEXT_DIST_DIR.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
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
  // takumi-pdf ships its renderer as a WebAssembly module loaded through a
  // bundler-specific entry. Turbopack cannot resolve that loader
  // ("Can't resolve './takumi_pdf_wasm_bg.js'"), and the failure is not confined
  // to the exporter: it breaks the dev server's module graph, so unrelated pages
  // start returning 500 — the login page included.
  // Externalising it makes Next require() the package natively and load the .wasm
  // from disk itself, which is what its Node entry already does.
  //
  // This replaced the same treatment for pdfkit, which needed it for a different
  // reason: pdfkit resolved its built-in .afm font metrics via __dirname, and
  // Turbopack rewrote __dirname to a virtual build-time root. pdfkit is gone now
  // (takumi renders those reports, and unlike Helvetica it can render Arabic).
  serverExternalPackages: ['takumi-pdf', '@takumi-rs/helpers'],
  outputFileTracingIncludes: {
    // The .wasm binary and the fonts the exporter embeds must ship with the
    // standalone build; neither is reachable by static import analysis.
    '/api/addons/reporting/**': ['./node_modules/takumi-pdf/pkg/**', './public/fonts/**'],
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
  redirects: async () => [
    {
      source: '/:locale/dashboard/communication/sms-reminders',
      destination: '/:locale/dashboard/communication/reminders',
      permanent: true,
    },
    {
      source: '/dashboard/communication/sms-reminders',
      destination: '/dashboard/communication/reminders',
      permanent: true,
    },
  ],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        zlib: false,
        'node:zlib': false,
        fs: false,
        'fs/promises': false,
        'node:fs/promises': false,
        module: false,
        'node:module': false,
        url: false,
        'node:url': false,
        stream: false,
        'node:stream': false,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
