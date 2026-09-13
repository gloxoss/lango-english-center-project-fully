'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, FileText, AlertCircle, X, ChevronDown, ChevronUp, CheckCircle2, Send,
} from 'lucide-react';
import { api, CHANNEL_BADGE, fmtDate, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

type TemplateVersion = {
  id: string;
  version: number;
  subject: string | null;
  bodyText: string;
  variableSchema: { name: string }[] | null;
  status: string;
  createdAt: string;
};

type Template = {
  id: string;
  name: string;
  channel: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  latestVersion: TemplateVersion | null;
};

const CHANNELS = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];
const CATEGORIES = ['general', 'announcement', 'reminder', 'event', 'invoice', 'other'];

export function TemplatesView() {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [rows, setRows] = useState<Template[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms');
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');

  const [expanded, setExpanded] = useState<Record<string, { versions: TemplateVersion[]; loaded: boolean }>>({});
  const [newVersions, setNewVersions] = useState<Record<string, { subject: string; bodyText: string }>>({});
  const [published, setPublished] = useState<Record<string, boolean>>({});

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

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'general': return t('catGeneral');
      case 'announcement': return t('catAnnouncement');
      case 'reminder': return t('catReminder');
      case 'event': return t('catEvent');
      case 'invoice': return t('catInvoice');
      default: return t('catOther');
    }
  };

  const getVersionStatusLabel = (st: string) => {
    switch (st) {
      case 'draft': return t('tplStatusDraft');
      case 'published': return t('tplStatusPublished');
      case 'archived': return t('tplStatusArchived');
      default: return st;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Template[]>('/api/addons/broadcast/templates');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error ?? { message: t('addonNotActivated') });
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (tObj: Template) => {
    if (expanded[tObj.id]?.loaded) {
      setExpanded((prev) => ({ ...prev, [tObj.id]: { ...(prev[tObj.id] ?? { versions: [] as TemplateVersion[] }), loaded: false } }));
      return;
    }
    const res = await api<TemplateVersion[]>(`/api/addons/broadcast/templates/${tObj.id}/versions`);
    if (res.ok && res.data) {
      setExpanded((prev) => ({ ...prev, [tObj.id]: { versions: res.data ?? [], loaded: true } }));
    }
  };

  const addVersion = async (tObj: Template) => {
    const v = newVersions[tObj.id];
    if (!v || !v.bodyText.trim()) return;
    const res = await api<TemplateVersion>(`/api/addons/broadcast/templates/${tObj.id}/versions`, {
      method: 'POST', body: JSON.stringify({ subject: v.subject, bodyText: v.bodyText }),
    });
    if (res.ok) {
      setNewVersions((prev) => ({ ...prev, [tObj.id]: { subject: '', bodyText: '' } }));
      await toggleExpand(tObj);
      load();
    }
  };

  const publish = async (tObj: Template, versionId: string) => {
    const res = await api<{ status: string }>(`/api/addons/broadcast/templates/${tObj.id}/versions/${versionId}/publish`, { method: 'POST' });
    if (res.ok) {
      setPublished((prev) => ({ ...prev, [versionId]: true }));
      await toggleExpand(tObj);
      load();
    }
  };

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const res = await api<{ template: Template; version: TemplateVersion }>('/api/addons/broadcast/templates', {
      method: 'POST',
      body: JSON.stringify({ name, channel, category, initial: { subject, bodyText } }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName(''); setChannel('sms'); setCategory('general'); setSubject(''); setBodyText('');
      load();
    } else {
      setFormError(res.error?.message ?? t('addonNotActivated'));
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
          <h1 className="text-2xl font-bold text-[#16212B]">{t('templatesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('templatesSubtitle')}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="cursor-pointer"><Plus className="me-2 h-4 w-4" /> {t('btnNewTemplate')}</Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">{t('btnNewTemplate')}</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="cursor-pointer"><X className="h-4 w-4" /></Button>
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
              <Label>{t('templateCategory')}</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer">
                {CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('emailSubject')}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t('templateBody')}</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3} />
              <p className="mt-1 text-xs text-slate-400">{t('variablesHelp')}</p>
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={saving || !name.trim() || !bodyText.trim()} className="cursor-pointer">
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <FileText className="me-2 h-4 w-4" />} {t('btnCreate')}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="cursor-pointer">{t('btnCancel')}</Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {t('noTemplates')}
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => {
            const ex = expanded[item.id];
            return (
              <Card key={item.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><FileText className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold text-[#16212B]">{item.name}</p>
                      <p className="text-xs text-slate-500">{getCategoryLabel(item.category)} · {fmtDate(item.updatedAt, locale)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border ${CHANNEL_BADGE[item.channel]}`}>{getChannelLabel(item.channel)}</Badge>
                    <Badge className={`border ${item.latestVersion?.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      {item.latestVersion ? `${getVersionStatusLabel(item.latestVersion.status)} v${item.latestVersion.version}` : t('noVersion')}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleExpand(item)} className="cursor-pointer">
                      {ex?.loaded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {ex?.loaded && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    {ex.versions.length === 0 && <p className="text-sm text-slate-400">{t('noVersion')}</p>}
                    {ex.versions.map((v) => (
                      <div key={v.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-[#16212B]">v{v.version}</span>
                            <Badge className={`border ${v.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>{getVersionStatusLabel(v.status)}</Badge>
                            {v.subject && <span>· {v.subject}</span>}
                          </div>
                          {v.status === 'draft' && (
                            <Button size="sm" onClick={() => publish(item, v.id)} disabled={published[v.id]} className="cursor-pointer">
                              {published[v.id] ? <CheckCircle2 className="me-1 h-3.5 w-3.5" /> : <Send className="me-1 h-3.5 w-3.5" />} {t('publish')}
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{v.bodyText}</p>
                        {v.variableSchema && v.variableSchema.length > 0 && (
                          <p className="mt-1 text-xs text-slate-400">Variables : {v.variableSchema.map((x) => `{{${x.name}}}`).join(' ')}</p>
                        )}
                      </div>
                    ))}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>{t('addVersion')}</Label>
                        <Input
                          value={newVersions[item.id]?.bodyText ?? ''}
                          onChange={(e) => setNewVersions((prev) => ({ ...prev, [item.id]: { subject: prev[item.id]?.subject ?? '', bodyText: e.target.value } }))}
                        />
                      </div>
                      <Button variant="outline" onClick={() => addVersion(item)} disabled={!newVersions[item.id]?.bodyText?.trim()} className="cursor-pointer">{t('addVersion')}</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
