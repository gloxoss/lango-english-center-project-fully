// pass-threshold.ts
// Single conversion between the school's configured passing score (expressed
// on the school's grading scale, default 10/20) and the 0-100 percentage
// contract that assessment_results.final_percentage and the promotions engine
// use. The promotions preview and the grading-policy API MUST go through this
// one function so the threshold the director edits on
// /dashboard/academics/grading/policies is the threshold promotions apply.

export type GradingScale = '20' | '100';

export function passingScoreToPercentage(passingScore: number, gradingScale: GradingScale): number {
  if (gradingScale === '100') {
    return passingScore;
  }
  return passingScore * 5;
}

/** Normalize a stored policy value to the /20 Moroccan report-card scale. */
export function passingScoreOnTwenty(passingScore: number, gradingScale: GradingScale): number {
  if (gradingScale === '100') {
    return Math.round((passingScore / 5) * 100) / 100;
  }
  return passingScore;
}
