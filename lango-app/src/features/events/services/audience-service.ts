import { resolveStudentAudienceContext } from '@/libs/academics/audience-context';
import type { AppRole } from '@/libs/api/context';

export type EventTargetRow = {
  targetKind: 'school' | 'role' | 'class_offering' | 'class_section' | 'class_subject' | 'user' | 'group';
  targetRoleValue: string | null;
  targetRefId: string | null;
};

export type EventViewer = {
  userId: string;
  role: AppRole;
  sectionId: string | null;
  offeringIds: string[];
  classSubjectIds: string[];
};

/**
 * Validates if an event is visible to the given user context based on audience rules.
 * This function follows the exact same shape as isAssetVisibleToUser.
 *
 * If targets is empty, the event is visible to everyone in the tenant.
 */
export function isEventVisibleToUser(
  targets: EventTargetRow[],
  viewer: EventViewer,
): boolean {
  if (targets.length === 0) {
    return true;
  }

  return targets.some((t) => {
    switch (t.targetKind) {
      case 'school':
        return true;
      case 'role':
        return t.targetRoleValue === viewer.role;
      case 'user':
        return t.targetRefId === viewer.userId;
      case 'class_section':
        return viewer.sectionId !== null && t.targetRefId === viewer.sectionId;
      case 'class_offering':
        return t.targetRefId !== null && viewer.offeringIds.includes(t.targetRefId);
      case 'class_subject':
        return t.targetRefId !== null && viewer.classSubjectIds.includes(t.targetRefId);
      case 'group':
        // Not yet implemented: requires fetching group membership
        return false;
      default:
        return false;
    }
  });
}

/**
 * Resolves the academic and structural context needed to evaluate event audience rules.
 * Reuses the existing resolveStudentAudienceContext function.
 */
export async function resolveEventViewerContext(userId: string, role: AppRole): Promise<EventViewer> {
  const viewer: EventViewer = {
    userId,
    role,
    sectionId: null,
    offeringIds: [],
    classSubjectIds: [],
  };

  if (role === 'student') {
    const studentCtx = await resolveStudentAudienceContext(userId);
    viewer.sectionId = studentCtx.sectionId;
    viewer.offeringIds = studentCtx.offeringIds;
    viewer.classSubjectIds = studentCtx.classSubjectIds;
  }

  // Teachers could potentially have offeringIds or sectionIds resolved here if needed,
  // similar to how it works in resolveTeacherAudienceContext if it exists.

  return viewer;
}
