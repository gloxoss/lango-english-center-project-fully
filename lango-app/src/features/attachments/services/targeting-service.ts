export type AssetTargetRow = {
  targetKind: 'school' | 'role' | 'class_offering' | 'class_section' | 'class_subject' | 'user';
  targetRoleValue: string | null;
  targetRefId: string | null;
};

export type AssetViewer = {
  userId: string;
  role: string;
  sectionId: string | null;
  offeringIds: string[];
  classSubjectIds: string[];
};

// Real audience-matching rule for digital assets - mirrors the exact shape
// of isHomeworkVisibleToStudent (broadcast-on-empty, .some() over target
// rows), extended with the studentVisible staff-only gate (an answer key
// must never leak to a student even if a target row would otherwise match)
// and the role/school/class_subject/user target kinds homework doesn't need.
export function isAssetVisibleToUser(
  targets: AssetTargetRow[],
  studentVisible: boolean,
  viewer: AssetViewer,
): boolean {
  if (viewer.role === 'student' && !studentVisible) {
    return false;
  }
  if (targets.length === 0) {
    return true;
  }
  return targets.some((t) => {
    if (t.targetKind === 'school') return true;
    if (t.targetKind === 'role') return t.targetRoleValue === viewer.role;
    if (t.targetKind === 'user') return t.targetRefId === viewer.userId;
    if (t.targetKind === 'class_section') return viewer.sectionId !== null && t.targetRefId === viewer.sectionId;
    if (t.targetKind === 'class_offering') return t.targetRefId !== null && viewer.offeringIds.includes(t.targetRefId);
    if (t.targetKind === 'class_subject') return t.targetRefId !== null && viewer.classSubjectIds.includes(t.targetRefId);
    return false;
  });
}
