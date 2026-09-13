'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Transfer = { id: string; copyId: string; fromBranchId: string; toBranchId: string; state: string; note: string | null; createdAt: string; dispatchedAt: string | null; receivedAt: string | null };

export function LibraryTransfersClient() {
  const t = useTranslations('Library');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [copyId, setCopyId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stateLabels: Record<string, { label: string; cls: string }> = {
    requested: { label: t('stateRequested'), cls: 'bg-amber-50 text-amber-700' },
    dispatched: { label: t('stateDispatched'), cls: 'bg-blue-50 text-[#2487B8]' },
    discrepancy: { label: t('stateDiscrepancy'), cls: 'bg-rose-50 text-rose-600' },
    received: { label: t('stateReceived'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
    cancelled: { label: t('stateCancelled'), cls: 'bg-slate-100 text-slate-500' },
  };

  const actions: Record<string, { label: string; action: string }[]> = {
    requested: [
      { label: t('btnDispatch'), action: 'dispatch' },
      { label: t('cancel'), action: 'cancel' },
    ],
    dispatched: [
      { label: t('btnReceive'), action: 'receive' },
      { label: t('btnReportDiscrepancy'), action: 'report_discrepancy' },
    ],
    discrepancy: [
      { label: t('btnReceive'), action: 'receive' },
    ],
  };

  const actionStatusMap: Record<string, string> = {
    dispatch: t('statusDispatched'),
    receive: t('statusReceived'),
    cancel: t('statusCancelled'),
    report_discrepancy: t('statusReported'),
  };

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/transfers', { cache: 'no-store' });
    const j = await r.json();
    if (j.success) setTransfers(j.data);
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
        setToBranchId('');
        setNote('');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function create() {
    void post('/api/addons/library/transfers', { copyId, toBranchId, note: note.trim() || undefined }, t('transferRequestedMsg'));
  }

  function transition(tItem: Transfer, action: string) {
    const statusText = actionStatusMap[action] ?? action;
    void post(`/api/addons/library/transfers/${tItem.id}/transition`, { action }, t('transferStatusUpdatedMsg', { status: statusText }));
  }

  const shortId = (s: string) => s.slice(0, 8);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('transfersTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('transfersSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">{t('requestTransferTitle')}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={copyId} onChange={e => setCopyId(e.target.value)} placeholder={t('copyUuidPlaceholder')} />
          <Input value={toBranchId} onChange={e => setToBranchId(e.target.value)} placeholder={t('destBranchUuidPlaceholder')} />
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('noteOptional')} />
        </div>
        <Button disabled={busy || !copyId || !toBranchId} onClick={create}>
          {t('btnCreateTransfer')}
        </Button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </Card>

      <Card className="p-4">
        {transfers.length === 0 ? (
          <div className="py-12 text-center">
            <Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">{t('noTransfers')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-3">{t('thCopies')}</th>
                  <th className="p-3">{t('thFrom')}</th>
                  <th className="p-3">{t('thTo')}</th>
                  <th className="p-3">{t('status')}</th>
                  <th className="p-3">{t('note')}</th>
                  <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(transferItem => {
                  const s = stateLabels[transferItem.state] ?? { label: transferItem.state, cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={transferItem.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{shortId(transferItem.copyId)}</td>
                      <td className="p-3 font-mono text-xs">{shortId(transferItem.fromBranchId)}</td>
                      <td className="p-3 font-mono text-xs">{shortId(transferItem.toBranchId)}</td>
                      <td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td>
                      <td className="p-3 text-xs">{transferItem.note ?? '—'}</td>
                      <td className="p-3 text-right rtl:text-left">
                        <div className="flex justify-end rtl:justify-start gap-2">
                          {(actions[transferItem.state] ?? []).map(a => (
                            <Button key={a.action} variant="outline" size="sm" disabled={busy} onClick={() => transition(transferItem, a.action)}>
                              {a.label}
                            </Button>
                          ))}
                        </div>
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
