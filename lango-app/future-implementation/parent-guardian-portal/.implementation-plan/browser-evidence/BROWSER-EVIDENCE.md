# Parent Portal — Browser Acceptance Evidence (release steps 14–17)

**Date:** 2026-08-09
**Driver:** `scripts/browser-parent-portal.mjs` (Playwright library, real headless Chromium, live dev server `:3002`, PostgreSQL `schoolos-db`)
**Result:** **112 passed / 0 failed** — `BATTERY_EXIT=0`
**Fixture:** parent `prn-prn-parent-a@placeholder.local` (PARENT-A), tenant Atlas, linked child PRN-CHILD-A.

The battery is not a human manual pass — it is a scripted equivalent that drives the
live app in real Chromium and asserts the exact acceptance criteria in
`MANUAL-TESTING.md` §3.3 (FR + Arabic/RTL) and §3.4 (mobile, keyboard WCAG 2.2 AA,
degraded network). A human can re-run the same journey by following the linked doc;
the screenshots below record each state.

The battery self-cleans the two UI mutations it creates (attendance excuse,
document request) and the consent toggle it flips, so the DB is returned to its
pre-run state (release row 18).

---

## AUTH

Session established via the same API sign-in the verify battery uses (`Origin`
spoofed to `:3000` because the live dev server runs on `:3002` but Better Auth is
configured for `:3000`). Cookies injected into the browser context via
storageState. The login UI itself is not under test here — the portal pages are.

- PASS `auth → session cookies captured`

## Pass A — FR golden path (every page 200 + heading + no pageerror + no overflow)

Run against all 6 parent pages: home, attendance, finance, communication, requests, settings.
Each page asserted: HTTP 200, h1 rendered, zero `pageerror`, horizontal scroll diff ≤ 1px.

- PASS × 24 (6 pages × 4 checks)

## Pass B — FR content + UI mutations

- home → active-child banner + 6 widget cards, no pageerror — `fr-home.png`
- finance → outstanding **800 MAD**, invoices PRN-INV-0001/0002, badges `Payée` +
  `En attente`, payment 1200 MAD — `fr-finance.png`
- attendance → KPI `Taux de présence` + history table; excuse submission returns
  the success banner `Demande de justification soumise.` — `fr-attendance-excuse.png`
- communication → class-A + all-parents announcements, `Créneaux de rendez-vous parents` section
- requests → `Acte de naissance` + `Bulletin` documents; submission returns
  `Demande soumise avec succès.` and the new request is listed — `fr-requests-submitted.png`
- settings → 5 consent toggles are real `<input>`s; flipping the phone-consent
  toggle persists (`Préférence enregistrée.`) — `fr-settings-consent.png`

PASS × 25

## Pass C — Arabic / RTL

Same 6 pages under `locale: 'ar'` (`/ar/dashboard/parent/*`). Each page additionally
asserted: `dir="rtl"`, `lang="ar"`, and Cairo font on the h1.

- PASS × 42 (6 pages × 7 checks)

## Pass D — Mobile viewport (375×812, `isMobile` + `hasTouch`)

- home → no page horizontal scroll; child-switcher dropdown stays fully inside the
  375px viewport — `mobile-switcher-open.png`
- finance → KPI cards stacked single column; no page horizontal scroll; the
  invoices table scrolls inside its own `.overflow-x-auto` container — `mobile-finance.png`

The mobile shell was the one real app bug this pass surfaced (see *Shared-file
footprint* below): the global dashboard shell's fixed 256px sidebar + 320px header
search overflowed every dashboard page at 375px, not just parent pages. Fixed with a
responsive drawer shell; a probe (`_probe-mobile.mjs`) verified drawer open (hamburger
→ `aside` at x=0 w=256, backdrop present) and close (tap on the exposed backdrop →
`aside` slides to `-start-64`), plus the switcher dropdown geometry `48..336px`.

- PASS × 5

## Pass E — Keyboard-only (WCAG 2.2 AA)

- settings → 5 consent toggles are real inputs (not divs); `Tab` reaches the phone
  consent toggle; `:focus-visible` applies; the toggle's pill shows a visible focus
  ring (peer-focus-visible ring) — `keyboard-settings-focus.png`
- home → `Tab` reaches the child switcher; `Enter` opens the listbox; `Tab` lands on
  the first option; `Enter` selects and closes (`aria-expanded` back to `false`)

- PASS × 8

## Pass F — Degraded network

- **Throttled** (CDP: 1500ms latency, 250 kbps): home widgets render after latency;
  finance data completes — no crash either time.
- **Offline** (CDP offline): the communication view is loaded online first, then the
  network is dropped and `Actualiser` is clicked; the fetch rejects and the shell
  renders the explicit `role="alert"` banner (`Impossible de se connecter au serveur.`)
  without a pageerror — `offline-error.png`.

> Why load online first: a full `page.goto` while offline hard-fails at the
> navigation itself (`net::ERR_INTERNET_DISCONNECTED`). The app's graceful
> degradation is a client-side data-fetch error, which requires the JS bundle to
> already be mounted — matching real-world "the app is open, the network drops."

- PASS × 6

---

## Shared-file footprint (this release added to the portal's files)

The mobile pass fixed an app-wide defect in the shared dashboard shell (not
parent-portal-specific) so that every dashboard page is responsive at 375px:

| File | Change |
|---|---|
| `src/components/shared/dashboard-shell.tsx` | **new** client shell: sidebar renders static on `lg+`, slide-in drawer on mobile (logical `start`/`-start-64`, RTL-aware), backdrop to close |
| `src/components/shared/sidebar-drawer-context.ts` | **new** client context bridging the server→client function-passing boundary (a server layout cannot pass a render-prop callback into a client shell) |
| `src/components/shared/header.tsx` | mobile hamburger (opens the drawer) + search/campus-switcher hidden below `lg` |
| `src/app/[locale]/(dashboard)/layout.tsx` | now renders `<DashboardShell>` (was a server-inline flex shell) |
| `src/components/parent/ChildContextSwitcher.tsx` | dropdown anchored `start-0 lg:end-0` (keeps the 288px listbox in-viewport on mobile) |
| `src/features/parent/ui/SettingsView.tsx` | consent pill gets a `peer-focus-visible` ring so the toggle has a visible keyboard focus indicator |

These are the only files beyond the parent-portal feature + parent route touched in
this release; they are merge-safe and additive (the drawer only activates below `lg`).

## Re-run

```bash
node scripts/browser-parent-portal.mjs
# expect: ==== RESULT: 112 passed, 0 failed ====
```
