import {
  HeroContent,
  ProcessStep,
  FeatureTab,
  IntegrationTool,
  PricingTier,
  FaqItem,
  ContactContent,
  FooterContent,
} from '../model/types';

export type Locale = 'fr' | 'ar';

// ─── HERO CONTENT DICTIONARY ──────────────────────────────────────────────────
export const HERO_CONTENT_I18N: Record<Locale, HeroContent> = {
  fr: {
    title: "Le système d'exploitation des établissements scolaires au Maroc",
    subtitle: "Plus de temps pour l'essentiel. Gérez vos élèves, absences, notes et finances sur une plateforme fluide, automatisée et 100% conforme CNDP Loi 09-08.",
    primaryCtaText: "Rejoindre la liste d’accès prioritaire",
    secondaryCtaText: "Découvrir les modules",
    heroCardMainUrl: "/assets/images/68a5a0547b3405bb7da6391a_Hero_UI_Card.png",
    heroCardSecondaryUrl: "/assets/images/68a5a0543502c2d385a6dc2e_Hero_UI_Card_2.png",
    tickerLogos: [
      { id: 'logo-1', name: 'Groupe Scolaire Atlas', logoUrl: '/assets/images/68a70127ff28015ac9fee3f8_Fake_Logo_1.svg' },
      { id: 'logo-2', name: 'École Al Amal Casablanca', logoUrl: '/assets/images/68a7012708a760adb36255e0_Fake_Logo_2.svg' },
      { id: 'logo-3', name: 'Institut Lango Center', logoUrl: '/assets/images/68a701274180c858df689f8b_Fake_Logo_3.svg' },
      { id: 'logo-4', name: 'Collège Anfa Rabat', logoUrl: '/assets/images/68a70127369f354d650b5176_Fake_Logo_4.svg' },
      { id: 'logo-5', name: 'Lycée Privé El Menzeh', logoUrl: '/assets/images/68a701274df0addd226bdf2e_Fake_Logo_5.svg' },
      { id: 'logo-6', name: 'Académie Pédagogique Marrakech', logoUrl: '/assets/images/68a70127c70239b918860830_Fake_Logo_6.svg' },
    ],
  },
  ar: {
    title: "نظام إدارة المؤسسات التعليمية والشاملة بالمغرب",
    subtitle: "استثمر وقتك في الأهم. أدِر طلابك، غياباتهم، نقاطهم وماليتك على منصة سلسة، مؤتمتة ومطابقة 100% لقانون حماية المعطيات CNDP 09-08.",
    primaryCtaText: "الانضمام إلى قائمة الوصول المبكر",
    secondaryCtaText: "استكشاف الوظائف",
    heroCardMainUrl: "/assets/images/68a5a0547b3405bb7da6391a_Hero_UI_Card.png",
    heroCardSecondaryUrl: "/assets/images/68a5a0543502c2d385a6dc2e_Hero_UI_Card_2.png",
    tickerLogos: [
      { id: 'logo-1', name: 'مجموعة أطلس المدرسية', logoUrl: '/assets/images/68a70127ff28015ac9fee3f8_Fake_Logo_1.svg' },
      { id: 'logo-2', name: 'مدرسة الأمل الدار البيضاء', logoUrl: '/assets/images/68a7012708a760adb36255e0_Fake_Logo_2.svg' },
      { id: 'logo-3', name: 'معهد لأنغو سنتر', logoUrl: '/assets/images/68a701274180c858df689f8b_Fake_Logo_3.svg' },
      { id: 'logo-4', name: 'إعدادية أنفة الرباط', logoUrl: '/assets/images/68a70127369f354d650b5176_Fake_Logo_4.svg' },
      { id: 'logo-5', name: 'ثانوية المنزه الخاصة', logoUrl: '/assets/images/68a701274df0addd226bdf2e_Fake_Logo_5.svg' },
      { id: 'logo-6', name: 'أكاديمية مراكش التربوية', logoUrl: '/assets/images/68a70127c70239b918860830_Fake_Logo_6.svg' },
    ],
  },
};

