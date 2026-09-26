// SETTINGS-CORE-FIX-01 — SCF-06-01 locale keys for the rebuilt Numbering page.
//
// The page now lists `naming_series` (real counters) instead of the retired
// definitions store, so the old create/preview copy is replaced and a small set
// of new labels is added. Kept in the evidence folder because the key list IS
// part of the deliverable.
//
// Locale files are pure CRLF with 2-space indent and
// JSON.parse -> JSON.stringify(j, null, 2) with \n -> \r\n round-trips
// BYTE-IDENTICAL (checked before writing), so the diff contains only the
// changed lines.
// Run: node artifacts/product-discovery/SETTINGS-CORE-FIX-01/apply-locales-scf3-numbering.mjs
import fs from 'node:fs';

const REPLACE = {
  fr: {
    subtitle: "Numéros réellement utilisés par les factures, reçus et matricules. Une valeur ne peut qu'augmenter : un numéro déjà émis n'est jamais réutilisé.",
    empty: 'Aucun compteur pour le moment. Ils apparaissent ici dès qu’un premier document ou matricule est émis.',
  },
  en: {
    subtitle: 'The numbers actually used by invoices, receipts and student matricules. A value can only be raised: an issued number is never reused.',
    empty: 'No counters yet. They appear here as soon as a first document or matricule is issued.',
  },
  ar: {
    subtitle: 'الأرقام المستعملة فعليا في الفواتير والوصولات وأرقام التسجيل. لا يمكن إلا رفع القيمة: الرقم الصادر لا يُعاد استعماله.',
    empty: 'لا توجد عدادات بعد. تظهر هنا بمجرد إصدار أول وثيقة أو رقم تسجيل.',
  },
};

const ADD = {
  fr: {
    currentLabel: 'Valeur actuelle',
    newValueLabel: 'Nouvelle valeur maximale',
    newValueHint: 'La valeur ne peut qu’augmenter : les numéros déjà émis ne sont jamais réutilisés.',
    raise: 'Relever',
    confirmRaise: 'Relever « {label} » à {value} ? Les numéros intermédiaires seront sautés.',
    kind_invoice: 'Factures',
    kind_receipt: 'Reçus',
    kind_credit_note: 'Avoirs',
    kind_candidate: 'Candidats',
    kind_employee: 'Employés',
    kind_student_matricule: 'Matricules élèves',
    kind_other: 'Autres documents',
  },
  en: {
    currentLabel: 'Current value',
    newValueLabel: 'New highest value',
    newValueHint: 'The value can only be raised: issued numbers are never reused.',
    raise: 'Raise',
    confirmRaise: 'Raise “{label}” to {value}? Numbers in between will be skipped.',
    kind_invoice: 'Invoices',
    kind_receipt: 'Receipts',
    kind_credit_note: 'Credit notes',
    kind_candidate: 'Candidates',
    kind_employee: 'Employees',
    kind_student_matricule: 'Student matricules',
    kind_other: 'Other documents',
  },
  ar: {
    currentLabel: 'القيمة الحالية',
    newValueLabel: 'القيمة القصوى الجديدة',
    newValueHint: 'لا يمكن إلا رفع القيمة: الأرقام الصادرة لا يُعاد استعمالها.',
    raise: 'رفع',
    confirmRaise: 'رفع «{label}» إلى {value}؟ سيتم تخطي الأرقام الوسيطة.',
    kind_invoice: 'الفواتير',
    kind_receipt: 'الوصولات',
    kind_credit_note: 'إشعارات دائنة',
    kind_candidate: 'المترشحون',
    kind_employee: 'الموظفون',
    kind_student_matricule: 'أرقام تسجيل التلاميذ',
    kind_other: 'وثائق أخرى',
  },
};

for (const locale of ['fr', 'en', 'ar']) {
  const file = `locales/${locale}.json`;
  const raw = fs.readFileSync(file, 'utf8');

  const roundTrip = JSON.stringify(JSON.parse(raw), null, 2).replace(/\n/g, '\r\n');
  if (roundTrip !== raw) {
    throw new Error(`${locale}: the JSON round-trip is not byte-identical; refusing to write`);
  }

  const messages = JSON.parse(raw);
  messages.NumberingSettings = messages.NumberingSettings ?? {};

  for (const [key, value] of Object.entries(REPLACE[locale])) {
    if (typeof messages.NumberingSettings[key] !== 'string') {
      throw new Error(`${locale}: NumberingSettings.${key} is not an existing string to replace`);
    }
    messages.NumberingSettings[key] = value;
  }

  const duplicates = [];
  for (const [key, value] of Object.entries(ADD[locale])) {
    if (Object.prototype.hasOwnProperty.call(messages.NumberingSettings, key)) duplicates.push(key);
    else messages.NumberingSettings[key] = value;
  }
  if (duplicates.length > 0) {
    throw new Error(`${locale}: NumberingSettings keys already exist: ${duplicates.join(', ')}`);
  }

  const out = JSON.stringify(messages, null, 2).replace(/\n/g, '\r\n');
  if (/(?<!\r)\n/.test(out)) {
    throw new Error(`${locale}: produced a bare LF`);
  }
  fs.writeFileSync(file, out, 'utf8');
  console.log(`${locale}: NumberingSettings=${Object.keys(messages.NumberingSettings).length} keys, top-level=${Object.keys(messages).length}`);
}
