# Parent / Guardian Portal — Manual Testing

> Live evidence for the Parent/Guardian Portal (P1–P11). Executed 2026-08-09
> against the dev server on `:3002`, Postgres `schoolos-db`, tenants Atlas
> `ca40c88e-339c-4fea-b5c4-51d5c9cc0239` and SchoolOS `f62f31eb-1fc8-4102-9145-a5ce0bca989b`.

## 0. Fixture set (seed, idempotent)

`npx tsx scripts/seed-parent-fixtures.ts` creates the PRN- fixture set in Atlas:

| Fixture | Value | Used by |
|---|---|---|
| PARENT-A (`prn-prn-parent-a@placeholder.local`) | full rights on CHILD-A; attendance:false on ATD; medical:false on MED; communication:false on COM | S3–S8, S24–S40 |
| PARENT-B | co-guardian on CHILD-A (finance:false), exclusive on CHILD-D | S12–S13 |
| PARENT-C (SchoolOS) | owns CHILD-SCHOOLOS | S14 cross-tenant |
| PARENT-UNLINKED | unbound guardian, links via one-time token | S18–S22 |
| CHILD-A | class-section pinned, invoice PRN-INV-0001 (paid 1200) + PRN-INV-0002 (pending 800) → outstanding **800**; 2 documents; 1 sms | S24, S26, S28–S29, S31, S33–S34, S36, S38 |
| CHILD-B | finance:false, section-pinned to class B | S5, S28, S30, S32 |
| PRN-TEACHER | author of 3 announcements (class A / class B / all-parents) + 1 open meeting slot | S31–S32, S34 |

## 1. Automated live battery — results

`node scripts/verify-parent-security.mjs` → **40/40 PASS** (two consecutive runs;
run 2 proves idempotency after the account-link state reset).

| # | Check | Result |
|---|---|---|
| S1 | anonymous 401 on /me + child summary | PASS |
| S2 | non-parent role 403 | PASS |
| S3 | /me lists only effective children (A,B,CUST,FIN,ATD,MED,COM) | PASS |
| S4 | PARENT-A → A: full rights + primary | PASS |
| S5 | PARENT-A → B: finance:false redacted projection | PASS |
| S6–S10 | revoked/expired/future/suspended/cross-guardian → uniform 404 | PASS |
| S11 | unknown relationship id → 404 (no existence oracle) | PASS |
| S12–S13 | co-guardian rights differ; exclusive child full rights | PASS |
| S14 | cross-tenant both directions → 404 | PASS |
| S16 | link/start by parent → 403 | PASS |
| S17 | link/start already-bound guardian → 409 | PASS |
| S18–S22 | account-linking cycle: token issue, cross-tenant 403, garbage 422, redeem binds, single-use + rebind 409 | PASS |
| S23 | live revocation drops /me entry + 404 without re-login | PASS |
| S24 | attendance GET shape (summary/recent/today) | PASS |
| S25 | attendance right withheld (ATD) → 403 | PASS |
| S26 | excuse POST → 201 pending + audit | PASS |
| S27 | excuse POST on cross-guardian child → uniform 404 | PASS |
| S28 | household finance excludes B/FIN; A outstanding 800; total 800 | PASS |
| S29 | child finance invoices PRN-INV-0001/0002; outstanding 800 | PASS |
| S30 | child finance withheld (B) → 403 | PASS |
| S31 | announcements class-scoped (A + all-parents, no B leak) | PASS |
| S32 | announcements B: no class-A leak | PASS |
| S33 | messages scoped to own children | PASS |
| S34 | meetings: open PRN-TEACHER slot visible | PASS |
| S35 | meetings right withheld (COM) → 403 | PASS |
| S36 | documents A: birth_certificate + bulletin | PASS |
| S37 | documents right withheld (MED) → 403 | PASS |
| S38 | requests GET 200 + POST 201 pending | PASS |
| S39 | preferences GET/PATCH consent persists; bad key 400; bad value 400 | PASS |
| S40 | transport/hostel addon gate → 403 ADDON_NOT_ACTIVATED (off on Atlas) | PASS |

## 2. Live page smoke (authenticated PARENT-A session)

`/fr/dashboard/parent/` → 308 (trailing-slash redirect, normal); the following
return **200** and server-render without error:

- `/fr/dashboard/parent/attendance`
- `/fr/dashboard/parent/finance`
- `/fr/dashboard/parent/communication`
- `/fr/dashboard/parent/requests`
- `/fr/dashboard/parent/settings`

Anonymous requests to any of these redirect to `/fr/login?redirectTo=…`
(`requireServerPage` role guard).

## 3. Manual browser checklist (pending — requires a human with a browser)

### 3.1 Golden path — parent self-service (PARENT-A / `ParentAdmin123!`)
1. Sign in as PARENT-A; land on **Espace Parent** dashboard with the child
   switcher showing CHILD-A/B/CUST/FIN/ATD/MED/COM.
2. Switch to CHILD-A → **Présence**: summary cards render (rate/sessions/etc.),
   history table renders, submit an excuse for a past date → success banner.
3. **Finance**: outstanding shows 800 MAD, invoices PRN-INV-0001 (payée) +
   PRN-INV-0002 (en attente), payment 1200 MAD listed.
4. **Communication**: class-A + all-parents announcements; messages for CHILD-A;
   the PRN-TEACHER open meeting slot listed.
5. **Demandes & documents**: submit a `document_request` → appears in list as
   "En attente"; documents panel shows acte de naissance + bulletin.
6. **Paramètres**: toggle `contactConsent` on → "Préférence enregistrée"; a
   non-boolean consent (via API) is rejected 400.

### 3.2 Negative paths
1. Switch to CHILD-B → **Finance** shows 403 state (right withheld), no data leak.
2. Directly open `/fr/dashboard/parent/requests` for a non-owned child id via URL
   → uniform 404 / redirect, never a distinguishable error.
3. Anonymous / non-parent role → redirected to login or 403.

### 3.3 FR + Arabic/RTL
- Load `/ar/dashboard/parent/…` — the layout flips to `dir="rtl"`, Cairo font
  applies, and the pages render without horizontal overflow on the widgets.

### 3.4 Mobile + keyboard (WCAG 2.2 AA)
- 375px viewport: KPI cards collapse to one column; tables scroll horizontally;
  switcher dropdown stays on-screen.
- Keyboard-only: tab through switcher, refresh, form fields, submit buttons;
  focus rings visible; toggles are real checkboxes (not divs).

## 4. Idempotency notes
- Re-running `verify-parent-security.mjs` is safe: the account-link section
  resets the unlinked guardian binding first; S23 restores the revoked link;
  the excuse/request/consent rows are cleaned up by the script.
- Migration `0105_parent_requests` and `0088_parent_guardian_portal` re-run as
  no-ops.
