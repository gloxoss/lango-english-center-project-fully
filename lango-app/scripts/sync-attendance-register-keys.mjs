import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const enPath = path.join(ROOT, 'locales', 'en.json');
const frPath = path.join(ROOT, 'locales', 'fr.json');
const arPath = path.join(ROOT, 'locales', 'ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const keys = {
  en: {
    registerLocked: "Register Locked",
    registerLockedNotice: "This register ({reference}) was submitted and locked. An administrative reopening is required to make corrections.",
    reopenRegisterBtn: "Reopen Register",
    reopenReasonPrompt: "Reopening reason (required, min 3 chars)",
    reopenSuccess: "Register reopened for correction.",
    registerReopened: "Register Reopened for Correction",
    reopenReasonLabel: "Reopen reason:",
    correctionNoteLabel: "Correction note (required to re-lock):",
    correctionNotePlaceholder: "Describe the changes made...",
    correctionNoteRequired: "A correction note is required to save modifications to a reopened register."
  },
  fr: {
    registerLocked: "Registre verrouillé",
    registerLockedNotice: "Ce registre ({reference}) a été soumis et verrouillé. Une réouverture par l'administration est requise pour le modifier.",
    reopenRegisterBtn: "Rouvrir le registre",
    reopenReasonPrompt: "Motif de la réouverture (obligatoire, min 3 car.)",
    reopenSuccess: "Registre rouvert avec succès pour correction.",
    registerReopened: "Registre rouvert pour correction",
    reopenReasonLabel: "Motif de réouverture :",
    correctionNoteLabel: "Note de correction (obligatoire pour re-verrouiller) :",
    correctionNotePlaceholder: "Précisez les modifications apportées...",
    correctionNoteRequired: "Une note de correction est obligatoire pour enregistrer les modifications d'un registre rouvert."
  },
  ar: {
    registerLocked: "الدفتر مقفل",
    registerLockedNotice: "تم تقديم هذا الدفتر ({reference}) وإقفاله. يلزم إعادة الفتح من قبل الإدارة لتعديل الحضور.",
    reopenRegisterBtn: "إعادة فتح الدفتر",
    reopenReasonPrompt: "سبب إعادة الفتح (إجباري، 3 أحرف على الأقل)",
    reopenSuccess: "تمت إعادة فتح الدفتر بنجاح للتصحيح.",
    registerReopened: "تمت إعادة فتح الدفتر للتصحيح",
    reopenReasonLabel: "سبب إعادة الفتح:",
    correctionNoteLabel: "ملاحظة التصحيح (إلزامية لإعادة الإقفال):",
    correctionNotePlaceholder: "حدد التعديلات التي تم إجراؤها...",
    correctionNoteRequired: "يلزم كتابة ملاحظة تصحيح لحفظ تعديلات الدفتر المعاد فتحه."
  }
};

Object.assign(en.Attendance, keys.en);
Object.assign(fr.Attendance, keys.fr);
Object.assign(ar.Attendance, keys.ar);

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(frPath, JSON.stringify(fr, null, 2) + '\n', 'utf8');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8');

console.log('Attendance register keys synced successfully across en, fr, ar.');
