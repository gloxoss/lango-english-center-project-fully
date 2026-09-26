// SETTINGS-CORE-FIX-01 — the locale key batch for sections 03-01, 04-01/04-02,
// 05-01 and the Attendance sidebar entry.
//
// Kept in the evidence folder because the key list IS part of the deliverable:
// it is the exact set of user-visible strings this run added, in fr/en/ar.
//
// The locale files are pure CRLF with 2-space indent, and
// JSON.parse -> JSON.stringify(j, null, 2) with \n -> \r\n round-trips
// BYTE-IDENTICAL (checked before writing), so the diff contains only added
// lines. Run: node artifacts/product-discovery/SETTINGS-CORE-FIX-01/apply-locales-scf.mjs
import fs from 'node:fs';

const PRESENCE = {
  fr: { presence: 'Présence', absenceJustifiee: 'Absence justifiée', absenceNonJustifiee: 'Absence non justifiée', retard: 'Retard', sortieAnticipee: 'Sortie anticipée', morning: 'Matin', afternoon: 'Après-midi' },
  en: { presence: 'Present', absenceJustifiee: 'Justified absence', absenceNonJustifiee: 'Unjustified absence', retard: 'Late', sortieAnticipee: 'Early leave', morning: 'Morning', afternoon: 'Afternoon' },
  ar: { presence: 'حاضر', absenceJustifiee: 'غياب مبرر', absenceNonJustifiee: 'غياب غير مبرر', retard: 'متأخر', sortieAnticipee: 'خروج مبكر', morning: 'صباحا', afternoon: 'بعد الزوال' },
};

const KEYS = {
  fr: {
    OrganizationSettings: {
      currentYearLabel: "Année scolaire en cours",
      currentYearNone: "Aucune année scolaire n'est définie comme année en cours.",
      currentYearManagedElsewhere: "L'année scolaire se gère depuis les années scolaires : elle n'est plus modifiable ici.",
      manageSchoolYears: "Gérer les années scolaires",
    },
    AttendanceSettings: {
      title: "Présences & Absences",
      subtitle: "Minutes de grâce, heure de référence du scan, seuils de signalement et alertes aux tuteurs.",
      sectionEntry: "Pointage à l'entrée",
      sectionThresholds: "Seuils de signalement",
      sectionAlerts: "Alertes aux tuteurs",
      sectionModes: "Statuts de présence",
      lateGraceMinutesLabel: "Minutes de grâce pour retard",
      lateGraceMinutesHint: "Un badge scanné avant (début de séance + grâce) est enregistré « présent », après en « retard ».",
      periodStartTimeLabel: "Heure de début de séance",
      periodStartTimeHint: "Utilisée par le scanner QR tant que les cours ne sont pas liés à l'emploi du temps.",
      consecutiveAbsenceThresholdLabel: "Absences consécutives",
      consecutiveAbsenceThresholdHint: "Nombre de jours d'enseignement consécutifs d'absence qui déclenche un signalement.",
      repeatedLateThresholdLabel: "Retards répétés dans le mois",
      repeatedLateThresholdHint: "Nombre de retards dans le mois qui déclenche un signalement.",
      smsAlertsLabel: "Alertes SMS automatiques aux tuteurs",
      smsAlertsHint: "Notification au tuteur lors d'une absence non justifiée.",
      presenceModesHint: "Statuts que le registre d'appel peut enregistrer. Décocher un statut le retire des choix proposés aux enseignants.",
      rangeError: "Valeur attendue entre {min} et {max}.",
      timeFormatError: "Heure attendue au format HH:MM.",
      save: "Enregistrer",
      saving: "Enregistrement…",
      saved: "Paramètres de présence enregistrés.",
      saveError: "Impossible d'enregistrer les paramètres de présence.",
      loadError: "Impossible de charger les paramètres de présence.",
      fixErrors: "Corrigez les valeurs invalides.",
    },
    Grading: {
      gradingScaleLabel: "Barème de notation",
      gradingScaleOn20: "Sur 20 (norme marocaine)",
      gradingScaleOn100: "Sur 100 (pourcentage)",
    },
    Navigation: { 'settings-attendance': "Présences" },
  },
  en: {
    OrganizationSettings: {
      currentYearLabel: "Current school year",
      currentYearNone: "No school year is set as the current one.",
      currentYearManagedElsewhere: "The school year is managed under school years; it is no longer editable here.",
      manageSchoolYears: "Manage school years",
    },
    AttendanceSettings: {
      title: "Attendance & Absences",
      subtitle: "Grace minutes, scan reference time, flag thresholds and guardian alerts.",
      sectionEntry: "Entry check-in",
      sectionThresholds: "Flag thresholds",
      sectionAlerts: "Guardian alerts",
      sectionModes: "Attendance statuses",
      lateGraceMinutesLabel: "Lateness grace minutes",
      lateGraceMinutesHint: "A badge scanned before (lesson start + grace) is recorded as present, after as late.",
      periodStartTimeLabel: "Lesson start time",
      periodStartTimeHint: "Used by the QR scanner while lessons are not linked to the timetable.",
      consecutiveAbsenceThresholdLabel: "Consecutive absences",
      consecutiveAbsenceThresholdHint: "Number of consecutive teaching days absent that raises a flag.",
      repeatedLateThresholdLabel: "Repeated lateness in the month",
      repeatedLateThresholdHint: "Number of late arrivals in the month that raises a flag.",
      smsAlertsLabel: "Automatic guardian SMS alerts",
      smsAlertsHint: "Notifies the guardian after an unjustified absence.",
      presenceModesHint: "Statuses the register can record. Clearing one removes it from the choices offered to teachers.",
      rangeError: "Expected a value between {min} and {max}.",
      timeFormatError: "Expected a time in HH:MM format.",
      save: "Save",
      saving: "Saving…",
      saved: "Attendance settings saved.",
      saveError: "Could not save the attendance settings.",
      loadError: "Could not load the attendance settings.",
      fixErrors: "Fix the invalid values.",
    },
    Grading: {
      gradingScaleLabel: "Grading scale",
      gradingScaleOn20: "Out of 20 (Moroccan standard)",
      gradingScaleOn100: "Out of 100 (percentage)",
    },
    Navigation: { 'settings-attendance': "Attendance" },
  },
  ar: {
    OrganizationSettings: {
      currentYearLabel: "السنة الدراسية الحالية",
      currentYearNone: "لم يتم تحديد أي سنة دراسية كسنة حالية.",
      currentYearManagedElsewhere: "تُدار السنة الدراسية من السنوات الدراسية؛ لم تعد قابلة للتعديل هنا.",
      manageSchoolYears: "إدارة السنوات الدراسية",
    },
    AttendanceSettings: {
      title: "الحضور والغياب",
      subtitle: "دقائق السماح، الساعة المرجعية للمسح، عتبات التبليغ وتنبيهات الأولياء.",
      sectionEntry: "التسجيل عند الدخول",
      sectionThresholds: "عتبات التبليغ",
      sectionAlerts: "تنبيهات الأولياء",
      sectionModes: "حالات الحضور",
      lateGraceMinutesLabel: "دقائق السماح عن التأخر",
      lateGraceMinutesHint: "الشارة الممسوحة قبل (بداية الحصة + السماح) تُسجّل حاضرا، وبعدها تُسجّل متأخرا.",
      periodStartTimeLabel: "ساعة بداية الحصة",
      periodStartTimeHint: "يستخدمها ماسح رمز QR إلى أن تُربط الحصص بجدول الحصص.",
      consecutiveAbsenceThresholdLabel: "الغيابات المتتالية",
      consecutiveAbsenceThresholdHint: "عدد أيام الدراسة المتتالية للغياب التي تُطلق تبليغا.",
      repeatedLateThresholdLabel: "التأخرات المتكررة في الشهر",
      repeatedLateThresholdHint: "عدد مرات التأخر في الشهر التي تُطلق تبليغا.",
      smsAlertsLabel: "تنبيهات SMS تلقائية للأولياء",
      smsAlertsHint: "إشعار الولي عند غياب غير مبرر.",
      presenceModesHint: "الحالات التي يمكن لدفتر الحضور تسجيلها. إلغاء تحديد حالة يحذفها من الخيارات المعروضة على الأساتذة.",
      rangeError: "القيمة المطلوبة بين {min} و {max}.",
      timeFormatError: "الساعة بصيغة HH:MM.",
      save: "حفظ",
      saving: "جار الحفظ…",
      saved: "تم حفظ إعدادات الحضور.",
      saveError: "تعذر حفظ إعدادات الحضور.",
      loadError: "تعذر تحميل إعدادات الحضور.",
      fixErrors: "صحّح القيم غير الصحيحة.",
    },
    Grading: {
      gradingScaleLabel: "سلم التنقيط",
      gradingScaleOn20: "من 20 (المعيار المغربي)",
      gradingScaleOn100: "من 100 (نسبة مئوية)",
    },
    Navigation: { 'settings-attendance': "الحضور" },
  },
};

