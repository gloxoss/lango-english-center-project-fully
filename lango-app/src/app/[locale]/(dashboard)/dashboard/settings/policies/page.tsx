import { redirect } from 'next/navigation';
import { requireServerPage } from '@/libs/api/page-guard';

/**
 * /settings/policies is retired (SETTINGS-CORE-FIX-01 / SCF-04-02).
 *
 * It edited three keys, and all three now live where the work happens:
 * `academic.passThreshold` and `academic.gradingScale` on the Grading policies
 * page, `attendance.smsAlerts` on the Attendance settings page. Two pages
 * editing one key drift apart silently, so this one redirects instead of
 * offering a second copy. The guard is the TARGET's capability, not this
 * page's old one, so the redirect can never drop a user somewhere their role
 * cannot open — otherwise they would bounce straight back to the dashboard.
 */
export default async function SettingsPoliciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'grading.manage' });
  redirect(`/${locale}/dashboard/academics/grading/policies`);
}
