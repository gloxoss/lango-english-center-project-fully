# Section 01: Foundation, Core Utilities, Locales & App Providers

## Overview
Establishes the Next.js 16 App Router foundation adhering to `/nextjs-app-structure`: environment validation (`src/libs/env/server.ts`, `src/libs/env/client.ts`), composed providers (`src/providers/index.tsx`), locale configuration (`src/libs/i18n.ts`), Tailwind CSS v4 design tokens (`src/app/globals.css`), and global TypeScript types (`src/types/global.d.ts`).

## Risk: `green` — Standard Next.js foundation

## Tasks

<task type="auto" id="01-01">
  <name>Create Typed Environment Configuration</name>
  <files>src/libs/env/server.ts, src/libs/env/client.ts</files>
  <action>
    Create server-only and client-side type-safe environment variable helpers using Zod validation. Ensure DATABASE_URL, BETTER_AUTH_SECRET, and NEXT_PUBLIC_APP_URL are typed and validated.
  </action>
  <verify>Import env helpers without compilation errors</verify>
  <done>Server and client environment helpers created</done>
</task>

<task type="auto" id="01-02">
  <name>Create Trilingual Locales JSON files</name>
  <files>locales/fr.json, locales/ar.json, locales/en.json</files>
  <action>
    Create complete dictionary translations for French, Arabic (RTL), and English covering common UI terms, navigation items, role badges, and status labels.
  </action>
  <verify>All 3 locale files parse valid JSON</verify>
  <done>Locales directory populated with FR, AR, and EN dictionaries</done>
</task>

<task type="auto" id="01-03">
  <name>Configure Tailwind CSS v4 Globals & Theme Tokens</name>
  <files>src/app/globals.css</files>
  <action>
    Define Tailwind CSS v4 `@theme` tokens in `src/app/globals.css` including brand color tokens (primary, secondary, surface, border, status colors) and RTL support rules.
  </action>
  <verify>Build CSS compiles without Tailwind errors</verify>
  <done>Tailwind v4 theme tokens configured</done>
</task>

<task type="auto" id="01-04">
  <name>Create Composed Application Providers</name>
  <files>src/providers/index.tsx, src/providers/theme-provider.tsx, src/providers/toast-provider.tsx</files>
  <action>
    Create composed Provider tree wrapping application context (NextIntlClientProvider, Sonner Toast Provider, Theme Provider).
  </action>
  <verify>Import Providers wrapper inside root layout</verify>
  <done>Composed Providers component ready</done>
</task>

<task type="auto" id="01-05">
  <name>Create Shared UI Primitives</name>
  <files>src/components/ui/button.tsx, src/components/ui/card.tsx, src/components/ui/badge.tsx, src/components/ui/input.tsx, src/components/ui/table.tsx</files>
  <action>
    Build accessible, reusable UI component primitives styled with Tailwind CSS v4.
  </action>
  <verify>Render components in a test page without errors</verify>
  <done>Core UI component primitives created</done>
</task>
