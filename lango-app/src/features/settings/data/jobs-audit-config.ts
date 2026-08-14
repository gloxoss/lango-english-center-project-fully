// jobs-audit-config.ts
// Seed definitions for scheduled jobs and maintenance windows. These populate
// the `jobs.definitions` setting on first load; run history is recorded by the
// trigger API, never fabricated here.
// Decoupled from JSX per Next.js App Router Rule 3 (Content Separation).

export const SCHEDULED_JOBS = [
  {
    id: 'job-1',
    name: 'Rappels de paiement automatiques (SMS/Email)',
    category: 'Communication',
    schedule: 'Chaque lundi à 08:00',
    nextRun: '—',
    avgDuration: '—',
    status: 'paused' as const,
    lastRun: '—',
    lastMessage: 'Aucune exécution enregistrée',
    action: 'none',
  },
  {
    id: 'job-2',
    name: 'Sauvegarde quotidienne de la base de données',
    category: 'Système',
    schedule: 'Chaque jour à 02:00',
    nextRun: '—',
    avgDuration: '—',
    status: 'paused' as const,
    lastRun: '—',
    lastMessage: 'Aucune exécution enregistrée',
    action: 'none',
  },
  {
    id: 'job-3',
    name: 'Calcul automatique des moyennes trimestrielles',
    category: 'Académique',
    schedule: 'Lancement manuel',
    nextRun: 'À la demande',
    avgDuration: '—',
    status: 'paused' as const,
    lastRun: '—',
    lastMessage: 'Aucune exécution enregistrée',
    action: 'none',
  },
  {
    id: 'job-4',
    name: 'Synchronisation import des matricules MASSAR',
    category: 'Intégration',
    schedule: 'Chaque 6 heures',
    nextRun: '—',
    avgDuration: '—',
    status: 'paused' as const,
    lastRun: '—',
    lastMessage: 'Aucune exécution enregistrée',
    action: 'none',
  },
  {
    id: 'job-5',
    name: 'Génération asynchrone des reçus de paiement PDF',
    category: 'Finance',
    schedule: 'En continu (Queue)',
    nextRun: 'Temps réel',
    avgDuration: '—',
    status: 'paused' as const,
    lastRun: '—',
    lastMessage: 'Aucune exécution enregistrée',
    action: 'none',
  },
  {
    id: 'job-6',
    name: 'Purge des sessions utilisateur expirées',
    category: 'Sécurité',
    schedule: 'Chaque jour à 04:00',
    nextRun: '—',
    avgDuration: '—',
    status: 'paused' as const,
    lastRun: '—',
    lastMessage: 'Aucune exécution enregistrée',
    action: 'purge_sessions',
  },
] as const;

export const MAINTENANCE_WINDOWS = [
  { title: 'Mise à jour mensuelle de sécurité système', schedule: 'Dimanche 15 août 2026, 02:00 - 04:00', impact: 'Coupure brève de 10 min' },
  { title: 'Sauvegarde froide intégrale infrastructure', schedule: '1er septembre 2026, 01:00 - 03:00', impact: 'Accès lecture seule' },
] as const;
