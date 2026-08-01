'use client';

import { ComingSoonView } from '@/components/shared/coming-soon-view';

// ponytail: no real chapter/lesson-progress schema exists, and there's no
// reference model for one (see MIGRATION-NOTES.md) - honest placeholder
// instead of inventing a new domain concept.
export function SyllabusView() {
  return <ComingSoonView title="Progression pédagogique" description="Suivi des chapitres et de l'avancement par matière." />;
}