for (const locale of ['fr', 'en', 'ar']) {
  const file = `locales/${locale}.json`;
  const raw = fs.readFileSync(file, 'utf8');

  // Guard: the round-trip must be byte-identical, or writing back would
  // reformat the whole file and bury the real change in noise.
  const roundTrip = JSON.stringify(JSON.parse(raw), null, 2).replace(/\n/g, '\r\n');
  if (roundTrip !== raw) {
    throw new Error(`${locale}: the JSON round-trip is not byte-identical; refusing to write`);
  }

  const messages = JSON.parse(raw);
  const duplicates = [];
  for (const [namespace, entries] of Object.entries(KEYS[locale])) {
    if (namespace === 'AttendanceSettings') {
      messages.AttendanceSettings = { ...(messages.AttendanceSettings ?? {}), ...entries, presenceModes: PRESENCE[locale] };
      continue;
    }
    messages[namespace] = messages[namespace] ?? {};
    for (const [key, value] of Object.entries(entries)) {
      if (Object.prototype.hasOwnProperty.call(messages[namespace], key)) {
        duplicates.push(`${namespace}.${key}`);
      } else {
        messages[namespace][key] = value;
      }
    }
  }
  if (duplicates.length > 0) {
    throw new Error(`${locale}: keys already exist: ${duplicates.join(', ')}`);
  }

  const out = JSON.stringify(messages, null, 2).replace(/\n/g, '\r\n');
  if (/(?<!\r)\n/.test(out)) {
    throw new Error(`${locale}: produced a bare LF`);
  }
  fs.writeFileSync(file, out, 'utf8');
  console.log(`${locale}: AttendanceSettings=${Object.keys(messages.AttendanceSettings).length} keys, top-level=${Object.keys(messages).length}`);
}
