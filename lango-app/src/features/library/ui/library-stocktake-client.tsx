'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type Stocktake = { id: string; branchId: string; state: string; startedAt: string; closedAt: string | null };

export function LibraryStocktakeClient() {
  const t = useTranslations('Library');
  const locale = useLocale();
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [branchId, setBranchId] = useState('');
  const [obs, setObs] = useState<Record<string, { copyId: string; found: string; note: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/stocktakes', { cache: 'no-store' });
    const j = await r.json();
    if (j.success) setStocktakes(j.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? t('operationFailed'));
      if (j.success) {
        setBranchId('');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function start() {
    void post('/api/addons/library/stocktakes', { branchId }, t('stocktakeOpenedMsg'));
  }

  function observe(stocktake: Stocktake) {
    const o = obs[stocktake.id];
    if (!o?.copyId) {
      setMessage(t('enterCopyUuidWarning'));
      return;
    }
    void post(
      `/api/addons/library/stocktakes/${stocktake.id}/observations`,
      { copyId: o.copyId, found: o.found === 'found', note: o.note.trim() || null },
      t('observationSavedMsg')
    );
    setObs(prev => ({ ...prev, [stocktake.id]: { copyId: '', found: 'found', note: '' } }));
  }

  function close(stocktake: Stocktake) {
    void post(`/api/addons/library/stocktakes/${stocktake.id}/close`, {}, t('stocktakeClosedMsg'));
  }

  function apply(stocktake: Stocktake) {
    void post(`/api/addons/library/stocktakes/${stocktake.id}/adjustments/apply`, {}, t('adjustmentsAppliedMsg'));
  }

  const shortId = (s: string) => s.slice(0, 8);
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('stocktakeTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('stocktakeSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-bold text-slate-700">{t('branchUuidLabel')}</label>
          <Input value={branchId} onChange={e => setBranchId(e.target.value)} placeholder="Ex : ca40c88e-…" />
        </div>
        <Button disabled={busy || !branchId} onClick={start}>
          <ClipboardCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('btnOpenStocktake')}
        </Button>
      </Card>

      {message && <p role="status" className="text-sm">{message}</p>}

      <div className="space-y-4">
        {stocktakes.length === 0 ? (
          <Card className="p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">{t('noStocktakes')}</p>
          </Card>
        ) : (
          stocktakes.map(stocktake => (
            <Card key={stocktake.id} className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{t('stocktakeCardTitle', { id: shortId(stocktake.id) })}</h3>
                  <p className="text-xs text-slate-500">
                    {t('stocktakeMeta', { branchId: shortId(stocktake.branchId), date: formatDate(stocktake.startedAt) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={stocktake.state === 'open' ? 'warning' : 'success'}>
                    {stocktake.state === 'open' ? t('stateOpen') : t('stateClosed')}
                  </Badge>
                  {stocktake.state === 'open' ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => close(stocktake)}>
                      {t('btnCloseStocktake')}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => apply(stocktake)}>
                      {t('btnApplyAdjustments')}
                    </Button>
                  )}
                </div>
              </div>
              {stocktake.state === 'open' && (
                <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_150px_1fr_auto]">
                  <Input
                    value={obs[stocktake.id]?.copyId ?? ''}
                    onChange={e =>
                      setObs(prev => ({
                        ...prev,
                        [stocktake.id]: {
                          copyId: e.target.value,
                          found: prev[stocktake.id]?.found ?? 'found',
                          note: prev[stocktake.id]?.note ?? '',
                        },
                      }))
                    }
                    placeholder={t('copyUuidPlaceholder')}
                  />
                  <Select
                    value={obs[stocktake.id]?.found ?? 'found'}
                    onValueChange={v =>
                      setObs(prev => ({
                        ...prev,
                        [stocktake.id]: {
                          copyId: prev[stocktake.id]?.copyId ?? '',
                          found: v,
                          note: prev[stocktake.id]?.note ?? '',
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="found">{t('obsFound')}</SelectItem>
                      <SelectItem value="missing">{t('obsMissing')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={obs[stocktake.id]?.note ?? ''}
                    onChange={e =>
                      setObs(prev => ({
                        ...prev,
                        [stocktake.id]: {
                          copyId: prev[stocktake.id]?.copyId ?? '',
                          found: prev[stocktake.id]?.found ?? 'found',
                          note: e.target.value,
                        },
                      }))
                    }
                    placeholder={t('noteOptional')}
                  />
                  <Button size="sm" disabled={busy} onClick={() => observe(stocktake)}>
                    {t('save')}
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
