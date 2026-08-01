'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

type ApiClassSection = { id: string; classId: string; className: string; sectionName: string };
type ApiSubject = { id: string; name: string };
type ApiClassSubject = { id: string; classId: string; subjectId: string };
type RankedStudent = { studentId: string; name: string; generalAverage: number; rank: number; totalStudents: number; mention: string };
type ClassResults = {
  className: string;
  subjectName: string;
  rosterSize: number;
  gradedCount: number;
  classAverage: number;
  passingCount: number;
  atRiskCount: number;
  bestStudent: RankedStudent | null;
  mentionCounts: Record<string, number>;
  ranking: RankedStudent[];
};

const MENTION_COLOR: Record<string, string> = {
  'Très Bien': 'bg-[#DCEBF4] text-[#1B6C93]',
  'Bien': 'bg-sky-100 text-sky-800',
  'Assez Bien': 'bg-slate-100 text-slate-700',
  'Passable': 'bg-[#FCF0DC] text-[#E8A33D]',
  'Insuffisant': 'bg-[#FCE4E2] text-[#E5544B]',
};

export function ClassResultsView() {
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ApiClassSubject[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [results, setResults] = useState<ClassResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()),
      fetch('/api/academics/subjects?pageSize=200').then(r => r.json()),
      fetch('/api/academics/class-subjects?pageSize=500').then(r => r.json()),
    ]).then(([csJson, subjJson, classSubjJson]) => {
      if (csJson.success) setClassSections(csJson.data);
      if (subjJson.success) setSubjects(subjJson.data);
      if (classSubjJson.success) setClassSubjects(classSubjJson.data);
    }).catch(err => console.error('Failed loading class-results pickers', err));
  }, []);

  const selectedClassSection = classSections.find(c => c.id === selectedClassSectionId) ?? null;
  const classSubjectId = useMemo(() => {
    if (!selectedClassSection || !selectedSubjectId) {
      return null;
    }
    return classSubjects.find(cs => cs.classId === selectedClassSection.classId && cs.subjectId === selectedSubjectId)?.id ?? null;
  }, [selectedClassSection, selectedSubjectId, classSubjects]);

  useEffect(() => {
    if (!classSubjectId) {
      setResults(null);
      return;
    }
    setError(null);
    fetch(`/api/academics/class-results?classSubjectId=${classSubjectId}`)
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setResults(json.data);
        } else {
          setError(json.message || 'Échec du chargement des résultats.');
        }
      })
      .catch((err) => {
        console.error('Failed loading class results', err);
        setError('Connexion impossible.');
      });
  }, [classSubjectId]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Résultats de la classe</h1>
          <p className="text-xs text-slate-500 mt-1">Classement et moyennes réels, calculés à partir des notes saisies.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl"><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>
              {classSections.map(cs => (
                <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl"><SelectValue placeholder="Matière" /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!classSubjectId && !error && (
        <p className="text-xs text-slate-400 py-8 text-center">Sélectionnez une classe et une matière pour voir les résultats.</p>
      )}

      {results && (
        <>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{results.className}</Badge>
            <span className="text-xs text-slate-500">{results.subjectName} • {results.gradedCount} / {results.rosterSize} élèves notés</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Moyenne de la classe</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{results.classAverage} <span className="text-xs font-normal text-slate-400">/20</span></p>
            </Card>
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Meilleur élève</p>
              {results.bestStudent
                ? (
                    <>
                      <p className="text-base font-extrabold text-[#16212B]">{results.bestStudent.name}</p>
                      <p className="text-xs font-extrabold text-[#2487B8]">{results.bestStudent.generalAverage} /20 • {results.bestStudent.mention}</p>
                    </>
                  )
                : <p className="text-sm text-slate-400">Aucune note</p>}
            </Card>
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Taux de réussite</p>
              <p className="text-2xl font-extrabold text-[#2487B8]">{results.gradedCount > 0 ? Math.round((results.passingCount / results.gradedCount) * 1000) / 10 : 0}%</p>
              <p className="text-[11px] font-bold text-[#2487B8]">{results.passingCount} / {results.gradedCount} élèves</p>
            </Card>
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-400">Notes à risque (&lt;10)</p>
              <p className="text-2xl font-extrabold text-rose-600">{results.atRiskCount}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-sm font-extrabold text-[#16212B]">Classement des élèves</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Élève</th>
                      <th className="py-2.5 px-3">Moyenne</th>
                      <th className="py-2.5 px-3">Mention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {results.ranking.map(st => (
                      <tr key={st.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{st.rank}</td>
                        <td className="py-2.5 px-3 font-bold text-[#16212B]">{st.name}</td>
                        <td className="py-2.5 px-3 font-extrabold text-[#16212B]">{st.generalAverage}</td>
                        <td className="py-2.5 px-3">
                          <Badge className={MENTION_COLOR[st.mention] ?? 'bg-slate-100 text-slate-700'}>{st.mention}</Badge>
                        </td>
                      </tr>
                    ))}
                    {results.ranking.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-slate-400">Aucune note saisie pour cette matière.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-[#16212B]">Répartition des mentions</h3>
              <div className="space-y-2 text-xs font-semibold">
                {Object.entries(results.mentionCounts).map(([mention, count]) => (
                  <div key={mention} className="flex items-center justify-between">
                    <Badge className={MENTION_COLOR[mention] ?? 'bg-slate-100 text-slate-700'}>{mention}</Badge>
                    <span className="text-[#16212B] font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
