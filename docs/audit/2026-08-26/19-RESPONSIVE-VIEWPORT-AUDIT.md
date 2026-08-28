# SchoolOS — Responsive Viewport Audit (Task T19 / Wave 3 W10)

**Date:** 2026-08-28
**Method:** Real Playwright (Chromium) captures against the running app on the seeded Atlas tenant. Measured `document.body.scrollWidth - window.innerWidth` (horizontal overflow) per page per viewport, plus full-page screenshots. Evidence: `assets/*.png` beside this document; the measurement spec ran with `--workers=1` on a cold server.
**Author:** Wave 3 agent. This document **supersedes** `lango-app/docs/audit/2026-08-26/19-RESPONSIVE-VERIFICATION.md`, whose claims could not have been produced by real execution (see the banner added to that file).

---

## 1. Scope — and what this audit is NOT

**Audited (real evidence, this session):**

| Surface | Why prioritised | Viewports |
|---|---|---|
| Teacher attendance marking (`/fr/dashboard/attendance`) | The highest-frequency real mobile flow: a teacher taking roll call on a phone | 320 / 375 / 768 / 1440 |
| Student directory (`/fr/dashboard/students`) | Data-dense table — the hardest layout to keep inside a phone screen | 320 / 375 / 768 / 1440 |
| Login page FR (`/fr/login`) and AR (`/ar/login`) | Public entry point; also feeds the RTL audit (doc 17) | 375 |

**NOT audited:** the remaining ~340 pages, modals in isolation, print styles, and real devices (this is Chromium emulation only). Partial by design; extend the harness per module as W9 extraction proceeds.

## 2. Measured horizontal overflow

`body.scrollWidth − window.innerWidth`, in px. Anything > ~2px would mean a sideways-scrollable page on a phone.

| Viewport | Attendance | Student directory |
|---|---|---|
| 320px | **0px** | **0px** |
| 375px | **0px** | **0px** |
| 768px | **0px** | **0px** |
| 1440px | **0px** | **0px** |

No horizontal overflow at any audited viewport on either surface.

## 3. Touch targets (teacher attendance, 375px)

The regression spec `tests/mobile-attendance.e2e.ts` measures the status-toggle buttons (present/absent/late/excused — the only buttons inside the marking-grid table cells) and asserts **height ≥ 30px**. Passing as of 2026-08-28.

Honest note: 30px passes WCAG 2.5.8 (24px minimum) but is **below** the 44px Apple HIG / Material ideal. The spec name says ">= 44px" while asserting 30 — tightened naming is left to the owner; raising the UI to 44px is a product change, not an audit item.

## 4. Evidence index (this directory)

| File | What it shows |
|---|---|
| `assets/attendance-320.png` / `-375 / -768 / -1440` | Attendance marking, full page, logged-in teacher |
| `assets/students-320.png` / `-375 / -768 / -1440` | Student directory, full page, logged-in admin |
| `assets/login-fr-375.png` | French login, 375px |
| `assets/login-ar-375-rtl.png` | Arabic login, 375px, `dir="rtl"` (asserted in the capture) |

## 5. How to reproduce

```bash
cd lango-app
docker start schoolos-db
npm run test:e2e            # includes mobile-attendance 375px regression spec
```

The capture harness itself was temporary (deleted after evidence collection); re-create from this document's method line if screenshots need refreshing.
