const fs = require('fs');
const path = require('path');

const locales = ['en', 'fr', 'ar'];
const paths = locales.reduce((acc, l) => {
  acc[l] = path.join(process.cwd(), 'locales', l + '.json');
  return acc;
}, {});

const data = {};
locales.forEach(l => {
  data[l] = JSON.parse(fs.readFileSync(paths[l], 'utf8'));
});

const superAdminAdditions = {
  waitlist: { en: 'Priority Access List', fr: 'Liste accès prioritaire', ar: 'قائمة الوصول ذو الأولوية' },
  subscriptions: { en: 'Subscriptions & Pricing', fr: 'Abonnements & Tarifs', ar: 'الاشتراكات والأسعار' },
  support: { en: 'Support & Incidents', fr: 'Support & Incidents', ar: 'الدعم والحوادث' },
  domains: { en: 'Custom Domains', fr: 'Domaines Personnalisés', ar: 'النطاقات المخصصة' },
  allSchools: { en: 'All Schools', fr: 'Toutes les écoles', ar: 'جميع المدارس' },
  createSchool: { en: '+ Create a School', fr: '+ Créer une école', ar: '+ إنشاء مدرسة' },
  plansAndModules: { en: 'Plans & Modules', fr: 'Plans & Modules', ar: 'الخطط والوحدات' },
  manageSubscriptions: { en: 'Manage Subscriptions', fr: 'Gestion Abonnements', ar: 'إدارة الاشتراكات' },
  domainsTitle: { en: 'Custom Domains', fr: 'Domaines Personnalisés', ar: 'النطاقات المخصصة' },
  domainsSubtitle: { en: 'Manage school custom domains and subdomain requests.', fr: 'Gérez les demandes de sous-domaines et domaines personnalisés des écoles.', ar: 'إدارة طلبات النطاقات المخصصة والنطاقات الفرعية للمدارس.' },
  domainRequests: { en: 'Domain Requests', fr: 'Demandes de domaines', ar: 'طلبات النطاقات' },
  domainRequestsDesc: { en: 'All domain requests submitted by client schools.', fr: 'Toutes les demandes de domaines par les écoles.', ar: 'جميع طلبات النطاقات المقدمة من المدارس.' },
  domainCol: { en: 'Domain', fr: 'Domaine', ar: 'النطاق' },
  schoolCol: { en: 'School', fr: 'École', ar: 'المؤسسة' },
  typeCol: { en: 'Type', fr: 'Type', ar: 'النوع' },
  statusCol: { en: 'Status', fr: 'Statut', ar: 'الحالة' },
  dateCol: { en: 'Date', fr: 'Date', ar: 'التاريخ' },
  actionsCol: { en: 'Actions', fr: 'Actions', ar: 'إجراءات' },
  statusPending: { en: 'Pending', fr: 'En attente', ar: 'قيد الانتظار' },
  statusApproved: { en: 'Approved', fr: 'Approuvé', ar: 'تمت الموافقة' },
  statusRejected: { en: 'Rejected', fr: 'Rejeté', ar: 'مرفوض' },
  typeSubdomain: { en: 'Subdomain', fr: 'Sous-domaine', ar: 'نطاق فرعي' },
  typeCustom: { en: 'Custom Domain', fr: 'Domaine personnalisé', ar: 'نطاق مخصص' },
  approve: { en: 'Approve', fr: 'Approuver', ar: 'موافقة' },
  reject: { en: 'Reject', fr: 'Rejeter', ar: 'رفض' },
  domainApproved: { en: 'Domain approved', fr: 'Domaine approuvé', ar: 'تمت الموافقة على النطاق' },
  domainRejected: { en: 'Domain rejected', fr: 'Domaine rejeté', ar: 'تم رفض النطاق' },
  clientSchoolsTitle: { en: 'Client Schools', fr: 'Écoles Clientes', ar: 'المؤسسات التعليمية' },
  clientSchoolsSubtitle: { en: 'Manage all client schools on the platform.', fr: 'Gérez toutes les écoles de la plateforme.', ar: 'إدارة جميع المؤسسات التعليمية المسجلة على المنصة.' },
  totalSchools: { en: 'Total Schools', fr: 'Total des écoles', ar: 'إجمالي المؤسسات' },
  activeSubscriptions: { en: 'Active Subscriptions', fr: 'Abonnements actifs', ar: 'اشتراكات نشطة' },
  suspendedInactive: { en: 'Suspended / Inactive', fr: 'Suspendues / inactives', ar: 'معلقة / غير نشطة' },
  filterAll: { en: 'All Statuses', fr: 'Tous les statuts', ar: 'جميع الحالات' },
  filterActive: { en: 'Active', fr: 'Actives', ar: 'نشطة' },
  filterSuspended: { en: 'Suspended', fr: 'Suspendues', ar: 'معلقة' },
  filterCancelled: { en: 'Cancelled', fr: 'Annulées', ar: 'ملغاة' },
  searchSchools: { en: 'Search a school...', fr: 'Rechercher une école...', ar: 'البحث عن مؤسسة...' },
  exportCsv: { en: 'Export CSV', fr: 'Exporter CSV', ar: 'تصدير CSV' },
  newSchool: { en: 'New School', fr: 'Nouvelle école', ar: 'مؤسسة جديدة' },
  planCol: { en: 'Plan', fr: 'Plan', ar: 'الخطة' },
  usersCol: { en: 'Users', fr: 'Utilisateurs', ar: 'المستخدمون' },
  statusActive: { en: 'Active', fr: 'Actif', ar: 'نشط' },
  statusSuspended: { en: 'Suspended', fr: 'Suspendu', ar: 'معلق' },
  statusCancelled: { en: 'Cancelled', fr: 'Annulé', ar: 'ملغى' },
  statusDeactivated: { en: 'Deactivated', fr: 'Désactivée', ar: 'معطلة' },
  noSchoolsFound: { en: 'No schools match the filter criteria.', fr: 'Aucune école ne correspond aux critères.', ar: 'لا توجد أي مؤسسة مطابقة للبحث.' },
  smsPlatformTitle: { en: 'SMS Platform & Telecom Gateways', fr: 'Plateforme SMS & Passerelles Télécom', ar: 'منصة الرسائل القصيرة وبوابات الاتصال' },
  smsPlatformSubtitle: { en: 'Global monitoring of SMS traffic, credit consumption, and Maroc Telecom / Inwi / Orange gateways.', fr: 'Supervision globale des flux SMS, consommation de crédits et passerelles Maroc Télécom / Inwi / Orange.', ar: 'المراقبة العامة لرسائل SMS واستهلاك الرصيد وبوابات اتصالات المغرب وإنوي وأورنج.' },
  totalVolume: { en: 'Total Volume', fr: 'Volume Total', ar: 'الحجم الإجمالي' },
  totalVolumeDesc: { en: 'Messages recorded on platform', fr: 'Messages enregistrés sur la plateforme', ar: 'رسائل مسجلة على المنصة' },
  deliveryRate: { en: 'Deliverability Rate', fr: 'Taux de Délivrabilité', ar: 'نسبة التسليم' },
  deliveredCountDesc: { en: '{count} delivered successfully', fr: '{count} délivrés avec succès', ar: '{count} تم تسليمها بنجاح' },
  inQueue: { en: 'In Queue', fr: 'En file d\'attente', ar: 'في قائمة الانتظار' },
  routingDesc: { en: 'Operator routing in progress', fr: 'En cours de routage opérateur', ar: 'جاري الإرسال عبر المزود' },
  connectedSchools: { en: 'Connected Schools', fr: 'Écoles Connectées', ar: 'المؤسسات المتصلة' },
  connectedSchoolsDesc: { en: 'Institutions with active gateway', fr: 'Établissements avec passerelle active', ar: 'مؤسسات تتوفر على بوابة نشطة' },
  allSchoolsOption: { en: 'All Schools ({count})', fr: 'Toutes les écoles ({count})', ar: 'جميع المؤسسات ({count})' },
  allStatusesOption: { en: 'All Statuses', fr: 'Tous les statuts', ar: 'جميع الحالات' },
  statusSent: { en: 'Sent', fr: 'Envoyés', ar: 'مرسلة' },
  statusQueued: { en: 'Pending', fr: 'En attente', ar: 'قيد الانتظار' },
  statusFailed: { en: 'Failed', fr: 'Échoués', ar: 'فاشلة' },
  allocateCredits: { en: 'Allocate SMS Credits', fr: 'Allouer des crédits SMS', ar: 'شحن رصيد الرسائل' },
  recipientCol: { en: 'Recipient', fr: 'Destinataire', ar: 'المستلم' },
  messageCol: { en: 'Message', fr: 'Message', ar: 'نص الرسالة' },
  sentDateCol: { en: 'Sent Date', fr: 'Date d\'envoi', ar: 'تاريخ الإرسال' },
  plansAndModulesTitle: { en: 'Plans & Modules', fr: 'Plans & Modules', ar: 'الخطط والوحدات' },
  plansAndModulesSubtitle: { en: 'Platform pricing tiers and add-on module catalog.', fr: 'Catalogue des offres tarifaires et des modules de la plateforme.', ar: 'دليل الباقات والوحدات الوظيفية للمنصة.' },
  totalSchoolsStat: { en: 'Total Schools', fr: 'Total écoles', ar: 'إجمالي المؤسسات' },
  activeLicensesStat: { en: 'Active Licenses', fr: 'Licences actives', ar: 'تراخيص نشطة' },
  expiredLicensesStat: { en: 'Expired / No License', fr: 'Expirées / sans licence', ar: 'منتهية الصلاحية / بدون ترخيص' },
  pendingRequestsStat: { en: 'Pending Requests', fr: 'Demandes en attente', ar: 'طلبات معلقة' },
  planLimitsTitle: { en: 'Limits per Plan', fr: 'Limites par plan', ar: 'حدود كل خطة' },
  planLimitsSubtitle: { en: 'Capacities applied to each tier. Leave empty for "unlimited".', fr: 'Capacités appliquées à chaque formule. Laissez un champ vide pour « illimité ».', ar: 'القدرات المحددة لكل باقة. اترك الحقل فارغاً لتحديد "غير محدود".' },
  schoolsCountBadge: { en: '{count} school(s)', fr: '{count} école(s)', ar: '{count} مؤسسة' },
  planLabelField: { en: 'Label', fr: 'Libellé', ar: 'التسمية' },
  maxStudentsField: { en: 'Max Students', fr: 'Élèves max', ar: 'أقصى عدد للتلاميذ' },
  maxStorageField: { en: 'Max Storage (MB)', fr: 'Stockage max (Mo)', ar: 'أقصى مساحة تخزين (ميغابايت)' },
  unlimited: { en: 'Unlimited', fr: 'Illimité', ar: 'غير محدود' },
  moduleCatalogTitle: { en: 'Module Catalog', fr: 'Catalogue des modules', ar: 'دليل الوحدات والخدمات' },
  moduleCatalogSubtitle: { en: 'Activated per school in Subscriptions Management — a module is only visible to an institution when enabled.', fr: 'Activation par école dans Gestion Abonnements — un module n\'est visible pour un établissement que s\'il y est activé.', ar: 'التفعيل لكل مدرسة في إدارة الاشتراكات — لا تظهر الوحدة إلا عند تفعيلها للمؤسسة.' },
  moduleCol: { en: 'Module', fr: 'Module', ar: 'الوحدة' },
  descCol: { en: 'Description', fr: 'Description', ar: 'الوصف' },
  requiresCol: { en: 'Prerequisites', fr: 'Prérequis', ar: 'المتطلبات' },
  statusColBuilt: { en: 'Built', fr: 'Construit', ar: 'جاهزة' },
  statusColUpcoming: { en: 'Upcoming', fr: 'À venir', ar: 'قريباً' }
};

