'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Pencil, Play, Power, History, Loader2, Save, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Job = {
  id: string;
  key: string;
  name: string;
  handler: string;
  intervalMinutes: number | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type Run = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  triggeredBy: string;
  metadata: { purgedSessions?: number } | null;
};

const HANDLERS: { value: string; label: string }[] = [
  { value: 'purge_sessions', label: 'Purge des sessions expirées' },
  { value: 'noop', label: 'Test (aucun effet)' },
];

const EMPTY_FORM = { key: '', name: '', handler: 'purge_sessions', intervalMinutes: '1440' };

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ScheduledJobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Run[]>>({});
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/scheduled-jobs');
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch {
      showToast('err', 'Erreur chargement des tâches.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = {
        key: form.key.trim(),
        name: form.name.trim(),
        handler: form.handler,
        intervalMinutes: Number(form.intervalMinutes) || 60,
      };
      const res = await fetch(editing ? `/api/settings/scheduled-jobs/${editing.id}` : '/api/settings/scheduled-jobs', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setForm(EMPTY_FORM);
        setEditing(null);
        showToast('ok', editing ? 'Tâche mise à jour.' : 'Tâche planifiée créée.');
        load();
      } else {
        showToast('err', json.error?.message ?? 'Enregistrement impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (j: Job) => {
    setEditing(j);
    setForm({ key: j.key, name: j.name, handler: j.handler, intervalMinutes: String(j.intervalMinutes ?? 1440) });
  };

  const handleToggle = async (j: Job) => {
    setBusyId(j.id);
    try {
      const res = await fetch(`/api/settings/scheduled-jobs/${j.id}/toggle`, { method: 'POST' });
      const json = await res.json();
      if (json.success) showToast('ok', json.message);
      else showToast('err', json.error?.message ?? 'Activation impossible.');
      load();
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  };

  const handleTrigger = async (j: Job) => {
    setBusyId(j.id);
    try {
      const res = await fetch(`/api/settings/scheduled-jobs/${j.id}/trigger`, { method: 'POST' });
      const json = await res.json();
      if (json.success) showToast('ok', json.message);
      else showToast('err', json.error?.message ?? 'Exécution impossible.');
      load();
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (j: Job) => {
    if (!window.confirm(`Supprimer la tâche « ${j.name} » ?`)) return;
    setBusyId(j.id);
    try {
      const res = await fetch(`/api/settings/scheduled-jobs/${j.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Tâche supprimée.');
        load();
      } else {
        showToast('err', json.error?.message ?? 'Suppression impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleHistory = async (j: Job) => {
    if (historyId === j.id) {
      setHistoryId(null);
      return;
    }
    setHistoryId(j.id);
    try {
      if (!history[j.id]) {
        const res = await fetch(`/api/settings/scheduled-jobs/${j.id}/runs`);
        const json = await res.json();
        if (json.success) setHistory(h => ({ ...h, [j.id]: json.data }));
      }
    } catch {
      showToast('err', 'Erreur chargement de l\'historique.');
    }
  };

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tâches planifiées</h1>
        <p className="text-xs text-slate-500 mt-1">Exécutions automatiques périodiques (purge des sessions expirées). Chaque tâche utilise un gestionnaire prédéfini et sécurisé — aucun code arbitraire n&apos;est accepté.</p>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <Card className="border border-slate-200 rounded-2xl shadow-xs p-5">
        <div className="text-sm font-bold text-slate-800 mb-3">{editing ? `Modifier « ${editing.name} »` : 'Nouvelle tâche'}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input className="h-9 text-xs rounded-xl" placeholder="Clé (ex: purge_sessions)" value={form.key} onChange={set('key')} disabled={!!editing} />
          <Input className="h-9 text-xs rounded-xl" placeholder="Nom (ex: Purge des sessions)" value={form.name} onChange={set('name')} />
          <select
            className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.handler}
            onChange={set('handler')}
          >
            {HANDLERS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
          <Input className="h-9 text-xs rounded-xl" type="number" min={1} placeholder="Intervalle (minutes)" value={form.intervalMinutes} onChange={set('intervalMinutes')} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleSave}
            disabled={busy || !form.name.trim() || !form.key.trim()}
            className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? 'Enregistrer' : 'Créer la tâche'}
          </Button>
          {editing && (
            <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); }} className="h-9 rounded-full px-4 text-xs" variant="outline">
              <X className="w-3.5 h-3.5" /> Annuler
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">Aucune tâche planifiée. Créez la première pour commencer.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(j => (
            <Card key={j.id} className="border border-slate-200 rounded-2xl shadow-xs p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{j.name}</span>
                    <Badge variant={j.isActive ? 'success' : 'neutral'} className="text-[10px] px-2">{j.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                    {j.key}
                    <span className="text-slate-400"> · {HANDLERS.find(h => h.value === j.handler)?.label ?? j.handler} · toutes les {j.intervalMinutes ?? '—'} min · dernière exécution {fmtDate(j.lastRunAt)} · prochaine {fmtDate(j.nextRunAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleHistory(j)} title="Historique des exécutions" className="h-8 w-8 p-0 text-slate-500">
                    <History className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(j)} title="Modifier" className="h-8 w-8 p-0 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleToggle(j)} disabled={busyId === j.id} title={j.isActive ? 'Désactiver' : 'Activer'} className="h-8 w-8 p-0 text-slate-500">
                    <Power className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(j)} disabled={busyId === j.id} title="Supprimer" className="h-8 w-8 p-0 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleTrigger(j)}
                    disabled={busyId === j.id}
                    className="gap-1.5 h-8 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {busyId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Exécuter
                  </Button>
                </div>
              </div>

              {historyId === j.id && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {(() => {
                    const runs = history[j.id];
                    if (!runs?.length) {
                      return <p className="text-[11px] text-slate-400">Aucune exécution enregistrée pour cette tâche.</p>;
                    }
                    return (
                      <ul className="space-y-1.5">
                        {runs.map(r => (
                          <li key={r.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Badge variant={r.status === 'success' ? 'success' : 'danger'} className="text-[9px] px-1.5">{r.status === 'success' ? 'OK' : 'Erreur'}</Badge>
                            <span>{fmtDate(r.startedAt)}</span>
                            <span className="text-slate-400">· {r.triggeredBy === 'worker' ? 'automatique' : 'manuelle'}</span>
                            {r.metadata && typeof r.metadata.purgedSessions === 'number' && <span className="text-slate-400">· {r.metadata.purgedSessions} session(s) purgée(s)</span>}
                            {r.error && <span className="text-red-600 truncate">{r.error}</span>}
                            {r.durationMs != null && <span className="text-slate-400">· {r.durationMs} ms</span>}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Plus className="w-3 h-3" /> Le worker interne vérifie les tâches actives chaque minute.</div>
    </div>
  );
}
