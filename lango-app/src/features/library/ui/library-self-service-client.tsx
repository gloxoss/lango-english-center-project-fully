'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookCheck, BookOpen, Clock3, Receipt, RefreshCw, RotateCcw, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Home = { memberNumber: string; activeLoans: number; overdueLoans: number; waitingHolds: number; openCharges: number };
type Loan = { id: string; dueDate: string; returnedAt: string | null; renewedCount: number; accessionNumber: string; title: string; returnState?: string | null };
type Hold = { id: string; state: string; placedAt: string; expiresAt: string | null; accessionNumber: string; title: string };
type Charge = { id: string; amount: string; reason: string; state: string; createdAt: string; waiverReason: string | null; waivedAt: string | null };
type Child = { studentId: string; name: string; memberId: string | null; memberNumber: string | null; canAccessLibrary: boolean };

export function LibrarySelfServiceClient() {
  const t = useTranslations('Library');
  const locale = useLocale();
  const [home, setHome] = useState<Home | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [history, setHistory] = useState<Loan[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [childLoans, setChildLoans] = useState<Loan[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tab, setTab] = useState<'home' | 'loans' | 'holds' | 'charges' | 'history' | 'children'>('home');
  const [message, setMessage] = useState<string | null>(null);
  const [notMember, setNotMember] = useState(false);
  const [busy, setBusy] = useState(false);

  const holdLabels: Record<string, { label: string; cls: string }> = {
    waiting: { label: t('stateWaiting'), cls: 'bg-amber-50 text-amber-700' },
    fulfilled: { label: t('stateFulfilled'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
    cancelled: { label: t('stateCancelled'), cls: 'bg-slate-100 text-slate-500' },
    expired: { label: t('stateExpired'), cls: 'bg-rose-50 text-rose-600' },
  };

  const chargeLabels: Record<string, { label: string; cls: string }> = {
    open: { label: t('stateWaiting'), cls: 'bg-amber-50 text-amber-700' },
    waived: { label: t('stateWaived'), cls: 'bg-slate-100 text-slate-500' },
    posted: { label: t('statePosted'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
  };

  const chargeReasons: Record<string, string> = {
    overdue_fine: t('chargeReasonOverdueFine'),
    lost_copy: t('chargeReasonLostCopy'),
  };

  const tabs = [
    ['home', t('tabOverview'), BookCheck],
    ['loans', t('tabMyLoans'), BookOpen],
    ['holds', t('tabMyHolds'), Users],
    ['charges', t('tabMyCharges'), Receipt],
    ['history', t('tabHistory'), Clock3],
    ['children', t('tabChildren'), Users],
  ] as const;

  const load = useCallback(async () => {
    setMessage(null);
    const get = async (path: string) => {
      try {
        const r = await fetch(path, { cache: 'no-store' });
        const j = await r.json();
        return j.success ? j.data : null;
      } catch {
        return null;
      }
    };
    const [h, l, ho, c, hi, ch] = await Promise.all([
      get('/api/addons/library/me/home'),
      get('/api/addons/library/me/loans'),
      get('/api/addons/library/me/holds'),
      get('/api/addons/library/me/charges'),
      get('/api/addons/library/me/history'),
      get('/api/addons/library/me/children'),
    ]);
    if (!h) {
      setNotMember(true);
      return;
    }
    setNotMember(false);
    setHome(h);
    setLoans(l ?? []);
    setHolds(ho ?? []);
    setCharges(c ?? []);
    setHistory(hi ?? []);
    setChildren(ch ?? []);
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
      if (j.success) await load();
    } finally {
      setBusy(false);
    }
  }

  function renew(loan: Loan) {
    void post('/api/addons/library/me/renew', { loanId: loan.id }, t('loanRenewedMsg'));
  }

  function cancelHold(hold: Hold) {
    const reason = window.prompt(t('cancelHoldPrompt'));
    if (reason) void post('/api/addons/library/me/holds', { holdId: hold.id, reason }, t('holdCancelledMsg'));
  }

  async function selectChild(studentId: string) {
    setSelectedChild(studentId);
    setMessage(null);
    const r = await fetch(`/api/addons/library/me/children/${studentId}/loans`, { cache: 'no-store' });
    const j = await r.json();
    if (j.success) setChildLoans(j.data ?? []);
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');

  if (notMember) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <Card className="p-10 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h1 className="text-xl font-bold">{t('notMemberTitle')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('notMemberMsg')}</p>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const homeKpis = home ? [
    [t('kpiActiveLoans'), home.activeLoans, BookOpen],
    [t('kpiOverdueLoans'), home.overdueLoans, Clock3],
    [t('stateWaiting'), home.waitingHolds, Users],
    [t('kpiOpenChargesCount'), home.openCharges, Receipt],
  ] as const : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('selfServiceTitle')}</h1>
          <p className="text-sm text-slate-500">
            {home ? t('selfServiceSubtitle', { memberNumber: home.memberNumber }) : t('loading')}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]' : 'bg-white text-slate-600'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {message && <p role="status" className="text-sm">{message}</p>}

      {tab === 'home' && home && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {homeKpis.map(([label, value, Icon]) => (
            <Card key={String(label)} className="p-4">
              <Icon className="mb-3 h-5 w-5 text-[#2487B8]" />
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'loans' && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">{t('activeLoansTitle')}</h2>
          {loans.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('noLoansCurrent')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="p-3">{t('thTitle')}</th>
                    <th className="p-3">{t('thDueDate')}</th>
                    <th className="p-3">{t('thRenewals')}</th>
                    <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => (
                    <tr key={loan.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-semibold">{loan.title}</div>
                        <div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div>
                      </td>
                      <td className="p-3">
                        <span className={loan.dueDate < today ? 'font-semibold text-red-600' : ''}>
                          {loan.dueDate}
                        </span>
                      </td>
                      <td className="p-3">{loan.renewedCount}</td>
                      <td className="p-3 text-right rtl:text-left">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => renew(loan)}>
                          <RotateCcw className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                          {t('btnRenew')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'holds' && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">{t('tabMyHolds')}</h2>
          {holds.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('noHolds')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="p-3">{t('thTitle')}</th>
                    <th className="p-3">{t('status')}</th>
                    <th className="p-3">{t('thPlacedAt')}</th>
                    <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.map(hold => {
                    const s = holdLabels[hold.state] ?? { label: hold.state, cls: 'bg-slate-100 text-slate-500' };
                    return (
                      <tr key={hold.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-semibold">{hold.title}</div>
                          <div className="font-mono text-xs text-slate-500">{hold.accessionNumber}</div>
                        </td>
                        <td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td>
                        <td className="p-3">{formatDate(hold.placedAt)}</td>
                        <td className="p-3 text-right rtl:text-left">
                          {hold.state === 'waiting' ? (
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => cancelHold(hold)}>
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
      )}

      {tab === 'charges' && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">{t('tabMyCharges')}</h2>
          {charges.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('noCharges')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="p-3">{t('reason')}</th>
                    <th className="p-3">{t('amount')}</th>
                    <th className="p-3">{t('status')}</th>
                    <th className="p-3">{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map(charge => {
                    const s = chargeLabels[charge.state] ?? { label: charge.state, cls: 'bg-slate-100 text-slate-500' };
                    return (
                      <tr key={charge.id} className="border-b last:border-0">
                        <td className="p-3">{chargeReasons[charge.reason] ?? charge.reason}</td>
                        <td className="p-3 font-bold">{Number(charge.amount).toFixed(2)} DH</td>
                        <td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td>
                        <td className="p-3">{formatDate(charge.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">{t('loanHistoryTitle')}</h2>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('noHistory')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="p-3">{t('thTitle')}</th>
                    <th className="p-3">{t('thDueDate')}</th>
                    <th className="p-3">{t('thReturnedAt')}</th>
                    <th className="p-3">{t('thCondition')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(loan => (
                    <tr key={loan.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-semibold">{loan.title}</div>
                        <div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div>
                      </td>
                      <td className="p-3">{loan.dueDate}</td>
                      <td className="p-3">{loan.returnedAt ? formatDate(loan.returnedAt) : '—'}</td>
                      <td className="p-3">{loan.returnState ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'children' && (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">{t('childrenLoansTitle')}</h2>
          {children.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('noChildrenWithLibrary')}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {children.map(child => (
                  <button
                    key={child.studentId}
                    type="button"
                    onClick={() => void selectChild(child.studentId)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      selectedChild === child.studentId
                        ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]'
                        : 'bg-white text-slate-600'
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
              {selectedChild && (
                childLoans.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('noLoansForChild')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left rtl:text-right text-sm">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className="p-3">{t('thTitle')}</th>
                          <th className="p-3">{t('thDueDate')}</th>
                          <th className="p-3">{t('thReturnedStatus')}</th>
                          <th className="p-3">{t('thRenewals')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {childLoans.map(loan => (
                          <tr key={loan.id} className="border-b last:border-0">
                            <td className="p-3 font-medium">{loan.title}</td>
                            <td className="p-3">{loan.dueDate}</td>
                            <td className="p-3">{loan.returnedAt ? t('yes') : t('no')}</td>
                            <td className="p-3">{loan.renewedCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
