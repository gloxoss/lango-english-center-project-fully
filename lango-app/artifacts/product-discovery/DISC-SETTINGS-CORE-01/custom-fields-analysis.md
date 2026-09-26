# Custom fields analysis

## Storage model

| Table | Columns | Notes |
|---|---|---|
| `custom_field_definitions` | id, tenant_id, key, label, entity_type (student/guardian/employee), field_type, options, required, default_value, sort_order, is_active, created_at, updated_at | unique `(tenant_id, key)` |
| `custom_field_definition_versions` | per-change history | every PATCH writes a version (round-trip T6) |
| `custom_field_values` | id, tenant_id, definition_id, entity_id, value, updated_by, created_at, updated_at | unique `(tenant_id, definition_id, entity_id)`; value is untyped text/JSON |

Dev Atlas: 2 definitions, each with 10 seeded values: `matricule` "N° matricule" (text, student) and `sport` "Sport pratiqué" (select: football, basket, natation).

## API support

- `GET/POST /api/settings/custom-fields`, `GET/PATCH/DELETE /api/settings/custom-fields/[id]`, `GET/PUT /api/settings/custom-fields/[id]/values`: school_admin + `settings.custom_field.manage`. Proven: 403 for teacher/receptionist/accountant; 404 for another tenant (read, update, delete).
- PATCH is strict (`customFieldInputSchema.partial()`): unknown keys such as `reason` are rejected, so no change reason can be recorded.
- Round trip (T6): label edited → DB updated → restored; audit row `setting_custom_field:update {key}` (no before/after in the audit row; the before/after is in the versions table).

## Entity rendering, import, export

**None.** `grep customField src/` finds only the settings page, its API, its service, the sidebar, the hub card, the permission list and the translations page. No student, guardian or employee form, detail page, list, Excel import, export, report or document template reads definitions or values. The page's own subtitle says so ("ils ne sont pas encore affichés dans les formulaires").

Status: PARTIAL (real storage and API; zero consumers).

## Collisions with core fields

- `matricule` custom field vs core `user.matricule`: nothing prevents defining a custom key that shadows a core field. Values would silently diverge.
- The translations page has a second "custom fields presets" block (`translations-custom-fields-config.ts`, static) that is unrelated to these tables.

## Validation gaps

- Values are not validated against `field_type`/`options` at the DB level (text column). A `select` value outside the options is possible through the values API unless the service checks it (not proven here).
- No per-tenant cap on definitions; no index on `custom_field_values(entity_id)` for rendering a student's fields (only the unique composite).

## Recommendation (not implemented)

Reserve core keys (matricule, massar, cin, name, email…); render active definitions on the student/guardian/employee detail and edit forms; include them in import/export; validate values against type and options server-side.
