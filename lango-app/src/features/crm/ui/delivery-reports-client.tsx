'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, BarChart3, CheckCircle2, Download, Loader2, Mail, RefreshCw, Search, Smartphone, XCircle,
} from 'lucide-react';
import {
  api, fmtCount, fmtDate, isAddonNotActivated, CHANNEL_BADGE, CAMPAIGN_STATUS_BADGE, type ApiErrorShape,
} from '@/features/broadcast/ui/broadcast-ui';

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  scheduleAt: string | null;
  createdAt: string;
  targetedCount: number | null;
  sentCount: number | null;
  deliveredCount: number | null;
  failedCount: number | null;
};

type CampaignReport = {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
  scheduleAt: string | null;
  counts: {
    targeted: number; enqueued: number; sent: number; delivered: number; failed: number;
    skipped: number; pending: number; invalid: number; dedup: number;
    consentExcluded: number; suppressionExcluded: number;
  };
  byStatus: { status: string; n: number }[];
};

/**
 * Delivery reporting over the real Broadcast log.
 *
 * Metric contract, so nobody re-adds an invented percentage:
 *   REAL        counts the API stores per campaign (sent, delivered, failed, ...).
 *   DERIVABLE   delivery rate = delivered / sent, and channel volume ranking.
 *   UNSUPPORTED opens and clicks. No provider here returns them: there is no
 *               open pixel, no link tracking and no event type for either, so
 *               they render as "Non disponible" instead of a percentage.
 */
