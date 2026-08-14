import { getEffectiveValue } from '@/libs/settings/registry';

// 2FA enforcement policy (plan #3):
//   * super_admin  -> always mandatory (platform-wide rule, no toggle).
//   * school_admin -> mandatory when the tenant enables
//                     `security.requireTwoFactorForAdmins` (default false).
//   * every other role -> not enforced at the dashboard shell.
export async function requiresTwoFactor(
  role: string | null | undefined,
  tenantId: string | null | undefined,
): Promise<boolean> {
  if (!role) return false;
  if (role === 'super_admin') return true;
  if (role === 'school_admin') {
    if (!tenantId) return false;
    const eff = await getEffectiveValue(tenantId, null, 'security.requireTwoFactorForAdmins');
    return eff.value === true;
  }
  return false;
}
