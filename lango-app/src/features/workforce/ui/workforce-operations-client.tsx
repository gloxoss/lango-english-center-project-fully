'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@/libs/finance/format-money';
import { useTranslations } from 'next-intl';

type Row = Record<string, unknown>;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const p = await r.json();
  if (!r.ok) throw new Error(p.error?.message ?? `Erreur ${r.status}`);
  return p.data as T;
}

const amount = (v: unknown) => formatMoney(v as number | string | null | undefined);

export function AdvancesOperationsClient() {
  const t = useTranslations('Workforce');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => call<Row[]>('/api/workforce/advances').then(setRows).catch(e => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, action: 'approved' | 'rejected') {
    setBusy(id);
    setError('');
    try {
      await call('/api/workforce/advances', {
        method: 'PATCH',
        body: JSON.stringify({ id, action, ...(action === 'rejected' ? { rejectionReason: 'Refus documenté par le gestionnaire' } : {}) }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy('');
    }
  }

  return (
    <Shell title={t('advancesTitle')} subtitle={t('advancesSubtitle')} error={error}>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Grid>
          {rows.map(r => (
            <Card key={String(r.id)}>
              <div className="flex justify-between gap-3 text-start">
                <div>
                  <b>{String(r.employeeName)}</b>
                  <p className="text-sm text-slate-500">{String(r.reason ?? t('unspecifiedReason'))}</p>
                </div>
                <Badge text={String(r.status)} />
              </div>
              <p className="mt-4 text-2xl font-bold text-start">{amount(r.requestedAmount)}</p>
              <p className="text-sm text-start">{t('repaidAmount', { amount: amount(r.repaidAmount) })}</p>
              {r.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <Action disabled={busy === r.id} onClick={() => review(String(r.id), 'approved')}>{t('btnApprove')}</Action>
                  <Action disabled={busy === r.id} onClick={() => review(String(r.id), 'rejected')} secondary>{t('btnReject')}</Action>
                </div>
              )}
            </Card>
          ))}
        </Grid>
      )}
    </Shell>
  );
}

export function LeaveOperationsClient() {
  const t = useTranslations('Workforce');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => call<Row[]>('/api/hr/leave/requests?status=all').then(setRows).catch(e => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(id);
    setError('');
    try {
      await call(`/api/hr/leave/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ action: status }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy('');
    }
  }

  return (
    <Shell title={t('leaveTitle')} subtitle={t('leaveSubtitle')} error={error}>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Grid>
          {rows.map(r => (
            <Card key={String(r.id)}>
              <div className="flex justify-between gap-3 text-start">
                <div>
                  <b>{String(r.userName ?? r.employeeName ?? r.userId)}</b>
                  <p className="text-sm text-slate-500">{String(r.categoryName ?? t('defaultLeave'))} · {String(r.startDate)} → {String(r.endDate)}</p>
                </div>
                <Badge text={String(r.status)} />
              </div>
              <p className="mt-3 font-semibold text-start">{t('daysCount', { count: String(r.daysRequested) })}</p>
              {r.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <Action disabled={busy === r.id} onClick={() => review(String(r.id), 'approved')}>{t('btnApprove')}</Action>
                  <Action disabled={busy === r.id} onClick={() => review(String(r.id), 'rejected')} secondary>{t('btnReject')}</Action>
                </div>
              )}
            </Card>
          ))}
        </Grid>
      )}
    </Shell>
  );
}

export function AwardsOperationsClient() {
  const t = useTranslations('Workforce');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => call<Row[]>('/api/workforce/awards').then(setRows).catch(e => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Shell title={t('awardsTitle')} subtitle={t('awardsSubtitle')} error={error}>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <Grid>
          {rows.map(r => (
            <Card key={String(r.id)}>
              <div className="flex justify-between gap-3 text-start">
                <div>
                  <b>{String(r.employeeName)}</b>
                  <p className="text-sm text-slate-500">{String(r.title)}</p>
                </div>
                <Badge text={String(r.status)} />
              </div>
              <p className="mt-3 text-sm text-start">{String(r.category)} · {String(r.awardDate)}</p>
              {Number(r.monetaryReward) > 0 && <p className="mt-2 text-xl font-bold text-start">{amount(r.monetaryReward)}</p>}
            </Card>
          ))}
        </Grid>
      )}
    </Shell>
  );
}

function Shell({ title, subtitle, error, children }: { title: string; subtitle: string; error: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1600px] space-y-5 text-start">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-600">{subtitle}</p>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {children}
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <article className="rounded-xl border bg-white p-5 shadow-sm text-start">{children}</article>;
}

function Badge({ text }: { text: string }) {
  return <span className="h-fit rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">{text.replaceAll('_', ' ')}</span>;
}

function Action({ children, onClick, disabled, secondary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-sky-500 disabled:opacity-50 ${
        secondary ? 'border text-slate-700' : 'bg-sky-700 text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Empty() {
  const t = useTranslations('Workforce');
  return <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">{t('noRecords')}</div>;
}
