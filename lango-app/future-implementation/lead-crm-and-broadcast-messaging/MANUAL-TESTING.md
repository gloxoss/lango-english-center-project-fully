# Lead CRM & Broadcast Messaging — Manual Testing Guide

Complete human-facing acceptance logic for the **Lead CRM** and **Broadcast
Messaging** add-ons (Lango / SchoolOS, Next.js App Router, Drizzle + PostgreSQL).
This is the companion to the automated live scripts
`scripts/verify-lead-crm.mjs`, `scripts/verify-broadcast.mjs`,
`scripts/verify-lead-crm-addon-gate.mjs`, `scripts/verify-broadcast-addon-gate.mjs`,
`scripts/check-broadcast-pages.mjs`, and the unit suite under
`src/features/broadcast/services/__tests__/`.

**Security rule that applies to every step:** this environment uses the **test
provider** only. No real SMS/e-mail is ever sent. The sender address/sender id is
emulated and every recipient shown as "Envoyé/Délivré" is simulated.

---

## 1. Preconditions

| Item | Value |
|---|---|
| App URL | `http://localhost:3000` (locale `en` or `fr`; dev server :3002 in this workspace) |
| DB | `postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos` |
| Tenant A | Atlas — `ca40c88e-339c-4fea-b5c4-51d5c9cc0239` |
| Tenant B | Lango — `f62f31eb-1fc8-4102-9145-a5ce0bca989b` |
| Atlas admin | `y.elamrani@atlas.ma` / `Admin123!` (school_admin) |
| Lango admin | `admin@lango.ma` / `Admin123!` (school_admin) |
| Add-ons | `lead-crm` and `broadcast-messaging` must be `is_enabled=true` for **both** tenants |
| Permissions | school_admin role defaults include `crm.manage` and all `broadcast.*` keys |

**Sidebar entry:** the **"CRM & Diffusion"** group (icon `Megaphone`) links to
`/dashboard/broadcast` and lists Pipeline CRM, Vue d’ensemble, Connexions,
Segments, Modèles, Campagnes, Rapports, Automations.

**Reset between runs:** delete rows in FK order —
`communication_delivery_events`, `communication_deliveries`,
`communication_campaign_recipients`, `communication_campaigns`,
`communication_automation_recipients`, `communication_automation_runs`,
`communication_automations`, `communication_template_versions`,
`communication_templates`, `communication_segments`,
`communication_connections`, `communication_suppressions`,
`communication_consents`, `inquiry_follow_ups`, `inquiries`.

---

## 2. API conventions (apply to every step)

- Create endpoints return **201** `{ success, data }`; reads return **200**.
- Errors: `403 ADDON_NOT_ACTIVATED` (add-on disabled), `403 FORBIDDEN` (missing
  capability), `404 NOT_FOUND` (incl. cross-tenant IDs), `422 VALIDATION_ERROR`,
  `409` for invalid transitions / idempotency conflicts.
- **Idempotency:** campaign creation accepts `idempotencyKey`; retrying with the
  same key returns the SAME campaign (never a duplicate). Preview is idempotent.
  Send/retry use the per-recipient delivery row, so a retry never double-sends.
- **Tenant isolation:** every query is scoped to the session tenant. A campaign
  or segment belonging to the other tenant returns 404, never data.
- **Consent/suppression:** checked at preview/snapshot AND immediately before
  dispatch. A recipient who revoked or suppressed after approval is skipped.

---

## 3. Lead CRM — Pipeline

Route family `/api/crm/inquiries` (+ `[id]`, `[id]/duplicates`, `[id]/follow-ups`,
`/merge`). UI at **CRM & Diffusion → Pipeline CRM** (`/dashboard/communication/crm`).

### 3.1 Create an inquiry
1. Open **Pipeline CRM** → **Nouvelle demande**.
2. Fill contact name, phone, e-mail, source (`web`, `walk_in`, …), interest level, tags.
3. **Enregistrer** → card appears in the **New** column with the chosen source/level.
4. **Negative:** submit with an invalid phone or missing name → 422 with a French
   error message, no row created.

