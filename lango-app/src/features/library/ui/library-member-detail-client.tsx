'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, RefreshCw, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ActiveLoan = { loanId: string; dueDate: string; issuedAt: string; renewedCount: number; accessionNumber: string; title: string };
type OpenCharge = { id: string; amount: string; reason: string; state: string; createdAt: string };
type WaitingHold = { id: string; placedAt: string; expiresAt: string | null; accessionNumber: string; title: string };
type MemberDetail = { id: string; memberNumber: string; state: string; blockReason: string | null; blockUntil: string | null; branchId: string; branchName: string; userId: string; name: string; email: string | null; role: string; activeLoans: ActiveLoan[]; openCharges: OpenCharge[]; waitingHolds: WaitingHold[] };

export function LibraryMemberDetailClient({ memberId }: { memberId: string }) {
  const t = useTranslations('Library');
  const locale = useLocale();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateLabels: Record<string, { label: string; cls: string }> = {
    active: { label: t('active'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
    blocked: { label: t('stateBlocked'), cls: 'bg-rose-50 text-rose-600' },
    suspended: { label: t('stateSuspended'), cls: 'bg-amber-50 text-amber-700' },
    closed: { label: t('stateClosed'), cls: 'bg-slate-100 text-slate-500' },
  };

  const chargeReasons: Record<string, string> = {
    overdue_fine: t('chargeReasonOverdueFine'),
    lost_copy: t('chargeReasonLostCopy'),
    damage: t('chargeReasonDamage'),
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/addons/library/members/${memberId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error?.message ?? t('memberNotFound'));
      setMember(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('memberNotFound'));
    }
  }, [memberId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');

  const today = new Date().toISOString().slice(0, 10);
  const s = member ? (stateLabels[member.state] ?? { label: member.state, cls: 'bg-slate-100 text-slate-500' }) : null;
  const overdueCount = member?.activeLoans.filter(l => l.dueDate < today).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/portals/librarian/members"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToMembers')}
        </Link>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      {error ? (
        <Card className="p-10 text-center">
          <UserRound className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="font-medium">{error}</p>
        </Card>
      ) : !member ? (
        <Card className="p-10 text-center text-sm text-slate-500">{t('loading')}</Card>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-[#16212B]">{member.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{member.memberNumber}</span>
                  <Badge className={s!.cls}>{s!.label}</Badge>
                  <Badge variant="neutral" className="capitalize">{member.role}</Badge>
                  <Badge variant="neutral">{member.branchName}</Badge>
                </div>
                {member.email && <p className="mt-2 text-sm text-slate-500">{member.email}</p>}
              </div>
              <div className="text-right rtl:text-left text-sm">
                <p className="text-slate-500">{t('activeLoansTitle')}</p>
                <p className="text-2xl font-bold">{member.activeLoans.length}</p>
                {overdueCount > 0 && (
                  <p className="text-sm font-semibold text-red-600">
                    {t('overdueCount', { count: overdueCount })}
                  </p>
                )}
              </div>
            </div>
            {member.blockReason && (
              <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {t('blockedReasonNotice', {
                  reason: member.blockReason + (member.blockUntil ? ` ${t('blockedUntil', { date: member.blockUntil })}` : ''),
                })}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#2487B8]" />
              <h2 className="font-semibold">{t('activeLoansCount', { count: member.activeLoans.length })}</h2>
            </div>
            {member.activeLoans.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('noActiveLoans')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('thTitle')}</th>
                      <th className="p-3">{t('thIssuedAt')}</th>
                      <th className="p-3">{t('thDueDate')}</th>
                      <th className="p-3 text-right rtl:text-left">{t('thRenewals')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {member.activeLoans.map(loan => (
                      <tr key={loan.loanId} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-semibold">{loan.title}</div>
                          <div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div>
                        </td>
                        <td className="p-3">{formatDate(loan.issuedAt)}</td>
                        <td className="p-3">
                          <span className={loan.dueDate < today ? 'font-semibold text-red-600' : ''}>
                            {loan.dueDate}
                          </span>
                        </td>
                        <td className="p-3 text-right rtl:text-left">{loan.renewedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">{t('openChargesCount', { count: member.openCharges.length })}</h2>
            {member.openCharges.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('noOpenCharges')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('reason')}</th>
                      <th className="p-3 text-right rtl:text-left">{t('amount')}</th>
                      <th className="p-3">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {member.openCharges.map(charge => (
                      <tr key={charge.id} className="border-b last:border-0">
                        <td className="p-3">{chargeReasons[charge.reason] ?? charge.reason}</td>
                        <td className="p-3 text-right rtl:text-left font-bold">{Number(charge.amount).toFixed(2)} DH</td>
                        <td className="p-3">{formatDate(charge.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">{t('waitingHoldsCount', { count: member.waitingHolds.length })}</h2>
            {member.waitingHolds.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('noWaitingHolds')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('thTitle')}</th>
                      <th className="p-3">{t('thPlacedAt')}</th>
                      <th className="p-3">{t('thExpiresAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {member.waitingHolds.map(hold => (
                      <tr key={hold.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-semibold">{hold.title}</div>
                          <div className="font-mono text-xs text-slate-500">{hold.accessionNumber}</div>
                        </td>
                        <td className="p-3">{formatDate(hold.placedAt)}</td>
                        <td className="p-3">{hold.expiresAt ? formatDate(hold.expiresAt) : '—'}</td>
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
