import React from 'react';
import { GradeEntryGrid } from '@/components/teacher/GradeEntryGrid';
import { TeacherTodaySchedule } from '@/components/teacher/TeacherTodaySchedule';

export default function TeacherPortalPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <TeacherTodaySchedule />
      <GradeEntryGrid />
    </div>
  );
}