const leadershipAdditions = {
  adminTitle: { en: 'Leadership Administration', fr: 'Administration de la direction', ar: 'إدارة القيادة الإدارية' },
  adminSubtitle: { en: 'Assign perimeters and approval authorities to leaders.', fr: 'Attribuez des périmètres et autorités d\'approbation aux responsables.', ar: 'تحديد الصلاحيات ونطاقات الموافقة للمسؤولين.' },
  tabPerimeters: { en: 'Perimeters', fr: 'Périmètres', ar: 'النطاقات' },
  tabAuthorities: { en: 'Authorities', fr: 'Autorités', ar: 'سلطات الاعتماد' },
  colLeader: { en: 'Leader', fr: 'Responsable', ar: 'المسؤول' },
  colPerimeter: { en: 'Perimeter', fr: 'Périmètre', ar: 'مجال الصلاحية' },
  colTarget: { en: 'Target', fr: 'Cible', ar: 'الهدف' },
  colValidity: { en: 'Validity', fr: 'Validité', ar: 'الصلاحية' },
  approvalsBox: { en: 'Leadership Approvals', fr: 'Approbations', ar: 'طلبات الموافقة' },
  approvalsBoxDesc: { en: 'Leadership approval inbox — limits and scopes restricted by active authorities.', fr: 'Bac à approbations de la direction — montants et domaines limités par vos autorités actives.', ar: 'صندوق موافقات الإدارة — المبالغ والمجالات المحددة حسب صلاحياتكم النشطة.' },
  activeAuthorities: { en: 'Active Authorities', fr: 'Autorités actives', ar: 'الصلاحيات النشطة' },
  pendingCreditNotes: { en: 'Pending Credit Notes', fr: 'Notes de crédit en attente', ar: 'إشعارات الدائن المعلقة' },
  pendingRefunds: { en: 'Pending Refunds', fr: 'Remboursements en attente', ar: 'المسترجعات المعلقة' },
  periodReopenings: { en: 'Period Reopenings', fr: 'Rouvertures de période', ar: 'إعادة فتح الفترات' },
  noActiveAuthorities: { en: 'No active approval authority.', fr: 'Aucune autorité d’approbation active.', ar: 'لا توجد سلطة موافقة نشطة.' },
  exceptionsSupervision: { en: 'Exceptions & Oversight', fr: 'Exceptions & supervision', ar: 'الاستثناءات والرقابة' },
  exceptionsSupervisionDesc: { en: 'Attendance alerts and operational incidents — aggregated accounts, no individual dossier.', fr: 'Alertes de présence et incidents opérationnels — comptes agrégés, sans dossier individuel.', ar: 'تنبيهات الحضور والحوادث التشغيلية — حسابات مجمعة دون بيانات فردية.' },
  attendanceFlags: { en: 'Attendance Flags', fr: 'Drapeaux de présence', ar: 'مؤشرات الحضور' },
  guardIncidents: { en: 'Guard Incidents', fr: 'Incidents gardien', ar: 'حوادث الأمن' },
  transportIncidents: { en: 'Transport Incidents', fr: 'Incidents transport', ar: 'حوادث النقل' },
  alertsBySeverity: { en: 'Attendance Alerts by Severity', fr: 'Alertes de présence par sévérité', ar: 'تنبيهات الحضور حسب درجة الخطورة' },
  openOperationalIncidents: { en: 'Open Operational Incidents', fr: 'Incidents opérationnels ouverts', ar: 'الحوادث التشغيلية المفتوحة' },
  securityGuards: { en: 'Security & Guards', fr: 'Sécurité & gardiens', ar: 'الأمن والحراسة' },
  schoolTransport: { en: 'School Transport', fr: 'Transport scolaire', ar: 'النقل المدرسي' },
  privacyDisclaimer: { en: 'Privacy: aggregated accounts only — no individual records returned.', fr: 'Confidentialité : comptes agrégés uniquement — aucun enregistrement individuel n’est renvoyé.', ar: 'السرية والخصوصية: حسابات مجمعة فقط — لا يتم عرض أي سجل فردي.' }
};

