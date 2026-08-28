'use client';

import { Cake, UserCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

export type BirthdayPerson = {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'staff';
  detail: string;
};

export function BirthdayTrackerWidget({
  studentBirthdays = [],
  employeeBirthdays = [],
}: {
  studentBirthdays?: BirthdayPerson[];
  employeeBirthdays?: BirthdayPerson[];
}) {
  const t = useTranslations('Dashboard');
  const totalStudentBirthdays = studentBirthdays.length;
  const totalEmployeeBirthdays = employeeBirthdays.length;

  return (
    <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
            <Cake className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider">
              {t('birthdayTitle')}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">{t('birthdaySubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 my-3">
        {/* Student Birthdays Section */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0EA5C4]" />
              <span className="text-xs font-bold text-[#16212B]">{t('birthdayStudentsLabel')}</span>
            </div>
            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#0EA5C4]/10 text-[#0EA5C4]">
              {totalStudentBirthdays}
            </span>
          </div>

          {totalStudentBirthdays === 0 ? (
            <div className="py-2 text-center border-t border-slate-200/60">
              <p className="text-[11px] font-semibold text-slate-400">{t('birthdayTodayBadge', { count: totalStudentBirthdays })}</p>
              <p className="text-[10px] text-slate-400">{t('birthdayStudentEmpty')}</p>
            </div>
          ) : (
            <div className="space-y-1.5 border-t border-slate-200/60 pt-2">
              {studentBirthdays.map(person => (
                <div key={person.id} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#16212B]">🎉 {person.name}</span>
                  <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {person.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employee Birthdays Section */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-pink-600" />
              <span className="text-xs font-bold text-[#16212B]">{t('birthdayStaffLabel')}</span>
            </div>
            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
              {totalEmployeeBirthdays}
            </span>
          </div>

          {totalEmployeeBirthdays === 0 ? (
            <div className="py-2 text-center border-t border-slate-200/60">
              <p className="text-[11px] font-semibold text-slate-400">{t('birthdayTodayBadge', { count: totalEmployeeBirthdays })}</p>
              <p className="text-[10px] text-slate-400">{t('birthdayStaffEmpty')}</p>
            </div>
          ) : (
            <div className="space-y-1.5 border-t border-slate-200/60 pt-2">
              {employeeBirthdays.map(person => (
                <div key={person.id} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#16212B]">🎂 {person.name}</span>
                  <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {person.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
