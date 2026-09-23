export type EvaluationRule = {
  id: string;
  name: string;
  weight: number;
  description: string;
};

/**
 * Form template seeded into the weights editor before the first server save.
 * Not displayed as stored truth — the stored policy lives in the tenant
 * settings registry (academic.evaluationWeights) and is loaded from
 * GET /api/academics/grading-policies (audit 2026-09-22, P0-3).
 */
export const DEFAULT_EVALUATION_RULES: EvaluationRule[] = [
  { id: '1', name: 'Examen Final de Semestre (Devoir Synthèse)', weight: 50, description: 'Épreuve écrite nationale / régionale sur table' },
  { id: '2', name: 'Contrôles Continus (CC1 & CC2)', weight: 30, description: 'Évaluations formatives régulières en classe' },
  { id: '3', name: 'Devoirs à la maison & TP Pratiques', weight: 15, description: 'Travaux personnels et séances de laboratoire' },
  { id: '4', name: 'Assiduité & Participation Orale', weight: 5, description: 'Présence effective et engagement au cours' },
];

// The /20 reference scale shown on the page is derived from the Moroccan
// grade engine itself (MOROCCAN_MENTION_BANDS) — no hand-written mock scale
// lives here anymore (audit pass 2, item 4 / security audit P3).
