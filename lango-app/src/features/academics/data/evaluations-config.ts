export type ApiAssessmentSession = {
  id: string;
  title: string;
  type: string;
  assessmentDate: string;
  className: string | null;
  subjectName: string | null;
  gradedCount: number;
  publishedCount: number;
};

// Labels for assessment_definitions.type (homework is listed on its own page).
export const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  quiz: 'Contrôle',
  paper_exam: 'Examen écrit',
  online_exam: 'Examen en ligne',
  project: 'Projet',
  oral: 'Oral',
  practical: 'Pratique',
};
