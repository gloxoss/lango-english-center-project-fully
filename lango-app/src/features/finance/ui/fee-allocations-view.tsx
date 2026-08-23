'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle2, CircleDashed, Eye, Loader2, PlayCircle, Plus, Search, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type PreviewComponent = { name: string; amount: string; taxable: boolean; dueOffsetDays: number };
type PreviewSummary = {
  count?: number;
  totalCents?: string;
  amountPerStudentCents?: string;
  baseDueDate?: string;
  maxDueOffsetDays?: number;
  dueDate?: string;
  componentCount?: number;
  components?: PreviewComponent[];
  included?: number;
  errors?: number;
};

type RunRow = {
  id: string;
  period: string;
  feeStructureName: string | null;
  branchName: string | null;
  status: string;
  previewSummary: PreviewSummary | null;
  runById: string;
  runByName: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  counts: { pending: number; included: number; error: number };
};

type TargetRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  amount: number;
  status: string;
  reason: string | null;
  error: string | null;
  invoiceId: string | null;
  processedAt: string | null;
};

type VersionOption = { id: string; feeStructureName: string; versionNumber: number; componentCount: number };
type BranchOption = { id: string; name: string };
type StudentOption = { id: string; fullName: string; matricule: string | null };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  previewed: 'Prévisualisée',
  approved: 'Approuvée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  previewed: 'bg-blue-50 text-[#1B6C93]',
  approved: 'bg-cyan-50 text-[#0EA5C4]',
  completed: 'bg-[#DDF5EC] text-[#17A673]',
  cancelled: 'bg-rose-50 text-rose-500',
};
const TARGET_LABEL: Record<string, string> = { pending: 'En attente', included: 'Incluse', error: 'Erreur' };