### 3.2 Status transitions
1. Drag a card `New → Contacted`, then `Contacted → Qualified`.
2. Open the card → the profile shows the transition history and the timeline entry.
3. **Negative:** try to drag `Lost → New` (a backwards transition) → blocked with a
   409; status unchanged.

### 3.3 Duplicates & merge
1. Create two inquiries with the same phone.
2. Open one → **Doublons** lists the other (exact phone/e-mail match).
3. **Fusionner** → follow-ups re-point to the primary, tags union, notes appended,
   the secondary is deleted.
4. **Negative:** attempt to merge a **converted** inquiry → 422, nothing merges.

### 3.4 Follow-ups
1. Open an inquiry → add a follow-up of type `call` with a note and due date.
2. The timeline shows it; the row appears in any "à relancer" view.

### 3.5 Convert to applicant
1. On a `Qualified` inquiry → **Convertir**.
2. A student/applicant row is created (check DB `user`/applicant table), the
   inquiry becomes `converted`, and the `studentId` link is stored.
3. **Idempotency:** click **Convertir** again → same result, no duplicate applicant
   (the conversion guard refuses a second conversion).

---

## 4. Broadcast Messaging — Connections

Route `/api/addons/broadcast/connections`. UI at **CRM & Diffusion → Connexions**.

1. **Nouvelle connexion** → name `SMS Test`, channel `SMS`, provider `test`,
   fill `apiKey` + `sender` → **Créer** → 201; status `connected`.
2. The list shows the connection with `apiKey` masked as `••••••••` and the sender
   visible (`sender` is not a secret).
3. **Tester** → 200 and status stays `connected`.
4. **Negative (secret leakage):** the GET response for a connection NEVER contains
   the plaintext `apiKey`/`token`/`accessToken`/`password`/`fromAddress` values —
   verify in DevTools Network that the config only carries the mask.
5. **Negative:** delete a connection that is referenced by a campaign/template →
   blocked or safe reference handling; no orphan crash.

---

## 5. Broadcast Messaging — Segments

Route `/api/addons/broadcast/segments`. UI at **CRM & Diffusion → Segments**.

1. **Nouveau segment** → kind `Demande (inquiry)`, filter by `tag = web` → **Créer**.
2. The list shows `memberCount` computed live (matches the number of matching inquiries).
3. **Recalculer** re-runs the definition and refreshes the count.
4. **Negative:** an empty/invalid kind → 422 `VALIDATION_ERROR`.
5. **Cross-tenant:** a segment created by Lango is never visible/addressable from
   the Atlas session (404 on direct ID).

---

## 6. Broadcast Messaging — Templates

Route `/api/addons/broadcast/templates`. UI at **CRM & Diffusion → Modèles**.

1. **Nouveau modèle** → name, channel `SMS`, category, body with `{{name}}` → **Créer**
   (creates version v1, status `draft`).
2. Expand the template → **Ajouter une version** → v2 body → save.
3. **Publier** v2 → status `published`; the published version is what campaigns use.
4. **Negative:** body with an undeclared variable renders → error (no silent
   injection); empty body → 422.

---

## 7. Broadcast Messaging — Campaigns (the core flow)

Route `/api/addons/broadcast/campaigns`. UI at **CRM & Diffusion → Campagnes**.

1. **Nouvelle campagne** → name `Campagne manuelle`, channel `SMS`, pick the
   connection, the segment, the template (or a raw `bodyText`), subject/body.
2. **Aperçu (preview)** → shows the exact breakdown: `targeted`, `invalid`,
   `consentExcluded`, `suppressionExcluded`, `dedup`, `enqueued`. Verify the
   numbers add up (enqueued = targeted − invalid − consent − suppression − dedup).
3. **Approuver** → status `queued`, snapshot counts persisted.
4. **Traiter la file (process)** → status `sending` → `completed`; the recipients
   table shows per-recipient status (`sent`/`delivered`).
5. **Retry:** open a `failed` delivery → **Réessayer** → re-enqueued and processed
   exactly once (no duplicate send event).
6. **Export CSV** → downloads `rapport-<name>.csv` with columns
   `name,phone,email,status` and masked contacts (`…`), one row per recipient.
