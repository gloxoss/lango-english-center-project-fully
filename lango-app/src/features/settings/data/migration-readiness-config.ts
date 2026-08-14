// migration-readiness-config.ts
// Seed definitions for the Migration Readiness Center: step labels, target columns,
// template column mappings and team-task checklist. Real readiness/anomaly counts
// are computed server-side from the database — never fabricated here.
// Decoupled from JSX per Next.js App Router Rule 3 (Content Separation).

export const MIGRATION_STEPS = [
  {
    id: 1,
    stepNumber: 1,
    label: 'Audit & Nettoyage des fichiers source',
    sub: 'Analyse syntaxique, détection des encodages UTF-8 et suppression des lignes vides',
    status: 'pending' as const,
  },
  {
    id: 2,
    stepNumber: 2,
    label: 'Cartographie des champs (Mapping)',
    sub: 'Association des colonnes Excel aux attributs de la base de données SchoolOS',
    status: 'pending' as const,
  },
  {
    id: 3,
    stepNumber: 3,
    label: 'Validation des règles de cohérence',
    sub: 'Contrôle des doublons CIN, formats téléphones (+212) et matricules MASSAR',
    status: 'pending' as const,
  },
  {
    id: 4,
    stepNumber: 4,
    label: 'Importation finale en base de données',
    sub: 'Injection transactionnelle atomique PostgreSQL avec journalisation complète',
    status: 'pending' as const,
  },
] as const;

export const TARGET_COLUMNS = [
  { key: 'student_full_name', label: 'Nom & Prénom Élève *' },
  { key: 'massar_code', label: 'Matricule MASSAR *' },
  { key: 'cin_number', label: 'Numéro CIN Tuteur' },
  { key: 'parent_phone', label: 'Téléphone Mobile Tuteur (+212)' },
  { key: 'class_name', label: 'Libellé Classe / Niveau *' },
  { key: 'date_of_birth', label: 'Date de Naissance Élève' },
] as const;

export const INITIAL_COLUMN_MAPPINGS: Array<{ sourceCol: string; targetField: string }> = [
  { sourceCol: 'NOM_PRENOM_ELEVE', targetField: 'student_full_name' },
  { sourceCol: 'MATRICULE_MASSAR', targetField: 'massar_code' },
  { sourceCol: 'CIN_PARENT', targetField: 'cin_number' },
  { sourceCol: 'TELEPHONE_TUTEUR', targetField: 'parent_phone' },
  { sourceCol: 'CLASSE_ACTUELLE', targetField: 'class_name' },
];

export const MIGRATION_TEAM_TASKS = [
  {
    id: 1,
    task: 'Vérifier les doublons CIN tuteurs avec le secrétariat',
    status: 'pending' as const,
    assignee: '',
    date: '',
  },
  {
    id: 2,
    task: "Obtenir le fichier d'export MASSAR actualisé du Ministère",
    status: 'pending' as const,
    assignee: '',
    date: '',
  },
  {
    id: 3,
    task: 'Valider la cartographie des codes comptables PCG 2026',
    status: 'pending' as const,
    assignee: '',
    date: '',
  },
] as const;
