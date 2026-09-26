# Auditability analysis

`audit_logs` columns: id, tenant_id, actor_id, action, entity_type, entity_id, metadata (JSON), created_at. There are no before/after columns and no reason column: whether a change is reconstructable depends on what each caller puts in `metadata` or in a versions table.

## What each high-impact change leaves behind (proven by the round trips, evidence/persistence.txt)

| Change | Audit row | Before / after recoverable? | Reason captured? |
|---|---|---|---|
| Registry setting (pass mark, SMS alerts, 2FA policy, accounting defaults, translations…) via `setSettingValue` | `setting:update {"version": n}` | **Yes**, `setting_value_versions` | Optional `reason` argument (grading-policies passes `body.reason`; the policies page sends none) |
| Grading policy save | `setting` rows + grading metadata (passingScore, eliminatoryScore, ruleCount, reason) | Yes (versions) | Yes if provided |
| Numbering series edit | `setting_numbering:update {"key"}` | **Yes**, `numbering_series_versions` (1 → 3 after probe + restore) | No (strict schema rejects `reason`) |
| Custom field edit | `setting_custom_field:update {"key"}` | **Yes**, `custom_field_definition_versions` | No (strict schema rejects `reason`) |
| Session year edit (dates, default flag) | `session_year:update {}` | **No**: empty metadata, no versions table | No |
| Semester edit | `semester:update {}` | **No** | No |
| Organisation / legal identity (`school_settings`) | `school_settings:update` (no metadata) | **Partly**: fields dual-written to the registry get versions; RC, ICE, IF, MEN authorisation, stamp and signature URLs, contacts have **no history** | No |
| Branch lifecycle | recorded by the branches API | not verified here | — |
| Module / licence changes | `addon_entitlement` create/delete rows (VPS shows 3 deletes at 2026-09-21 11:17) | who and when only | — |
| Permissions | `permission_change` rows (visible on the hub) | not verified here | — |

## "Modifications récentes" on the settings hub

**Real** audit data (`settings-hub-page.tsx:90-100`: last 5 `audit_logs` rows of the tenant, joined to the actor's name). Not synthetic. But it is **not settings-specific**: it shows the last 5 events of any kind (permission changes, record creations), so a settings change can be pushed out by unrelated activity. The `aud-1..3` entries in `settings-hub-config.ts` are unused static fixtures.

## Gaps (for the product review)

1. Academic year and semester changes are not reconstructable. These drive every module.
2. Legal identity changes (ICE, RC, IF, MEN authorisation, stamp and signature) have no history, although they are printed on official documents.
3. No reason can be given on numbering and custom-field changes (strict schemas).
4. `recordAudit` is fire-and-forget (`db.insert(...)` not awaited): a failed audit insert never fails the change.
