'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookCheck, BookOpen, Clock3, Library, RefreshCw, RotateCcw, ShieldAlert, Undo2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type Overview = { totalCopies: number; availableCopies: number; activeLoans: number; overdueLoans: number; waitingHolds: number; activeMembers: number };
type Member = { id: string; memberNumber: string; name: string; role: string; state: string };
type ActiveLoan = { loanId: string; dueDate: string; renewedCount: number; accessionNumber: string; title: string; memberNumber: string; memberName: string };

export function LibrarianPortalClient({ desk = false, viewingRole }: { desk?: boolean; viewingRole?: string }) {
  const t = useTranslations('Library');
  const isAdminViewing = viewingRole === 'school_admin' || viewingRole === 'super_admin';
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [query, setQuery] = useState('');
  const [copyId, setCopyId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [condition, setCondition] = useState<'good' | 'damaged' | 'lost'>('good');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const conditionLabels: Record<'good' | 'damaged' | 'lost', string> = {
    good: t('conditionGood'),
    damaged: t('conditionDamaged'),
    lost: t('stateLost'),
  };

  const load = useCallback(async () => {
    const response = await fetch('/api/addons/library/reports/overview', { cache: 'no-store' });
    const json = await response.json();
    if (json.success) setOverview(json.data);
  }, []);

  const loadLoans = useCallback(async () => {
    const response = await fetch('/api/addons/library/circulation/loans', { cache: 'no-store' });
    const json = await response.json();
    if (json.success) setLoans(json.data);
  }, []);

  useEffect(() => {
    void load();
    if (desk) void loadLoans();
  }, [load, loadLoans, desk]);

  async function searchMembers() {
    const response = await fetch(`/api/addons/library/members?q=${encodeURIComponent(query)}`);
    const json = await response.json();
    if (json.success) setMembers(json.data);
  }

  async function post(path: string, body: object, okMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      setMessage(json.success ? okMessage : json.error?.message ?? t('operationFailed'));
      if (json.success) {
        void load();
        if (desk) void loadLoans();
      }
    } finally {
      setBusy(false);
    }
  }

  function issue() {
    void post('/api/addons/library/circulation/issue', { copyId, memberId }, t('loanCreatedMsg'));
    setCopyId('');
  }

  function renew(loan: ActiveLoan) {
    void post('/api/addons/library/circulation/renew', { loanId: loan.loanId }, t('loanRenewedMsg'));
  }

  function returnLoan(loan: ActiveLoan) {
    void post('/api/addons/library/circulation/return', { loanId: loan.loanId, condition }, t('loanReturnedMsg', { condition: conditionLabels[condition] }));
  }

  const cards = overview ? [
    [t('kpiTotalCopies'), overview.totalCopies, Library],
    [t('kpiAvailableCopies'), overview.availableCopies, BookOpen],
    [t('kpiActiveLoans'), overview.activeLoans, BookCheck],
    [t('kpiOverdueLoans'), overview.overdueLoans, Clock3],
    [t('kpiActiveMembers'), overview.activeMembers, Users],
  ] as const : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {isAdminViewing && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm font-medium">{t('adminSupervisionBanner')}</p>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('portalTitle')}</h1>
          <p className="text-sm text-slate-500">{t('portalSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => { void load(); if (desk) void loadLoans(); }}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value, Icon]) => (
          <Card key={String(label)} className="p-4">
            <Icon className="mb-3 h-5 w-5 text-[#2487B8]" />
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      {desk && (
        <>
          <Card className="space-y-5 p-5">
            <div>
              <h2 className="font-semibold">{t('deskLoanTitle')}</h2>
              <p className="text-sm text-slate-500">{t('deskLoanSubtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('searchMemberPlaceholder')}
              />
              <Button onClick={searchMembers}>{t('search')}</Button>
            </div>
            {members.length > 0 && (
              <div className="grid gap-2">
                {members.map(member => (
                  <button
                    type="button"
                    key={member.id}
                    onClick={() => setMemberId(member.id)}
                    className={`rounded-lg border p-3 text-left rtl:text-right ${
                      memberId === member.id ? 'border-[#2487B8] bg-blue-50' : ''
                    }`}
                  >
                    <span className="font-medium">{member.name}</span>
                    <span className="text-xs text-slate-500 ltr:ml-2 rtl:mr-2">
                      {member.memberNumber} · {member.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={copyId}
                onChange={e => setCopyId(e.target.value)}
                placeholder={t('copyUuidPlaceholder')}
              />
              <Button disabled={busy || !copyId || !memberId} onClick={issue}>
                {t('recordLoanBtn')}
              </Button>
            </div>
            {message && <p role="status" className="text-sm">{message}</p>}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{t('activeLoansTitle')}</h2>
                <p className="text-sm text-slate-500">{t('activeLoansSubtitle')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{t('returnConditionLabel')}</span>
                <Select value={condition} onValueChange={v => setCondition(v as 'good' | 'damaged' | 'lost')}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">{conditionLabels.good}</SelectItem>
                    <SelectItem value="damaged">{conditionLabels.damaged}</SelectItem>
                    <SelectItem value="lost">{conditionLabels.lost}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loans.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('noActiveLoans')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('thTitle')}</th>
                      <th className="p-3">{t('thMember')}</th>
                      <th className="p-3">{t('thDueDate')}</th>
                      <th className="p-3 text-right rtl:text-left">{t('thRenewals')}</th>
                      <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map(loan => (
                      <tr key={loan.loanId} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-semibold">{loan.title}</div>
                          <div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div>
                        </td>
                        <td className="p-3">
                          {loan.memberName}
                          <div className="text-xs text-slate-500">{loan.memberNumber}</div>
                        </td>
                        <td className="p-3">
                          <span className={loan.dueDate < new Date().toISOString().slice(0, 10) ? 'font-semibold text-red-600' : ''}>
                            {loan.dueDate}
                          </span>
                        </td>
                        <td className="p-3 text-right rtl:text-left">{loan.renewedCount}</td>
                        <td className="p-3 text-right rtl:text-left">
                          <div className="flex justify-end rtl:justify-start gap-2">
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => renew(loan)}>
                              <RotateCcw className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                              {t('btnRenew')}
                            </Button>
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => returnLoan(loan)}>
                              <Undo2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                              {t('btnReturn')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