7. **Schedule:** set a future date → status stays `draft`/`scheduled`; no send
   before the date.
8. **Annuler** a scheduled/queued campaign → status `cancelled`, recipients marked
   `skipped` with reason `cancelled`.
9. **Negative:** campaign with an empty message → 422.
10. **Idempotency:** re-POST the same create with the same `idempotencyKey` → same
    campaign ID returned, no duplicate.

---

## 8. Broadcast Messaging — Consent & Suppression

Routes `/api/addons/broadcast/consents`, `/api/addons/broadcast/suppressions`.

1. **Revoke consent** for a recipient on channel `sms` (`granted=false`).
2. Re-run the campaign preview → the recipient counts under `consentExcluded`.
3. **Add a global suppression** for a recipient → preview shows `suppressionExcluded`.
4. **Send-time re-check:** revoke consent AFTER approval but BEFORE processing →
   the recipient is skipped (`skipped`, reason `consent_revoked`), never sent.
5. **Negative:** a channel-specific suppression beats a global one (more precise
   rule); consent defaults to allowed unless explicitly revoked.

---

## 9. Broadcast Messaging — Reports & Automations

**Reports** (`/dashboard/broadcast/reports`): one card per campaign with targeted /
enqueued / sent / delivered / failed / delivery-rate and CSV + detail links.

**Automations** (`/dashboard/broadcast/automations`):
1. Create an automation of kind `Anniversaires élèves`, pick channel/connection/template + send time.
2. **Activer**, then **Tester** (runs for today) → a run row appears with
   `Trouvés / En file / Exclus` counts.
3. **Negative:** toggling off stops future runs; a test run does not double-send
   (per-recipient dedupe).

---

## 10. Cross-cutting suites

### 10.1 Tenant isolation
- From Atlas, request a campaign/segment/template ID created by Lango → **404**.
- `scripts/check-tenant-isolation.ts` reports no missing `tenantId` scoping on any
  `src/app/api/crm/**` or `src/app/api/addons/broadcast/**` route.
- Both live scripts assert "Lango tenant untouched by verify data" at the DB.

### 10.2 Add-on disable
- `node scripts/verify-lead-crm-addon-gate.mjs` → 8/8 (all CRM routes 403
  `ADDON_NOT_ACTIVATED`, broadcast stays up, re-enable restores data).
- `node scripts/verify-broadcast-addon-gate.mjs` → 8/8 (all broadcast routes 403,
  lead-crm stays up, re-enable restores data).

### 10.3 No real external sends
- Every campaign in this environment is sent through the **test provider**;
  deterministic outcomes derive from the address (`bounce`→bounced,
  `retryfail`→failed, `delivered`→delivered, else→sent). `delivered` is never
  fabricated for a recipient that did not resolve to `sent`.
- The overview page shows the banner: *"Diffusion simulée : aucun SMS/e-mail réel
  envoyé (fournisseur de test)."*

### 10.4 Audit
- Sensitive mutations (create/approve/cancel/retry, connection create/delete,
  consent/suppression changes, CRM transitions/merge/convert) write rows via the
  central `recordAudit` helper (`@/libs/api/audit`). Verify in the audit log that
  each of the above actions produced a row with the acting user.

### 10.5 Responsive + states
- Every page handles **empty** (friendly "Aucune …" card), **loading** (spinner),
  **error** (rose message + **Réessayer**), and **success** states.
- Check both `en` and `fr` locale prefixes render the same flows.

---

## 11. Automated suites to run before sign-off

```bash
node scripts/verify-lead-crm.mjs            # 41 checks
node scripts/verify-broadcast.mjs           # 54 checks
node scripts/verify-lead-crm-addon-gate.mjs # 8 checks
node scripts/verify-broadcast-addon-gate.mjs# 8 checks
node scripts/check-broadcast-pages.mjs      # 14 page checks (en+fr)
npx vitest run --project unit "src/features/broadcast/services/__tests__"  # 21 unit tests
npx tsc --noEmit                            # 0 broadcast/crm errors
```
