'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, BarChart3, AlertCircle, Download } from 'lucide-react';
import { api, CHANNEL_BADGE, CAMPAIGN_STATUS_BADGE, fmtDate, fmtCount, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

type Campaign = {
  id: string; name: string; channel: string; status: string; scheduleAt: string | null;
  targetedCount: number | null; enqueuedCount: number | null; sentCount: number | null;
  deliveredCount: number | null; failedCount: number | null; createdAt: string;
};

export function ReportsView() {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Campaign[]>('/api/addons/broadcast/campaigns');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error ?? { message: t('addonNotActivated') });
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async (id: string, name: string) => {
    const res = await fetch(`/api/addons/broadcast/campaigns/${id}/export`, { credentials: 'include' });
    if (!res.ok) return;
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

  if (error && !rows) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('reportsTitle')}</h1>
          <p className="text-sm text-slate-500">{t('reportsSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer"><RefreshCw className="me-2 h-4 w-4" /> {t('refresh')}</Button>
      </div>

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {t('noCampaigns')}
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((c) => (
            <Card key={c.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BarChart3 className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{getChannelLabel(c.channel)}</Badge>
                      <Badge className={`border ${CAMPAIGN_STATUS_BADGE[c.status]}`}>{getCampaignStatusLabel(c.status)}</Badge>
                      {c.scheduleAt && <span>{fmtDate(c.scheduleAt, locale)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportCsv(c.id, c.name)} className="cursor-pointer"><Download className="me-1 h-3.5 w-3.5" /> {t('exportCsv')}</Button>
                  <Link href={`/${locale}/dashboard/broadcast/campaigns/${c.id}`}><Button size="sm" className="cursor-pointer">{t('details')}</Button></Link>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: t('targeted'), value: c.targetedCount, cls: '' },
                  { label: t('enqueued'), value: c.enqueuedCount, cls: '' },
                  { label: t('colSent'), value: c.sentCount, cls: '' },
                  { label: t('colDelivered'), value: c.deliveredCount, cls: 'text-emerald-700' },
                  { label: t('colFailed'), value: c.failedCount, cls: 'text-rose-600' },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-[#16212B]">{m.value != null ? fmtCount(m.value, locale) : '—'}</p>
                    <p className="text-xs text-slate-500">{m.label}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-[#16212B]">{c.sentCount && c.sentCount > 0 && c.deliveredCount != null ? `${Math.round((c.deliveredCount / c.sentCount) * 100)}%` : '—'}</p>
                  <p className="text-xs text-slate-500">{t('deliveryRate')}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
