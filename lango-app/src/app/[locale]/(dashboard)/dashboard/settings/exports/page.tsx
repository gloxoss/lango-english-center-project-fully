'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Download, FileText, RefreshCw, Plus, CheckCircle2, AlertCircle,
  Clock, Loader2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ExportJob = {
  id: string;
  reportType: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  resultPath: string | null;
  params: Record<string, unknown> | null;
  completedAt: string | null;
  createdAt: string;
};

const REPORT_TYPES = [
  { id: 'students', label: 'Liste des élèves (CSV)' },
  { id: 'teachers', label: 'Liste des enseignants (CSV)' },
  { id: 'attendance_summary', label: 'Résumé des présences (CSV)' },
  { id: 'finance_summary', label: 'Résumé financier (CSV)' },
  { id: 'payroll_summary', label: 'Récapitulatif paie (CSV)' },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: {
    label: 'En file',
    cls: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  processing: {
    label: 'En cours...',
    cls: 'bg-blue-50 text-blue-600 border-blue-200',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  complete: {
    label: 'Terminé',
    cls: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: 'Échec',
    cls: 'bg-red-50 text-red-600 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const REPORT_LABELS: Record<string, string> = Object.fromEntries(REPORT_TYPES.map(r => [r.id, r.label]));

export default function ExportsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState(REPORT_TYPES[0]!.id);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobsRef = useRef<ExportJob[]>(jobs);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/exports');
      const json = await res.json();
      if (json.success) {
        setJobs(json.data);
        jobsRef.current = json.data;
      }
    } catch { /* silent — polling */ }
    finally { setLoading(false); }
  }, []);

  // Auto-poll every 10 s while any job is running/pending.
  // jobsRef tracks the latest list so the interval closure stays fresh.
  useEffect(() => {
    load();
    pollRef.current = setInterval(() => {
      const hasActive = jobsRef.current.some(j => j.status === 'pending' || j.status === 'processing');
      if (hasActive) load();
    }, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: selectedType }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Export lancé. Il apparaîtra dans la liste.');
        await load();
      } else {
        showToast('err', json.error?.message ?? 'Erreur création export.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (job: ExportJob) => {
    if (!job.resultPath) return;
    // Open the result path — could be a signed URL or a local path served via /api
    window.open(`/api/exports/${job.id}/download`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Exports & téléchargements</h1>
          <p className="text-xs text-slate-500 mt-1">Générez et téléchargez des exports de données.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 text-xs rounded-full">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* New export panel */}
      <Card className="p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-500" />
          Nouvel export
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="h-9 text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[220px]"
          >
            {REPORT_TYPES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="gap-2 h-9 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {creating ? 'Génération...' : 'Générer l\'export'}
          </Button>
        </div>
      </Card>

      {/* Job list */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun export</p>
            <p className="text-xs mt-1">Créez votre premier export ci-dessus.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-bold text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Statut</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Demandé à</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Terminé à</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const cfg = STATUS_CONFIG[job.status];
                const isReady = job.status === 'complete' && job.resultPath;

                return (
                  <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">
                        {REPORT_LABELS[job.reportType] ?? job.reportType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cfg && (
                        <Badge className={`text-[10px] border flex items-center gap-1 w-fit px-2 ${cfg.cls}`}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(job.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {job.completedAt ? new Date(job.completedAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isReady}
                        onClick={() => handleDownload(job)}
                        className="gap-1.5 text-[10px] h-7 rounded-lg"
                      >
                        <Download className="w-3 h-3" />
                        {isReady ? 'Télécharger' : '—'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Note */}
      <p className="text-[10px] text-slate-400 text-center">
        Les exports sont rafraîchis automatiquement toutes les 10 secondes tant qu&apos;un job est en cours.
      </p>
    </div>
  );
}
