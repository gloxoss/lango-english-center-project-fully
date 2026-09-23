'use client';

import { StudentTransfersClient } from './student-transfers-client';

export function StudentTransfersPlayground({ locale }: { locale?: string } = {}) {
  return <StudentTransfersClient locale={locale} />;
}
