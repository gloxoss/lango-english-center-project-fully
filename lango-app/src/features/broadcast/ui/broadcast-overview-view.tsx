'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, RefreshCw, Megaphone, AlertCircle, Cable, Users, FileText, CheckCircle2,
} from 'lucide-react';
import { api, CHANNEL_LABELS, CHANNEL_BADGE, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE, fmtDate, fmtCount, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

type Campaign = {
  id: string; name: string; channel: string; status: string; scheduleAt: string | null;
  targetedCount: number | null; sentCount: number | null; deliveredCount: number | null; failedCount: number | null; createdAt: string;
};

function Kpi({ icon, label, value, href, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; href: string; accent?: boolean }) {
  return (
    <Link href={href}>
      <Card className={`rounded-2xl border p-5 shadow-2xs transition-colors hover:border-[#0066FF]/40 ${accent ? 'border-[#0066FF]/20 bg-[#D1F5E8]/40' : 'border-slate-200/80 bg-white'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]">{icon}</div>
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-[#16212B]">{value}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function BroadcastOverviewView({ locale: initialLocale }: { locale?: string } = {}) {
  const params = useParams<{ locale?: string }>();
  const locale = initialLocale || params?.locale || 'fr';
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const [data, setData] = useState<{ connections: number; segments: number; templates: number; campaigns: Campaign[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [c, s, t, camps] = await Promise.all([
      api<unknown[]>('/api/addons/broadcast/connections'),
      api<unknown[]>('/api/addons/broadcast/segments'),
      api<unknown[]>('/api/addons/broadcast/templates'),
      api<Campaign[]>('/api/addons/broadcast/campaigns'),
    ]);
    if (!c.ok || !s.ok || !t.ok || !camps.ok) {
      const addonError = [c, s, t, camps].find((r) => isAddonNotActivated(r.error));
      setError(addonError?.error ?? { message: 'Impossible de charger le tableau de bord de diffusion.' });
    } else {
      setData({
        connections: c.data?.length ?? 0,
        segments: s.data?.length ?? 0,
        templates: t.data?.length ?? 0,
        campaigns: camps.data ?? [],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement du tableau de bord…</div>;
  }

  if (error || !data) {
    if (isAddonNotActivated(error ?? undefined)) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error?.message ?? 'Module non activé.'}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error?.message ?? 'Erreur inconnue.'}
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  const active = data.campaigns.filter((c) => ['queued', 'sending', 'scheduled'].includes(c.status));
  const completed = data.campaigns.filter((c) => c.status === 'completed');
  const sentTotal = data.campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0);
  const deliveredTotal = data.campaigns.reduce((s, c) => s + (c.deliveredCount ?? 0), 0);

  const recent = [...data.campaigns].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 6);

  const getCampaignStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('statusDraft');
      case 'pending_approval': return t('statusPendingApproval');
      case 'scheduled': return t('statusScheduled');
      case 'queued': return t('statusQueued');
      case 'sending': return t('statusSending');
      case 'completed': return t('statusCompleted');
      case 'failed': return t('statusFailed');
      case 'cancelled': return t('statusCancelled');
      default: return status;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'sms': return t('channelSms');
      case 'email': return t('channelEmail');
      case 'whatsapp': return t('channelWhatsapp');
      case 'telegram': return t('channelTelegram');
      case 'messenger': return t('channelMessenger');
      default: return channel;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> {t('refresh')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi href={`/${locale}/dashboard/broadcast/connections`} icon={<Cable className="h-5 w-5" />} label={t('kpiActiveConnections')} value={fmtCount(data.connections, locale)} />
        <Kpi href={`/${locale}/dashboard/broadcast/segments`} icon={<Users className="h-5 w-5" />} label={t('kpiAudienceSegments')} value={fmtCount(data.segments, locale)} />
        <Kpi href={`/${locale}/dashboard/broadcast/templates`} icon={<FileText className="h-5 w-5" />} label={t('kpiSavedTemplates')} value={fmtCount(data.templates, locale)} />
        <Kpi href={`/${locale}/dashboard/broadcast/campaigns`} icon={<Megaphone className="h-5 w-5" />} label={t('kpiCampaignsCreated')} value={fmtCount(data.campaigns.length, locale)} accent />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <p className="text-sm text-slate-500">{t('totalSent')}</p>
          <p className="text-2xl font-bold text-[#16212B]">{fmtCount(sentTotal, locale)}</p>
        </Card>
        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-2xs">
          <p className="text-sm text-emerald-700">{t('delivered')}</p>
          <p className="text-2xl font-bold text-emerald-700">{fmtCount(deliveredTotal, locale)}</p>
        </Card>
        <Card className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-2xs">
          <p className="text-sm text-amber-700">{t('activeScheduled')}</p>
          <p className="text-2xl font-bold text-amber-700">{fmtCount(active.length, locale)}</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-[#16212B]">{t('recentCampaignsTitle')}</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{t('colName')}</th>
                <th className="px-4 py-3 text-start">{t('colChannel')}</th>
                <th className="px-4 py-3 text-start">{t('colStatus')}</th>
                <th className="px-4 py-3 text-start">{t('targeted')}</th>
                <th className="px-4 py-3 text-start">{t('colSent')}</th>
                <th className="px-4 py-3 text-start">{t('colDelivered')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t('noCampaignsYet')}</td></tr>
              )}
              {recent.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-[#16212B] text-start">{c.name}</td>
                  <td className="px-4 py-3 text-start"><Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{getChannelLabel(c.channel)}</Badge></td>
                  <td className="px-4 py-3 text-start"><Badge className={`border ${CAMPAIGN_STATUS_BADGE[c.status]}`}>{getCampaignStatusLabel(c.status)}</Badge></td>
                  <td className="px-4 py-3 text-start">{fmtCount(c.targetedCount, locale)}</td>
                  <td className="px-4 py-3 text-start">{fmtCount(c.sentCount, locale)}</td>
                  <td className="px-4 py-3 text-start text-emerald-700">{fmtCount(c.deliveredCount, locale)}</td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/${locale}/dashboard/broadcast/campaigns/${c.id}`}><Button variant="outline" size="sm">{t('details')}</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> {t('simulationNotice')}
      </div>
    </div>
  );
}
