'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, RefreshCw, IdCard, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';

type Student = {
  id: string;
  matricule: string | null;
  fullName: string;
  className: string | null;
  status: string;
};

type IssuedDoc = {
  id: string;
  subjectId: string;
  status: string;
};

const PAGE_SIZE = 100;

export default function CardsStudentsPage() {
  const params = useParams<{ locale?: string }>();

  const [students, setStudents] = useState<Student[]>([]);
  const [issued, setIssued] = useState<IssuedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [dialog, setDialog] = useState<Student | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, iRes] = await Promise.all([
        fetch(`/api/students?page=${page}&pageSize=${PAGE_SIZE}`),
        fetch('/api/cards/issued?type=student_id'),
      ]);
      const s = await sRes.json();
      const i = await iRes.json();
      if (s.success) { setStudents(s.data); setTotal(s.total ?? s.data.length); }
      if (i.success) setIssued(i.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const statusByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of issued) map.set(doc.subjectId, doc.status);
    return map;
  }, [issued]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s =>
      s.fullName?.toLowerCase().includes(q) ||
      (s.matricule?.toLowerCase().includes(q) ?? false)
    );
  }, [students, search]);

  const withActiveCard = students.filter(s => statusByStudent.get(s.id) === 'active').length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Cartes d'étudiant</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Émettez et suivez les cartes d'identité des élèves.</p>
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Élèves</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{total}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><Users className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cartes actives</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{withActiveCard}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><IdCard className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sans carte</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{students.length - withActiveCard}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><IdCard className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Students table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher par nom ou matricule..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl" />
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Élève</th>
                <th className="p-3">Matricule</th>
                <th className="p-3">Classe</th>
                <th className="p-3">Statut carte</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun élève trouvé.</td></tr>
              ) : (
                filtered.map(s => {
                  const cardStatus = statusByStudent.get(s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 pl-4 font-semibold text-slate-700">{s.fullName}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{s.matricule ?? '-'}</td>
                      <td className="p-3 text-slate-600">{s.className ?? '-'}</td>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                          onClick={() => setDialog(s)}
                        >
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

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Page {page} / {totalPages} · {total} élève(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" /> Précédent
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Suivant <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <IssueCardDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        subjectType="student"
        templateType="student_id"
        subjectId={dialog?.id ?? ''}
        subjectLabel="Élève"
        subjectName={dialog?.fullName ?? ''}
      />
    </div>
  );
}
