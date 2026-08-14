'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type StudentResult = { id: string; fullName: string; matricule: string | null; className: string | null };
type BranchOption = { id: string; name: string; city: string | null };
type ClassSectionOption = { id: string; className: string; sectionName: string };
type TransferStats = { transfersThisMonth: number; byBranch: { branchId: string; name: string; studentCount: number }[] };

// ponytail: the previous mock invented a "Transferts" workflow duplicating
// the real Promotions page (class-to-class) plus a fabricated inter-campus
// concept with fake KPIs and a fake pending-request queue - no such request/
// approval table exists. `user.branchId` and the real `branches` table do
// exist and are already load-bearing (branchId already scopes the students
// list for branch-scoped staff) - this wires a real, direct transfer action
// against them instead: no invented approval queue, since nothing in this
// app models one for transfers.
export function StudentTransfersClient({ locale: _locale }: { locale?: string } = {}) {
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetClassSectionId, setTargetClassSectionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<TransferStats | null>(null);

  const loadStats = () => {
    fetch('/api/students/transfer-stats').then(r => r.json()).then(j => j?.success && setStats(j.data));
  };

  useEffect(() => {
    fetch('/api/settings/branches').then(r => r.json()).then(j => j?.success && setBranches(j.data));
    fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()).then(j => j?.success && setClassSections(j.data));
    loadStats();
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      fetch(`/api/students?search=${encodeURIComponent(query)}&pageSize=10`)
        .then(r => r.json())
        .then(j => j?.success && setResults(j.data))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const handleTransfer = async () => {
    if (!selected || !targetBranchId) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/students/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: targetBranchId, classSectionId: targetClassSectionId || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec du transfert.');
        return;
      }
      setSuccess(`${selected.fullName} a été transféré(e) avec succès.`);
      setSelected(null);
      setSearch('');
      setTargetBranchId('');
      setTargetClassSectionId('');
      loadStats();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const canTransfer = can('students.update');

  if (!canTransfer) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-sm font-semibold text-center">
        Vous ne disposez pas des autorisations nécessaires pour transférer des élèves.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Transferts d&apos;élèves</h1>
        <p className="text-xs text-slate-500 mt-1">Transférez un élève vers une autre branche de l&apos;établissement.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Transferts ce mois-ci</p>
            <p className="text-2xl font-extrabold text-[#16212B] mt-1">{stats.transfersThisMonth}</p>
          </Card>
          {stats.byBranch.map(b => (
            <Card key={b.branchId} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{b.name}</p>
              <p className="text-2xl font-extrabold text-[#16212B] mt-1">{b.studentCount}</p>
              <p className="text-[10px] text-slate-400">élève(s) actif(s)</p>
            </Card>
          ))}
        </div>
      )}

      {branches.length <= 1 && (
        <Card className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-700">
          Cet établissement n&apos;a qu&apos;une seule branche active — aucun transfert possible tant qu&apos;une deuxième branche n&apos;est pas créée (Paramètres → Branches).
        </Card>
      )}

      {success && (
        <div className="p-3.5 bg-[#DDF5EC] border border-[#17A673]/30 rounded-xl flex items-center gap-2.5 text-[#17A673] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600">Élève</label>
          {!selected
            ? (
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou matricule..." className="h-9 pl-9 rounded-xl text-xs" />
                </div>
              )
            : (
                <div className="mt-1 flex items-center justify-between p-3 rounded-xl border border-[#DCEBF4] bg-[#DCEBF4]/30">
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{selected.fullName}</p>
                    <p className="text-[10px] text-slate-500">{selected.matricule} · {selected.className ?? 'Non assigné'}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[10px] font-bold text-slate-500 hover:text-rose-600">Changer</button>
                </div>
              )}
          {!selected && searching && <p className="text-[10px] text-slate-400 mt-1">Recherche...</p>}
          {!selected && results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map(r => (
                <button key={r.id} onClick={() => { setSelected(r); setResults([]); setSearch(''); }} className="w-full text-left p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-[#DCEBF4]/40 text-xs">
                  <span className="font-bold text-[#16212B]">{r.fullName}</span>
                  <span className="text-slate-400 ml-2">{r.matricule} · {r.className ?? 'Non assigné'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600">Branche de destination</label>
                <select value={targetBranchId} onChange={e => setTargetBranchId(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs">
                  <option value="">Sélectionner...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.city ? ` (${b.city})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Nouvelle classe (optionnel)</label>
                <select value={targetClassSectionId} onChange={e => setTargetClassSectionId(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs">
                  <option value="">Non assigné</option>
                  {classSections.map(cs => <option key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            <Button disabled={!targetBranchId || submitting} onClick={handleTransfer} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {submitting ? 'Transfert en cours...' : 'Transférer'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
