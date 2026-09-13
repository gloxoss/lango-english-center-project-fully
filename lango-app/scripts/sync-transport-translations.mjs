import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('locales');

const transportNewKeys = {
  en: {
    // Stops
    stopsTitle: "Stops & Pickup Points",
    stopsSubtitle: "Geolocated registry of transport stops and boarding stations.",
    addStop: "Add Stop",
    editStop: "Edit Stop",
    searchStopPlaceholder: "Search by code, name, or address...",
    stopCodeHeader: "Code",
    stopNameHeader: "Stop Name",
    addressHeader: "Address",
    gpsCoordinatesHeader: "GPS Coordinates",
    loadingStops: "Loading stops...",
    noStopsFound: "No stops found.",
    confirmDeleteStop: "Are you sure you want to delete this stop?",
    stopCodeLabel: "Stop Code",
    stopNameLabel: "Stop Name",
    addressLabel: "Address",
    latitudeLabel: "Latitude",
    longitudeLabel: "Longitude",
    notesLabel: "Notes / Landmarks",
    saveStop: "Save Stop",
    notSpecified: "Not specified",

    // Incidents
    incidentsTitle: "Transport Incident Management",
    incidentsSubtitle: "Incident reporting, safety escalation, and fleet safeguarding registry.",
    reportIncident: "Report Incident",
    searchIncidentPlaceholder: "Search incidents...",
    allSeverities: "All Severities",
    severityLow: "Low",
    severityMedium: "Medium",
    severityHigh: "High",
    severityCritical: "Critical",
    incidentTypeMissedPickup: "Missed Pickup",
    incidentTypeDelay: "Significant Delay",
    incidentTypeAccident: "Traffic Accident",
    incidentTypeBehavior: "Student Behavior",
    incidentTypeBreakdown: "Mechanical Breakdown",
    incidentTypeOther: "Other Incident",
    loadingIncidents: "Loading incidents...",
    noIncidentsFound: "No incidents recorded.",
    safeguardingNotice: "Strict CNDP privacy protection applied to sensitive incident notes.",
    resolveIncident: "Mark as Resolved",
    reopenIncident: "Reopen Incident",
    incidentTitleLabel: "Incident Title",
    incidentTypeLabel: "Incident Type",
    severityLabel: "Severity Tier",
    safeguardingNotesLabel: "Safeguarding Notes (Confidential)",
    submitIncident: "Submit Incident Report",

    // Policies
    policiesTitle: "Transport Rules & Operating Policies",
    policiesSubtitle: "Configure attendance grace periods, safety thresholds, and SMS alert rules.",
    policyMaxDelay: "Maximum Delay Before Notification (minutes)",
    policyGracePeriod: "Grace Period at Stops (minutes)",
    policyAutoNotify: "Automated SMS Alert to Parents upon Pickup/Dropoff",
    policyMandatoryScan: "Mandatory QR Badge Scan upon Entry/Exit",
    savePolicies: "Save Operating Policies",
    policiesUpdatedMsg: "Transport operating policies successfully updated.",

    // Reports
    transportReportsTitle: "Transport Analytics & Operational Reports",
    transportReportsSubtitle: "Comprehensive audit exports for bus runs, student boarding, and vehicle logs.",
    exportTripsCsv: "Export Trips Log (CSV)",
    exportBoardingCsv: "Export Boarding Log (CSV)",
    exportIncidentsCsv: "Export Safety Incidents (CSV)",
    filterByDateRange: "Filter by Date Range",
    totalTripsRun: "Total Trips Executed",
    totalBoardingsLogged: "Total Boardings Logged",
    safetyScore: "Fleet Safety Rate",

    // Guardian Portal
    guardianTransportTitle: "Children's School Transport",
    guardianTransportSubtitle: "Track assigned school bus circuits, daily stops, and bus driver contacts.",
    childRouteInfo: "Assigned Bus Circuit",
    liveBusLocation: "Bus Dispatch Status",
    pickupTime: "Morning Pickup",
    dropoffTime: "Afternoon Dropoff",
    contactDriver: "Contact Bus Attendant",
    noTransportAssigned: "No school transport subscription registered for this child.",

    // Student Portal
    studentTransportTitle: "My School Bus & Route",
    studentTransportSubtitle: "View your assigned bus line, pickup station, and departure time.",
    myBusCard: "My School Transport Pass",
    assignedStop: "Assigned Boarding Stop",
    pickupSchedule: "Estimated Arrival Time",
    busBadgeScanNotice: "Present your student QR badge to the attendant upon boarding."
  },
  fr: {
    // Stops
    stopsTitle: "Arrêts & Points de Ramassage",
    stopsSubtitle: "Répertoire géolocalisé des arrêts de transport et stations d'embarquement.",
    addStop: "Ajouter un Arrêt",
    editStop: "Modifier l'Arrêt",
    searchStopPlaceholder: "Rechercher par code, nom ou adresse...",
    stopCodeHeader: "Code",
    stopNameHeader: "Nom de l'Arrêt",
    addressHeader: "Adresse",
    gpsCoordinatesHeader: "Coordonnées GPS",
    loadingStops: "Chargement des arrêts...",
    noStopsFound: "Aucun arrêt trouvé.",
    confirmDeleteStop: "Êtes-vous sûr de vouloir supprimer cet arrêt ?",
    stopCodeLabel: "Code de l'Arrêt",
    stopNameLabel: "Nom de l'Arrêt",
    addressLabel: "Adresse",
    latitudeLabel: "Latitude",
    longitudeLabel: "Longitude",
    notesLabel: "Notes / Repères",
    saveStop: "Enregistrer l'Arrêt",
    notSpecified: "Non renseigné",

    // Incidents
    incidentsTitle: "Gestion des Incidents de Transport",
    incidentsSubtitle: "Signalement des incidents, escalade de sécurité et registre de protection de la flotte.",
    reportIncident: "Signaler un Incident",
    searchIncidentPlaceholder: "Rechercher des incidents...",
    allSeverities: "Toutes gravités",
    severityLow: "Faible",
    severityMedium: "Moyenne",
    severityHigh: "Élevée",
    severityCritical: "Critique",
    incidentTypeMissedPickup: "Ramassage manqué",
    incidentTypeDelay: "Retard significatif",
    incidentTypeAccident: "Accident de circulation",
    incidentTypeBehavior: "Comportement élève",
    incidentTypeBreakdown: "Panne mécanique",
    incidentTypeOther: "Autre incident",
    loadingIncidents: "Chargement des incidents...",
    noIncidentsFound: "Aucun incident enregistré.",
    safeguardingNotice: "Protection stricte des données CNDP appliquée aux notes d'incident sensibles.",
    resolveIncident: "Marquer comme résolu",
    reopenIncident: "Rouvrir l'incident",
    incidentTitleLabel: "Titre de l'incident",
    incidentTypeLabel: "Type d'incident",
    severityLabel: "Niveau de gravité",
    safeguardingNotesLabel: "Notes confidentielles (Protection)",
    submitIncident: "Soumettre le rapport d'incident",

    // Policies
    policiesTitle: "Règles & Politiques de Transport",
    policiesSubtitle: "Configurer les délais de tolérance, seuils de sécurité et alertes SMS automatiques.",
    policyMaxDelay: "Délai maximum avant notification (minutes)",
    policyGracePeriod: "Délai de grâce aux arrêts (minutes)",
    policyAutoNotify: "Notification SMS automatique aux parents à la montée/descente",
    policyMandatoryScan: "Scan obligatoire du badge QR à l'embarquement et débarquement",
    savePolicies: "Enregistrer les politiques",
    policiesUpdatedMsg: "Politiques d'exploitation du transport mises à jour avec succès.",

    // Reports
    transportReportsTitle: "Analytique & Rapports de Transport",
    transportReportsSubtitle: "Exports complets d'audit pour les trajets de bus, embarquements et registres véhicules.",
    exportTripsCsv: "Exporter les trajets (CSV)",
    exportBoardingCsv: "Exporter les montées/descentes (CSV)",
    exportIncidentsCsv: "Exporter les incidents de sécurité (CSV)",
    filterByDateRange: "Filtrer par plage de dates",
    totalTripsRun: "Total trajets effectués",
    totalBoardingsLogged: "Total embarquements enregistrés",
    safetyScore: "Taux de sécurité de la flotte",

    // Guardian Portal
    guardianTransportTitle: "Transport Scolaire des Enfants",
    guardianTransportSubtitle: "Suivez les circuits de bus assignés, arrêts quotidiens et contacts des accompagnateurs.",
    childRouteInfo: "Circuit de bus assigné",
    liveBusLocation: "Statut de circulation du bus",
    pickupTime: "Ramassage matinal",
    dropoffTime: "Retour de l'après-midi",
    contactDriver: "Contacter l'accompagnateur",
    noTransportAssigned: "Aucun abonnement au transport scolaire enregistré pour cet enfant.",

    // Student Portal
    studentTransportTitle: "Mon Bus Scolaire & Circuit",
    studentTransportSubtitle: "Consultez votre ligne de bus, point d'arrêt et horaire estimé de passage.",
    myBusCard: "Ma Carte de Transport Scolaire",
    assignedStop: "Point de ramassage assigné",
    pickupSchedule: "Horaire de passage estimé",
    busBadgeScanNotice: "Présentez votre badge QR élève à l'accompagnateur lors de la montée."
  },
  ar: {
    // Stops
    stopsTitle: "محطات ونقاط التوقف",
    stopsSubtitle: "سجل محدد جغرافياً لمحطات النقل المدرسي ونقاط صعود ونزول التلاميذ.",
    addStop: "إضافة محطة توقف",
    editStop: "تعديل المحطة",
    searchStopPlaceholder: "البحث بالرمز أو الاسم أو العنوان...",
    stopCodeHeader: "الرمز",
    stopNameHeader: "اسم المحطة",
    addressHeader: "العنوان",
    gpsCoordinatesHeader: "إحداثيات GPS",
    loadingStops: "جاري تحميل المحطات...",
    noStopsFound: "لم يتم العثور على أي محطة.",
    confirmDeleteStop: "هل أنت متأكد من رغبتك في حذف هذه المحطة؟",
    stopCodeLabel: "رمز المحطة",
    stopNameLabel: "اسم المحطة",
    addressLabel: "العنوان",
    latitudeLabel: "خط العرض",
    longitudeLabel: "خط الطول",
    notesLabel: "ملاحظات / معالم قريبة",
    saveStop: "حفظ المحطة",
    notSpecified: "غير محدد",

    // Incidents
    incidentsTitle: "إدارة حوادث وطوارئ النقل",
    incidentsSubtitle: "التبليغ عن حوادث السير، تصعيد إجراءات السلامة وسجل حماية الأسطول المدرسي.",
    reportIncident: "التبليغ عن حادث",
    searchIncidentPlaceholder: "البحث في الحوادث المسجلة...",
    allSeverities: "جميع درجات الخطورة",
    severityLow: "منخفضة",
    severityMedium: "متوسطة",
    severityHigh: "عالية",
    severityCritical: "حرجة / طارئة",
    incidentTypeMissedPickup: "تخلف عن محطة التوقف",
    incidentTypeDelay: "تأخر ملحوظ في الموعد",
    incidentTypeAccident: "حادثة سير",
    incidentTypeBehavior: "سلوك غير منضبط لتلميذ",
    incidentTypeBreakdown: "عطل ميكانيكي بالحافلة",
    incidentTypeOther: "حادث آخر",
    loadingIncidents: "جاري تحميل الحوادث...",
    noIncidentsFound: "لا توجد أي حوادث مسجلة.",
    safeguardingNotice: "تطبيق تدابير صارمة لحماية المعطيات الشخصية (CNDP) على الملاحظات الحساسة.",
    resolveIncident: "تحديد كـ معالج",
    reopenIncident: "إعادة فتح ملف الحادث",
    incidentTitleLabel: "عنوان الحادث",
    incidentTypeLabel: "نوع الحادث",
    severityLabel: "مستوى الخطورة",
    safeguardingNotesLabel: "ملاحظات سرية (الحماية والأمان)",
    submitIncident: "إرسال تقرير الحادث",

    // Policies
    policiesTitle: "ضوابط وسياسات تشغيل النقل المدرسي",
    policiesSubtitle: "تحديد مهلات التأخير المقبولة، معايير السلامة والتنبيهات التلقائية عبر الرسائل القصيرة.",
    policyMaxDelay: "الحد الأقصى للتأخير قبل إشعار أولياء الأمور (بالدقائق)",
    policyGracePeriod: "فترة الانتظار عند نقاط التوقف (بالدقائق)",
    policyAutoNotify: "إرسال رسالة SMS تلقائية لأولياء الأمور عند الصعود والنزول",
    policyMandatoryScan: "إلزامية مسح شارة QR عند صعود ونزول كل تلميذ",
    savePolicies: "حفظ السياسات والضوابط",
    policiesUpdatedMsg: "تم تحديث سياسات وضوابط النقل المدرسي بنجاح.",

    // Reports
    transportReportsTitle: "تقارير وتحليلات أسطول النقل",
    transportReportsSubtitle: "تصدير سجلات التدقيق الشاملة للرحلات، صعود التلاميذ وعمليات الصيانة.",
    exportTripsCsv: "تصدير سجل الرحلات (CSV)",
    exportBoardingCsv: "تصدير سجل الصعود والنزول (CSV)",
    exportIncidentsCsv: "تصدير سجل حوادث السلامة (CSV)",
    filterByDateRange: "تصفية حسب النطاق الزمني",
    totalTripsRun: "إجمالي الرحلات المنجزة",
    totalBoardingsLogged: "إجمالي عمليات الصعود المسجلة",
    safetyScore: "معدل سلامة الأسطول",

    // Guardian Portal
    guardianTransportTitle: "النقل المدرسي للأبناء",
    guardianTransportSubtitle: "متابعة خطوط الحافلات المخصصة للأبناء، مواعيد التوقف وجهات اتصال المرافقين.",
    childRouteInfo: "خط الحافلة المخصص",
    liveBusLocation: "حالة انطلاق الحافلة",
    pickupTime: "موعد الانطلاق الصباحي",
    dropoffTime: "موعد العودة المسائية",
    contactDriver: "التواصل مع مرافقة الحافلة",
    noTransportAssigned: "لا يوجد اشتراك في النقل المدرسي مسجل لهذا التلميذ حالياً.",

    // Student Portal
    studentTransportTitle: "حافلتي وخط النقل المدرسي",
    studentTransportSubtitle: "الاطلاع على مسار الحافلة المخصصة، محطة التوقف وموعد الوصول التقريبي.",
    myBusCard: "بطاقة النقل المدرسي الخاصة بي",
    assignedStop: "محطة الركوب المخصصة",
    pickupSchedule: "موعد الوصول المتوقع",
    busBadgeScanNotice: "يرجى إبراز شارة QR المدرسية للمرافقة عند الصعود للحافلة."
  }
};

['en', 'fr', 'ar'].forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  json.Transport = json.Transport || {};
  Object.assign(json.Transport, transportNewKeys[lang]);
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  console.log(`Updated Transport keys in ${lang}.json`);
});
