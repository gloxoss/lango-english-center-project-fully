'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus } from 'lucide-react';
import { ApiAssessmentSession } from '../data/evaluations-config';

export function EvaluationsClient({ locale }: { locale: string }) {
  const [sessions, setSessions] = useState<ApiAssessmentSession[]>([]);

  useEffect(() => {
    fetch('/api/academics/assessment-sessions')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setSessions(json.data);
        }
      })
      .catch(err => console.error('Failed loading evaluations', err));
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Évaluations</h1>
          <p className="text-xs text-slate-500 mt-1">Contrôles et devoirs définis par classe et matière.</p>
        </div>
        <Link
          href={`/${locale}/dashboard/academics/grades/entry`}
          className="h-10 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold flex items-center gap-2 shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle évaluation</span>
        </Link>
      </div>

      <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Évaluation</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Classe</th>
                <th className="py-3.5 px-4">Matière</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Notes saisies</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#16212B] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2487B8]" />
                      {s.title}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{s.planName}</td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{s.className}</td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{s.subjectName}</td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{new Date(s.assessmentDate).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <Badge className={s.gradedCount > 0 ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#FCF0DC] text-[#E8A33D]'}>
                      {s.gradedCount}
                      {' '}
                      élève(s)
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <Link href={`/${locale}/dashboard/academics/grades/entry`} className="text-[#2487B8] hover:underline text-[11px] font-bold">
                      Saisir les notes
                    </Link>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Aucune évaluation créée pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
