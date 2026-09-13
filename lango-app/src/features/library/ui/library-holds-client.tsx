'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookMarked, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Hold = { id: string; state: string; placedAt: string; expiresAt: string | null; copyId: string; accessionNumber: string; memberId: string; memberNumber: string; memberName: string };

export function LibraryHoldsClient() {
  const t = useTranslations('Library');
  const locale = useLocale();
  const [holds, setHolds] = useState<Hold[]>([]);
  const [copyId, setCopyId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stateLabels: Record<string, { label: string; cls: string }> = {
    waiting: { label: t('stateWaiting'), cls: 'bg-amber-50 text-amber-700' },
    fulfilled: { label: t('stateFulfilled'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
    cancelled: { label: t('stateCancelled'), cls: 'bg-slate-100 text-slate-500' },
    expired: { label: t('stateExpired'), cls: 'bg-rose-50 text-rose-600' },
  };

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/holds', { cache: 'no-store' });
    const j = await r.json();
    if (j.success) setHolds(j.data);
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
        setCopyId('');
        setMemberId('');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function place() {
    void post('/api/addons/library/holds', { copyId, memberId }, t('holdCreatedMsg'));
  }

  function cancel(hold: Hold) {
    const reason = window.prompt(t('cancelHoldPrompt'));
    if (reason) void post(`/api/addons/library/holds/${hold.id}/cancel`, { reason }, t('holdCancelledMsg'));
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('holdsTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('holdsSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">{t('placeHoldTitle')}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={copyId} onChange={e => setCopyId(e.target.value)} placeholder={t('copyUuidPlaceholder')} />
          <Input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder={t('memberUuidPlaceholder')} />
        </div>
        <Button disabled={busy || !copyId || !memberId} onClick={place}>
          {t('btnCreateHold')}
        </Button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </Card>

      <Card className="p-4">
        {holds.length === 0 ? (
          <div className="py-12 text-center">
            <BookMarked className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">{t('noHolds')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-3">{t('thCopies')}</th>
                  <th className="p-3">{t('thMember')}</th>
                  <th className="p-3">{t('thPlacedAt')}</th>
                  <th className="p-3">{t('thExpiresAt')}</th>
                  <th className="p-3">{t('status')}</th>
                  <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {holds.map(hold => {
                  const s = stateLabels[hold.state] ?? { label: hold.state, cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={hold.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-semibold">{hold.accessionNumber}</div>
                      </td>
                      <td className="p-3">
                        {hold.memberName}
                        <div className="text-xs text-slate-500">{hold.memberNumber}</div>
                      </td>
                      <td className="p-3">{formatDate(hold.placedAt)}</td>
                      <td className="p-3">{hold.expiresAt ? formatDate(hold.expiresAt) : '—'}</td>
                      <td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td>
                      <td className="p-3 text-right rtl:text-left">
                        {hold.state === 'waiting' ? (
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => cancel(hold)}>
                            {t('cancel')}
                          </Button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