const reportsAdditions = {
  usedStorage: { en: 'Used Storage', fr: 'Stockage Utilisé', ar: 'المساحة المستهلكة' },
  storageQuotaConsumed: { en: '{pct}% of storage quota consumed', fr: '{pct}% de la capacité quota consommée', ar: 'تم استهلاك {pct}% من الحصة المخصصة' },
  activeSchedules: { en: 'Active Schedules', fr: 'Planifications Actives', ar: 'الجدولات النشطة' },
  cronServiceActive: { en: 'Active Cron Service', fr: 'Service Cron Actif', ar: 'خدمة الجدولة التلقائية نشطة' },
  failedRuns: { en: 'Failed Executions', fr: 'Exécutions Échouées', ar: 'عمليات فاشلة' },
  zeroAnomalies: { en: 'Zero system anomalies detected', fr: 'Zéro anomalie système détectée', ar: 'لم يتم اكتشاف أي خلل في النظام' },
  watermarkTitle: { en: 'Analytical Projections Freshness & Watermarks', fr: 'Fraîcheur des Projections Analytical & Fil d\'Eau (Watermark)', ar: 'جاهزية البيانات التحليلية والمزامنة الزمنية' },
  watermarkSubtitle: { en: 'Real-time monitoring of read indexes and analytical materialized tables.', fr: 'Surveillance en temps réel des index de lecture et tables matérialisées du sous-système analytique.', ar: 'المراقبة الفورية لمؤشرات القراءة والجداول المحدثة للنظام التحليلي.' },
  colProjectionModel: { en: 'Projection Model (Read View)', fr: 'Modèle de Projection (Read View)', ar: 'نموذج العرض التحليلي' },
  colRecordedRows: { en: 'Recorded Rows', fr: 'Lignes Enregistrées', ar: 'الصفوف المسجلة' },
  colLastWatermark: { en: 'Last Watermark', fr: 'Dernier Fil d\'Eau (Watermark)', ar: 'آخر مزامنة مسجلة' },
  backgroundRunsTitle: { en: 'Background Execution History', fr: 'Historique des Exécutions en Arrière-Plan', ar: 'سجل العمليات المنفذة في الخلفية' },
  backgroundRunsSubtitle: { en: 'Each large report is compiled in the background and cryptographically archived with HMAC SHA-256.', fr: 'Chaque rapport volumineux est compilé en tâche de fond et archivé sous signature cryptographique HMAC SHA-256.', ar: 'يتم تجميع كل تقرير ضخم في الخلفية وتوقيعه إلكترونياً بتقنية HMAC SHA-256.' },
  colExecutedReport: { en: 'Executed Report', fr: 'Rapport Executé', ar: 'التقرير المنفذ' },
  colExecutionStatus: { en: 'Execution Status', fr: 'Statut Exécution', ar: 'حالة التنفيذ' },
  colProducedRows: { en: 'Produced Rows', fr: 'Lignes Produites', ar: 'الصفوف المستخرجة' },
  colExecutionTime: { en: 'Execution Time', fr: 'Temps Exécution', ar: 'مدة التنفيذ' },
  colTimestamp: { en: 'Timestamp', fr: 'Horodatage', ar: 'الوقت والتاريخ' },
  colAction: { en: 'Action', fr: 'Action', ar: 'الإجراء' },
  statusCompleted: { en: 'Completed', fr: 'Terminé', ar: 'مكتمل' },
  statusRunning: { en: 'In progress', fr: 'En cours', ar: 'قيد المعالجة' },
  statusProcessing: { en: 'Processing in progress...', fr: 'Traitement en cours...', ar: 'جاري المعالجة...' },
  schedulesTitle: { en: 'Automated Schedules & Deliveries', fr: 'Planifications & Livraisons Automatiques', ar: 'الجدولة التلقائية وتسليم التقارير' },
  schedulesSubtitle: { en: 'Manage automated recurrence (nightly, weekly, or monthly) for balance sheets and academic records.', fr: 'Gérez les récurrences automatisées (toutes les nuits, hebdomadaires ou mensuelles) pour la génération de vos bilans comptables et académiques.', ar: 'إدارة الجدولة الدورية (ليلياً، أسبوعياً، أو شهرياً) لاستخراج القوائم المالية والأكاديمية.' },
  colScheduleName: { en: 'Schedule Name', fr: 'Nom de la Planification', ar: 'اسم الجدولة' },
  colCron: { en: 'Cron Expression', fr: 'Expression Cron', ar: 'تعبير الجدولة Cron' },
  colExportFormat: { en: 'Export Format', fr: 'Format Export', ar: 'صيغة التصدير' },
  colNextRun: { en: 'Next Execution', fr: 'Prochaine Exécution', ar: 'التنفيذ القادم' },
  colRecurrenceState: { en: 'Recurrence Status', fr: 'État Récurrence', ar: 'حالة التكرار' }
};

locales.forEach(l => {
  data[l].SuperAdmin = data[l].SuperAdmin || {};
  Object.entries(superAdminAdditions).forEach(([k, v]) => { data[l].SuperAdmin[k] = v[l]; });

  data[l].Leadership = data[l].Leadership || {};
  Object.entries(leadershipAdditions).forEach(([k, v]) => { data[l].Leadership[k] = v[l]; });

  data[l].Reports = data[l].Reports || {};
  Object.entries(reportsAdditions).forEach(([k, v]) => { data[l].Reports[k] = v[l]; });

  fs.writeFileSync(paths[l], JSON.stringify(data[l], null, 2) + '\n', 'utf8');
});

console.log('Successfully injected all additions with 100% parity!');
