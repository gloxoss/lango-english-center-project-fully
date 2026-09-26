'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/**
 * SCF-06-01 (OD3): this page lists `naming_series`, the counters the document
 * and matricule generators actually increment. The old definitions store was a
 * second source nothing consumed, so a director could "renumber" here and the
 * next invoice ignored it. The API is now the real thing; the only edit this
 * page can make is to RAISE a counter (lowering would re-issue printed
 * numbers, and the API refuses it with 409).
 */

type NamingSeriesKind =
  | 'invoice'
  | 'receipt'
  | 'credit_note'
  | 'candidate'
  | 'employee'
  | 'student_matricule'
  | 'other';

type Series = {
  prefix: string;
  currentVal: number;
  kind: NamingSeriesKind;
  nextNumber: string;
};

export default function NumberingPage() {
  const t = useTranslations('NumberingSettings');
  const [rows, setRows] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [raisingPrefix, setRaisingPrefix] = useState<string | null>(null);
  const [raiseValue, setRaiseValue] = useState('');
  const [busy, setBusy] = useState(false);
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
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  const kindLabel = (kind: NamingSeriesKind): string => {
    switch (kind) {
      case 'invoice': return t('kind_invoice');
      case 'receipt': return t('kind_receipt');
      case 'credit_note': return t('kind_credit_note');
      case 'candidate': return t('kind_candidate');
      case 'employee': return t('kind_employee');
      case 'student_matricule': return t('kind_student_matricule');
      default: return t('kind_other');
    }
  };

  const startRaise = (s: Series) => {
    setRaisingPrefix(s.prefix);
    setRaiseValue(String(s.currentVal + 1));
  };

  const submitRaise = async (s: Series) => {
    const value = Number(raiseValue);
    if (!Number.isInteger(value) || value <= s.currentVal) return;
    if (!window.confirm(t('confirmRaise', { label: kindLabel(s.kind), value }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/numbering/${encodeURIComponent(s.prefix)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVal: value }),
      });
      const json = await res.json();
      if (json.success) {
        setRaisingPrefix(null);
        setRaiseValue('');
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

  const raiseInvalid = (s: Series) => {
    const value = Number(raiseValue);
    return !Number.isInteger(value) || value <= s.currentVal;
  };

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
            <Card key={s.prefix} className="border border-slate-200 rounded-2xl shadow-xs p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{kindLabel(s.kind)}</span>
                    <Badge variant="neutral" className="text-[10px] px-2 font-mono">{s.prefix}</Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {t('currentLabel')} <span className="font-mono text-slate-700">{s.currentVal}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="font-mono text-slate-700">{t('nextNumber', { value: s.nextNumber })}</span>
                  </div>
                </div>
                {raisingPrefix === s.prefix ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      min={s.currentVal + 1}
                      value={raiseValue}
                      onChange={e => setRaiseValue(e.target.value)}
                      aria-label={t('newValueLabel')}
                      className="h-8 w-28 text-xs rounded-xl"
                    />
                    <Button
                      onClick={() => submitRaise(s)}
                      disabled={busy || raiseInvalid(s)}
                      className="gap-1.5 h-8 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      {t('raise')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRaisingPrefix(null); setRaiseValue(''); }}
                      title={t('cancel')}
                      aria-label={t('cancel')}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => startRaise(s)}
                    className="gap-1.5 h-8 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {t('raise')}
                  </Button>
                )}
              </div>
              {raisingPrefix === s.prefix && (
                <p className="text-[10px] text-slate-500 mt-2">{t('newValueHint')}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
