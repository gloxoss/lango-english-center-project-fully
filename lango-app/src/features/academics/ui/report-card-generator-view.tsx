'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Printer, Eye, Layers, Loader2 } from 'lucide-react';

type ClassSectionOption = { id: string; className: string; sectionName: string };
type StudentOption = { id: string; fullName: string; matricule?: string };
type ReportCard = {
  student: { id: string; name: string; matricule: string | null; className: string | null };
  subjects: { subjectId: string; subjectName: string; coefficient: number; average: number; assessmentCount: number }[];
  generalAverage: number;
  mention: string | null;
  rank: number | null;
  classSize: number;
};

export function ReportCardGeneratorView({ locale }: { locale: string }) {
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [classSectionId, setClassSectionId] = useState<string>('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [card, setCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchCards, setBatchCards] = useState<ReportCard[] | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    fetch('/api/academics/class-sections')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setClassSections(json.data);
          if (json.data[0]) {
            setClassSectionId(json.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!classSectionId) {
      return;
    }
    fetch(`/api/students?classSectionId=${classSectionId}&pageSize=100`)
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setStudents(json.data);
          setStudentId(json.data[0]?.id ?? '');
        }
      })
      .catch(() => {});
  }, [classSectionId]);

  useEffect(() => {
    if (!studentId) {
      setCard(null);
      return;
    }
    setLoading(true);
    fetch(`/api/students/report-card?studentId=${studentId}`)
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setCard(json.data);
        } else {
          setCard(null);
        }
      })
      .catch(() => setCard(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  async function generateAll() {
    if (!classSectionId) {
      return;
    }
    setBatchLoading(true);
    setBatchCards(null);
    try {
      const res = await fetch(`/api/students/report-card?classSectionId=${classSectionId}`);
      const json = res.ok ? await res.json() : null;
      if (json?.success && Array.isArray(json.data)) {
        setBatchCards(json.data);
      } else {
        setBatchCards([]);
      }
    } catch {
      setBatchCards([]);
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-cards-print, #report-cards-print * { visibility: visible; }
          #report-cards-print { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .report-card-page { page-break-after: always; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Générer les bulletins</h1>
          <p className="text-xs text-slate-500 mt-1">Bulletin réel, calculé à partir des notes saisies (moyenne marocaine /20, coefficients appliqués).</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 text-xs rounded-xl"
            onClick={generateAll}
            disabled={batchLoading || !classSectionId}
          >
            {batchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            <span>{batchLoading ? 'Génération...' : 'Générer tous les bulletins'}</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 text-xs rounded-xl" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer / PDF</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Sélection</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Classe</label>
                <Select value={classSectionId} onValueChange={setClassSectionId}>
                  <SelectTrigger className="w-full rounded-xl h-9 bg-white">
                    <SelectValue placeholder="Choisir une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSections.map(cs => (
                      <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Élève</label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="w-full rounded-xl h-9 bg-white">
                    <SelectValue placeholder="Choisir un élève" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">2. Statut</h3>
            {loading && <p className="text-xs text-slate-500">Chargement...</p>}
            {!loading && !card && !batchCards && <p className="text-xs text-slate-500">Aucune note enregistrée pour cet élève.</p>}
            {!loading && card && !batchCards && (
              <p className="text-xs font-bold text-[#16212B]">
                {card.subjects.length} matière(s) notée(s) · Moyenne générale {card.generalAverage.toFixed(2)}/20
              </p>
            )}
            {batchCards && (
              <p className="text-xs font-bold text-[#16212B]">
                {batchCards.length} bulletin(s) généré(s) pour la classe sélectionnée.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4" id="report-cards-print">
          {batchCards
            ? batchCards.map(c => <ReportCardSheet key={c.student.id} card={c} />)
            : card
              ? <ReportCardSheet card={card} />
              : (
                  <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-md flex items-center justify-center text-xs text-slate-400 min-h-[300px]">
                    <div className="text-center space-y-2">
                      <Eye className="w-6 h-6 mx-auto" />
                      <p>Sélectionnez un élève avec des notes, ou générez toute la classe.</p>
                    </div>
                  </Card>
                )}
        </div>
      </div>
    </div>
  );
}

function ReportCardSheet({ card }: { card: ReportCard }) {
  return (
    <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-md space-y-6 text-xs report-card-page">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2487B8] text-white flex items-center justify-center font-extrabold text-lg">
            S
          </div>
          <div>
            <h2 className="font-extrabold text-base text-[#16212B]">Bulletin scolaire</h2>
            <p className="text-[10px] text-slate-400">Barème national marocain sur 20</p>
          </div>
        </div>
        {card.mention && <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{card.mention}</Badge>}
      </div>

      <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-center">
        <div>
          <p className="text-[10px] text-slate-400 font-bold">Élève</p>
          <p className="font-bold text-[#16212B]">{card.student.name}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold">Classe</p>
          <p className="font-bold text-[#16212B]">{card.student.className ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold">Matricule</p>
          <p className="font-bold text-slate-600 font-mono">{card.student.matricule ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold">Classement</p>
          <p className="font-extrabold text-[#2487B8]">{card.rank ? `${card.rank} / ${card.classSize}` : '—'}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs">
          <thead className="bg-[#F6F9FC] text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2 text-left px-2">Matières</th>
              <th className="py-2 px-2">Coef</th>
              <th className="py-2 px-2">Évaluations</th>
              <th className="py-2 px-2">Moyenne</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {card.subjects.map(s => (
              <tr key={s.subjectId}>
                <td className="py-2 text-left px-2 font-bold text-[#16212B]">{s.subjectName}</td>
                <td className="py-2 px-2 text-slate-500">{s.coefficient}</td>
                <td className="py-2 px-2">{s.assessmentCount}</td>
                <td className="py-2 px-2 font-bold text-[#2487B8]">{s.average.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-400 font-bold">Moyenne générale</p>
          <p className="text-xl font-extrabold text-[#2487B8]">{card.generalAverage.toFixed(2)} /20</p>
        </div>
        {card.mention && <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-xs px-3 py-1">Mention {card.mention}</Badge>}
      </div>
    </Card>
  );
}
