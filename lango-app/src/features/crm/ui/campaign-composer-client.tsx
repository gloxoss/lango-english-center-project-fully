'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertCircle, CalendarClock, CheckCircle2, Eye, Loader2, Megaphone, RefreshCw, Users,
} from 'lucide-react';
import { api, fmtCount, isAddonNotActivated, CHANNEL_BADGE, CAMPAIGN_STATUS_BADGE, type ApiErrorShape } from '@/features/broadcast/ui/broadcast-ui';

type Connection = { id: string; name: string; channel: string };
type Segment = { id: string; name: string; memberCount: number | null };
type Template = { id: string; name: string; channel: string };
type Campaign = { id: string; name: string; channel: string; status: string };

type PreviewTotals = {
  targeted: number;
  invalid: number;
  dedup: number;
  consentExcluded: number;
  suppressionExcluded: number;
  enqueued: number;
  estimatedCost: string;
};

// Matches communication_broadcast_channel. Only these five can actually be sent.
const CHANNELS = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];

/**
 * Campaign composer over the real Broadcast domain. Every number on this screen
 * comes from a broadcast endpoint: the audience size is the segment's stored
 * member count, and the adjusted totals are the campaign preview the API
 * computes from consent, suppression and deduplication rules. Nothing is
 * estimated here, and an API failure shows an error rather than sample data.
 */
