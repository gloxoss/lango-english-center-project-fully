'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IdCard, Search, RefreshCw, CalendarDays } from 'lucide-react';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';

type Seat = {
  id: string;
  studentId: string;
  studentName: string;
  studentMatricule: string | null;
  candidateNumber: string;
  seatNumber: number;
  deskLabel: string | null;
  examTermId: string;
  termName: string;
  termDate: string;
  hallName: string;
};

type IssuedDoc = {
  id: string;
  examCandidateId: string | null;
  status: string;
};

export default function CardsAdmitCardsPage() {
  const params = useParams<{ locale?: string }>();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [issued, setIssued] = useState<IssuedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState('all');

  const [dialog, setDialog] = useState<Seat | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, iRes] = await Promise.all([
        fetch('/api/cards/admit-seats'),
        fetch('/api/cards/issued?type=admit_card'),
      ]);
      const s = await sRes.json();
      const i = await iRes.json();
      if (s.success) setSeats(s.data);
      if (i.success) setIssued(i.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusBySeat = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of issued) if (doc.examCandidateId) map.set(doc.examCandidateId, doc.status);
    return map;
  }, [issued]);

  const terms = useMemo(() => {
    const map = new Map<string, { id: string; name: string; date: string }>();
    for (const seat of seats) {
      if (!map.has(seat.examTermId)) {
        map.set(seat.examTermId, { id: seat.examTermId, name: seat.termName, date: seat.termDate });
      }
    }
    return [...map.values()];
  }, [seats]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return seats.filter(s =>
      (termFilter === 'all' || s.examTermId === termFilter) &&
      (s.studentName?.toLowerCase().includes(q) ||
        (s.candidateNumber?.toLowerCase().includes(q) ?? false) ||
        (s.studentMatricule?.toLowerCase().includes(q) ?? false))
    );
  }, [seats, search, termFilter]);

  const withActiveCard = seats.filter(s => statusBySeat.get(s.id) === 'active').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <IdCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Convocations d'examen</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Émettez les cartes de candidat depuis les places allouées aux examens.</p>
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Places allouées</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{seats.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Convocations actives</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{withActiveCard}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><IdCard className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sessions</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{terms.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Seats table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher par élève ou n° candidat..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl" />
          </div>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-56 h-9 text-xs">
              <SelectValue placeholder="Toutes les sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Toutes les sessions</SelectItem>
              {terms.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Candidat</th>
                <th className="p-3">N° candidat</th>
                <th className="p-3">Session</th>
                <th className="p-3">Salle / Bureau</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucune place d'examen trouvée.</td></tr>
              ) : (
                filtered.map(seat => {
                  const cardStatus = statusBySeat.get(seat.id);
                  return (
                    <tr key={seat.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 pl-4">
                        <p className="font-semibold text-slate-700">{seat.studentName}</p>
                        <p className="text-[10px] text-slate-400">{seat.studentMatricule ?? ''}</p>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{seat.candidateNumber}</td>
                      <td className="p-3">
                        <p className="text-slate-600">{seat.termName}</p>
                        <p className="text-[10px] text-slate-400">{seat.termDate}</p>
                      </td>
                      <td className="p-3 text-slate-600">{seat.deskLabel ?? `${seat.hallName} #${seat.seatNumber}`}</td>
                      <td className="p-3">
                        {cardStatus ? (
                          <Badge variant={cardStatus === 'active' ? 'success' : cardStatus === 'revoked' ? 'danger' : 'warning'}>
                            {cardStatus === 'active' ? 'Active' : cardStatus === 'revoked' ? 'Révoquée' : 'Expirée'}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Aucune</Badge>
                        )}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={() => setDialog(seat)}>
                          <IdCard className="w-3.5 h-3.5 mr-1.5" />Émettre
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <IssueCardDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        subjectType="exam_candidate"
        templateType="admit_card"
        subjectId={dialog?.id ?? ''}
        subjectLabel="Candidat"
        subjectName={dialog ? `${dialog.studentName} (${dialog.candidateNumber})` : ''}
      />
    </div>
  );
}
