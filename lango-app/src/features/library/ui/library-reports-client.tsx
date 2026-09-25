'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookCheck, BookOpen, Boxes, Clock3, Library, RefreshCw, Repeat, TrendingUp, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { casablancaTodayIso } from '@/libs/finance/today';

type Overview = { totalCopies: number; availableCopies: number; activeLoans: number; overdueLoans: number; waitingHolds: number; activeMembers: number };
type Overdue = { loanId: string; dueDate: string; memberNumber: string; memberName: string; accessionNumber: string; title: string };
type InventoryRow = { branchId: string; branchName: string; total: number; available: number; checkedOut: number; onHoldShelf: number; inTransit: number; repair: number; lost: number; missing: number; withdrawn: number; active: number; conditions: Record<string, number> };
type InventoryReport = { byBranch: InventoryRow[]; totals: { total: number; active: number; withdrawn: number } };
type CirculationReport = {
  loans: { active: number; issued30: number; returned30: number; renewed30: number; issued90: number; returned90: number; renewed90: number; daily: Array<{ day: string; issued: number; returned: number; renewed: number }> };
  holds: Record<string, number>; transfers: Record<string, number>;
  charges: { open: number; waived: number; paid: number; openAmount: number };
};

export function LibraryReportsClient() {
  const t = useTranslations('Library');
  const locale = useLocale();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [circulation, setCirculation] = useState<CirculationReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [or, odr, ir, cr] = await Promise.all([
        fetch('/api/addons/library/reports/overview', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/overdue', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/inventory', { cache: 'no-store' }),
        fetch('/api/addons/library/reports/circulation', { cache: 'no-store' }),
      ]);
      const [oj, odj, ij, cj] = await Promise.all([or.json(), odr.json(), ir.json(), cr.json()]);
      if (oj.success) setOverview(oj.data);
      if (odj.success) setOverdue(odj.data);
      if (ij.success) setInventory(ij.data);
      if (cj.success) setCirculation(cj.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');

  const today = casablancaTodayIso();
  const kpis = overview ? [
    [t('kpiTotalCopies'), overview.totalCopies, Library],
    [t('kpiAvailableCopies'), overview.availableCopies, BookOpen],
    [t('kpiActiveLoans'), overview.activeLoans, BookCheck],
    [t('kpiOverdueLoans'), overview.overdueLoans, Clock3],
    [t('kpiHolds'), overview.waitingHolds, Users],
    [t('kpiActiveMembers'), overview.activeMembers, Users],
  ] as const : [];

  const circKpis = circulation ? [
    [t('kpiActiveLoans'), circulation.loans.active, BookCheck],
    [t('kpiIssued30'), circulation.loans.issued30, BookOpen],
    [t('kpiReturned30'), circulation.loans.returned30, Clock3],
    [t('kpiRenewed30'), circulation.loans.renewed30, Repeat],
    [t('stateWaiting'), circulation.holds.waiting ?? 0, Users],
    [t('kpiOpenCharges'), circulation.charges.open, TrendingUp],
  ] as const : [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('reportsTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('reportsSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">{t('loading')}</div>
      ) : (
        <>
          {overview && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {kpis.map(([label, value, Icon]) => (
                <Card key={String(label)} className="p-4">
                  <Icon className="mb-3 h-5 w-5 text-[#2487B8]" />
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="font-semibold">{t('kpiOverdues', { count: overdue.length })}</h2>
            </div>
            {overdue.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('noOverdues')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('thTitle')}</th>
                      <th className="p-3">{t('thMember')}</th>
                      <th className="p-3">{t('thDueDate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map(o => (
                      <tr key={o.loanId} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-semibold">{o.title}</div>
                          <div className="font-mono text-xs text-slate-500">{o.accessionNumber}</div>
                        </td>
                        <td className="p-3">
                          {o.memberName}
                          <div className="text-xs text-slate-500">{o.memberNumber}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant={o.dueDate < today ? 'danger' : 'warning'}>{o.dueDate}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {inventory && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Boxes className="h-4 w-4 text-[#2487B8]" />
                <h2 className="font-semibold">{t('branchInventoryTitle')}</h2>
                <span className="text-xs text-slate-500 ltr:ml-auto rtl:mr-auto">
                  {t('inventorySummary', {
                    total: inventory.totals.total,
                    active: inventory.totals.active,
                    withdrawn: inventory.totals.withdrawn,
                  })}
                </span>
              </div>
              {inventory.byBranch.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('noCopiesRecorded')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left rtl:text-right text-sm">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="p-3">{t('thBranch')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('total')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thActive')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thCheckedOut')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thOnHold')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thInTransit')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thRepair')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thLost')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thMissing')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thWithdrawn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.byBranch.map(b => (
                        <tr key={b.branchId} className="border-b last:border-0">
                          <td className="p-3 font-semibold">{b.branchName}</td>
                          <td className="p-3 text-right rtl:text-left">{b.total}</td>
                          <td className="p-3 text-right rtl:text-left">{b.active}</td>
                          <td className="p-3 text-right rtl:text-left">{b.checkedOut}</td>
                          <td className="p-3 text-right rtl:text-left">{b.onHoldShelf}</td>
                          <td className="p-3 text-right rtl:text-left">{b.inTransit}</td>
                          <td className="p-3 text-right rtl:text-left">{b.repair}</td>
                          <td className="p-3 text-right rtl:text-left">{b.lost}</td>
                          <td className="p-3 text-right rtl:text-left">{b.missing}</td>
                          <td className="p-3 text-right rtl:text-left">{b.withdrawn}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="p-3">{t('total')}</td>
                        <td className="p-3 text-right rtl:text-left">{inventory.totals.total}</td>
                        <td className="p-3 text-right rtl:text-left">{inventory.totals.active}</td>
                        <td className="p-3 text-right rtl:text-left" />
                        <td className="p-3 text-right rtl:text-left" />
                        <td className="p-3 text-right rtl:text-left" />
                        <td className="p-3 text-right rtl:text-left" />
                        <td className="p-3 text-right rtl:text-left" />
                        <td className="p-3 text-right rtl:text-left" />
                        <td className="p-3 text-right rtl:text-left">{inventory.totals.withdrawn}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {circulation && (
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#2487B8]" />
                <h2 className="font-semibold">{t('circulationTitle')}</h2>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {circKpis.map(([label, value, Icon]) => (
                  <div key={String(label)} className="flex items-center gap-3 rounded-lg border p-3">
                    <Icon className="h-5 w-5 text-[#2487B8]" />
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-lg font-bold">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              {circulation.loans.daily.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t('noCirculationActivity')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left rtl:text-right text-sm">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="p-3">{t('thDay')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thIssued')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thReturned')}</th>
                        <th className="p-3 text-right rtl:text-left">{t('thRenewals')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {circulation.loans.daily.map(d => (
                        <tr key={d.day} className="border-b last:border-0">
                          <td className="p-3">{formatDate(d.day)}</td>
                          <td className="p-3 text-right rtl:text-left">{d.issued}</td>
                          <td className="p-3 text-right rtl:text-left">{d.returned}</td>
                          <td className="p-3 text-right rtl:text-left">{d.renewed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