function formatMAD(cents?: string): string {
  if (!cents) return '—';
  return (Number(cents) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
}

function runStudentCount(run: RunRow): number {
  const c = run.counts;
  return c.pending + c.included + c.error;
}

export function FeeAllocationsView() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [popMode, setPopMode] = useState<'all' | 'manual'>('all');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createdRun, setCreatedRun] = useState<RunRow | null>(null);

  const [detail, setDetail] = useState<{ run: RunRow; targets: TargetRow[] } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [acting, setActing] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/fee-allocations');
      const json = await res.json();
      if (json?.success) setRuns(json.data);
    } catch {
      setError('Impossible de charger les allocations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
    fetch('/api/settings/branches')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success) setBranches(json.data); })
      .catch(() => {});
    fetch('/api/finance/fee-structure-versions')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success) setVersions(json.data); })
      .catch(() => {});
    fetch('/api/students?status=Actif&pageSize=300')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success) setStudents(json.data); })
      .catch(() => {});
  }, [loadRuns]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.toLowerCase();
    return students.filter(s => !term || s.fullName.toLowerCase().includes(term) || (s.matricule ?? '').toLowerCase().includes(term));
  }, [students, studentSearch]);

  function toggleStudent(id: string) {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePreview() {
    setPreviewMessage(null);
    setPreviewError(null);
    if (!versionId) { setPreviewError('Sélectionnez une structure/version publiée.'); return; }
    if (!period.trim()) { setPreviewError('Renseignez la période.'); return; }
    if (popMode === 'manual' && selectedStudents.size === 0) { setPreviewError('Sélectionnez au moins un élève.'); return; }
    setPreviewing(true);
    try {
      const body: Record<string, unknown> = {
        period: period.trim(),
        feeStructureVersionId: versionId,
        dueDate: dueDate || undefined,
      };
      if (popMode === 'all') {
        body.branchId = branchId || null;
      } else {
        body.studentIds = [...selectedStudents];
      }
      const res = await fetch('/api/finance/fee-allocations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setCreatedRun(json.data.run);
        setPreviewMessage(json.message);
        setShowCreate(false);
        resetCreateForm();
        loadRuns();
      } else {
        setPreviewError(json?.message ?? 'L\'aperçu a échoué.');
      }
    } catch {
      setPreviewError('Erreur réseau pendant l\'aperçu.');
    } finally {
      setPreviewing(false);
    }
  }

  function resetCreateForm() {
    setPeriod('');
    setDueDate('');
    setBranchId('');
    setVersionId('');
    setPopMode('all');
    setSelectedStudents(new Set());
    setStudentSearch('');
  }

  async function act(run: RunRow, kind: 'approve' | 'run' | 'cancel') {
    setActing(run.id);
    try {
      const res = await fetch(`/api/finance/fee-allocations/${run.id}/${kind}`, { method: kind === 'run' ? 'POST' : 'PUT' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message ?? 'Action impossible.');
      } else if (kind === 'run') {
        setError(null);
        setPreviewMessage(json?.message ?? null);
      }
      loadRuns();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setActing(null);
    }
  }

  async function openDetail(run: RunRow) {
    setDetailLoading(true);
    setShowDetail(true);
    setDetail({ run, targets: [] });
    try {
      const res = await fetch(`/api/finance/fee-allocations/${run.id}`);
      const json = await res.json();
      if (json?.success) setDetail(json.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalInvoicedCents = useMemo(() => {
    return runs.reduce((sum, r) => sum + (r.previewSummary?.totalCents ? Number(r.previewSummary.totalCents) : 0), 0);
  }, [runs]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Allocations de frais</h1>
          <p className="text-xs text-slate-500 mt-1">
            Prévisualisez, approuvez puis lancez la facturation d'une population d'élèves à partir d'une structure tarifaire publiée.
          </p>
        </div>
        <Button onClick={() => { resetCreateForm(); setPreviewError(null); setPreviewMessage(null); setShowCreate(true); }} size="sm">
          <Plus className="w-4 h-4" /> Nouvelle allocation
        </Button>
      </div>

      {previewMessage && (
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-4 py-3 text-xs font-bold text-[#17A673]">{previewMessage}</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 px-4 py-3 text-xs font-bold text-[#E5544B]">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">Allocations</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{runs.length}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Factures générées</p>
          <p className="text-2xl font-extrabold text-[#16212B]">
            {runs.reduce((sum, r) => sum + (r.previewSummary?.included ?? 0), 0)}
          </p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">Total facturé (MAD)</p>
          <p className="text-2xl font-extrabold text-[#17A673]">{(totalInvoicedCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
        </Card>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Période</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Élèves</th>
                <th className="py-3.5 px-4">Total (MAD)</th>
                <th className="py-3.5 px-4">Structure</th>
                <th className="py-3.5 px-4">Branche</th>
                <th className="py-3.5 px-4">Créée par</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Chargement...</td></tr>
              )}
              {!loading && runs.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Aucune allocation. Créez une première allocation pour facturer.</td></tr>
              )}
              {runs.map(run => (
                <tr key={run.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-[#16212B]">{run.period}</td>
                  <td className="py-3.5 px-4">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[run.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABEL[run.status] ?? run.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{runStudentCount(run)}</td>
                  <td className="py-3.5 px-4 font-extrabold text-[#16212B]">{formatMAD(run.previewSummary?.totalCents)}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.feeStructureName ?? '—'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.branchName ?? 'Toutes'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.runByName ?? run.runById.slice(0, 8)}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.createdAt.slice(0, 10)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="icon" title="Détails" onClick={() => openDetail(run)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {run.status === 'previewed' && (
                        <Button variant="secondary" size="sm" disabled={acting === run.id} onClick={() => act(run, 'approve')}>
                          Approuver
                        </Button>
                      )}
                      {(run.status === 'previewed' || run.status === 'approved') && (
                        <Button variant="default" size="sm" disabled={acting === run.id} onClick={() => act(run, 'run')}>
                          {acting === run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                          Lancer
                        </Button>
                      )}
                      {(run.status === 'previewed' || run.status === 'approved') && (
                        <Button variant="danger" size="sm" disabled={acting === run.id} onClick={() => act(run, 'cancel')}>
                          Annuler
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvelle allocation de frais</DialogTitle>
            <DialogDescription>
              Choisissez la population, la structure publiée et l'échéance, puis générez un aperçu avant de lancer la facturation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Période</label>
                <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Ex. Trimestre 1 2026/27" className="h-9 text-xs rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Date d'échéance</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-xs rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Structure / version publiée</label>
              <select
                value={versionId}
                onChange={e => setVersionId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
              >
                <option value="">— Choisir une version publiée —</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.feeStructureName} — v{v.versionNumber} ({v.componentCount} composant(s))</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Population cible</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPopMode('all')}
                  className={`flex-1 h-9 rounded-xl border text-xs font-bold transition ${popMode === 'all' ? 'border-[#2487B8] bg-[#E4EDFD] text-[#2487B8]' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  Tous les élèves (branche)
                </button>
                <button
                  type="button"
                  onClick={() => setPopMode('manual')}
                  className={`flex-1 h-9 rounded-xl border text-xs font-bold transition ${popMode === 'manual' ? 'border-[#2487B8] bg-[#E4EDFD] text-[#2487B8]' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  Sélection manuelle
                </button>
              </div>
            </div>

            {popMode === 'all' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Branche (optionnel)</label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
                  <option value="">Toutes les branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {popMode === 'manual' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Élèves ({selectedStudents.size} sélectionné(s))</label>
                  <span className="flex-1" />
                  {selectedStudents.size > 0 && (
                    <button type="button" onClick={() => setSelectedStudents(new Set())} className="text-[11px] font-bold text-[#2487B8]">Tout effacer</button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Rechercher un élève..."
                    className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {filteredStudents.length === 0 && <div className="py-6 text-center text-xs text-slate-400">Aucun élève.</div>}
                  {filteredStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="accent-[#2487B8]"
                      />
                      <span className="font-bold text-[#16212B]">{s.fullName}</span>
                      {s.matricule && <span className="text-slate-400">{s.matricule}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {previewError && <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 px-4 py-3 text-xs font-bold text-[#E5544B]">{previewError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Fermer</Button>
            <Button variant="default" size="sm" disabled={previewing} onClick={handlePreview}>
              {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleDashed className="w-4 h-4" />}
              Générer l'aperçu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Allocation {detail?.run.period ? `« ${detail.run.period} »` : ''} — {detail ? (STATUS_LABEL[detail.run.status] ?? detail.run.status) : ''}
            </DialogTitle>
            <DialogDescription>
              {detail?.run.previewSummary?.components
                ? `${detail.run.previewSummary.components.length} composant(s) facturé(s), échéance ${detail.run.previewSummary.dueDate ?? detail.run.dueDate ?? '—'}.`
                : 'Aperçu de l\'allocation.'}
            </DialogDescription>
          </DialogHeader>

          {detail?.run.previewSummary?.components && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-3">Composant</th>
                    <th className="py-2.5 px-3 text-right">Montant (MAD)</th>
                    <th className="py-2.5 px-3 text-center">TVA</th>
                    <th className="py-2.5 px-3 text-right">Échéance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {detail.run.previewSummary.components.map(c => (
                    <tr key={c.name}>
                      <td className="py-2.5 px-3 font-bold text-[#16212B]">{c.name}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{Number(c.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{c.taxable ? 'Oui' : 'Non'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">+{c.dueOffsetDays} j</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            {detailLoading && <div className="py-8 text-center text-xs text-slate-400">Chargement des élèves...</div>}
            {!detailLoading && (!detail || detail.targets.length === 0) && (
              <div className="py-8 text-center text-xs text-slate-400">Aucune cible.</div>
            )}
            {!detailLoading && detail && detail.targets.length > 0 && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Élève</th>
                    <th className="py-2.5 px-3 text-right">Montant (MAD)</th>
                    <th className="py-2.5 px-3">Statut</th>
                    <th className="py-2.5 px-3">Facture</th>
                    <th className="py-2.5 px-3">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {detail.targets.map(t => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-bold text-[#16212B]">{t.studentName ?? t.studentId}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${t.status === 'included' ? 'bg-[#DDF5EC] text-[#17A673]' : t.status === 'error' ? 'bg-rose-50 text-[#E5544B]' : 'bg-slate-100 text-slate-600'}`}>
                          {TARGET_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{t.invoiceId ? t.invoiceId.slice(0, 8) : '—'}</td>
                      <td className="py-2.5 px-3 text-rose-500 max-w-[220px] truncate">{t.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {detail && (detail.run.status === 'previewed' || detail.run.status === 'approved') && (
            <DialogFooter>
              <div className="flex items-center gap-2 w-full justify-end">
                {detail.run.status === 'previewed' && (
                  <Button variant="secondary" size="sm" onClick={() => { act(detail.run, 'approve'); setShowDetail(false); }}>
                    <CheckCircle2 className="w-4 h-4" /> Approuver
                  </Button>
                )}
                <Button variant="default" size="sm" onClick={() => { act(detail.run, 'run'); setShowDetail(false); }}>
                  <PlayCircle className="w-4 h-4" /> Lancer la facturation
                </Button>
                <Button variant="danger" size="sm" onClick={() => { act(detail.run, 'cancel'); setShowDetail(false); }}>
                  <XCircle className="w-4 h-4" /> Annuler
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