// ─── PROCESS STEPS DICTIONARY ─────────────────────────────────────────────────
export const PROCESS_STEPS_I18N: Record<Locale, ProcessStep[]> = {
  fr: [
    {
      stepNumber: '01',
      title: 'Importation & Configuration instantanées',
      description: "Importez vos fichiers Excel existants en 2 minutes et configurez votre structure académique sans aucune formation lourde.",
    },
    {
      stepNumber: '02',
      title: 'Gestion quotidienne & SMS Automatiques',
      description: "Pointage par QR code, suivi des retards et notifications SMS instantanées aux tuteurs dès la première minute d'absence.",
    },
    {
      stepNumber: '03',
      title: 'Bulletins /20 & Tableaux de bord financiers',
      description: "Générez les bulletins conformes aux normes marocaines et suivez le taux de recouvrement des frais de scolarité en temps réel.",
    },
  ],
  ar: [
    {
      stepNumber: '01',
      title: 'استيراد وإعداد فوري في دقائق',
      description: "استورد ملفات إكسيل الخاصة بك في دقيقتين وقم بإعداد هيكلك الأكاديمي دون الحاجة لتدريب معقد.",
    },
    {
      stepNumber: '02',
      title: 'إدارة يومية ورسائل SMS تلقائية',
      description: "تسجيل الحضور عبر رمز QR، متابعة التأخيرات وتنبيهات SMS فورية لأولياء الأمور من الدقيقة الأولى للغياب.",
    },
    {
      stepNumber: '03',
      title: 'كشوف النقاط /20 ومتابعة مالية',
      description: "أنشئ كشوف النقاط المطابقة للمقاييس الوطنية بالمغرب وتابع نسبة استخلاص الواجبات المدرسية في الوقت الفعلي.",
    },
  ],
};

// ─── FEATURE TABS DICTIONARY ──────────────────────────────────────────────────
export const FEATURE_TABS_I18N: Record<Locale, FeatureTab[]> = {
  fr: [
    {
      id: 'tab-1',
      tag: 'Portail Établissement',
      title: 'Accès centralisé pour la direction, les professeurs et l\'administration',
      description: 'Partagez en toute sécurité les emplois du temps, dossiers élèves, notes et justificatifs d\'absence sans changer d\'outil.',
      imageUrl: '/assets/images/68a4af7ed724eae76593679d_Dashboard-2.avif',
    },
    {
      id: 'tab-2',
      tag: 'Notes & Bulletins /20',
      title: 'Calcul de moyenne selon le barème officiel du Ministère',
      description: 'Prise en charge complète des coefficients par matière, trimesters/semestres et impression automatique des bulletins.',
      imageUrl: '/assets/images/68a4af6379634f53e60e3f1b_Revenue_Card.png',
    },
    {
      id: 'tab-3',
      tag: 'Alertes SMS Automatisées',
      title: 'Passerelle SMS marocaine autonome pour les absences et rappels',
      description: 'Le système informe automatiquement les parents par SMS (+212) lors d\'une absence non justifiée ou d\'un rappel d\'échéance financière.',
      imageUrl: '/assets/images/68a4af8269dc1ef2ce14b1f9_Welcome_Card.png',
    },
    {
      id: 'tab-4',
      tag: 'Gestion des Groupes & Tarifs',
      title: 'Conçu pour la croissance et le suivi financier de votre établissement',
      description: 'Ajoutez facilement de nouvelles classes, suivez les encaissements, gérez les réductions de fratrie et éditez des reçus conformes.',
      imageUrl: '/assets/images/68a4af74b2e4e34cd6835eb4_Invite.png',
    },
  ],
  ar: [
    {
      id: 'tab-1',
      tag: 'بوابة المؤسسة',
      title: 'وصول مركزي للإدارة والأساتذة والطاقم الإداري',
      description: 'شارك بأمان جداول الحصص، ملفات التلاميذ، النقاط ومبررات الغياب دون الحاجة للتنقل بين برامج متعددة.',
      imageUrl: '/assets/images/68a4af7ed724eae76593679d_Dashboard-2.avif',
    },
    {
      id: 'tab-2',
      tag: 'النقاط وكشوف /20',
      title: 'حساب المعدلات حسب السلم الرسمي للوزارة',
      description: 'دعم كامل للمعاملات حسب المواد، الدورات والدورات الدراسية مع طباعة تلقائية لكشوف النقاط الرسمية.',
      imageUrl: '/assets/images/68a4af6379634f53e60e3f1b_Revenue_Card.png',
    },
    {
      id: 'tab-3',
      tag: 'تنبيهات SMS مؤتمتة',
      title: 'بوابة رسائل نصية مغربية مستقلة للغيابات والتذكيرات',
      description: 'يشعر النظام أولياء الأمور تلقائياً عبر SMS (+212) في حالة الغياب غير المبرر أو لتذكير بأداء الواجبات.',
      imageUrl: '/assets/images/68a4af8269dc1ef2ce14b1f9_Welcome_Card.png',
    },
    {
      id: 'tab-4',
      tag: 'إدارة الأقسام والرسوم',
      title: 'مصممة لنمو مؤسستك والمتابعة المالية الشاملة',
      description: 'أضف أقساماً جديدة بسهولة، تابع المداخيل، أدِر تخفيضات الإخوة وأصدر وصولات استلام رسمية.',
      imageUrl: '/assets/images/68a4af74b2e4e34cd6835eb4_Invite.png',
    },
  ],
};

