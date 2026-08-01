'use client';

import { ComingSoonView } from '@/components/shared/coming-soon-view';

// ponytail: most of this page (lateness threshold, justification rules,
// teacher permissions, approval workflow, SMS alert rules) has no schema
// anywhere - only status toggles loosely map to schoolSettings.presenceModes.
// Not scoped in the approved remediation plan; honest placeholder rather
// than half-real. Flagged for a future pass, not silently rebuilt.
export function AttendanceSettingsView() {
  return <ComingSoonView title="Configuration des présences" description="Règles de présence, retards et justifications - à venir." />;
}
