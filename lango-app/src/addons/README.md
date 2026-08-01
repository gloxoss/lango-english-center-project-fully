# Addons convention

Optional, not-core-to-running-a-school modules go here, one subfolder per
addon (`src/addons/<id>/`, mirroring the `model/data/ui` shape used under
`src/features/`), instead of being mixed into `src/features/`.

`registry.ts` lists what exists. **It does not gate anything yet** — that
was an explicit scope decision (see `AGENT-HANDOFF.md`, "Addon system"),
not an oversight. Every route and page still controls access purely through
the existing role/tenant checks (`requireRequestContext`,
`requireTenant`) like the rest of the app.

## When real gating is wanted later

Two different problems, pick based on which one actually applies:

- **Gate by plan tier** (same tenant, same deployment, features unlock per
  `tenants.planTier`): check `ADDONS` + the tenant's plan inside
  `requireRequestContext` or a thin wrapper around it. Small, server-side,
  builds directly on what already exists.
- **Distributed/sold product with a license key** (other operators
  self-hosting this codebase, need to stop them unlocking addons they
  didn't pay for even with source access): a materially bigger build
  (license validation, key issuance) — don't reach for this unless that's
  actually the business model.

## Existing core features are not being migrated here

Attendance, students, finance, academics, etc. stay in `src/features/` —
they're core to running a school, not optional add-ons. Only genuinely
optional modules (see `registry.ts` for current candidates, all not yet
built) belong under `src/addons/`.