// ─── INTEGRATION TOOLS DICTIONARY ─────────────────────────────────────────────
export const INTEGRATION_TOOLS_COL1: IntegrationTool[] = [
  { id: '1', name: 'Maroc Telecom SMS', category: 'Passerelle SMS (+212)', logoUrl: '/assets/images/68a70127ff28015ac9fee3f8_Fake_Logo_1.svg' },
  { id: '2', name: 'Inwi Business', category: 'Notifications Parents', logoUrl: '/assets/images/68a7012708a760adb36255e0_Fake_Logo_2.svg' },
  { id: '3', name: 'Orange SMS API', category: 'Alerte Absences', logoUrl: '/assets/images/68a701274180c858df689f8b_Fake_Logo_3.svg' },
  { id: '4', name: 'Microsoft Excel', category: 'Import / Export Massif', logoUrl: '/assets/images/68a70127369f354d650b5176_Fake_Logo_4.svg' },
  { id: '5', name: 'Google Classroom', category: 'Cours & E-learning', logoUrl: '/assets/images/68a701274df0addd226bdf2e_Fake_Logo_5.svg' },
  { id: '6', name: 'WhatsApp Business API', category: 'Communication Directe', logoUrl: '/assets/images/68a70127c70239b918860830_Fake_Logo_6.svg' },
];

export const INTEGRATION_TOOLS_COL2: IntegrationTool[] = [
  { id: '7', name: 'CNDP Conformité', category: 'Protection Données (Loi 09-08)', logoUrl: '/assets/images/68a701274b9f599b7bca7507_Fake_Logo_7.svg' },
  { id: '8', name: 'Sage Comptabilité', category: 'Facturation & Frais', logoUrl: '/assets/images/68a70127b855449b70c5ff14_Fake_Logo_8.svg' },
  { id: '9', name: 'PDF Engine /20', category: 'Génération Bulletins', logoUrl: '/assets/images/68a70127ff28015ac9fee3f8_Fake_Logo_1.svg' },
  { id: '10', name: 'Scanner QR Caméra', category: 'Présences Instantanées', logoUrl: '/assets/images/68a7012708a760adb36255e0_Fake_Logo_2.svg' },
  { id: '11', name: 'Stripe Payments', category: 'Paiements en ligne', logoUrl: '/assets/images/68a701274180c858df689f8b_Fake_Logo_3.svg' },
  { id: '12', name: 'Lango Core Sync', category: 'Gestion Pédagogique', logoUrl: '/assets/images/68a70127369f354d650b5176_Fake_Logo_4.svg' },
];

