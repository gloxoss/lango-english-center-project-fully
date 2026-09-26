# SETTINGS-CORE-FIX-01 — translations needed from another agent

The locale files (`lango-app/locales/{fr,en,ar}.json`) were held by
`task:locales-attendance-scan` (claude-agentb → claude-att-2 → claude-att-3)
while this run needed them. Everything below is the exact key set, ready to
apply with the two scripts in this folder:

```
node artifacts/product-discovery/SETTINGS-CORE-FIX-01/apply-locales-scf3-studentcard.mjs
node artifacts/product-discovery/SETTINGS-CORE-FIX-01/apply-locales-scf3-scf09.mjs
```

Both scripts refuse to write unless the JSON.parse → JSON.stringify(j, null, 2)
→ CRLF round-trip is byte-identical, so they only add lines.

## SCF-08-02 — student custom-fields card (`StudentDetail`, 11 keys × 3)

| key | fr | en | ar |
|---|---|---|---|
| customFieldsTitle | Champs personnalisés | Custom fields | حقول مخصصة |
| customFieldsSubtitle | Champs définis par l'école pour compléter la fiche élève. | School-defined fields that complete the student record. | حقول تعرّفها المدرسة لاستكمال ملف التلميذ. |
| customFieldsEdit | Modifier | Edit | تعديل |
| customFieldsAdd | Renseigner | Fill in | تعبئة |
| customFieldsSave | Enregistrer | Save | حفظ |
| customFieldsSaved | Valeur enregistrée. | Value saved. | تم حفظ القيمة. |
| customFieldsSaveError | Impossible d'enregistrer la valeur. | Could not save the value. | تعذر حفظ القيمة. |
| customFieldsCancel | Annuler | Cancel | إلغاء |
| customFieldsYes | Oui | Yes | نعم |
| customFieldsNo | Non | No | لا |
| customFieldsRequired | Ce champ est obligatoire. | This field is required. | هذا الحقل إلزامي. |

## SCF-09-01 — Attendance hub card (`Settings`, 2 keys × 3)

`/dashboard/settings` logged `MISSING_MESSAGE: Settings.mod_attendance_title/desc`
because this was the only one of the 18 module cards whose `mod_*` keys were
missing.

| key | fr | en | ar |
|---|---|---|---|
| mod_attendance_title | Présences & Absences | Attendance & Absences | الحضور والغياب |
| mod_attendance_desc | Minutes de grâce, heure de référence du scan, seuils de signalement et alertes SMS aux tuteurs. | Grace minutes, scan reference time, flag thresholds and guardian SMS alerts. | دقائق السماح، الساعة المرجعية للمسح، عتبات التبليغ وتنبيهات SMS للأولياء. |

## Not ours

The 27 missing keys reported by `check-missing-i18n-keys.mjs`
(`Parent.grades*` ×24 in `src/features/parent/ui/GradesView.tsx`,
`Navigation.parentGrades` ×3 in `src/components/shared/sidebar.tsx`) belong to
GRADES-CANONICAL-01 and are listed in its own TRANSLATIONS-NEEDED.md.