export function DeliveryReportsClient({ locale }: { locale?: string }) {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const activeLocale = locale ?? 'fr';

  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const getChannelLabel = (ch: string) => {
    switch (ch) {
      case 'sms': return t('channelSms');
      case 'email': return t('channelEmail');
      case 'whatsapp': return t('channelWhatsapp');
      case 'telegram': return t('channelTelegram');
      case 'messenger': return t('channelMessenger');
      default: return ch;
    }
  };

  const getCampaignStatusLabel = (st: string) => {
    switch (st) {
      case 'draft': return t('statusDraft');
      case 'pending_approval': return t('statusPendingApproval');
      case 'scheduled': return t('statusScheduled');
      case 'queued': return t('statusQueued');
      case 'sending': return t('statusSending');
      case 'completed': return t('statusCompleted');
      case 'failed': return t('statusFailed');
      case 'cancelled': return t('statusCancelled');
      default: return st;
    }
  };

  // Mirrors campaign-detail-view so a delivery state reads the same everywhere.
  const getDeliveryStatusLabel = (st: string) => {
    switch (st) {
      case 'queued':
      case 'pending': return t('delivPending');
      case 'sending': return t('delivSending');
      case 'sent': return t('delivSent');
      case 'delivered': return t('delivDelivered');
      case 'failed': return t('delivFailed');
      case 'bounced': return t('delivBounced');
      case 'complained': return t('delivComplained');
      case 'skipped': return t('delivSkipped');
      default: return st;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<CampaignRow[]>('/api/addons/broadcast/campaigns');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error ?? { message: tCommon('error') });
    setLoading(false);
  }, [tCommon]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setReport(null); return; }
    let cancelled = false;
    setReportLoading(true);
    setActionError(null);
    api<CampaignReport>(`/api/addons/broadcast/campaigns/${selectedId}/report`).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setReport(res.data);
      else setActionError(res.error?.message ?? tCommon('error'));
      setReportLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedId, tCommon]);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.channel.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  // Aggregates are summed from the campaign records the API returns, never
  // estimated. Delivery rate is delivered/sent and is left blank at zero sends.
  const totals = useMemo(() => {
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    const byChannel = new Map<string, number>();
    for (const r of rows ?? []) {
      sent += r.sentCount ?? 0;
      delivered += r.deliveredCount ?? 0;
      failed += r.failedCount ?? 0;
      byChannel.set(r.channel, (byChannel.get(r.channel) ?? 0) + (r.sentCount ?? 0));
    }
    let topChannel: string | null = null;
    let topVolume = 0;
    for (const [ch, n] of byChannel) {
      if (n > topVolume) { topVolume = n; topChannel = ch; }
    }
    return {
      sent,
      delivered,
      failed,
      deliveryRate: sent > 0 ? `${Math.round((delivered / sent) * 100)}%` : null,
      topChannel,
      topVolume,
    };
  }, [rows]);

  const deliveryRateLabel = (sent: number | null, delivered: number | null) =>
    sent && sent > 0 && delivered != null ? `${Math.round((delivered / sent) * 100)}%` : '—';

  const exportCsv = async (id: string, name: string) => {
    setActionError(null);
    const res = await fetch(`/api/addons/broadcast/campaigns/${id}/export`, { credentials: 'include' });
    if (!res.ok) {
      setActionError(tCommon('error'));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${name.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> {tCommon('loading')}</div>;
  }

  if (error) {
    if (isAddonNotActivated(error)) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error.message ?? t('addonNotActivated')}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error.message ?? tCommon('error')}
        <Button variant="outline" size="sm" onClick={load} className="cursor-pointer"><RefreshCw className="me-1 h-4 w-4" />{tCommon('retry')}</Button>
      </div>
    );
  }

  const NotTracked = () => (
    <span className="text-[10px] font-semibold text-slate-400 italic" title={t('notTrackedHint')}>{t('notAvailable')}</span>
  );

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('reportsTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('reportsRealSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B] cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> {t('refresh')}
        </Button>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]"><BarChart3 className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('totalSent')}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{fmtCount(totals.sent, activeLocale)}</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]"><CheckCircle2 className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('colRate')}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{totals.deliveryRate ?? '—'}</p>
            <p className="text-[10px] font-semibold text-slate-400">{t('delivered')} {fmtCount(totals.delivered, activeLocale)}</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700"><Mail className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('openRate')}</p>
            <p className="text-base font-extrabold text-slate-400">{t('notAvailable')}</p>
            <p className="text-[10px] font-semibold text-slate-400">{t('notTrackedHint')}</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700"><Search className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('clickRate')}</p>
            <p className="text-base font-extrabold text-slate-400">{t('notAvailable')}</p>
            <p className="text-[10px] font-semibold text-slate-400">{t('notTrackedHint')}</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 shrink-0 flex items-center justify-center text-rose-600"><XCircle className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('colFailed')}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{fmtCount(totals.failed, activeLocale)}</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 shrink-0 flex items-center justify-center text-blue-700"><Smartphone className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('topChannel')}</p>
            <p className="text-base font-extrabold text-[#16212B]">{totals.topChannel ? getChannelLabel(totals.topChannel) : '—'}</p>
            <p className="text-[10px] font-semibold text-slate-400">{fmtCount(totals.topVolume, activeLocale)}</p>
          </div>
        </Card>
      </div>

      {(!filtered || filtered.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {t('noCampaigns')}
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xs font-extrabold text-[#16212B]">{t('campaignsTitle')}</h2>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tCommon('search')}
                    className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                      <th className="pb-2">{t('colName')}</th>
                      <th className="pb-2">{t('colChannel')}</th>
                      <th className="pb-2">{t('colStatus')}</th>
                      <th className="pb-2 text-center">{t('colSent')}</th>
                      <th className="pb-2 text-center">{t('colDelivered')}</th>
                      <th className="pb-2 text-center">{t('colFailed')}</th>
                      <th className="pb-2 text-center">{t('colRate')}</th>
                      <th className="pb-2 text-center">{t('openRate')}</th>
                      <th className="pb-2 text-center">{t('clickRate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filtered.map((rep) => (
                      <tr
                        key={rep.id}
                        onClick={() => setSelectedId(rep.id)}
                        className={`cursor-pointer transition-all ${selectedId === rep.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{rep.name}</td>
                        <td className="py-2.5"><Badge className={`border ${CHANNEL_BADGE[rep.channel] ?? ''}`}>{getChannelLabel(rep.channel)}</Badge></td>
                        <td className="py-2.5"><Badge className={`border ${CAMPAIGN_STATUS_BADGE[rep.status] ?? ''}`}>{getCampaignStatusLabel(rep.status)}</Badge></td>
                        <td className="py-2.5 text-center font-bold text-[#16212B]">{fmtCount(rep.sentCount, activeLocale)}</td>
                        <td className="py-2.5 text-center font-bold text-emerald-700">{fmtCount(rep.deliveredCount, activeLocale)}</td>
                        <td className="py-2.5 text-center font-bold text-rose-600">{fmtCount(rep.failedCount, activeLocale)}</td>
                        <td className="py-2.5 text-center font-extrabold text-[#2487B8]">{deliveryRateLabel(rep.sentCount, rep.deliveredCount)}</td>
                        <td className="py-2.5 text-center"><NotTracked /></td>
                        <td className="py-2.5 text-center"><NotTracked /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="xl:col-span-4 space-y-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              {!selectedId ? (
                <p className="text-xs text-slate-400">{t('noCampaignSelected')}</p>
              ) : reportLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
              ) : report ? (
                <>
                  <div className="border-b border-slate-100 pb-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-extrabold text-[#16212B]">{report.name}</h2>
                      <Badge className={`border ${CHANNEL_BADGE[report.channel] ?? ''}`}>{getChannelLabel(report.channel)}</Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">{report.scheduleAt ? fmtDate(report.scheduleAt, activeLocale) : fmtDate(null, activeLocale)}</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-slate-400">{t('colSent')}</span><span className="font-bold text-[#16212B]">{fmtCount(report.counts.sent, activeLocale)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('colDelivered')}</span><span className="font-bold text-emerald-700">{fmtCount(report.counts.delivered, activeLocale)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('colFailed')}</span><span className="font-bold text-rose-600">{fmtCount(report.counts.failed, activeLocale)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('delivSkipped')}</span><span className="font-bold text-slate-600">{fmtCount(report.counts.skipped, activeLocale)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('delivPending')}</span><span className="font-bold text-slate-600">{fmtCount(report.counts.pending, activeLocale)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('colRate')}</span><span className="font-bold text-[#2487B8]">{deliveryRateLabel(report.counts.sent, report.counts.delivered)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('openRate')}</span><NotTracked /></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('clickRate')}</span><NotTracked /></div>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <p className="font-extrabold text-[#16212B]">{t('deliveryLog')}</p>
                    {report.byStatus.length === 0 ? (
                      <p className="text-slate-400">{t('noDeliveryEvents')}</p>
                    ) : (
                      report.byStatus.map((s) => (
                        <div key={s.status} className="flex justify-between">
                          <span className="text-slate-400">{getDeliveryStatusLabel(s.status)}</span>
                          <span className="font-bold text-[#16212B]">{fmtCount(s.n, activeLocale)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <Button onClick={() => exportCsv(report.campaignId, report.name)} className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] text-white hover:bg-[#1B6C93] cursor-pointer">
                    <Download className="w-3.5 h-3.5 me-1" /> {t('exportCsv')}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-400">{t('noDeliveryEvents')}</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
