export type AssessmentType =
  | 'homework'
  | 'quiz'
  | 'paper_exam'
  | 'online_exam'
  | 'project'
  | 'oral'
  | 'practical';

export type AssessmentStatus = 'draft' | 'published' | 'closed' | 'archived';

export type OutcomeStatus = 'pending' | 'graded' | 'exempted' | 'absent' | 'withheld';

export type ModerationState = 'draft' | 'submitted' | 'moderated' | 'locked' | 'published';

export interface AssessmentDefinitionDTO {
  id: string;
  tenantId: string;
  classSubjectId?: string;
  sessionYearId?: string;
  termId?: string;
  type: AssessmentType;
  title: string;
  description?: string;
  maximumScore: number;
  coefficient: number;
  passMark?: number;
  status: AssessmentStatus;
  createdAt: string;
}

export interface AssessmentOutcomeDTO {
  id: string;
  tenantId: string;
  assessmentDefinitionId: string;
  studentId: string;
  rawScore?: number;
  maximumScoreSnapshot: number;
  normalizedScore?: number;
  grade?: string;
  status: OutcomeStatus;
  sourceType: string;
  sourceReferenceId?: string;
  markerId?: string;
  moderationState: ModerationState;
  createdAt: string;
}

