# ==============================================================================
# SCHOOL OS / LANGO APP - PRODUCTION DOCKERFILE
# Node.js 24 multi-stage build for Next.js 16 App Router
# Node 24 is required: package.json declares "engines": { "node": ">=24" }
# ==============================================================================

FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++

# Dependencies Stage
# .npmrc carries legacy-peer-deps=true, without which npm ci aborts on the
# react-day-picker / date-fns peer conflict. It must be copied before npm ci.
FROM base AS deps
COPY package.json package-lock.json* .npmrc ./
RUN npm ci

# One-shot migration image used by Compose/deployment jobs. Keeping migrations
# separate from app startup avoids concurrent schema changes across replicas.
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY migrations ./migrations
COPY src/models ./src/models
CMD ["./node_modules/.bin/drizzle-kit", "migrate"]

# Builder Stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# `public` is optional in Next.js, but the runner stage copies it unconditionally.
# Keep the image build valid for apps that do not currently ship static assets.
RUN mkdir -p public

# ponytail: build:next only, never `npm run build`. The `build` script is
# `run-s db:migrate build:next`, and drizzle-kit migrate needs a live database -
# there is none during an image build. Migrations run at deploy time instead.
# Next evaluates route modules while collecting build metadata. These sentinels
# exist only for that process; the runner requires real runtime environment values.
# CI verifies that neither sentinel is embedded in the standalone output.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET=build-only-sentinel-secret-never-use-at-runtime \
    BETTER_AUTH_URL=http://build.invalid \
    npm run build:next

# Production Runner Stage
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# .next/standalone only exists because next.config.ts sets output: 'standalone'
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

# User-uploaded files (student photos) live here, mounted as a named volume
# in docker-compose.yml - must exist and be writable by `nextjs` before the
# volume is attached, or writes at runtime fail with EACCES.
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
