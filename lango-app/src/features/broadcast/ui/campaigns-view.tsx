'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, Megaphone, AlertCircle, X, Eye, CheckCircle2, CalendarClock,
} from 'lucide-react';
import { api, CHANNEL_BADGE, CAMPAIGN_STATUS_BADGE, fmtDate, fmtCount, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

type Connection = { id: string; name: string; channel: string };
type Segment = { id: string; name: string; memberCount: number | null };
type Template = { id: string; name: string; channel: string };

type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  scheduleAt: string | null;
  targetedCount: number | null;
  enqueuedCount: number | null;
  sentCount: number | null;
  deliveredCount: number | null;
  failedCount: number | null;
  createdAt: string;
};

type Preview = {
  targeted: number;
  invalid: number;
  dedup: number;
  consentExcluded: number;
  suppressionExcluded: number;
  enqueued: number;
  estimatedCost: string;
};

const CHANNELS = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];

export function CampaignsView() {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!showForm) return;
    api<Connection[]>('/api/addons/broadcast/connections').then((r) => { if (r.ok && r.data) setConnections(r.data); });
    api<Segment[]>('/api/addons/broadcast/segments').then((r) => { if (r.ok && r.data) setSegments(r.data); });
    api<Template[]>('/api/addons/broadcast/templates').then((r) => { if (r.ok && r.data) setTemplates(r.data); });
  }, [showForm]);

  const createCampaign = async () => {
    setSaving(true);
    setFormError(null);
    const res = await api<Campaign>('/api/addons/broadcast/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name, channel, connectionId, segmentId, templateId: templateId || null, subject, bodyText }),
    });
    setSaving(false);
    if (res.ok && res.data) {
      setCampaignId(res.data.id);
      setPreview(null);
      setPreviewError(null);
    } else {
      setFormError(res.error?.message ?? t('addonNotActivated'));
    }
  };

  const runPreview = async () => {
    if (!campaignId) return;
    setPreviewError(null);
    setPreview(null);
    const res = await api<Preview>(`/api/addons/broadcast/campaigns/${campaignId}/preview`, { method: 'POST' });
    if (res.ok && res.data) setPreview(res.data);
    else setPreviewError(res.error?.message ?? tCommon('error'));
  };

  const approve = async () => {
    if (!campaignId) return;
    const res = await api<{ campaign: Campaign }>(`/api/addons/broadcast/campaigns/${campaignId}/approve`, { method: 'POST' });
    if (res.ok) {
      setShowForm(false);
      setCampaignId(null);
      setPreview(null);
      setName(''); setChannel('sms'); setConnectionId(''); setSegmentId(''); setTemplateId(''); setSubject(''); setBodyText('');
      load();
    } else {
      setFormError(res.error?.message ?? tCommon('error'));
    }
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
          <h1 className="text-2xl font-bold text-[#16212B]">{t('campaignsTitle')}</h1>
          <p className="text-sm text-slate-500">{t('campaignsSubtitle')}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="cursor-pointer"><Plus className="me-2 h-4 w-4" /> {t('btnCreateCampaign')}</Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">{t('btnNewCampaignModal')}</h2>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCampaignId(null); setPreview(null); }} className="cursor-pointer"><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t('colName')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t('colChannel')}</Label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer">
                {CHANNELS.map((c) => <option key={c} value={c}>{getChannelLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('fieldConnection')}</Label>
              <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer">
                <option value="">{t('selectPlaceholder')}</option>
                {connections.filter((c) => c.channel === channel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('fieldSegment')}</Label>
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer">
                <option value="">{t('selectPlaceholder')}</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmtCount(s.memberCount, locale)})</option>)}
              </select>
            </div>
            <div>
              <Label>{t('fieldTemplate')}</Label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer">
                <option value="">{t('noneOption')}</option>
                {templates.filter((tObj) => tObj.channel === channel).map((tObj) => <option key={tObj.id} value={tObj.id}>{tObj.name}</option>)}
              </select>
            </div>
            {channel === 'email' && (
              <div>
                <Label>{t('fieldSubject')}</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>{t('fieldMessage')}</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3} />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}

          {!campaignId ? (
            <div className="mt-4 flex gap-2">
              <Button onClick={createCampaign} disabled={saving || !name.trim() || !connectionId || !segmentId || !bodyText.trim()} className="cursor-pointer">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Megaphone className="me-2 h-4 w-4" />} {t('btnCreate')}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="cursor-pointer">{t('btnCancel')}</Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Button onClick={runPreview} variant="outline" className="cursor-pointer"><Eye className="me-2 h-4 w-4" /> {t('previewAudience')}</Button>
                <Button onClick={approve} className="cursor-pointer"><CheckCircle2 className="me-2 h-4 w-4" /> {t('approveAndLaunch')}</Button>
              </div>
              {previewError && <p className="text-sm text-rose-600">{previewError}</p>}
              {preview && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div><p className="text-xs text-slate-500">{t('targeted')}</p><p className="font-semibold text-[#16212B]">{fmtCount(preview.targeted, locale)}</p></div>
                  <div><p className="text-xs text-slate-500">{t('enqueued')}</p><p className="font-semibold text-emerald-700">{fmtCount(preview.enqueued, locale)}</p></div>
                  <div><p className="text-xs text-slate-500">{t('invalidContact')}</p><p className="font-semibold text-slate-600">{fmtCount(preview.invalid, locale)}</p></div>
                  <div><p className="text-xs text-slate-500">{t('consentExcluded')}</p><p className="font-semibold text-amber-600">{fmtCount(preview.consentExcluded, locale)}</p></div>
                  <div><p className="text-xs text-slate-500">{t('suppressionExcluded')}</p><p className="font-semibold text-amber-600">{fmtCount(preview.suppressionExcluded, locale)}</p></div>
                  <div><p className="text-xs text-slate-500">{t('duplicates')}</p><p className="font-semibold text-slate-600">{fmtCount(preview.dedup, locale)}</p></div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {t('noCampaigns')}
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('colName')}</th>
                  <th className="px-4 py-3 text-start">{t('colChannel')}</th>
                  <th className="px-4 py-3 text-start">{t('colStatus')}</th>
                  <th className="px-4 py-3 text-start">{t('scheduled')}</th>
                  <th className="px-4 py-3 text-start">{t('targeted')}</th>
                  <th className="px-4 py-3 text-start">{t('colSent')}</th>
                  <th className="px-4 py-3 text-start">{t('colDelivered')}</th>
                  <th className="px-4 py-3 text-start">{t('colFailed')}</th>
                  <th className="px-4 py-3 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-[#16212B] text-start">{c.name}</td>
                    <td className="px-4 py-3 text-start"><Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{getChannelLabel(c.channel)}</Badge></td>
                    <td className="px-4 py-3 text-start"><Badge className={`border ${CAMPAIGN_STATUS_BADGE[c.status]}`}>{getCampaignStatusLabel(c.status)}</Badge></td>
                    <td className="px-4 py-3 text-slate-500 text-start">{c.scheduleAt ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{fmtDate(c.scheduleAt, locale)}</span> : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#16212B] text-start">{fmtCount(c.targetedCount, locale)}</td>
                    <td className="px-4 py-3 text-start">{fmtCount(c.sentCount, locale)}</td>
                    <td className="px-4 py-3 text-emerald-700 text-start">{fmtCount(c.deliveredCount, locale)}</td>
                    <td className="px-4 py-3 text-rose-600 text-start">{fmtCount(c.failedCount, locale)}</td>
                    <td className="px-4 py-3 text-end">
                      <Button asChild variant="outline" size="sm" className="cursor-pointer">
                        <Link href={`/${locale}/dashboard/broadcast/campaigns/${c.id}`}>{t('details')}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
