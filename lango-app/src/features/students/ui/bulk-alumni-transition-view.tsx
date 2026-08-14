'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Search, GraduationCap, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type StudentRow = { id: string; fullName: string; matricule: string | null; className: string | null };
type ItemResult = { studentId: string; success: boolean; tempPassword?: string | null; loginAccessDeliveryStatus?: string | null; error?: string };

// Real bulk transition for a whole graduating cohort at once (Phase 4
// refinement, future-implementation/alumni-portal) - one real confirmation
// step naming the count, not one dialog per student.
export function BulkAlumniTransitionView({ locale: _locale }: { locale?: string } = {}) {
  const { can } = usePermissions();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ItemResult[] | null>(null);

  useEffect(() => {
    fetch('/api/students?pageSize=200').then(r => r.json()).then(j => j?.success && setStudents(j.data)).catch(() => {});
  }, []);

  const filtered = students.filter(s => s.fullName.toLowerCase().includes(search.toLowerCase()) || (s.matricule ?? '').toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/students/bulk-transition-to-alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.results);
        setSelected(new Set());
      }
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const canManage = can('admissions.manage');

  if (!canManage) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-sm font-semibold text-center">
        Vous ne disposez pas des autorisations nécessaires.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Transition en masse — Anciens élèves</h1>
        <p className="text-xs text-slate-500 mt-1">Sélectionnez plusieurs élèves d&apos;une même cohorte diplômée et confirmez une seule fois.</p>
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={() => setShowConfirm(true)}
          className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Transitionner (
          {selected.size}
          )
        </Button>
      </Card>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3 px-4 w-10" />
              <th className="py-3 px-4">Élève</th>
              <th className="py-3 px-4">Matricule</th>
              <th className="py-3 px-4">Classe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(s => (
              <tr key={s.id} className={`hover:bg-slate-50/80 transition cursor-pointer ${selected.has(s.id) ? 'bg-[#DCEBF4]/20' : ''}`} onClick={() => toggle(s.id)}>
                <td className="py-2.5 px-4"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} onClick={e => e.stopPropagation()} className="rounded border-slate-300" /></td>
                <td className="py-2.5 px-4 font-bold text-[#16212B]">{s.fullName}</td>
                <td className="py-2.5 px-4 font-mono text-slate-400">{s.matricule ?? '—'}</td>
                <td className="py-2.5 px-4 text-slate-600">{s.className ?? 'Non assigné'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">Aucun élève trouvé.</td></tr>}
          </tbody>
        </table>
      </Card>

      {results && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-bold text-[#16212B]">
              {results.filter(r => r.success).length} transitionné(s) avec succès sur {results.length}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {results.map(r => (
              <div key={r.studentId} className="p-3 flex items-center gap-2 text-xs">
                {r.success ? <CheckCircle2 className="w-3.5 h-3.5 text-[#17A673] shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                <span className="font-mono text-slate-400">{r.studentId}</span>
                {r.success
                  ? <span className="text-[#17A673] font-semibold">{r.tempPassword ? `Mot de passe : ${r.tempPassword}` : 'Compte créé'}</span>
                  : <span className="text-rose-600 font-semibold">{r.error}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmer la transition en masse
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 mt-2">
            {selected.size}
            {' '}
            élève(s) seront immédiatement désactivé(s) de leur compte élève et recevront un nouveau compte Ancien(ne) élève.
          </p>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="rounded-full text-xs h-9">
              Annuler
            </Button>
            <Button disabled={submitting} onClick={handleConfirm} className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white border-0">
              {submitting ? 'Transition en cours...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
