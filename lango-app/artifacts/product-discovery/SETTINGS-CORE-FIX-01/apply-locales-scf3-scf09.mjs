// SETTINGS-CORE-FIX-01 — SCF-09-01: the Attendance hub card was the only
// module card without its Settings.mod_* keys, so /settings logged
// MISSING_MESSAGE for it (the other 17 modules all have theirs).
// Run: node artifacts/product-discovery/SETTINGS-CORE-FIX-01/apply-locales-scf3-scf09.mjs
import fs from 'node:fs';

const ADD = {
  fr: {
    mod_attendance_title: 'Présences & Absences',
    mod_attendance_desc: "Minutes de grâce, heure de référence du scan, seuils de signalement et alertes SMS aux tuteurs.",
  },
  en: {
    mod_attendance_title: 'Attendance & Absences',
    mod_attendance_desc: 'Grace minutes, scan reference time, flag thresholds and guardian SMS alerts.',
  },
  ar: {
    mod_attendance_title: 'الحضور والغياب',
    mod_attendance_desc: 'دقائق السماح، الساعة المرجعية للمسح، عتبات التبليغ وتنبيهات SMS للأولياء.',
  },
};

for (const locale of ['fr', 'en', 'ar']) {
  const file = `locales/${locale}.json`;
  const raw = fs.readFileSync(file, 'utf8');

  const trailing = raw.endsWith('\r\n') ? '\r\n' : '';
  const roundTrip = JSON.stringify(JSON.parse(raw), null, 2).replace(/\n/g, '\r\n') + trailing;
  if (roundTrip !== raw) {
    throw new Error(`${locale}: the JSON round-trip is not byte-identical; refusing to write`);
  }

  const messages = JSON.parse(raw);
  messages.Settings = messages.Settings ?? {};

  const duplicates = [];
  for (const [key, value] of Object.entries(ADD[locale])) {
    if (Object.prototype.hasOwnProperty.call(messages.Settings, key)) duplicates.push(key);
    else messages.Settings[key] = value;
  }
  if (duplicates.length > 0) {
    throw new Error(`${locale}: Settings keys already exist: ${duplicates.join(', ')}`);
  }

  const out = JSON.stringify(messages, null, 2).replace(/\n/g, '\r\n') + trailing;
  if (/(?<!\r)\n/.test(out)) {
    throw new Error(`${locale}: produced a bare LF`);
  }
  fs.writeFileSync(file, out, 'utf8');
  console.log(`${locale}: Settings.mod_attendance_* added`);
}
