export type StudentGuardianProjection = {
  guardianName: string | null;
  guardianPhone: string | null;
  relationshipType?: string | null;
  isVerified: boolean;
  isLegacyFallback: boolean;
};

export function resolveStudentGuardianProjection(
  relationalGuardians?: Array<{
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    relationshipType?: string | null;
    isPrimaryContact?: boolean | null;
  }> | null,
  legacy?: {
    guardianName?: string | null;
    guardianPhone?: string | null;
  } | null,
): StudentGuardianProjection {
  if (relationalGuardians && relationalGuardians.length > 0) {
    const primary = relationalGuardians.find(g => g.isPrimaryContact) ?? relationalGuardians[0];
    if (primary) {
      const name = `${primary.firstName || ''} ${primary.lastName || ''}`.trim() || null;
      return {
        guardianName: name,
        guardianPhone: primary.phone ?? null,
        relationshipType: primary.relationshipType ?? null,
        isVerified: true,
        isLegacyFallback: false,
      };
    }
  }

  if (legacy?.guardianName || legacy?.guardianPhone) {
    return {
      guardianName: legacy.guardianName ?? null,
      guardianPhone: legacy.guardianPhone ?? null,
      relationshipType: null,
      isVerified: false,
      isLegacyFallback: true,
    };
  }

  return {
    guardianName: null,
    guardianPhone: null,
    relationshipType: null,
    isVerified: false,
    isLegacyFallback: false,
  };
}
