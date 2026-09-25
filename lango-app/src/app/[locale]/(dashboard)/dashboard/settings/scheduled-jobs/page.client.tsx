'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Pencil, Play, Power, History, Loader2, Save, X, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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

// Labels live in ScheduledJobs.handlers.<value>.
const HANDLERS = ['purge_sessions', 'noop'] as const;

const EMPTY_FORM = { key: '', name: '', handler: 'purge_sessions', intervalMinutes: '1440' };

export default function ScheduledJobsPage() {
  const t = useTranslations('ScheduledJobs');
  const locale = useLocale();
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const handlerLabel = (h: string) => (t.has(`handlers.${h}`) ? t(`handlers.${h}` as 'handlers.noop') : h);
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
      else showToast('err', json.error?.message ?? t('loadError'));
    } catch {
      showToast('err', t('loadError'));
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
        showToast('ok', editing ? t('updated') : t('created'));
        load();
      } else {
        showToast('err', json.error?.message ?? t('saveError'));
      }
    } catch {
      showToast('err', t('networkError'));
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
      else showToast('err', json.error?.message ?? t('toggleError'));
      load();
    } catch {
      showToast('err', t('networkError'));
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
      else showToast('err', json.error?.message ?? t('runError'));
      load();
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (j: Job) => {
    if (!window.confirm(t('confirmDelete', { name: j.name }))) return;
    setBusyId(j.id);
    try {
      const res = await fetch(`/api/settings/scheduled-jobs/${j.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', t('deleted'));
        load();
      } else {
        showToast('err', json.error?.message ?? t('deleteError'));
      }
    } catch {
      showToast('err', t('networkError'));
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
      showToast('err', t('historyError'));
    }
  };

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('title')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
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
        <div className="text-sm font-bold text-slate-800 mb-3">{editing ? t('editTitle', { name: editing.name }) : t('newJob')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input className="h-9 text-xs rounded-xl" placeholder={t('keyPlaceholder')} aria-label={t('keyPlaceholder')} value={form.key} onChange={set('key')} disabled={!!editing} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('namePlaceholder')} aria-label={t('namePlaceholder')} value={form.name} onChange={set('name')} />
          <select
            className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.handler}
            onChange={set('handler')}
          >
            {HANDLERS.map(h => <option key={h} value={h}>{handlerLabel(h)}</option>)}
          </select>
          <Input className="h-9 text-xs rounded-xl" type="number" min={1} placeholder={t('intervalPlaceholder')} aria-label={t('intervalPlaceholder')} value={form.intervalMinutes} onChange={set('intervalMinutes')} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleSave}
            disabled={busy || !form.name.trim() || !form.key.trim()}
            className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? t('save') : t('create')}
          </Button>
          {editing && (
            <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); }} className="h-9 rounded-full px-4 text-xs" variant="outline">
              <X className="w-3.5 h-3.5" /> {t('cancel')}
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
          <p className="text-sm text-slate-500">{t('empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(j => (
            <Card key={j.id} className="border border-slate-200 rounded-2xl shadow-xs p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{j.name}</span>
                    <Badge variant={j.isActive ? 'success' : 'neutral'} className="text-[10px] px-2">{j.isActive ? t('active') : t('inactive')}</Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                    {j.key}
                    <span className="text-slate-400"> · {handlerLabel(j.handler)} · {t('meta', { interval: j.intervalMinutes ?? '—', last: fmtDate(j.lastRunAt), next: fmtDate(j.nextRunAt) })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleHistory(j)} title={t('history')} aria-label={t('history')} className="h-8 w-8 p-0 text-slate-500">
                    <History className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(j)} title={t('edit')} aria-label={t('edit')} className="h-8 w-8 p-0 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleToggle(j)} disabled={busyId === j.id} title={j.isActive ? t('disable') : t('enable')} aria-label={j.isActive ? t('disable') : t('enable')} className="h-8 w-8 p-0 text-slate-500">
                    <Power className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(j)} disabled={busyId === j.id} title={t('delete')} aria-label={t('delete')} className="h-8 w-8 p-0 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleTrigger(j)}
                    disabled={busyId === j.id}
                    className="gap-1.5 h-8 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {busyId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {t('run')}
                  </Button>
                </div>
              </div>

              {historyId === j.id && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {(() => {
                    const runs = history[j.id];
                    if (!runs?.length) {
                      return <p className="text-[11px] text-slate-400">{t('noRuns')}</p>;
                    }
                    return (
                      <ul className="space-y-1.5">
                        {runs.map(r => (
                          <li key={r.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Badge variant={r.status === 'success' ? 'success' : 'danger'} className="text-[9px] px-1.5">{r.status === 'success' ? t('ok') : t('error')}</Badge>
                            <span>{fmtDate(r.startedAt)}</span>
                            <span className="text-slate-400">· {r.triggeredBy === 'worker' ? t('automatic') : t('manual')}</span>
                            {r.metadata && typeof r.metadata.purgedSessions === 'number' && <span className="text-slate-400">· {t('purged', { count: r.metadata.purgedSessions })}</span>}
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

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Plus className="w-3 h-3" /> {t('workerNote')}</div>
    </div>
  );
}
