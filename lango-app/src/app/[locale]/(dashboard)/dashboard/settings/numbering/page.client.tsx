'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Pencil, Eye, Zap, Loader2, Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Series = {
  id: string;
  key: string;
  name: string;
  prefix: string | null;
  suffix: string | null;
  padding: number;
  start: number;
  current: number;
  step: number;
  isActive: boolean;
  nextValue?: string;
};

type SeriesForm = {
  key: string;
  name: string;
  prefix: string;
  suffix: string;
  padding: string;
  start: string;
  step: string;
};

const EMPTY_FORM: SeriesForm = { key: '', name: '', prefix: '', suffix: '', padding: '0', start: '1', step: '1' };

export default function NumberingPage() {
  const t = useTranslations('NumberingSettings');
  const [rows, setRows] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Series | null>(null);
  const [form, setForm] = useState<SeriesForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [busyNextId, setBusyNextId] = useState<string | null>(null);
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
      const res = await fetch('/api/settings/numbering');
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

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/settings/numbering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key.trim(),
          name: form.name.trim(),
          prefix: form.prefix.trim() || null,
          suffix: form.suffix.trim() || null,
          padding: Number(form.padding) || 0,
          start: Number(form.start) || 1,
          step: Number(form.step) || 1,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setForm(EMPTY_FORM);
        showToast('ok', t('created'));
        load();
      } else {
        showToast('err', json.error?.message ?? t('createError'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/numbering/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          prefix: form.prefix.trim() || null,
          suffix: form.suffix.trim() || null,
          padding: Number(form.padding) || 0,
          step: Number(form.step) || 1,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditing(null);
        setForm(EMPTY_FORM);
        showToast('ok', t('updated'));
        load();
      } else {
        showToast('err', json.error?.message ?? t('updateError'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: Series) => {
    setEditing(s);
    setForm({
      key: s.key,
      name: s.name,
      prefix: s.prefix ?? '',
      suffix: s.suffix ?? '',
      padding: String(s.padding),
      start: String(s.start),
      step: String(s.step),
    });
  };

  const handlePreview = async (s: Series) => {
    try {
      const res = await fetch(`/api/settings/numbering/${s.id}/preview`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', t('nextNumber', { value: json.data.nextValue }));
      } else {
        showToast('err', json.error?.message ?? t('previewError'));
      }
    } catch {
      showToast('err', t('networkError'));
    }
  };

  const handleNext = async (s: Series) => {
    // Handing out a number is irreversible: it leaves a gap in the series.
    if (!window.confirm(t('confirmAssign', { name: s.name }))) return;
    setBusyNextId(s.id);
    try {
      const res = await fetch(`/api/settings/numbering/${s.id}/next`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', t('assigned', { value: json.data.nextValue }));
        load();
      } else {
        showToast('err', json.error?.message ?? t('assignError'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setBusyNextId(null);
    }
  };

  const set = (k: keyof SeriesForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('title')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">{t('notWiredNote')}</p>
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
        <div className="text-sm font-bold text-slate-800 mb-3">{editing ? t('editTitle', { name: editing.name }) : t('newSeries')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input className="h-9 text-xs rounded-xl" placeholder={t('keyPlaceholder')} aria-label={t('keyPlaceholder')} value={form.key} onChange={set('key')} disabled={!!editing} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('namePlaceholder')} aria-label={t('namePlaceholder')} value={form.name} onChange={set('name')} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('prefixPlaceholder')} aria-label={t('prefixPlaceholder')} value={form.prefix} onChange={set('prefix')} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('suffixPlaceholder')} aria-label={t('suffixPlaceholder')} value={form.suffix} onChange={set('suffix')} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('paddingPlaceholder')} aria-label={t('paddingPlaceholder')} value={form.padding} onChange={set('padding')} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('startPlaceholder')} aria-label={t('startPlaceholder')} value={form.start} onChange={set('start')} disabled={!!editing} />
          <Input className="h-9 text-xs rounded-xl" placeholder={t('stepPlaceholder')} aria-label={t('stepPlaceholder')} value={form.step} onChange={set('step')} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={editing ? handleUpdate : handleCreate}
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
          {rows.map(s => (
            <Card key={s.id} className="border border-slate-200 rounded-2xl shadow-xs p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 truncate">{s.name}</span>
                  <Badge variant={s.isActive ? 'success' : 'neutral'} className="text-[10px] px-2">{s.isActive ? t('active') : t('inactive')}</Badge>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                  {s.prefix ?? ''}{String(s.current + s.step).padStart(s.padding, '0')}{s.suffix ?? ''}
                  <span className="text-slate-400"> · {s.key} · {t('meta', { start: s.start, step: s.step, padding: s.padding })}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => handlePreview(s)} title={t('previewTitle')} aria-label={t('previewTitle')} className="h-8 w-8 p-0 text-slate-500">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(s)} title={t('edit')} aria-label={t('edit')} className="h-8 w-8 p-0 text-slate-500">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleNext(s)}
                  disabled={busyNextId === s.id || !s.isActive}
                  className="gap-1.5 h-8 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {busyNextId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {t('assign')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Plus className="w-3 h-3" /> {t('lockedNote')}</div>
    </div>
  );
}