export function CampaignComposerClient({ locale }: { locale?: string }) {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const activeLocale = locale ?? 'fr';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms');
  const [connectionId, setConnectionId] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTotals | null>(null);
  const [busy, setBusy] = useState<'create' | 'preview' | 'schedule' | 'approve' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    const [conn, seg, tpl] = await Promise.all([
      api<Connection[]>('/api/addons/broadcast/connections'),
      api<Segment[]>('/api/addons/broadcast/segments'),
      api<Template[]>('/api/addons/broadcast/templates'),
    ]);
    const failed = !conn.ok ? conn : !seg.ok ? seg : !tpl.ok ? tpl : null;
    if (failed) {
      setError(failed.error ?? { message: tCommon('error') });
      setLoading(false);
      return;
    }
    setConnections(conn.data ?? []);
    setSegments(seg.data ?? []);
    setTemplates(tpl.data ?? []);
    setLoading(false);
  }, [tCommon]);

  useEffect(() => { load(); }, [load]);

  const selectedSegment = segments.find((s) => s.id === segmentId) ?? null;
  const channelConnections = connections.filter((c) => c.channel === channel);
  const channelTemplates = templates.filter((tpl) => tpl.channel === channel);

  const createCampaign = async () => {
    setBusy('create');
    setActionError(null);
    setNotice(null);
    // Only send fields the API accepts; the body schema is strict and rejects
    // nulls where it wants an omitted key.
    const body: Record<string, string> = { name, channel, bodyText };
    if (connectionId) body.connectionId = connectionId;
    if (segmentId) body.segmentId = segmentId;
    if (templateId) body.templateId = templateId;
    if (subject) body.subject = subject;

    const res = await api<Campaign>('/api/addons/broadcast/campaigns', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (res.ok && res.data) {
      setCampaignId(res.data.id);
      setCampaignStatus(res.data.status);
      setPreview(null);
      setNotice(t('campaignCreated'));
    } else {
      setActionError(res.error?.message ?? tCommon('error'));
    }
  };

  const runPreview = async () => {
    if (!campaignId) return;
    setBusy('preview');
    setActionError(null);
    setNotice(null);
    const res = await api<PreviewTotals>(`/api/addons/broadcast/campaigns/${campaignId}/preview`, { method: 'POST' });
    setBusy(null);
    if (res.ok && res.data) setPreview(res.data);
    else setActionError(res.error?.message ?? tCommon('error'));
  };

  const scheduleSend = async () => {
    if (!campaignId) return;
    setBusy('schedule');
    setActionError(null);
    setNotice(null);
    const res = await api<Campaign>(`/api/addons/broadcast/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduleAt: scheduleAt ? new Date(scheduleAt).toISOString() : null }),
    });
    setBusy(null);
    if (res.ok && res.data) {
      setCampaignStatus(res.data.status);
      setNotice(t('campaignScheduled'));
    } else {
      setActionError(res.error?.message ?? tCommon('error'));
    }
  };

  const approve = async () => {
    if (!campaignId) return;
    setBusy('approve');
    setActionError(null);
    setNotice(null);
    const res = await api<{ campaign: Campaign; totals: PreviewTotals }>(
      `/api/addons/broadcast/campaigns/${campaignId}/approve`,
      { method: 'POST' },
    );
    setBusy(null);
    if (res.ok && res.data) {
      setCampaignStatus(res.data.campaign.status);
      setPreview(res.data.totals);
      setNotice(t('campaignApproved'));
    } else {
      setActionError(res.error?.message ?? tCommon('error'));
    }
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

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('btnNewCampaignModal')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('composerSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B] cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> {t('refresh')}
        </Button>
      </div>

      {notice && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <h2 className="text-xs font-extrabold text-[#16212B]">1. {t('colChannel')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => { setChannel(ch); setConnectionId(''); setTemplateId(''); }}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                    channel === ch ? 'border-[#2487B8] bg-[#DCEBF4]/40 text-[#1B6C93]' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {getChannelLabel(ch)}
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-extrabold text-[#16212B]">2. {t('btnNewCampaignModal')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">{t('colName')}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">{t('fieldSegment')}</Label>
                  {segments.length === 0 ? (
                    <div className="h-9 flex items-center text-xs text-slate-500">
                      <Link href={`/${activeLocale}/dashboard/broadcast/segments`} className="underline text-[#2487B8]">{t('noSegments')}</Link>
                    </div>
                  ) : (
                    <select
                      value={segmentId}
                      onChange={(e) => setSegmentId(e.target.value)}
                      className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="">{t('selectPlaceholder')}</option>
                      {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">{t('fieldConnection')}</Label>
                  {channelConnections.length === 0 ? (
                    <div className="h-9 flex items-center text-xs text-slate-500">
                      <Link href={`/${activeLocale}/dashboard/broadcast/connections`} className="underline text-[#2487B8]">{t('noConnections')}</Link>
                    </div>
                  ) : (
                    <select
                      value={connectionId}
                      onChange={(e) => setConnectionId(e.target.value)}
                      className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="">{t('selectPlaceholder')}</option>
                      {channelConnections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">{t('fieldTemplate')}</Label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-slate-700 cursor-pointer"
                  >
                    <option value="">{t('noneOption')}</option>
                    {channelTemplates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                  </select>
                </div>
              </div>
              {channel === 'email' && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">{t('fieldSubject')}</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl font-bold" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">{t('fieldMessage')}</Label>
                <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} className="text-xs bg-slate-50 border-slate-200 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-extrabold text-[#16212B]">3. {t('btnScheduleSend')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">{t('scheduleAtLabel')}</Label>
                  <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-9 text-xs rounded-xl" />
                </div>
                <p className="text-[10px] text-slate-400">{t('scheduleHint')}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-5 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('recipientsCount')}</h2>
              {campaignStatus && (
                <Badge className={`border ${CAMPAIGN_STATUS_BADGE[campaignStatus] ?? ''}`}>{getCampaignStatusLabel(campaignStatus)}</Badge>
              )}
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">{t('fieldSegment')}</span>
                <span className="font-bold text-[#16212B] text-end">{selectedSegment ? selectedSegment.name : t('noneOption')}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">{t('colChannel')}</span>
                <span className={`font-bold border px-1.5 rounded ${CHANNEL_BADGE[channel] ?? ''}`}>{getChannelLabel(channel)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">{t('targeted')}</span>
                <span className="font-bold text-[#2487B8]">
                  {selectedSegment ? fmtCount(selectedSegment.memberCount ?? 0, activeLocale) : fmtCount(0, activeLocale)}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1">{t('audienceHint')}</p>
            </div>

            {preview ? (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-slate-400">{t('targeted')}</span><span className="font-bold text-[#16212B]">{fmtCount(preview.targeted, activeLocale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('enqueued')}</span><span className="font-bold text-[#17A673]">{fmtCount(preview.enqueued, activeLocale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('invalidContact')}</span><span className="font-bold text-slate-600">{fmtCount(preview.invalid, activeLocale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('duplicates')}</span><span className="font-bold text-slate-600">{fmtCount(preview.dedup, activeLocale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('consentExcluded')}</span><span className="font-bold text-amber-600">{fmtCount(preview.consentExcluded, activeLocale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('suppressionExcluded')}</span><span className="font-bold text-amber-600">{fmtCount(preview.suppressionExcluded, activeLocale)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('estimatedUnits')}</span><span className="font-bold text-[#16212B]">{preview.estimatedCost}</span></div>
              </div>
            ) : (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200 text-[10px] text-slate-400">
                {t('previewAudience')}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!campaignId ? (
                <Button
                  onClick={createCampaign}
                  disabled={busy !== null || !name.trim() || !bodyText.trim() || !connectionId || !segmentId}
                  className="h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white cursor-pointer"
                >
                  {busy === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : <Megaphone className="w-3.5 h-3.5 me-1" />}
                  {t('btnCreate')}
                </Button>
              ) : (
                <>
                  <Button onClick={runPreview} disabled={busy !== null} variant="outline" className="h-9 text-xs font-bold rounded-xl cursor-pointer">
                    {busy === 'preview' ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : <Eye className="w-3.5 h-3.5 me-1" />}
                    {t('previewAudience')}
                  </Button>
                  <Button onClick={scheduleSend} disabled={busy !== null} variant="outline" className="h-9 text-xs font-bold rounded-xl cursor-pointer">
                    {busy === 'schedule' ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : <CalendarClock className="w-3.5 h-3.5 me-1" />}
                    {t('btnScheduleSend')}
                  </Button>
                  <Button onClick={approve} disabled={busy !== null} className="h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white cursor-pointer">
                    {busy === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : <CheckCircle2 className="w-3.5 h-3.5 me-1" />}
                    {t('approveAndLaunch')}
                  </Button>
                </>
              )}
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> {t('composerFlowHint')}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