// ─── PRICING TIERS DICTIONARY ────────────────────────────────────────────────
export const PRICING_TIERS_I18N: Record<Locale, PricingTier[]> = {
  fr: [
    {
      id: 1,
      menuTitle: 'Plan Basique',
      menuSubtitle: 'Petits établissements',
      planName: 'Basique',
      price: '299',
      currency: 'MAD',
      period: '/ mois',
      description: 'Conçu pour les petits établissements et centres de langues qui démarrent leur digitalisation.',
      features: [
        'Gestion jusqu\'à 200 élèves',
        'Présence & absences SMS (+212)',
        'Bulletins /20 automatiques',
        'Support email standard',
        'Guide d\'onboarding stratégique',
      ],
      isMain: false,
    },
    {
      id: 2,
      menuTitle: 'Plan Standard',
      menuSubtitle: 'Le plus populaire',
      planName: 'Standard',
      price: '699',
      currency: 'MAD',
      period: '/ mois',
      description: 'Conçu pour les établissements en croissance qui ont besoin d\'outils complets et automatisés.',
      features: [
        'Jusqu\'à 500 élèves',
        'Tableau de bord analytique avancé',
        'SMS prioritaires multi-classes',
        'Sessions stratégiques trimestrielles',
        'Accès équipe (jusqu\'à 10 utilisateurs)',
        'Conformité CNDP Garantie',
      ],
      isMain: true,
    },
    {
      id: 3,
      menuTitle: 'Plan Premium',
      menuSubtitle: 'Établissements avancés',
      planName: 'Premium',
      price: '1299',
      currency: 'MAD',
      period: '/ mois',
      description: 'Pour les grands établissements qui nécessitent des insights approfondis et un accompagnement dédié.',
      features: [
        'Élèves illimités',
        'Responsable success dédié à Casablanca',
        'KPI personnalisés & reporting financier',
        'Revues de performance mensuelles',
        'Accès équipe illimité + marque blanche',
        'Serveur privé & installation dédiée',
      ],
      isMain: false,
    },
  ],
  ar: [
    {
      id: 1,
      menuTitle: 'الباقة الأساسية',
      menuSubtitle: 'المؤسسات الصغيرة',
      planName: 'الأساسية',
      price: '299',
      currency: 'درهم',
      period: '/ شهر',
      description: 'مصممة للمؤسسات الصغيرة ومراكز اللغات التي تبدأ تحولها الرقمي.',
      features: [
        'إدارة حتى 200 تلميذ',
        'حضور وغيابات عبر SMS (+212)',
        'كشوف النقاط /20 تلقائية',
        'دعم عبر البريد الإلكتروني',
        'دليل المواكبة الإستراتيجية',
      ],
      isMain: false,
    },
    {
      id: 2,
      menuTitle: 'الباقة القياسية',
      menuSubtitle: 'الأكثر شعبية',
      planName: 'القياسية',
      price: '699',
      currency: 'درهم',
      period: '/ شهر',
      description: 'مصممة للمؤسسات النامية التي تحتاج أدوات كاملة ومؤتمتة.',
      features: [
        'حتى 500 تلميذ',
        'لوحة قيادة تحليلية متقدمة',
        'رسائل SMS أولوية لعدة أقسام',
        'جلسات إستراتيجية كل ثلاثة أشهر',
        'وصول فريق العمل (حتى 10 مستخدمين)',
        'مطابقة كاملة لقانون CNDP',
      ],
      isMain: true,
    },
    {
      id: 3,
      menuTitle: 'الباقة الاحترافية',
      menuSubtitle: 'المؤسسات الكبرى',
      planName: 'الاحترافية',
      price: '1299',
      currency: 'درهم',
      period: '/ شهر',
      description: 'للمؤسسات الكبرى التي تتطلب تحليلات عميقة ومرافقة مخصصة.',
      features: [
        'عدد تلاميذ غير محدود',
        'مرافق خاص بالدار البيضاء',
        'مؤشرات أداء وتقارير مالية',
        'مراجعات أداء شهرية',
        'وصول غير محدود + علامة بيضاء',
        'خادم خاص وتثبيت مخصص',
      ],
      isMain: false,
    },
  ],
};

