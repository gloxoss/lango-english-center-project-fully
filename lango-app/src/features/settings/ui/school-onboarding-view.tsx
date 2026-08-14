// school-onboarding-view.tsx
// Re-exports OrganizationPage for backward compatibility with existing route imports.
import { OrganizationPage } from './organization-page';

export async function SchoolOnboardingView() {
  return <OrganizationPage />;
}
