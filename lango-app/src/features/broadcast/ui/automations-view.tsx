'use client';

import type { ApiErrorShape } from './broadcast-ui';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, CHANNEL_BADGE, fmtCount, fmtDate, isAddonNotActivated } from './broadcast-ui';

type Connection = { id: string; name: string; channel: string };
type Template = { id: string; name: string; channel: string };

type Automation = {
  id: string;
  name: string;
  kind: string;
  channel: string;
  connectionId: string;
  templateId: string;
  sendTime: string;
  isActive: boolean;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Run = {
  id: string;
  runDate: string;
  status: string;
  createdCount: number | null;
  queuedCount: number | null;
  skippedCount: number | null;
  failedCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

const KINDS = ['birthday_student', 'birthday_staff'];

export function AutomationsView() {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [rows, setRows] = useState<Automation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('birthday_student');
  const [channel, setChannel] = useState('sms');
  const [connectionId, setConnectionId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [sendTime, setSendTime] = useState('09:00');

  const [runs, setRuns] = useState<Record<string, Run[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  const getKindLabel = (k: string) => {
    switch (k) {
      case 'birthday_student': return t('triggerBirthdayStudent');
      case 'birthday_staff': return t('triggerBirthdayStaff');
      default: return k;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Automation[]>('/api/addons/broadcast/automations');
    if (res.ok && res.data) {
      setRows(res.data);
    } else {
      setError(res.error ?? { message: t('addonNotActivated') });
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showForm) {
      return;
    }
    api<Connection[]>('/api/addons/broadcast/connections').then((r) => {
      if (r.ok && r.data) {
        setConnections(r.data);
      }
    });
    api<Template[]>('/api/addons/broadcast/templates').then((r) => {
      if (r.ok && r.data) {
        setTemplates(r.data);
      }
    });
  }, [showForm]);

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const res = await api<Automation>('/api/addons/broadcast/automations', {
      method: 'POST',
      body: JSON.stringify({ name, kind, channel, connectionId, templateId, sendTime }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName(''); setKind('birthday_student'); setChannel('sms'); setConnectionId(''); setTemplateId(''); setSendTime('09:00');
      load();
    } else {
      setFormError(res.error?.message ?? t('addonNotActivated'));
    }
  };

  const toggle = async (a: Automation) => {
    await api(`/api/addons/broadcast/automations/${a.id}/toggle`, { method: 'POST' });
    load();
  };

  const del = async (a: Automation) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(tCommon('confirmDeleteGeneric'))) {
      return;
    }
    const res = await api(`/api/addons/broadcast/automations/${a.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(res.error?.message ?? tCommon('error'));
    }
    load();
  };

  const testRun = async (a: Automation) => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await api<{ alreadyRan: boolean; queuedCount: number }>(`/api/addons/broadcast/automations/${a.id}/test`, {
      method: 'POST',
      body: JSON.stringify({ runDate: today }),
    });
    if (res.ok) {
      setMsg({ ok: true, text: `${t('btnRunTest')} : ${res.data?.queuedCount ?? 0} ${t('enqueued')}` });
    } else {
      setMsg({ ok: false, text: res.error?.message ?? tCommon('error') });
    }
    load();
  };

  const toggleRuns = async (a: Automation) => {
    if (runs[a.id]) {
      setRuns((prev) => {
        const n = { ...prev }; delete n[a.id]; return n;
      });
      setExpanded(prev => ({ ...prev, [a.id]: false }));
      return;
    }
    const res = await api<Run[]>(`/api/addons/broadcast/automations/${a.id}/runs`);
    if (res.ok && res.data) {
      setRuns(prev => ({ ...prev, [a.id]: res.data ?? [] })); setExpanded(prev => ({ ...prev, [a.id]: true }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-slate-500">
        <Loader2 className="size-5 animate-spin" />
        {' '}
        {tCommon('loading')}
      </div>
    );
  }

  if (error && !rows) {
    if (isAddonNotActivated(error)) {
      return (
        <div className="
          flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50
          px-4 py-3 text-amber-700
        "
        >
          <AlertCircle className="size-5 shrink-0" />
          {' '}
          {error.message ?? t('addonNotActivated')}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="size-5" />
        {' '}
        {error.message ?? tCommon('error')}
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="cursor-pointer"
        >
          <RefreshCw className="me-1 size-4" />
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('automationsTitle')}</h1>
          <p className="text-sm text-slate-500">{t('automationsSubtitle')}</p>
        </div>
        <Button
          onClick={() => setShowForm(v => !v)}
          className="cursor-pointer"
        >
          <Plus className="me-2 size-4" />
          {' '}
          {t('btnNewAutomation')}
        </Button>
      </div>

      {msg && (
        <div className={`
          flex items-center gap-2 rounded-lg px-3 py-2 text-sm
          ${msg.ok
          ? `bg-emerald-50 text-emerald-700`
          : `bg-rose-50 text-rose-700`}
        `}
        >
          {msg.ok
            ? <Sparkles className="size-4 shrink-0" />
            : (
                <AlertCircle className="size-4 shrink-0" />
              )}
          {' '}
          {msg.text}
        </div>
      )}

      {showForm && (
        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">{t('btnNewAutomation')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="cursor-pointer"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="
            grid gap-4
            sm:grid-cols-2
          "
          >
            <div>
              <Label>{t('colName')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t('trigger')}</Label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value)}
                className="
                  h-9 w-full cursor-pointer rounded-md border border-slate-200
                  bg-white px-3 text-sm
                "
              >
                {KINDS.map(k => <option key={k} value={k}>{getKindLabel(k)}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('colChannel')}</Label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="
                  h-9 w-full cursor-pointer rounded-md border border-slate-200
                  bg-white px-3 text-sm
                "
              >
                {['sms', 'email', 'whatsapp', 'telegram', 'messenger'].map(c => <option key={c} value={c}>{getChannelLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('fieldConnection')}</Label>
              <select
                value={connectionId}
                onChange={e => setConnectionId(e.target.value)}
                className="
                  h-9 w-full cursor-pointer rounded-md border border-slate-200
                  bg-white px-3 text-sm
                "
              >
                <option value="">{t('selectPlaceholder')}</option>
                {connections.filter(c => c.channel === channel).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('fieldTemplate')}</Label>
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="
                  h-9 w-full cursor-pointer rounded-md border border-slate-200
                  bg-white px-3 text-sm
                "
              >
                <option value="">{t('selectPlaceholder')}</option>
                {templates.filter(tObj => tObj.channel === channel).map(tObj => <option key={tObj.id} value={tObj.id}>{tObj.name}</option>)}
              </select>
            </div>
            <div>
              <Label>{t('sendTime')}</Label>
              <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={submit}
              disabled={saving || !name.trim() || !connectionId || !templateId}
              className="cursor-pointer"
            >
              {saving
                ? <Loader2 className="me-2 size-4 animate-spin" />
                : (
                    <Sparkles className="me-2 size-4" />
                  )}
              {' '}
              {t('btnCreate')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="cursor-pointer"
            >
              {t('btnCancel')}
            </Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0)
        ? (
            <Card className="
              rounded-2xl border border-dashed border-slate-300 bg-white p-10
              text-center text-slate-500
            "
            >
              {t('noAutomations')}
            </Card>
          )
        : (
            <div className="space-y-3">
              {rows.map(a => (
                <Card
                  key={a.id}
                  className="
                    rounded-2xl border border-slate-200/80 bg-white p-5
                    shadow-2xs
                  "
                >
                  <div className="
                    flex flex-col justify-between gap-4
                    sm:flex-row sm:items-center
                  "
                  >
                    <div className="flex items-center gap-3">
                      <div className="
                        flex size-10 shrink-0 items-center justify-center
                        rounded-xl bg-[#D1F5E8] text-[#16212B]
                      "
                      >
                        <Sparkles className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#16212B]">{a.name}</p>
                        <p className="text-xs text-slate-500">
                          {getKindLabel(a.kind)}
                          {' '}
                          ·
                          {' '}
                          {t('sendTime')}
                          {' '}
                          {a.sendTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`
                        border
                        ${CHANNEL_BADGE[a.channel]}
                      `}
                      >
                        {getChannelLabel(a.channel)}
                      </Badge>
                      <Badge className={`
                        border
                        ${a.isActive
                  ? `border-emerald-200 bg-emerald-50 text-emerald-700`
                  : `border-slate-200 bg-slate-100 text-slate-500`}
                      `}
                      >
                        {a.isActive ? t('active') : t('inactive')}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggle(a)}
                        className="cursor-pointer"
                      >
                        <Power className="me-1 size-3.5" />
                        {' '}
                        {a.isActive ? t('btnDeactivate') : t('btnActivate')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testRun(a)}
                        className="cursor-pointer"
                      >
                        <Play className="me-1 size-3.5" />
                        {' '}
                        {t('btnRunTest')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRuns(a)}
                        className="cursor-pointer"
                      >
                        {expanded[a.id]
                          ? (
                              <ChevronUp className="size-4" />
                            )
                          : (
                              <ChevronDown className="size-4" />
                            )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="
                          cursor-pointer text-slate-400
                          hover:text-rose-600
                        "
                        onClick={() => del(a)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {expanded[a.id] && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <h3 className="mb-2 text-sm font-semibold text-[#16212B]">{t('runs')}</h3>
                      {(!runs[a.id] || (runs[a.id]?.length ?? 0) === 0) && (
                        <p className="text-sm text-slate-400">
                          {t('noRuns')}
                        </p>
                      )}
                      {runs[a.id]?.map(r => (
                        <div
                          key={r.id}
                          className="
                            mb-2 flex flex-wrap items-center gap-3 rounded-xl
                            border border-slate-100 bg-slate-50/60 px-3 py-2
                            text-sm
                          "
                        >
                          <span className="font-medium text-[#16212B]">{fmtDate(r.runDate, locale)}</span>
                          <Badge className={`
                            border
                            ${r.status === 'completed'
                          ? `border-emerald-200 bg-emerald-50 text-emerald-700`
                          : `border-slate-200 bg-slate-100 text-slate-500`}
                          `}
                          >
                            {r.status === 'completed' ? t('completedStatus') : r.status}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {t('foundCount')}
                            {' '}
                            :
                            {' '}
                            <b>{fmtCount(r.createdCount, locale)}</b>
                          </span>
                          <span className="text-xs text-slate-500">
                            {t('enqueuedCount')}
                            {' '}
                            :
                            {' '}
                            <b>{fmtCount(r.queuedCount, locale)}</b>
                          </span>
                          <span className="text-xs text-slate-500">
                            {t('skippedCount')}
                            {' '}
                            :
                            {' '}
                            <b>{fmtCount(r.skippedCount, locale)}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
    </div>
  );
}
