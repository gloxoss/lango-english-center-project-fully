const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'locales');
const enPath = path.join(localesDir, 'en.json');
const frPath = path.join(localesDir, 'fr.json');
const arPath = path.join(localesDir, 'ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// 1. Students additions
const studentsAdditions = {
  addPhoto: {
    en: 'Add a photo',
    fr: 'Ajouter une photo',
    ar: 'إضافة صورة',
  },
  setAsProfile: {
    en: 'Set as profile',
    fr: 'Définir comme profil',
    ar: 'تعيين كصورة شخصية',
  },
  profileBadge: {
    en: 'Profile',
    fr: 'Profil',
    ar: 'شخصية',
  },
  bulkModalTitle: {
    en: 'Bulk Student Photos Upload',
    fr: 'Téléversement Groupé de Photos Élèves',
    ar: 'الرفع الجماعي لصور التلاميذ',
  },
  bulkModalDesc: {
    en: 'Select a folder or group of images. The assistant will automatically match each file to the student using:',
    fr: "Sélectionnez un dossier ou un ensemble d'images. L'assistant associera automatiquement chaque fichier à l'élève correspondant en comparant le nom du fichier avec :",
    ar: 'اختر مجلداً أو مجموعة صور. سيقوم المعالج بربط كل صورة بالتلميذ المقابل تلقائياً عبر مقارنة اسم الملف بـ:',
  },
  bulkMatchMatricule: {
    en: 'Student ID (Matricule)',
    fr: 'Le matricule',
    ar: 'الرقم المدرسي (الماتريكول)',
  },
  bulkMatchName: {
    en: 'Full name',
    fr: 'Le nom complet',
    ar: 'الاسم الكامل',
  },
  bulkMatchUuid: {
    en: 'UUID Identifier',
    fr: "L'identifiant UUID",
    ar: 'المعرف الرقمي الفريد UUID',
  },
  bulkClickSelect: {
    en: 'Click to select photos',
    fr: 'Cliquez pour sélectionner les photos',
    ar: 'انقر لاختيار الصور',
  },
  bulkFilesSelected: {
    en: '{count} file(s) selected',
    fr: '{count} fichier(s) sélectionné(s)',
    ar: 'تم اختيار {count} ملف(ات)',
  },
  bulkAcceptedFormats: {
    en: 'Accepted formats: JPG, PNG (5 MB max per photo)',
    fr: 'Formats acceptés : JPG, PNG (5 Mo max par photo)',
    ar: 'الصيغ المقبولة: JPG, PNG (5 ميغابايت كحد أقصى لكل صورة)',
  },
  bulkBrowse: {
    en: 'Browse files',
    fr: 'Parcourir les fichiers',
    ar: 'استعراض الملفات',
  },
  bulkClose: {
    en: 'Close',
    fr: 'Fermer',
    ar: 'إغلاق',
  },
  bulkStartAssociation: {
    en: 'Start matching ({count})',
    fr: "Lancer l'association ({count})",
    ar: 'بدء عملية الربط ({count})',
  },
  bulkPhotosMatched: {
    en: '{count} photo(s) matched',
    fr: '{count} photo(s) associées',
    ar: 'تم ربط {count} صورة بنجاح',
  },
  bulkPhotosUnmatched: {
    en: '{count} unmatched',
    fr: '{count} non associée(s)',
    ar: '{count} صورة غير مطابقة',
  },
  bulkUnrecognized: {
    en: 'Unrecognized: {list}',
    fr: 'Non reconnus : {list}',
    ar: 'غير معروفة: {list}',
  },
  bulkUploadSuccess: {
    en: '{count} photo(s) updated successfully.',
    fr: '{count} photo(s) mise(s) à jour avec succès.',
    ar: 'تم تحديث {count} صورة بنجاح.',
  },
  bulkUploadFailed: {
    en: 'Bulk upload failed.',
    fr: 'Échec du téléversement groupé.',
    ar: 'فشل الرفع الجماعي للصور.',
  },
  bulkNetworkError: {
    en: 'Network error during bulk upload.',
    fr: 'Erreur réseau lors du téléversement groupé.',
    ar: 'خطأ في الشبكة أثناء الرفع الجماعي.',
  },
  noValidRowsFound: {
    en: 'No valid rows found. Please check that the file follows the template (fullName column required).',
    fr: 'Aucune ligne valide trouvée. Vérifiez que le fichier suit le modèle (colonne fullName requise).',
    ar: 'لم يتم العثور على أي سطر صالح. تأكد من مطابقة الملف للنموذج (عمود fullName إلزامي).',
  },
  importFailedGeneric: {
    en: 'Import failed.',
    fr: "Échec de l'import.",
    ar: 'فشلت عملية الاستيراد.',
  },
  connectionError: {
    en: 'Unable to connect.',
    fr: 'Connexion impossible.',
    ar: 'تعذر الاتصال بالخادم.',
  },
};

for (const [key, val] of Object.entries(studentsAdditions)) {
  en.Students[key] = val.en;
  fr.Students[key] = val.fr;
  ar.Students[key] = val.ar;
}

// 2. Settings additions (Hub + Modules + Categories)
const settingsAdditions = {
  hubPageTitle: {
    en: 'System Configuration Hub (PF-02)',
    fr: 'Espace de Configuration Système (PF-02)',
    ar: 'فضاء إعدادات النظام (PF-02)',
  },
  hubPageSubtitle: {
    en: 'Centralized access to all administrative modules and school policies.',
    fr: "Accès centralisé à l'ensemble des modules d'administration et politiques de votre établissement.",
    ar: 'الوصول المركزي إلى جميع وحدات الإدارة والسياسات الخاصة بمؤسستك.',
  },
  hubSearchPlaceholder: {
    en: 'Search a setting or module...',
    fr: 'Rechercher un paramètre ou module...',
    ar: 'البحث عن إعداد أو وحدة...',
  },
  configModules: {
    en: 'Configuration modules',
    fr: 'Modules de configuration',
    ar: 'وحدات الإعداد',
  },
  allConfigured: {
    en: 'All modules configured',
    fr: 'Tous les modules configurés',
    ar: 'تم إعداد جميع الوحدات',
  },
  modulesToConfigure: {
    en: '{count} module(s) to configure',
    fr: '{count} module(s) à configurer',
    ar: '{count} وحدة بحاجة للإعداد',
  },
  complianceStatus: {
    en: 'Compliance status',
    fr: 'Statut de conformité',
    ar: 'حالة الامتثال والمطابقة',
  },
  compliance_both: {
    en: 'PCG 2026 & CNDP compliant',
    fr: 'PCG 2026 & CNDP conformes',
    ar: 'مطابق لمعايير PCG 2026 و CNDP',
  },
  compliance_cndp_only: {
    en: 'CNDP filed · PCG not configured',
    fr: 'CNDP déposé · PCG non configuré',
    ar: 'تم إيداع CNDP · PCG غير معد',
  },
  compliance_pcg_only: {
    en: 'PCG 2026 configured · CNDP not filed',
    fr: 'PCG 2026 configuré · CNDP non déposé',
    ar: 'تم إعداد PCG 2026 · CNDP غير مودع',
  },
  compliance_none: {
    en: 'PCG 2026 & CNDP not configured',
    fr: 'PCG 2026 & CNDP non configurés',
    ar: 'PCG 2026 و CNDP غير معدين',
  },
  lastModification: {
    en: 'Last modification',
    fr: 'Dernière modification',
    ar: 'آخر تعديل',
  },
  byUser: {
    en: 'By {name}',
    fr: 'Par {name}',
    ar: 'بواسطة {name}',
  },
  noModifications: {
    en: 'No modifications recorded',
    fr: 'Aucune modification enregistrée',
    ar: 'لا توجد تعديلات مسجلة',
  },
  activeSchool: {
    en: 'Active institution',
    fr: 'Établissement actif',
    ar: 'المؤسسة النشطة',
  },
  notConfigured: {
    en: 'Not configured',
    fr: 'Non configuré',
    ar: 'غير مجهزة',
  },
  infoIncomplete: {
    en: 'Information incomplete',
    fr: 'Informations à compléter',
    ar: 'بيانات بحاجة للاستكمال',
  },
  configuredBadge: {
    en: 'Configured',
    fr: 'Configuré',
    ar: 'مُعدّ',
  },
  toConfigureBadge: {
    en: 'To configure',
    fr: 'À configurer',
    ar: 'قيد الإعداد',
  },
  accessModule: {
    en: 'Open module',
    fr: 'Accéder au module',
    ar: 'الدخول إلى الوحدة',
  },
  recentModifications: {
    en: 'Recent Settings Modifications',
    fr: 'Modifications Récentes des Paramètres',
    ar: 'آخر التعديلات على الإعدادات',
  },
  viewFullLog: {
    en: 'View full log',
    fr: 'Voir le journal complet',
    ar: 'عرض السجل الكامل',
  },
  noRecentModifications: {
    en: 'No recent modifications recorded.',
    fr: 'Aucune modification récente enregistrée.',
    ar: 'لا توجد أي تعديلات حديثة مسجلة.',
  },
  auditFeedSubtitle: {
    en: 'Configuration actions will appear here once the audit log is populated.',
    fr: "Les actions de configuration apparaîtront ici une fois le journal d'audit alimenté.",
    ar: 'ستظهر إجراءات الإعداد هنا بمجرد تغذية سجل التدقيق.',
  },
  auditedBadge: {
    en: 'Audited',
    fr: 'Audité',
    ar: 'مُدقّق',
  },
  cat_all: {
    en: 'All categories',
    fr: 'Toutes les catégories',
    ar: 'جميع الفئات',
  },
  cat_General: {
    en: 'General & Identity',
    fr: 'Général & Identité',
    ar: 'العام والهوية',
  },
  cat_Security: {
    en: 'Security & Access',
    fr: 'Sécurité & Accès',
    ar: 'الأمان والصلاحيات',
  },
  cat_Finance: {
    en: 'Finance & Accounting',
    fr: 'Finance & Comptabilité',
    ar: 'المالية والمحاسبة',
  },
  cat_Academic: {
    en: 'Academics & Policies',
    fr: 'Académique & Politiques',
    ar: 'الأكاديميا والسياسات',
  },
  cat_Integrations: {
    en: 'Integrations & SMS',
    fr: 'Intégrations & SMS',
    ar: 'الربط ورسائل SMS',
  },
  cat_System: {
    en: 'System & Infrastructure',
    fr: 'Système & Infrastructure',
    ar: 'النظام والبنية التحتية',
  },

  // 17 Modules
  mod_onboarding_title: {
    en: 'Organization & Identity',
    fr: 'Organisation & Identité',
    ar: 'المؤسسة والهوية الرسمية',
  },
  mod_onboarding_desc: {
    en: 'Legal name, tax identifiers (ICE/IF), logo, contact details, and official branding.',
    fr: 'Raison sociale, identifiants fiscaux (ICE/IF), logo, coordonnées et branding officiel.',
    ar: 'الاسم التجاري، المعرفات الجبائية (ICE/IF)، الشعار، معلومات الاتصال والهوية البصرية.',
  },
  mod_users_title: {
    en: 'Users, Roles & Permissions',
    fr: 'Utilisateurs, Rôles & Accès',
    ar: 'المستخدمون، الأدوار والصلاحيات',
  },
  mod_users_desc: {
    en: 'Staff and teacher accounts management, RBAC roles, and multi-site access scopes.',
    fr: "Gestion des comptes staff/enseignants, rôles RBAC et périmètres d'accès multi-sites.",
    ar: 'إدارة حسابات الطاقم والأساتذة، أدوار RBAC وصلاحيات الوصول متعددة المواقع.',
  },
  mod_security_title: {
    en: 'Security, Sessions & 2FA',
    fr: 'Sécurité, Sessions & 2FA',
    ar: 'الأمان، الجلسات و2FA',
  },
  mod_security_desc: {
    en: 'Two-factor authentication, active sessions, password policies, and trusted devices.',
    fr: 'Authentification à deux facteurs, sessions actives, politiques de mots de passe et trusted devices.',
    ar: 'المصادقة الثنائية، الجلسات النشطة، سياسات كلمات المرور والأجهزة الموثوقة.',
  },
  mod_login_events_title: {
    en: 'Login Activity Log',
    fr: 'Journal de connexion',
    ar: 'سجل تسجيلات الدخول',
  },
  mod_login_events_desc: {
    en: 'History of authentication attempts — successes, failures, IP addresses, and devices.',
    fr: "Historique des tentatives d'authentification email/mot de passe — réussites, échecs, adresse IP et appareil.",
    ar: 'سجل محاولات تسجيل الدخول بالبريد الإلكتروني — النجاحات، الإخفاقات، عناوين IP والأجهزة.',
  },
  mod_providers_title: {
    en: 'Connections & Providers',
    fr: 'Connexions & Fournisseurs',
    ar: 'الربط ومزودو الخدمات',
  },
  mod_providers_desc: {
    en: 'Orange/SMS.ma SMS gateways, SMTP email, S3 storage, and integration webhooks.',
    fr: "Passerelles SMS Orange/SMS.ma, SMTP Email, S3 Storage et webhooks d'intégration.",
    ar: 'بوابات SMS (أورانج/SMS.ma)، بريد SMTP، تخزين S3 وخطافات الربط البرمجية (Webhooks).',
  },
  mod_accounting_defaults_title: {
    en: 'Accounting & PCG Mapping',
    fr: 'Comptabilité & Liaisons PCG',
    ar: 'المحاسبة والربط مع PCG',
  },
  mod_accounting_defaults_desc: {
    en: 'Moroccan General Accounting Plan (PCG 2026) mapping, currencies, journals, and VAT (20%).',
    fr: 'Mapping du Plan Comptable Général Marocain (PCG 2026), devises, journaux et TVA (20%).',
    ar: 'ربط المخطط المحاسبي العام المغربي (PCG 2026)، العملات، الدفاتر اليومية والضريبة (20%).',
  },
  mod_translations_title: {
    en: 'Translations & Custom Fields',
    fr: 'Traductions & Champs Sur Mesure',
    ar: 'الترجمات والحقول المخصصة',
  },
  mod_translations_desc: {
    en: 'Labels dictionary (FR/AR/EN) with RTL support and custom attributes.',
    fr: 'Dictionnaire des libellés (FR/AR/EN) avec support RTL et attributs personnalisés.',
    ar: 'قاموس النصوص (عربي/فرنسي/إنجليزي) مع دعم RTL والسمات المخصصة.',
  },
  mod_jobs_title: {
    en: 'Scheduled Jobs & Audit',
    fr: 'Tâches Planifiées & Audit',
    ar: 'المهام المجدولة وسجل التدقيق',
  },
  mod_jobs_desc: {
    en: 'Background health pings, infrastructure status, maintenance, and audit logging.',
    fr: "Pings d'arrière-plan, santé de l'infrastructure, maintenance et journal d'audit.",
    ar: 'فحوصات الخلفية، صحة البنية التحتية، الصيانة وسجل العمليات الإدارية.',
  },
  mod_migration_title: {
    en: 'Data Migration Center',
    fr: 'Centre de Migration Fichiers',
    ar: 'مركز ترحيل الملفات',
  },
  mod_migration_desc: {
    en: 'Importing students and guardians, Excel column mapping, and data integrity checks.',
    fr: "Importation des élèves/tuteurs, cartographie des champs Excel et validation de cohérence.",
    ar: 'استيراد التلاميذ والأولياء، مطابقة حقول Excel والتحقق من التناسق.',
  },
  mod_policies_title: {
    en: 'Academic Policies & Portals',
    fr: 'Politiques Académiques & Portails',
    ar: 'السياسات الأكاديمية والبوابات',
  },
  mod_policies_desc: {
    en: 'Evaluation rules, attendance thresholds, parent/student portals, and guardian access.',
    fr: "Règles d'évaluation, seuils de présence, portails parents/élèves et accès tuteurs.",
    ar: 'قواعد التقييم، عتبات الغياب، بوابات أولياء الأمور والتلاميذ والولوج الخاص.',
  },
  mod_entitlements_title: {
    en: 'Modules Catalog & Licenses',
    fr: 'Catalogue des Modules & Licences',
    ar: 'دليل الوحدات والتراخيص',
  },
  mod_entitlements_desc: {
    en: 'Subscribed add-ons management, student/staff quotas, and plan upgrades.',
    fr: "Gestion des add-ons souscrits, quotas élèves/staff et mises à niveau de l'abonnement.",
    ar: 'إدارة الإضافات المفعلة، حصص التلاميذ والطاقم وترقيات الاشتراك.',
  },
  mod_drafts_title: {
    en: 'Settings Approvals & Drafts',
    fr: 'Approbation des paramètres',
    ar: 'اعتماد التعديلات والمسودات',
  },
  mod_drafts_desc: {
    en: 'Change proposals with dual authorization: author proposes, second administrator approves.',
    fr: "Propositions de modification avec séparation des tâches : l'auteur propose, un second administrateur valide.",
    ar: 'اقتراحات التعديل مع فصل المهام: المشرف يقترح، ومدير ثانٍ يعتمد التعديل.',
  },
  mod_numbering_title: {
    en: 'Document Numbering Series',
    fr: 'Séries de numérotation',
    ar: 'سلاسل الترقيم والتسلسل',
  },
  mod_numbering_desc: {
    en: 'Numbering sequences for documents (invoices, matricules): prefix, suffix, padding, and step.',
    fr: 'Séquences de numérotation pour documents (factures, matricules) : préfixe, suffixe, remplissage et pas.',
    ar: 'تسلسلات الترقيم للوثائق (الفواتير، المعرفات المدرسية): البادئة، اللاحقة وعدد الخانات.',
  },
  mod_custom_fields_title: {
    en: 'Custom Fields',
    fr: 'Champs personnalisés',
    ar: 'الحقول الإضافية المخصصة',
  },
  mod_custom_fields_desc: {
    en: 'Custom attributes for students, guardians, and employees: text, number, date, list, and boolean.',
    fr: 'Attributs sur mesure pour élèves, tuteurs et employés : texte, nombre, date, liste et booléen.',
    ar: 'سمات مخصصة للتلاميذ، الأولياء والموظفين: نصوص، أرقام، تواريخ وقوائم خيارات.',
  },
  mod_scheduled_jobs_title: {
    en: 'Automated Jobs',
    fr: 'Tâches automatisées',
    ar: 'المهام التلقائية الدورية',
  },
  mod_scheduled_jobs_desc: {
    en: 'Periodic executions (cleanup expired sessions) with execution logs and manual triggers.',
    fr: 'Exécutions périodiques (purge des sessions expirées) avec historique des exécutions et activation à la demande.',
    ar: 'العمليات الدورية (تنظيف الجلسات المنتهية) مع سجل التنفيذ والتشغيل عند الطلب.',
  },
  mod_branches_title: {
    en: 'Branches & Multi-Campus',
    fr: 'Annexes & Multi-Sites',
    ar: 'الفروع والمواقع المتعددة',
  },
  mod_branches_desc: {
    en: 'Campus management (Casablanca, Rabat, Marrakech) and geographic zones.',
    fr: 'Gestion des campus (Casablanca, Rabat, Marrakech) et périmètres géographiques.',
    ar: 'إدارة الفروع (الدار البيضاء، الرباط، مراكش) والنطاقات الجغرافية.',
  },
  mod_cndp_title: {
    en: 'CNDP Compliance & Data Privacy',
    fr: 'Conformité CNDP & Données',
    ar: 'مطابقة CNDP وحماية البيانات',
  },
  mod_cndp_desc: {
    en: 'CNDP Law 09-08 registry, privacy consent tracking, and data purging workflows.',
    fr: 'Registre CNDP Loi 09-08, consentement RGPD/CNDP et purges RGPD des données.',
    ar: 'سجل تصاريح CNDP بموجب القانون 09-08، إدارة الموافقات وتطهير البيانات الحساسة.',
  },
};

for (const [key, val] of Object.entries(settingsAdditions)) {
  en.Settings[key] = val.en;
  fr.Settings[key] = val.fr;
  ar.Settings[key] = val.ar;
}

// 3. Reports additions (Ready, Actions, plus all 27 report definitions)
const reportsAdditions = {
  ready: {
    en: 'Ready',
    fr: 'Prêt',
    ar: 'جاهز',
  },
  notReady: {
    en: 'Not enabled',
    fr: 'Non activé',
    ar: 'غير مفعل',
  },
  openReport: {
    en: 'Open',
    fr: 'Ouvrir',
    ar: 'فتح',
  },
  unavailable: {
    en: 'Unavailable',
    fr: 'Indisponible',
    ar: 'غير متاح',
  },
  addFavorite: {
    en: 'Add to favorites',
    fr: 'Ajouter aux favoris',
    ar: 'إضافة إلى المفضلة',
  },
  removeFavorite: {
    en: 'Remove from favorites',
    fr: 'Retirer des favoris',
    ar: 'إزالة من المفضلة',
  },

  // 27 Reports
  rep_student_credentials_title: {
    en: 'Student Account Activation Status',
    fr: "État d'Activation des Comptes Élèves",
    ar: 'حالة تفعيل حسابات التلاميذ',
  },
  rep_student_credentials_desc: {
    en: 'Student account activation and readiness report (without secrets or passwords).',
    fr: "Rapport d'activation et de préparation des comptes élèves (sans secrets ni mots de passe).",
    ar: 'تقرير تفعيل وجاهزية حسابات التلاميذ (بدون كلمات مرور أو بيانات سرية).',
  },
  rep_student_admission_funnel_title: {
    en: 'Admissions Conversion Funnel',
    fr: 'Entonnoir de Conversion des Admissions',
    ar: 'مراحل تحويل واستقطاب التسجيلات',
  },
  rep_student_admission_funnel_desc: {
    en: 'Analysis of lead progression from initial inquiry to final enrollment.',
    fr: "Analyse du flux des prospects de la demande d'information jusqu'à l'inscription finale.",
    ar: 'تحليل مسار المترشحين من طلب المعلومات الأولي حتى التسجيل النهائي.',
  },
  rep_student_class_section_occupancy_title: {
    en: 'Class & Section Occupancy Rate',
    fr: "Taux d'Occupation des Classes & Sections",
    ar: 'نسبة إشغال الأقسام والأفواج',
  },
  rep_student_class_section_occupancy_desc: {
    en: 'Enrollment numbers and capacity report by class, section, and educational cycle.',
    fr: "Rapport d'effectifs et de capacité d'accueil par classe, section et cycle.",
    ar: 'تقرير الأعداد والطاقة الاستيعابية حسب القسم والفوج والسلك التعليمي.',
  },
  rep_student_siblings_title: {
    en: 'Household & Sibling Distribution',
    fr: 'Répartition par Foyer & Fratrie',
    ar: 'توزيع الأسر والإخوة',
  },
  rep_student_siblings_desc: {
    en: 'Grouping of students by household and authorized legal guardian.',
    fr: 'Groupement des élèves par foyer familial et tuteur légal autorisé.',
    ar: 'تجميع التلاميذ حسب الأسرة وولي الأمر القانوني المعتمد.',
  },
  rep_fees_summary_title: {
    en: 'Tuition Fees Global Summary',
    fr: 'Récapitulatif Global des Frais Scolaires',
    ar: 'الملخص الشامل للواجبات المدرسية',
  },
  rep_fees_summary_desc: {
    en: 'Summary of issued invoices, discounts, collected payments, and balances due.',
    fr: 'Synthèse des factures émises, remises, paiements perçus et soldes dus.',
    ar: 'ملخص الفواتير الصادرة، الخصومات، المبالغ المستخلصة والديون المتبقية.',
  },
  rep_fees_receipts_title: {
    en: 'Cash Receipts Register',
    fr: 'Journal des Reçus de Caisse',
    ar: 'سجل إيصالات الصندوق',
  },
  rep_fees_receipts_desc: {
    en: 'List of cash collections recorded by session, payment method, and cashier.',
    fr: 'Liste des encaissements enregistrés par session de caisse, mode de règlement et caissier.',
    ar: 'قائمة المداخيل المسجلة حسب جلسة الصندوق وطريقة الأداء وأمين الصندوق.',
  },
  rep_fees_due_aging_title: {
    en: 'Aging of Outstanding Fees (Collection)',
    fr: 'Balance Âgée des Impayés (Recouvrement)',
    ar: 'ميزان أعمار الديون غير المستخلصة',
  },
  rep_fees_due_aging_desc: {
    en: 'Aging analysis of overdue receivables (Current, 1-30, 31-60, 61-90, 90+ days).',
    fr: "Analyse de l'ancienneté des créances échues (Courant, 1-30, 31-60, 61-90, 90+ jours).",
    ar: 'تحليل أقدمية المستحقات المالية المتأخرة (جارية، 1-30، 31-60، 61-90، +90 يوماً).',
  },
  rep_fees_fines_title: {
    en: 'Penalties & Waivers Register',
    fr: 'Registre des Pénalités & Exonérations',
    ar: 'سجل الغرامات والإعفاءات',
  },
  rep_fees_fines_desc: {
    en: 'Tracking of late fees applied, collected, waived, or cancelled.',
    fr: 'Suivi des frais de retard appliqués, encaissés, exonérés ou annulés.',
    ar: 'متابعة ذعائر وغرامات التأخير المطبقة، المحصلة، المعفاة أو الملغاة.',
  },
  rep_finance_statement_title: {
    en: 'Third-Party / Guardian Account Statement',
    fr: 'Relevé de Compte Tiers / Tuteur',
    ar: 'كشف حساب ولي الأمر / الأطراف الأخرى',
  },
  rep_finance_statement_desc: {
    en: 'Chronological history of debits, credits, and rolling balance of an account.',
    fr: "Historique chronologique des débits, crédits et solde progressif d'un compte.",
    ar: 'سجل زمني للعمليات المدينة والدائنة والرصيد المتراكم للحساب.',
  },
  rep_finance_income_expense_title: {
    en: 'Profit & Loss Statement (CPC)',
    fr: 'Compte de Produits et Charges (CPC)',
    ar: 'حساب العائدات والتكاليف (CPC)',
  },
  rep_finance_income_expense_desc: {
    en: 'Periodic breakdown of tuition revenues and operating expenses.',
    fr: "Ventilation périodique des recettes de scolarité et des dépenses d'exploitation.",
    ar: 'توزيع دوري لمداخيل التمدرس ومصاريف التشغيل والاستغلال.',
  },
  rep_finance_transactions_title: {
    en: 'General Ledger / Journal Entries',
    fr: 'Grand Livre / Journal des Écritures',
    ar: 'دفتر الأستاذ العام / سجل القيود اليومية',
  },
  rep_finance_transactions_desc: {
    en: 'Exhaustive details of validated accounting journal rows.',
    fr: 'Détail exhaustif des lignes de journal comptable validées.',
    ar: 'تفاصيل شاملة لقيود اليومية المحاسبية المعتمدة.',
  },
  rep_finance_balance_sheet_title: {
    en: 'Balance Sheet (Assets = Liabilities + Equity)',
    fr: 'Bilan Comptable (Actif = Passif + Capitaux)',
    ar: 'الميزانية المحاسبية (الأصول = الخصوم + حقوق الملكية)',
  },
  rep_finance_balance_sheet_desc: {
    en: 'Financial position at period close (Assets = Liabilities + Equity).',
    fr: 'État du patrimoine financier à la clôture de période (Actif = Passif + Capitaux Propres).',
    ar: 'وضعية الذمة المالية عند إقفال الدورة (الأصول = الخصوم + الأموال الذاتية).',
  },
  rep_finance_income_vs_expense_title: {
    en: 'Income vs Expense Trend Comparison',
    fr: 'Tendance Comparée Produits vs Charges',
    ar: 'مقارنة تطور الإيرادات والمصاريف',
  },
  rep_finance_income_vs_expense_desc: {
    en: 'Monthly progression of collected income compared to paid expenses.',
    fr: 'Évolution mensuelle des recettes encaissées par rapport aux dépenses payées.',
    ar: 'التطور الشهري للإيرادات المحصلة مقارنة بالنفقات المؤداة.',
  },
  rep_attendance_student_log_title: {
    en: 'Detailed Student Attendance History',
    fr: 'Historique Détaillé des Présences Élève',
    ar: 'سجل الحضور المفصل للتلميذ',
  },
  rep_attendance_student_log_desc: {
    en: 'Individual breakdown of sessions, tardiness in minutes, excuses, and reasons.',
    fr: 'Relevé individuel des séances, retards en minutes, justifications et motifs.',
    ar: 'كشف فردي للحصص ودقائق التأخر والمبررات والأسباب.',
  },
  rep_attendance_daily_matrix_title: {
    en: 'Daily Attendance Matrix by Section',
    fr: 'Matrice Journalière de Présence par Section',
    ar: 'مصفوفة الحضور اليومية حسب الفوج',
  },
  rep_attendance_daily_matrix_desc: {
    en: 'Daily roll call grid by class/section with locked register indicators.',
    fr: "Grille d'appel journalier par classe/section avec indicateur de registres verrouillés.",
    ar: 'جدول المناداة اليومي حسب القسم والفوج مع مؤشر السجلات المقفلة.',
  },
  rep_attendance_overview_streaks_title: {
    en: 'Attendance Summary & Recurrence Alerts',
    fr: "Synthèse d'Assiduité & Alertes Récurrence",
    ar: 'خلاصة المواظبة وتنبيهات الغياب المتكرر',
  },
  rep_attendance_overview_streaks_desc: {
    en: 'Global attendance statistics and detection of consecutive unexcused absences.',
    fr: "Statistiques globales de présence et identification des séries d'absences injustifiées.",
    ar: 'إحصائيات المواظبة العامة وتحديد حالات التغيب المتكرر غير المبرر.',
  },
  rep_attendance_employee_summary_title: {
    en: 'Staff Attendance & Working Hours Log',
    fr: 'Pointage & Heures de Présence Personnel',
    ar: 'تسجيل وساعات حضور الموظفين',
  },
  rep_attendance_employee_summary_desc: {
    en: 'Hours worked, tardiness, and absences of teaching and administrative staff.',
    fr: 'Heures travaillées, retards et absences du personnel enseignant et administratif.',
    ar: 'ساعات العمل والتأخيرات والغيابات الخاصة بالطاقم التربوي والإداري.',
  },
  rep_attendance_exam_session_title: {
    en: 'Exam Session Attendance & Sign-In',
    fr: "Émargement des Séances d'Examen",
    ar: 'توقيعات حضور دورات الامتحانات',
  },
  rep_attendance_exam_session_desc: {
    en: 'Candidate attendance, signature confirmation, and incidents during exams.',
    fr: "Présence, émargement et incidents des candidats en salle d'examen.",
    ar: 'حضور وتوقيعات وملاحظات المترشحين في قاعات الامتحانات.',
  },
  rep_hr_payroll_summary_title: {
    en: 'Payroll & Salary Summary',
    fr: 'Masse Salariale & Synthèse de Paie',
    ar: 'كتلة الأجور وملخص الرواتب',
  },
  rep_hr_payroll_summary_desc: {
    en: 'Summary of gross salaries, contributions, and net pay by department.',
    fr: 'Synthèse des traitements bruts, cotisations et net à payer par département (avec masquage si < 3 personnes).',
    ar: 'ملخص الرواتب الإجمالية والاشتراكات وصافي الأداء حسب القسم.',
  },
  rep_hr_leave_balances_title: {
    en: 'Staff Leave Entitlements & Balances',
    fr: 'Droits & Soldes de Congés du Personnel',
    ar: 'أرصدة وحقوق إجازات الموظفين',
  },
  rep_hr_leave_balances_desc: {
    en: 'Accrued, taken, and remaining vacation days counter per staff member.',
    fr: 'Compteur des jours de congés acquis, pris et solde restant par collaborateur.',
    ar: 'عداد أيام الإجازات المكتسبة والمستنفدة والرصيد المتبقي لكل موظف.',
  },
  rep_exam_report_card_title: {
    en: 'Official Report Card (Exam Snapshot)',
    fr: 'Bulletin Scolaire Officiel (Snapshot Examen)',
    ar: 'بيان النقط الرسمي (نسخة معتمدة)',
  },
  rep_exam_report_card_desc: {
    en: 'Generation and archiving of official validated student report cards.',
    fr: 'Génération et archivage des bulletins de notes officiels validés.',
    ar: 'إصدار وأرشفة بيانات النقط المدرسية الرسمية المعتمدة.',
  },
  rep_exam_tabulation_sheet_title: {
    en: 'Marks Tabulation Sheet & Council Minutes',
    fr: 'Procès-Verbal & Feuille de Tabulation des Notes',
    ar: 'محضر النقط وجدول حصر النتائج',
  },
  rep_exam_tabulation_sheet_desc: {
    en: 'Cross-tabulation summary table of student marks by subject for class councils.',
    fr: 'Tableau récapitulatif des notes par élève x matière pour conseil de classe.',
    ar: 'جدول تفريغ نتائج التلاميذ مادة بمادة الموجه لمجالس الأقسام.',
  },
  rep_exam_progress_title: {
    en: 'Academic Progress & Skills Tracking',
    fr: 'Suivi de la Progression & Compétences',
    ar: 'تتبع التطور واكتساب المهارات',
  },
  rep_exam_progress_desc: {
    en: 'Comparative analysis of student performance across evaluation periods.',
    fr: "Analyse comparative des résultats d'un élève au fil des périodes d'évaluation.",
    ar: 'تحليل مقارن لنتائج التلميذ عبر فترات التقييم المتعاقبة.',
  },
  rep_inventory_stock_valuation_title: {
    en: 'Inventory & Stock Valuation',
    fr: 'Inventaire & Valorisation des Stocks',
    ar: 'جرد وتقييم قيمة المخزون',
  },
  rep_inventory_stock_valuation_desc: {
    en: 'Quantities on hand, reorder thresholds, and financial valuation of items.',
    fr: 'Quantités en stock, seuils de réapprovisionnement et valeur financière des articles.',
    ar: 'الكميات المتوفرة، عتبات إعادة الطلب والقيمة المالية للمواد والمعدات.',
  },
  rep_inventory_purchase_summary_title: {
    en: 'Purchases Journal & Supplier Receipts',
    fr: 'Journal des Achats & Réceptions Fournisseurs',
    ar: 'سجل المشتريات وتوريدات الموردين',
  },
  rep_inventory_purchase_summary_desc: {
    en: 'Equipment and supply purchase orders classified by vendor and delivery status.',
    fr: "Commandes d'achats d'équipements et fournitures par fournisseur et statut.",
    ar: 'طلبات شراء التجهيزات واللوازم حسب المورد وحالة التوريد.',
  },
  rep_inventory_sales_revenue_title: {
    en: 'School Store & Bookstore Sales',
    fr: 'Ventes Boutique Scolaire & Manuels',
    ar: 'مبيعات المتجر والكتب المدرسية',
  },
  rep_inventory_sales_revenue_desc: {
    en: 'Sales of supplies, uniforms, and textbooks in the school bookstore.',
    fr: "Ventes d'articles, fournitures et manuels scolaires à la boutique de l'école.",
    ar: 'مبيعات اللوازم والزي المدرسي والكتب في متجر المؤسسة.',
  },
  rep_inventory_issues_custody_title: {
    en: 'Equipment Loans & Asset Custody',
    fr: "Prêts d'Équipements & Consommations",
    ar: 'إعارة التجهيزات والعهد المدرسية',
  },
  rep_inventory_issues_custody_desc: {
    en: 'Equipment loaned to staff or students, return due dates, and overdue alerts.',
    fr: "Matériel prêté au personnel/élèves, dates d'échéance de retour et retards.",
    ar: 'المعدات المعارة للأساتذة أو التلاميذ ومواعيد الإرجاع والتأخيرات.',
  },
};

for (const [key, val] of Object.entries(reportsAdditions)) {
  en.Reports[key] = val.en;
  fr.Reports[key] = val.fr;
  ar.Reports[key] = val.ar;
}

// 4. Leadership Namespace
const leadershipNamespace = {
  portalTitle: {
    en: 'Leadership Portal',
    fr: 'Portail direction',
    ar: 'بوابة الإدارة العامة',
  },
  portalSubtitle: {
    en: 'Monitor institutional strategic performance and steer organizational priorities.',
    fr: 'Suivez la performance stratégique de votre établissement et pilotez les priorités institutionnelles.',
    ar: 'متابعة الأداء الاستراتيجي للمؤسسة وقيادة الأولويات الإدارية والتربوية.',
  },
  last6Months: {
    en: 'Last 6 months',
    fr: '6 derniers mois',
    ar: 'آخر 6 أشهر',
  },
  last30Days: {
    en: 'Last 30 days',
    fr: '30 derniers jours',
    ar: 'آخر 30 يوماً',
  },
  export: {
    en: 'Export',
    fr: 'Exporter',
    ar: 'تصدير',
  },
  enrolledStudents: {
    en: 'Enrolled Students',
    fr: 'Élèves inscrits',
    ar: 'التلاميذ المسجلون',
  },
  newThisMonth: {
    en: '{count} new this month',
    fr: '{count} nouveau(x) ce mois-ci',
    ar: '{count} مسجل جديد هذا الشهر',
  },
  attendanceRate: {
    en: 'Attendance Rate',
    fr: 'Taux de présence',
    ar: 'نسبة الحضور',
  },
  last30DaysSubtitle: {
    en: 'Last 30 days',
    fr: '30 derniers jours',
    ar: 'آخر 30 يوماً',
  },
  feeCollection: {
    en: 'Fee Collection',
    fr: 'Recouvrement frais',
    ar: 'تحصيل الرسوم',
  },
  generalAverage: {
    en: 'General Average',
    fr: 'Moyenne générale',
    ar: 'المعدل العام',
  },
  evaluationResults: {
    en: 'Assessment results',
    fr: "Résultats d'évaluations",
    ar: 'نتائج التقييمات',
  },
  insufficientData: {
    en: 'Insufficient data',
    fr: 'Données insuffisantes',
    ar: 'بيانات غير كافية',
  },
  unresolvedAlerts: {
    en: 'Unresolved Alerts',
    fr: 'Alertes non résolues',
    ar: 'التنبيهات العالقة',
  },
  alertsSummary: {
    en: '{critical} critical • {important} imp.',
    fr: '{critical} critiques • {important} imp.',
    ar: '{critical} حرجة • {important} هامة',
  },
  staffAttendance: {
    en: 'Staff Attendance',
    fr: 'Présence personnel',
    ar: 'حضور الموظفين',
  },
  employeesCount: {
    en: '{count} employees',
    fr: '{count} employés',
    ar: '{count} موظف',
  },
  enrollmentTrends: {
    en: 'Enrollment Trends',
    fr: 'Tendances des Inscriptions',
    ar: 'تطور مؤشرات التسجيل',
  },
  enrollmentTrendsSub: {
    en: 'Monthly inflow of newly admitted students',
    fr: 'Flux mensuel des nouveaux élèves admis',
    ar: 'التدفق الشهري للتلاميذ الجدد المقبولين',
  },
  enrollmentTrendsDesc: {
    en: 'Monthly evolution of admissions',
    fr: 'Évolution mensuelle des inscriptions',
    ar: 'التطور الشهري لعمليات التسجيل',
  },
  financialPerformance: {
    en: 'Financial Performance',
    fr: 'Performance Financière',
    ar: 'الأداء المالي العام',
  },
  financialPerformanceSub: {
    en: 'Invoiced vs Collected Revenue (MAD)',
    fr: 'Recettes facturées vs montants encaissés (MAD)',
    ar: 'المداخيل المفوترة مقابل المبالغ المحصلة (درهم)',
  },
  invoiced: {
    en: 'Invoiced',
    fr: 'Facturé',
    ar: 'المفوتر',
  },
  collected: {
    en: 'Collected',
    fr: 'Encaissé',
    ar: 'المحصل',
  },
  expenses: {
    en: 'Expenses',
    fr: 'Dépenses',
    ar: 'المصاريف',
  },
  collectionRateLabel: {
    en: 'Collection rate',
    fr: "Taux d'encaissement",
    ar: 'نسبة الاستخلاص',
  },
  outstandingBalance: {
    en: 'Outstanding balance',
    fr: 'Solde restant dû',
    ar: 'المبلغ المتبقي واجب الأداء',
  },
  discountsGranted: {
    en: 'Discounts granted',
    fr: 'Remises accordées',
    ar: 'الخصومات الممنوحة',
  },
  igpTitle: {
    en: 'Global Performance Indicator (IGP)',
    fr: 'Indicateur Global de Performance (IGP)',
    ar: 'المؤشر العام للأداء (IGP)',
  },
  igpSub: {
    en: 'Weighted synthetic index (Academics 40%, Attendance 30%, Collection 30%)',
    fr: 'Indice synthétique pondéré (Académique 40%, Présence 30%, Recouvrement 30%)',
    ar: 'مؤشر تركيبي مرجح (أكاديمي 40%، حضور 30%، تحصيل 30%)',
  },
  currentScore: {
    en: 'Current score',
    fr: 'Score actuel',
    ar: 'النتيجة الحالية',
  },
  vsPreviousPeriod: {
    en: 'vs previous period',
    fr: 'vs période précédente',
    ar: 'مقارنة بالفترة السابقة',
  },
  riskRegistry: {
    en: 'Risk & Alerts Registry',
    fr: 'Registre des Risques & Alertes',
    ar: 'سجل المخاطر والتنبيهات',
  },
  riskLevel: {
    en: 'Level',
    fr: 'Niveau',
    ar: 'المستوى',
  },
  riskDescription: {
    en: 'Description',
    fr: 'Description',
    ar: 'الوصف',
  },
  riskStatus: {
    en: 'Status',
    fr: 'Statut',
    ar: 'الحالة',
  },
  riskCritical: {
    en: 'Critical',
    fr: 'Critique',
    ar: 'حرج',
  },
  riskImportant: {
    en: 'Important',
    fr: 'Importante',
    ar: 'هام',
  },
  riskModerate: {
    en: 'Moderate',
    fr: 'Modérée',
    ar: 'متوسط',
  },
  unresolved: {
    en: 'Unresolved',
    fr: 'Non résolu',
    ar: 'قيد المعالجة',
  },
  resolved: {
    en: 'Resolved',
    fr: 'Résolu',
    ar: 'تم الحل',
  },
  noRisksReported: {
    en: 'No risks reported for this period.',
    fr: 'Aucun risque signalé sur la période.',
    ar: 'لا توجد مخاطر مسجلة خلال هذه الفترة.',
  },
  priorityActions: {
    en: 'Priority Actions',
    fr: 'Actions Prioritaires',
    ar: 'الإجراءات ذات الأولوية',
  },
  actionTask: {
    en: 'Task',
    fr: 'Tâche',
    ar: 'المهمة',
  },
  actionPriority: {
    en: 'Priority',
    fr: 'Priorité',
    ar: 'الأولوية',
  },
  priorityHigh: {
    en: 'High',
    fr: 'Haute',
    ar: 'عالية',
  },
  priorityMedium: {
    en: 'Medium',
    fr: 'Moyenne',
    ar: 'متوسطة',
  },
  noPriorityActions: {
    en: 'No pending priority actions.',
    fr: 'Aucune action prioritaire en attente.',
    ar: 'لا توجد إجراءات عاجلة قيد الانتظار.',
  },
  insightsTitle: {
    en: 'Strategic Insights & Opportunities',
    fr: 'Insights & Opportunités Stratégiques',
    ar: 'تحليلات ورؤى استراتيجية',
  },
  meetingsTitle: {
    en: 'Councils & Meetings',
    fr: 'Conseils & Rendez-vous',
    ar: 'المجالس والمواعيد',
  },
  scheduleMeeting: {
    en: 'Schedule',
    fr: 'Planifier',
    ar: 'برمجة موعد',
  },
  notesTitle: {
    en: 'Leadership Notes & Directives',
    fr: 'Notes & Décisions Direction',
    ar: 'مذكرات وقرارات الإدارة',
  },
  newNote: {
    en: 'New note',
    fr: 'Nouvelle note',
    ar: 'مذكرة جديدة',
  },
  noNotesYet: {
    en: 'No notes yet.',
    fr: 'Aucune note pour le moment.',
    ar: 'لا توجد أي مذكرات حالياً.',
  },
  addNotePlaceholder: {
    en: 'Add an administrative note...',
    fr: 'Ajouter une note de direction...',
    ar: 'إضافة مذكرة إدارية...',
  },
  institutionPerformance: {
    en: "Institution Performance Overview",
    fr: "Aperçu des performances de l'institution",
    ar: "نظرة عامة على أداء المؤسسة",
  },
  vsPreviousMonth: {
    en: "vs previous month",
    fr: "vs mois précédent",
    ar: "مقارنة بالشهر السابق",
  },
  derivedIndexBadge: {
    en: "Index derived from real data",
    fr: "Indice dérivé des données réelles",
    ar: "مؤشر مستمد من بيانات حقيقية",
  },
  igpScale: {
    en: "/ 100 (GPI out of 100)",
    fr: "/ 100 (IGP sur 100)",
    ar: "/ 100 (مؤشر الأداء من 100)",
  },
  noActivityIgp: {
    en: "No measurable activity during this period — index will be computed upon initial data.",
    fr: "Aucune activité mesurable sur la période — l'indice sera calculé dès les premières données.",
    ar: "لا يوجد نشاط قابل للقياس خلال هذه الفترة — سيتم حساب المؤشر فور توفر البيانات الأولى.",
  },
  academicPerformance: {
    en: "Academic Performance",
    fr: "Performance académique",
    ar: "الأداء الأكاديمي",
  },
  allEvaluationsAverage: {
    en: "Overall average (all evaluations)",
    fr: "Moyenne générale (toutes évaluations)",
    ar: "المعدل العام (جميع التقييمات)",
  },
  levelDetailNote: {
    en: "Breakdown by level (Primary / Middle / High School) will be available once results are recorded.",
    fr: "Le détail par niveau (Primaire / Collège / Lycée) sera disponible dès la saisie des résultats.",
    ar: "التفصيل حسب السلك (ابتدائي / إعدادي / ثانوي) سيكون متاحاً فور تسجيل النتائج.",
  },
  noEvaluationResults: {
    en: "No evaluation results recorded yet.",
    fr: "Aucun résultat d'évaluation enregistré pour le moment.",
    ar: "لا توجد نتائج تقييمات مسجلة حتى الآن.",
  },
  viewFullAcademicReport: {
    en: "View full academic report →",
    fr: "Voir le rapport académique complet →",
    ar: "عرض التقرير الأكاديمي الكامل ←",
  },
  keyInsights: {
    en: "Key Insights",
    fr: "Insights clés",
    ar: "أبرز المؤشرات الذكية",
  },
  noInsightsYet: {
    en: "Insights will activate as school activity builds (attendance, fee collection, alerts).",
    fr: "Les insights s'activeront avec l'activité de l'établissement (présence, recouvrement, alertes).",
    ar: "ستتفاعل المؤشرات الذكية تدريجياً مع تزايد أنشطة المؤسسة (الحضور، الاستخلاص، التنبيهات).",
  },
  viewAllInsights: {
    en: "View all insights →",
    fr: "Voir tous les insights →",
    ar: "عرض جميع المؤشرات الذكية ←",
  },
  financialOverview: {
    en: "Financial Overview",
    fr: "Aperçu financier",
    ar: "نظرة عامة على المالية",
  },
  viewFinancialDashboard: {
    en: "View financial dashboard",
    fr: "Voir le tableau de bord financier",
    ar: "عرض لوحة القيادة المالية",
  },
  targetMad: {
    en: "MAD Target",
    fr: "MAD Objectif",
    ar: "الهدف (درهم)",
  },
  collectedLabel: {
    en: "Collected",
    fr: "Recouvré",
    ar: "المستخلص",
  },
  toCollectLabel: {
    en: "To collect",
    fr: "À recouvrir",
    ar: "قيد التحصيل",
  },
  discountsLabel: {
    en: "Discounts & waivers",
    fr: "Réductions & remises",
    ar: "التخفيضات والخصومات",
  },
  risksAndAlerts: {
    en: "Risks & Alerts",
    fr: "Risques & alertes",
    ar: "المخاطر والتنبيهات",
  },
  alertsCount: {
    en: "{count} alert(s)",
    fr: "{count} alerte(s)",
    ar: "{count} تنبيه(ات)",
  },
  viewRiskRegistry: {
    en: "View risk registry →",
    fr: "Voir le registre des risques →",
    ar: "عرض سجل المخاطر ←",
  },
  staffOverview: {
    en: "Staff Overview",
    fr: "Aperçu du personnel",
    ar: "نظرة عامة على الموظفين",
  },
  realData: {
    en: "Real data",
    fr: "Données réelles",
    ar: "بيانات حقيقية",
  },
  totalEmployeesLabel: {
    en: "Total Employees",
    fr: "Total employés",
    ar: "مجموع الموظفين",
  },
  avgAttendanceLabel: {
    en: "Avg Attendance",
    fr: "Présence moy.",
    ar: "متوسط الحضور",
  },
  teachersLabel: {
    en: "Teachers",
    fr: "Enseignants",
    ar: "الأساتذة",
  },
  viewHrDashboard: {
    en: "View HR dashboard →",
    fr: "Voir le tableau de bord RH →",
    ar: "عرض لوحة قيادة الموارد البشرية ←",
  },
  upcomingMeetings: {
    en: "Upcoming Meetings",
    fr: "Réunions à venir",
    ar: "الاجتماعات القادمة",
  },
  viewCalendar: {
    en: "View calendar",
    fr: "Voir le calendrier",
    ar: "عرض التقويم",
  },
  meetingResponsible: {
    en: "Responsible: {owner}",
    fr: "Responsable : {owner}",
    ar: "المسؤول: {owner}",
  },
  noUpcomingMeetings: {
    en: "No upcoming parent meetings.",
    fr: "Aucun rendez-vous parent à venir.",
    ar: "لا توجد مواعيد أولياء أمور قادمة.",
  },
  institutionalAnnouncements: {
    en: "Institutional Announcements",
    fr: "Annonces institutionnelles",
    ar: "الإعلانات الإدارية والمؤسساتية",
  },
  newAnnouncement: {
    en: "New announcement",
    fr: "Nouvelle annonce",
    ar: "إعلان جديد",
  },
  publishedBy: {
    en: "Published by {author}",
    fr: "Publiée par {author}",
    ar: "نُشرت بواسطة {author}",
  },
  noAnnouncementsYet: {
    en: "No announcements published yet.",
    fr: "Aucune annonce publiée pour le moment.",
    ar: "لا توجد أي إعلانات منشورة حتى الآن.",
  },
  priorityActionsTitle: {
    en: "Priority Actions",
    fr: "Actions prioritaires",
    ar: "الإجراءات ذات الأولوية",
  },
  viewAllActions: {
    en: "View all actions",
    fr: "Voir toutes les actions",
    ar: "عرض جميع الإجراءات",
  },
  saveNote: {
    en: 'Save',
    fr: 'Enregistrer',
    ar: 'حفظ',
  },
};

en.Leadership = {};
fr.Leadership = {};
ar.Leadership = {};

for (const [key, val] of Object.entries(leadershipNamespace)) {
  en.Leadership[key] = val.en;
  fr.Leadership[key] = val.fr;
  ar.Leadership[key] = val.ar;
}

// 5. SuperAdmin Namespace
const superAdminNamespace = {
  platformDashboardTitle: {
    en: 'Platform Command Center (All Branch Dashboard)',
    fr: 'Tableau de bord Plateforme (All Branch Dashboard)',
    ar: 'لوحة قيادة المنصة (لوحة جميع الفروع والمؤسسات)',
  },
  superAdminGlobal: {
    en: 'Global Super Admin',
    fr: 'Super Admin Global',
    ar: 'الإدارة العامة الشاملة',
  },
  platformDashboardSubtitle: {
    en: 'Consolidated overview of all client institutions on SchoolOS.',
    fr: "Vue d'ensemble consolidée de tous les établissements clients sur SchoolOS.",
    ar: 'نظرة شاملة وموحدة لجميع المؤسسات التعليمية المشتركة في SchoolOS.',
  },
  alertsSupervision: {
    en: 'Alerts & Oversight',
    fr: 'Alertes & Supervision',
    ar: 'التنبيهات والمراقبة',
  },
  suspendedSubscriptions: {
    en: 'Suspended subscriptions',
    fr: 'Abonnements suspendus',
    ar: 'اشتراكات موقوفة',
  },
  cancelledSubscriptions: {
    en: 'Cancelled subscriptions',
    fr: 'Abonnements annulés',
    ar: 'اشتراكات ملغاة',
  },
  expiringLicenses: {
    en: 'Expiring / expired licenses',
    fr: 'Licences expirant / expirées',
    ar: 'تراخيص منتهية أو تشرف على الانتهاء',
  },
  suspended: {
    en: 'Suspended',
    fr: 'Suspendu',
    ar: 'موقوف',
  },
  cancelled: {
    en: 'Cancelled',
    fr: 'Annulé',
    ar: 'ملغى',
  },
  deactivated: {
    en: 'Deactivated',
    fr: 'Désactivée',
    ar: 'معطل',
  },
  licenseExpired: {
    en: 'License expired',
    fr: 'Licence expirée',
    ar: 'الترخيص منتهٍ',
  },
  expiresOn: {
    en: 'Expires on {date}',
    fr: 'Expire le {date}',
    ar: 'ينتهي في {date}',
  },
  viewAllAlerts: {
    en: 'View all alerts ({count})',
    fr: 'Voir toutes les alertes ({count})',
    ar: 'عرض جميع التنبيهات ({count})',
  },
  allSchools: {
    en: 'All Schools',
    fr: 'Toutes Écoles',
    ar: 'جميع المدارس والمؤسسات',
  },
  studentQuantityByBranch: {
    en: 'Student Enrollment by Institution',
    fr: 'Student Quantity (Par Établissement)',
    ar: 'توزيع التلاميذ حسب المؤسسة',
  },
  recentClientSchools: {
    en: 'Recent Client Institutions',
    fr: 'Écoles Clients Récentes',
    ar: 'أحدث المؤسسات الشريكة',
  },
  manageAllSchools: {
    en: 'Manage all institutions ({count})',
    fr: 'Gérer toutes les écoles ({count})',
    ar: 'إدارة جميع المؤسسات ({count})',
  },
  noSchoolsYet: {
    en: 'No institutions yet.',
    fr: 'Aucune école pour le moment.',
    ar: 'لا توجد أي مؤسسة مسجلة حالياً.',
  },
  planTierLabel: {
    en: 'Plan: {tier}',
    fr: 'Formule: {tier}',
    ar: 'الباقة: {tier}',
  },
  usersCount: {
    en: '{count} users',
    fr: '{count} utilisateurs',
    ar: '{count} مستخدم',
  },
  active: {
    en: 'Active',
    fr: 'Actif',
    ar: 'نشط',
  },
  inactive: {
    en: 'Inactive',
    fr: 'Inactif',
    ar: 'غير نشط',
  },
};

en.SuperAdmin = {};
fr.SuperAdmin = {};
ar.SuperAdmin = {};

for (const [key, val] of Object.entries(superAdminNamespace)) {
  en.SuperAdmin[key] = val.en;
  fr.SuperAdmin[key] = val.fr;
  ar.SuperAdmin[key] = val.ar;
}

// 6. Month names in Dashboard
const monthsAdditions = {
  month_Jan: { en: 'Jan', fr: 'Jan', ar: 'يناير' },
  month_Feb: { en: 'Feb', fr: 'Fév', ar: 'فبراير' },
  month_Mar: { en: 'Mar', fr: 'Mar', ar: 'مارس' },
  month_Apr: { en: 'Apr', fr: 'Avr', ar: 'أبريل' },
  month_May: { en: 'May', fr: 'Mai', ar: 'ماي' },
  month_Jun: { en: 'Jun', fr: 'Juin', ar: 'يونيو' },
  month_Jul: { en: 'Jul', fr: 'Juil', ar: 'يوليوز' },
  month_Aug: { en: 'Aug', fr: 'Août', ar: 'غشت' },
  month_Sep: { en: 'Sep', fr: 'Sep', ar: 'شتنبر' },
  month_Oct: { en: 'Oct', fr: 'Oct', ar: 'أكتوبر' },
  month_Nov: { en: 'Nov', fr: 'Nov', ar: 'نونبر' },
  month_Dec: { en: 'Dec', fr: 'Déc', ar: 'دجنبر' },
};

for (const [key, val] of Object.entries(monthsAdditions)) {
  en.Dashboard[key] = val.en;
  fr.Dashboard[key] = val.fr;
  ar.Dashboard[key] = val.ar;
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(frPath, JSON.stringify(fr, null, 2) + '\n');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n');

console.log('Successfully updated locales with exact parity!');
