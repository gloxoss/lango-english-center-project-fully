import type { AppRole } from '@/libs/api/context';

// Real, sensitivity + domain-scoped report access matrix
// (future-implementation/advanced-reporting remediation, section-02) -
// reuses the catalog's existing sensitivityLevel/domain fields (already
// present in report_definitions, previously never enforced anywhere)
// instead of inventing new permission infrastructure.
export function canAccessReport(
  role: AppRole,
  reportDefinition: { sensitivityLevel: string; domain: string },
): boolean {
  if (role === 'school_admin' || role === 'super_admin') {
    return true;
  }

  const { sensitivityLevel, domain } = reportDefinition;

  if (role === 'teacher') {
    return sensitivityLevel === 'standard' || sensitivityLevel === 'restricted';
  }

  if (role === 'accountant') {
    if (sensitivityLevel === 'standard') {
      return true;
    }
    return domain === 'Fees' || domain === 'Financial';
  }

  return false;
}