// ─── FAQ ITEMS DICTIONARY ─────────────────────────────────────────────────────
export const FAQ_ITEMS_I18N: Record<Locale, FaqItem[]> = {
  fr: [
    {
      id: 'faq-1',
      question: "Quels types d'établissements accompagnez-vous au Maroc ?",
      answer: "Nous accompagnons les écoles privées (Maternelle, Primaire, Collège, Lycée), les centres de langues et les instituts de formation professionnelle à Casablanca, Rabat, Marrakech et dans tout le Royaume.",
    },
    {
      id: 'faq-2',
      question: 'Combien de temps faut-il pour migrer nos données Excel existantes ?',
      answer: "Notre équipe s'occupe de l'importation de votre liste d'élèves, tuteurs et enseignants en moins de 24 heures. Aucune saisie manuelle lourde n'est nécessaire.",
    },
    {
      id: 'faq-3',
      question: "SchoolOS est-il conforme à la loi CNDP 09-08 sur la protection des données ?",
      answer: "Oui. Toutes les données scolaires et familiales sont hébergées et traitées dans le strict respect de la Loi 09-08 avec chiffrement de bout en bout et autorisations CNDP.",
    },
    {
      id: 'faq-4',
      question: 'Comment fonctionne l\'envoi des SMS d\'absence aux parents ?',
      answer: "Lorsqu'un enseignant ou l'administration marque une absence, la passerelle SMS informe directement le téléphone des parents avec l'indicatif +212 en temps réel.",
    },
    {
      id: 'faq-5',
      question: 'Proposez-vous une démonstration personnalisée dans nos locaux ?',
      answer: "Absolument. Nos conseillers peuvent planifier une démonstration en visioconférence ou directement dans vos locaux à Casablanca, Rabat et environnements.",
    },
  ],
  ar: [
    {
      id: 'faq-1',
      question: "ما هي أنواع المؤسسات التي تواكبونها في المغرب؟",
      answer: "نرافق المدارس الخاصة (الروض، الابتدائي، الإعدادي، الثانوي)، مراكز اللغات، والمعاهد المهنية بالدار البيضاء، الرباط، مراكش وكافة مدن المملكة.",
    },
    {
      id: 'faq-2',
      question: "كم يلزم من الوقت لنقل بياناتنا من ملفات Excel الحالية؟",
      answer: "يتكفل فريقنا باستيراد قائمة التلاميذ، أولياء الأمور والأساتذة في أقل من 24 ساعة دون أي إدخال يدوي شاق.",
    },
    {
      id: 'faq-3',
      question: "هل منصة SchoolOS مطابقة لقانون حماية المعطيات الشخصية CNDP 09-08؟",
      answer: "نعم. جميع المعطيات المدرسية والعائلية تُعالج وتُحفظ في احترام تام للقانون 09-08 مع تشفير كامل ورخص حماية المعطيات.",
    },
    {
      id: 'faq-4',
      question: "كيف تعمل خدمة إرسال رسائل SMS للغياب لأولياء الأمور؟",
      answer: "بمجرد تسجيل الغياب من طرف الأستاذ أو الإدارة، تقوم بوابة SMS بإشعار هاتف ولي الأمر بالرمز الدولي (+212) فوراً.",
    },
    {
      id: 'faq-5',
      question: "هل تقدمون عرضاً توضيحياً مخصصاً بمقر مؤسستنا؟",
      answer: "بالتأكيد. يمكن لمستشارينا تنظيم عرض توضيحي عبر الفيديو أو مباشرة بمقر مؤسستكم بالدار البيضاء، الرباط والمدن المجاورة.",
    },
  ],
};

