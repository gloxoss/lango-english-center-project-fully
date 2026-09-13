'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, Plug, Zap, AlertCircle, X, CheckCircle2, Cable,
} from 'lucide-react';
import { api, CHANNEL_BADGE, CONNECTION_STATUS_BADGE, fmtDate, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

type Connection = {
  id: string;
  channel: string;
  name: string;
  provider: string;
  status: string;
  lastTestedAt: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const CHANNELS = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];
// Secret keys are never returned by the API; the create form still offers the
// fields so a real adapter can be configured when one is added.
const SECRET_FIELDS: Record<string, string[]> = {
  sms: ['apiKey', 'sender'],
  email: ['fromAddress', 'password'],
  whatsapp: ['apiKey', 'phoneNumberId'],
  telegram: ['token'],
  messenger: ['accessToken', 'phoneNumberId'],
};

export function ConnectionsView() {
  const t = useTranslations('Broadcast');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [rows, setRows] = useState<Connection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ channel: 'sms', name: '', provider: 'test', apiKey: '', sender: '' });
  const [formError, setFormError] = useState<string | null>(null);

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

  const getSecretLabel = (k: string) => {
    switch (k) {
      case 'apiKey': return t('fieldApiKey');
      case 'sender': return t('fieldSender');
      case 'fromAddress': return t('fieldFromAddress');
      case 'password': return t('fieldPassword');
      case 'phoneNumberId': return t('fieldPhoneNumberId');
      case 'token': return t('fieldToken');
      case 'accessToken': return t('fieldAccessToken');
      default: return k;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Connection[]>('/api/addons/broadcast/connections');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error ?? { message: t('addonNotActivated') });
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const testConn = async (id: string) => {
    const res = await api<{ ok: boolean; message?: string }>(`/api/addons/broadcast/connections/${id}/test`, { method: 'POST' });
    if (res.ok) load();
  };

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const config: Record<string, unknown> = {};
    for (const k of SECRET_FIELDS[form.channel ?? 'sms'] ?? []) {
      if (form[k]) config[k] = form[k];
    }
    const res = await api<Connection>('/api/addons/broadcast/connections', {
      method: 'POST',
      body: JSON.stringify({ channel: form.channel, name: form.name, provider: form.provider, config }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ channel: 'sms', name: '', provider: 'test', apiKey: '', sender: '' });
      load();
    } else {
      setFormError(res.error?.message ?? t('addonNotActivated'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> {tCommon('loading')}
      </div>
    );
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
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />{tCommon('retry')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('connectionsTitle')}</h1>
          <p className="text-sm text-slate-500">{t('connectionsSubtitle')}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="cursor-pointer">
          <Plus className="me-2 h-4 w-4" /> {t('btnNewConnection')}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">{t('btnNewConnection')}</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="cursor-pointer"><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t('colName')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('connectionName')} />
            </div>
            <div>
              <Label>{t('colChannel')}</Label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer"
              >
                {CHANNELS.map((c) => <option key={c} value={c}>{getChannelLabel(c)}</option>)}
              </select>
            </div>
            {(SECRET_FIELDS[form.channel ?? 'sms'] ?? []).map((k) => (
              <div key={k}>
                <Label>{getSecretLabel(k)}</Label>
                <Input type={k === 'password' ? 'password' : 'text'} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={saving || !(form.name ?? '').trim()} className="cursor-pointer">
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Cable className="me-2 h-4 w-4" />} {t('btnCreate')}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="cursor-pointer">{t('btnCancel')}</Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {t('noConnections')}
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('colName')}</th>
                  <th className="px-4 py-3 text-start">{t('colChannel')}</th>
                  <th className="px-4 py-3 text-start">{t('provider')}</th>
                  <th className="px-4 py-3 text-start">{t('colStatus')}</th>
                  <th className="px-4 py-3 text-start">{t('config')}</th>
                  <th className="px-4 py-3 text-start">{t('tested')}</th>
                  <th className="px-4 py-3 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-[#16212B] text-start">{c.name}</td>
                    <td className="px-4 py-3 text-start"><Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{getChannelLabel(c.channel)}</Badge></td>
                    <td className="px-4 py-3 text-start">{c.provider}</td>
                    <td className="px-4 py-3 text-start">
                      <Badge className={`border ${CONNECTION_STATUS_BADGE[c.status]}`}>
                        {c.status === 'connected' ? t('statusConnected') : c.status === 'disconnected' ? t('statusDisconnected') : t('statusError')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 text-start">{Object.entries(c.config ?? {}).map(([k, v]) => `${k}=${String(v)}`).join(' · ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-start">{fmtDate(c.lastTestedAt, locale)}</td>
                    <td className="px-4 py-3 text-end">
                      <Button variant="outline" size="sm" onClick={() => testConn(c.id)} className="cursor-pointer">
                        <Zap className="me-1 h-3.5 w-3.5" /> {t('btnTest')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {t('simulationNotice')}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <Plug className="h-4 w-4 shrink-0" /> {error.message}
        </div>
      )}
    </div>
  );
}
