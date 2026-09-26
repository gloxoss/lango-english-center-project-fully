// SETTINGS-CORE-FIX-01 — SCF-08-02 locale keys for the student custom-fields card.
// Run: node artifacts/product-discovery/SETTINGS-CORE-FIX-01/apply-locales-scf3-studentcard.mjs
import fs from 'node:fs';

const ADD = {
  fr: {
    customFieldsTitle: 'Champs personnalisés',
    customFieldsSubtitle: "Champs définis par l'école pour compléter la fiche élève.",
    customFieldsEdit: 'Modifier',
    customFieldsAdd: 'Renseigner',
    customFieldsSave: 'Enregistrer',
    customFieldsSaved: 'Valeur enregistrée.',
    customFieldsSaveError: "Impossible d'enregistrer la valeur.",
    customFieldsCancel: 'Annuler',
    customFieldsYes: 'Oui',
    customFieldsNo: 'Non',
    customFieldsRequired: 'Ce champ est obligatoire.',
  },
  en: {
    customFieldsTitle: 'Custom fields',
    customFieldsSubtitle: 'School-defined fields that complete the student record.',
    customFieldsEdit: 'Edit',
    customFieldsAdd: 'Fill in',
    customFieldsSave: 'Save',
    customFieldsSaved: 'Value saved.',
    customFieldsSaveError: 'Could not save the value.',
    customFieldsCancel: 'Cancel',
    customFieldsYes: 'Yes',
    customFieldsNo: 'No',
    customFieldsRequired: 'This field is required.',
  },
  ar: {
    customFieldsTitle: 'حقول مخصصة',
    customFieldsSubtitle: 'حقول تعرّفها المدرسة لاستكمال ملف التلميذ.',
    customFieldsEdit: 'تعديل',
    customFieldsAdd: 'تعبئة',
    customFieldsSave: 'حفظ',
    customFieldsSaved: 'تم حفظ القيمة.',
    customFieldsSaveError: 'تعذر حفظ القيمة.',
    customFieldsCancel: 'إلغاء',
    customFieldsYes: 'نعم',
    customFieldsNo: 'لا',
    customFieldsRequired: 'هذا الحقل إلزامي.',
  },
};

for (const locale of ['fr', 'en', 'ar']) {
  const file = `locales/${locale}.json`;
  const raw = fs.readFileSync(file, 'utf8');

  // The guard compares against the canonical serialization of the file itself,
  // so any pre-existing formatting difference (spacing, ordering, a trailing
  // newline added by an editor) refuses the write. The file's own trailing
  // newline style is preserved.
  const trailing = raw.endsWith('\r\n') ? '\r\n' : '';
  const roundTrip = JSON.stringify(JSON.parse(raw), null, 2).replace(/\n/g, '\r\n') + trailing;
  if (roundTrip !== raw) {
    throw new Error(`${locale}: the JSON round-trip is not byte-identical; refusing to write`);
  }

  const messages = JSON.parse(raw);
  messages.StudentDetail = messages.StudentDetail ?? {};

  const duplicates = [];
  for (const [key, value] of Object.entries(ADD[locale])) {
    if (Object.prototype.hasOwnProperty.call(messages.StudentDetail, key)) duplicates.push(key);
    else messages.StudentDetail[key] = value;
  }
  if (duplicates.length > 0) {
    throw new Error(`${locale}: StudentDetail keys already exist: ${duplicates.join(', ')}`);
  }

  const out = JSON.stringify(messages, null, 2).replace(/\n/g, '\r\n') + trailing;
  if (/(?<!\r)\n/.test(out)) {
    throw new Error(`${locale}: produced a bare LF`);
  }
  fs.writeFileSync(file, out, 'utf8');
  console.log(`${locale}: StudentDetail=${Object.keys(messages.StudentDetail).length} keys`);
}
