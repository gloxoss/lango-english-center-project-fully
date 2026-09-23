# S-19: 3 labels to add to the `Finance` namespace

Used by `src/features/finance/ui/fine-policies-view.tsx`. Add under `"Finance"` in each locale file, then run `node scripts/check-missing-i18n-keys.mjs` (must report 0).

`locales/fr.json`

```json
"legacyFinesNeedReview": "{count, plural, one {# ancienne pénalité n'a jamais été facturée : à vérifier avant de l'ajouter au solde de la famille} other {# anciennes pénalités n'ont jamais été facturées : à vérifier avant de les ajouter au solde des familles}}",
"assessmentSuperseded": "Remplacée",
"assessmentUnbilled": "Non facturée"
```

`locales/en.json`

```json
"legacyFinesNeedReview": "{count, plural, one {# older fine was never billed: review it before adding it to the family's balance} other {# older fines were never billed: review them before adding them to families' balances}}",
"assessmentSuperseded": "Superseded",
"assessmentUnbilled": "Not billed"
```

`locales/ar.json`

```json
"legacyFinesNeedReview": "{count, plural, one {غرامة قديمة واحدة لم تُفوتر قط: راجعها قبل إضافتها إلى رصيد الأسرة} other {# غرامات قديمة لم تُفوتر قط: راجعها قبل إضافتها إلى أرصدة الأسر}}",
"assessmentSuperseded": "مستبدلة",
"assessmentUnbilled": "غير مفوترة"
```