// ─── CONTACT CONTENT DICTIONARY ───────────────────────────────────────────────
export const CONTACT_CONTENT_I18N: Record<Locale, ContactContent> = {
  fr: {
    title: "Préparez votre école pour SchoolOS",
    subtitle: "SchoolOS arrive bientôt. Rejoignez la liste d'accès prioritaire pour découvrir le pilote et nous aider à l'adapter aux besoins réels de votre établissement.",
    phone: "+212 522 123 456",
    email: "contact@schoolos.ma",
    ratingText: "Accès pilote en préparation",
    ratingSubtext: "Pensé pour les écoles privées au Maroc",
    profiles: [
      { src: '/assets/images/68a71d7fa79008ec6716ac73_Modern_man_portrait_.avif', alt: 'Directeur M. El Amrani' },
      { src: '/assets/images/68a71d7fa80bb87671d03416_Dreamy_Portrait_of_a_Young_Woman.avif', alt: 'Directrice Mme. Bennani' },
      { src: '/assets/images/68a71d7fa80bb87671d03408_Contemplative_Woman_in_Vibrant_Fashion.avif', alt: 'Responsable Pédagogique' },
      { src: '/assets/images/68a71d7f400136be769bc9dc_Modern_Portrait_Gradient.avif', alt: 'Fondateur Institut' },
    ],
  },
  ar: {
    title: "حضّر مؤسستك لـ SchoolOS",
    subtitle: "SchoolOS قادم قريباً. انضم إلى قائمة الولوج الأولي لاكتشاف النسخة التجريبية ومساعدتنا على ملاءمتها مع احتياجات مؤسستك الحقيقية.",
    phone: "+212 522 123 456",
    email: "contact@schoolos.ma",
    ratingText: "النسخة التجريبية قيد التحضير",
    ratingSubtext: "مصممة للمدارس الخاصة بالمغرب",
    profiles: [
      { src: '/assets/images/68a71d7fa79008ec6716ac73_Modern_man_portrait_.avif', alt: 'المدير السيد العمراني' },
      { src: '/assets/images/68a71d7fa80bb87671d03416_Dreamy_Portrait_of_a_Young_Woman.avif', alt: 'المديرة السيدة بناني' },
      { src: '/assets/images/68a71d7fa80bb87671d03408_Contemplative_Woman_in_Vibrant_Fashion.avif', alt: 'المشرفة التربوية' },
      { src: '/assets/images/68a71d7f400136be769bc9dc_Modern_Portrait_Gradient.avif', alt: 'مؤسس المعهد' },
    ],
  },
};

// ─── FOOTER CONTENT DICTIONARY ────────────────────────────────────────────────
export const FOOTER_CONTENT_I18N: Record<Locale, FooterContent> = {
  fr: {
    newsletterTitle: "S'abonner à notre newsletter",
    newsletterButtonText: "S'abonner",
    contactEmail: "contact@schoolos.ma",
    designedByText: "Conçu pour SchoolOS Maroc",
    poweredByText: "Propulsé par SchoolOS Engine",
    navLinks: [
      { label: 'Accueil', href: '#' },
      { label: 'Processus', href: '#process' },
      { label: 'Fonctionnalités', href: '#features' },
      { label: 'Intégrations', href: '#integration' },
      { label: 'Tarification', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Espace Établissement', href: '/dashboard' },
    ],
  },
  ar: {
    newsletterTitle: "الاشتراك في النشرة الإخبارية",
    newsletterButtonText: "اشتراك",
    contactEmail: "contact@schoolos.ma",
    designedByText: "مصمم لـ SchoolOS المغرب",
    poweredByText: "مدعوم من محرك SchoolOS",
    navLinks: [
      { label: 'الرئيسية', href: '#' },
      { label: 'طريقة العمل', href: '#process' },
      { label: 'المميزات', href: '#features' },
      { label: 'الربط المباشر', href: '#integration' },
      { label: 'الأسعار', href: '#pricing' },
      { label: 'الأسئلة الشائعة', href: '#faq' },
      { label: 'فضاء المؤسسة', href: '/dashboard' },
    ],
  },
};

// Default exports for backward compatibility
export const HERO_CONTENT = HERO_CONTENT_I18N.fr;
export const PROCESS_STEPS = PROCESS_STEPS_I18N.fr;
export const FEATURE_TABS = FEATURE_TABS_I18N.fr;
export const PRICING_TIERS = PRICING_TIERS_I18N.fr;
export const FAQ_ITEMS = FAQ_ITEMS_I18N.fr;
export const CONTACT_CONTENT = CONTACT_CONTENT_I18N.fr;
export const FOOTER_CONTENT = FOOTER_CONTENT_I18N.fr;
