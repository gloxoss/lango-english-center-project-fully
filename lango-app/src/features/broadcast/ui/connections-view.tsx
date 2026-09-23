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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2, Plus, RefreshCw, Plug, Zap, AlertCircle, X, CheckCircle2, Cable,
  Send, Trash2, Smartphone, MessageSquare, Mail, Globe, Info, QrCode,
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

const CHANNELS = ['sms', 'whatsapp', 'email', 'telegram', 'messenger'] as const;
type Channel = (typeof CHANNELS)[number];

type ProviderDef = {
  id: string;
  label: string;
  channels: Channel[];
  tag: string;
  tagColor: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    type?: 'text' | 'password';
    help?: string;
  }>;
};

const PROVIDER_DEFS: Record<string, ProviderDef> = {
  'android-sms': {
    id: 'android-sms',
    label: 'Relais SMS Android (Textbee / SMSGate)',
    channels: ['sms'],
    tag: '100% Gratuit',
    tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Envoi de SMS réels via un smartphone Android muni d\'une SIM Maroc Telecom, Orange ou Inwi.',
    fields: [
      { key: 'endpointUrl', label: 'URL Passerelle Android SMS', placeholder: 'https://api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms ou http://192.168.1.50:8080/send-sms', help: 'URL du service ou IP locale de votre smartphone' },
      { key: 'apiKey', label: 'Clé d\'API / Token Relais', placeholder: 'Token d\'accès configuré sur le téléphone', type: 'password' },
      { key: 'deviceId', label: 'Identifiant Appareil (Device ID - optionnel)', placeholder: 'Ex: 65a8d4c...' },
      { key: 'simSlot', label: 'Emplacement SIM (1 ou 2)', placeholder: '1' },
    ],
  },
  'whatsapp-waha': {
    id: 'whatsapp-waha',
    label: 'WhatsApp Gateway (WAHA / Baileys)',
    channels: ['whatsapp'],
    tag: 'Passerelle Dédiée (QR Code)',
    tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Passerelle WhatsApp connectée via scan de code QR depuis WhatsApp Web sur le smartphone officiel de votre établissement. Chaque école dispose de sa propre session isolée.',
    fields: [
      { key: 'endpointUrl', label: 'URL Serveur WAHA', placeholder: 'http://schoolos-waha:3000 ou http://127.0.0.1:3008', help: 'Sur le VPS SchoolOS de production : http://schoolos-waha:3000' },
      { key: 'apiKey', label: 'Clé secrète WAHA', placeholder: '••••••••', type: 'password', help: 'Clé API WAHA de l\'établissement (variable WAHA_API_KEY du serveur)' },
      { key: 'session', label: 'Nom de Session WhatsApp (Optionnel)', placeholder: 'Automatique par établissement (ex: ecole_al_amal)', help: 'Par défaut, SchoolOS génère une session dédiée et isolée pour votre établissement.' },
    ],
  },
  'smsto': {
    id: 'smsto',
    label: 'SMS.to Gateway',
    channels: ['sms'],
    tag: 'Low-cost Maroc',
    tagColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Passerelle SMS Cloud professionnelle économique vers tous les opérateurs marocains.',
    fields: [
      { key: 'apiKey', label: 'Clé d\'API SMS.to', placeholder: 'Clé API générée sur sms.to', type: 'password' },
      { key: 'senderId', label: 'Nom Expéditeur (Sender ID)', placeholder: 'SchoolOS' },
    ],
  },
  'twilio': {
    id: 'twilio',
    label: 'Twilio Cloud',
    channels: ['sms', 'whatsapp'],
    tag: 'Cloud International',
    tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Plateforme mondiale pour l\'envoi de SMS et messages WhatsApp certifiés.',
    fields: [
      { key: 'accountSid', label: 'Account SID Twilio', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token Twilio', placeholder: 'Token d\'authentification Twilio', type: 'password' },
      { key: 'fromNumber', label: 'Numéro Expéditeur', placeholder: '+1234567890 ou Sender ID' },
    ],
  },
  'resend': {
    id: 'resend',
    label: 'Resend Email',
    channels: ['email'],
    tag: '3 000 emails/mois gratuits',
    tagColor: 'bg-violet-100 text-violet-800 border-violet-300',
    description: 'Service d\'email moderne pour notifications scolaires, bulletins et reçus de paiement.',
    fields: [
      { key: 'apiKey', label: 'Clé d\'API Resend', placeholder: 're_123456789...', type: 'password' },
      { key: 'fromAddress', label: 'Email Expéditeur', placeholder: 'SchoolOS <notifications@votre-ecole.ma>' },
    ],
  },
  'brevo': {
    id: 'brevo',
    label: 'Brevo (Sendinblue)',
    channels: ['email'],
    tag: '300 emails/jour gratuits',
    tagColor: 'bg-sky-100 text-sky-800 border-sky-300',
    description: 'Fournisseur d\'emails transactionnels avec 9 000 emails gratuits chaque mois.',
    fields: [
      { key: 'apiKey', label: 'Clé d\'API Brevo (v3)', placeholder: 'xkeysib-...', type: 'password' },
      { key: 'fromAddress', label: 'Email Expéditeur', placeholder: 'contact@votre-ecole.ma' },
      { key: 'fromName', label: 'Nom Expéditeur', placeholder: 'Groupe Scolaire Atlas' },
    ],
  },
  'webhook': {
    id: 'webhook',
    label: 'Webhook HTTP Personnalisé',
    channels: ['sms', 'email', 'whatsapp', 'telegram', 'messenger'],
    tag: 'API Personnalisée',
    tagColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Transmet chaque notification en requête POST JSON vers votre propre serveur ou passerelle.',
    fields: [
      { key: 'url', label: 'URL du Webhook', placeholder: 'https://votre-api.com/webhooks/sms' },
      { key: 'method', label: 'Méthode HTTP', placeholder: 'POST' },
    ],
  },
  'test': {
    id: 'test',
    label: 'Simulateur Interne (Mode Test)',
    channels: ['sms', 'email', 'whatsapp', 'telegram', 'messenger'],
    tag: 'Simulation Locale',
    tagColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Journalise les envois dans la base de données sans déclencher d\'appel réseau extérieur.',
    fields: [],
  },
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

  // Form state
  const [selectedChannel, setSelectedChannel] = useState<Channel>('sms');
  const [selectedProvider, setSelectedProvider] = useState<string>('android-sms');
  const [connName, setConnName] = useState('');
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Action states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  // Live send test dialog state
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [activeSendConn, setActiveSendConn] = useState<Connection | null>(null);
  const [testRecipient, setTestRecipient] = useState('+212');
  const [testBody, setTestBody] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendTestResult, setSendTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // WAHA Live QR Modal state
  const [wahaQrOpen, setWahaQrOpen] = useState(false);
  const [wahaQrConn, setWahaQrConn] = useState<Connection | null>(null);
  const [wahaQrData, setWahaQrData] = useState<{ ok: boolean; status: string; qrDataUrl?: string; message?: string; session?: string } | null>(null);
  const [wahaQrLoading, setWahaQrLoading] = useState(false);

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

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'sms': return <Smartphone className="h-4 w-4 text-emerald-600" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'email': return <Mail className="h-4 w-4 text-sky-600" />;
      default: return <Globe className="h-4 w-4 text-slate-500" />;
    }
  };

  // Available providers for currently selected channel
  const availableProviders = Object.values(PROVIDER_DEFS).filter((p) => p.channels.includes(selectedChannel));

  // Whenever channel changes, pick first valid provider
  const handleChannelChange = (ch: Channel) => {
    setSelectedChannel(ch);
    const valid = Object.values(PROVIDER_DEFS).filter((p) => p.channels.includes(ch));
    const firstProvider = valid[0]?.id ?? 'test';
    setSelectedProvider(firstProvider);
    setConfigFields({});
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
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; message?: string }>(`/api/addons/broadcast/connections/${id}/test`, { method: 'POST' });
      if (res.ok && res.data) {
        setTestResult({ id, ok: res.data.ok, message: res.data.message || (res.data.ok ? 'Connexion réussie.' : 'Échec du test.') });
        load();
      } else {
        setTestResult({ id, ok: false, message: res.error?.message || 'Erreur lors du test de connexion.' });
      }
    } finally {
      setTestingId(null);
    }
  };

  const deleteConn = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette passerelle ?')) return;
    const res = await api(`/api/addons/broadcast/connections/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
    } else {
      alert(res.error?.message || 'Impossible de supprimer la connexion.');
    }
  };

  const openSendTest = (conn: Connection) => {
    setActiveSendConn(conn);
    setTestRecipient(conn.channel === 'email' ? 'admin@ecole.ma' : '+2126');
    setTestBody(`Notification test SchoolOS depuis ${conn.name} (${conn.provider}).`);
    setSendTestResult(null);
    setSendTestOpen(true);
  };

  const submitSendTest = async () => {
    if (!activeSendConn) return;
    setSendingTest(true);
    setSendTestResult(null);
    try {
      const res = await api<{ ok: boolean; status?: string; failureReason?: string; providerRef?: string }>(
        `/api/addons/broadcast/connections/${activeSendConn.id}/send-test`,
        {
          method: 'POST',
          body: JSON.stringify({
            to: testRecipient,
            message: testBody,
          }),
        }
      );

      if (res.ok && res.data?.ok) {
        setSendTestResult({
          ok: true,
          message: `Message expédié avec succès ! Réf: ${res.data.providerRef || res.data.status}`,
        });
      } else {
        setSendTestResult({
          ok: false,
          message: `Échec d'envoi : ${res.data?.failureReason || res.error?.message || 'Erreur inconnue'}`,
        });
      }
    } catch (e: any) {
      setSendTestResult({ ok: false, message: e?.message || 'Erreur réseau.' });
    } finally {
      setSendingTest(false);
    }
  };

  const fetchWahaQr = useCallback(async (conn: Connection) => {
    try {
      // Security audit P0-A: endpoint/key/session are resolved server-side from
      // the tenant's stored connection — the client sends only the id.
      const params = new URLSearchParams({ connectionId: conn.id });

      const res = await fetch(`/api/addons/broadcast/waha/qr?${params.toString()}`);
      const json = await res.json();
      setWahaQrData(json);
      if (json.status === 'CONNECTED' || json.status === 'WORKING') {
        load();
      }
    } catch (e: any) {
      setWahaQrData({ ok: false, status: 'ERROR', message: e?.message || 'Impossible de joindre le serveur WAHA' });
    } finally {
      setWahaQrLoading(false);
    }
  }, [load]);

  const openWahaQr = (conn: Connection) => {
    setWahaQrConn(conn);
    setWahaQrData(null);
    setWahaQrLoading(true);
    setWahaQrOpen(true);
    fetchWahaQr(conn);
  };

  useEffect(() => {
    if (!wahaQrOpen || !wahaQrConn) return;
    if (wahaQrData?.status === 'CONNECTED' || wahaQrData?.status === 'WORKING') return;

    const timer = setInterval(() => {
      fetchWahaQr(wahaQrConn);
    }, 3500);

    return () => clearInterval(timer);
  }, [wahaQrOpen, wahaQrConn, wahaQrData?.status, fetchWahaQr]);

  const submitCreate = async () => {
    setSaving(true);
    setFormError(null);

    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(configFields)) {
      if (v.trim()) config[k] = v.trim();
    }

    const res = await api<Connection>('/api/addons/broadcast/connections', {
      method: 'POST',
      body: JSON.stringify({
        channel: selectedChannel,
        name: connName.trim() || `${PROVIDER_DEFS[selectedProvider]?.label ?? selectedProvider} (${selectedChannel.toUpperCase()})`,
        provider: selectedProvider,
        config,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setConnName('');
      setConfigFields({});
      load();
    } else {
      setFormError(res.error?.message ?? t('addonNotActivated'));
    }
  };

  const curDef = PROVIDER_DEFS[selectedProvider] ?? PROVIDER_DEFS.test;

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('connectionsTitle')}</h1>
          <p className="text-sm text-slate-500">{t('connectionsSubtitle')}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="me-2 h-4 w-4" /> {t('btnNewConnection')}
        </Button>
      </div>

      {/* Test feedback banner */}
      {testResult && (
        <div className={`flex items-center justify-between gap-2 rounded-xl border p-4 text-sm ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <div className="flex items-center gap-2">
            {testResult.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />}
            <span>{testResult.message}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setTestResult(null)}><X className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Creation form */}
      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-bold text-[#16212B]">Configurer une nouvelle passerelle</h2>
              <p className="text-xs text-slate-500">Connectez vos canaux WhatsApp, SMS cellulaires ou Email pour des notifications réelles.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="cursor-pointer"><X className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-5">
            {/* Step 1: Channel selection */}
            <div>
              <Label className="font-semibold text-slate-700">1. Canal de communication</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => handleChannelChange(ch)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition cursor-pointer ${selectedChannel === ch ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-2xs font-semibold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                  >
                    {getChannelIcon(ch)}
                    {getChannelLabel(ch)}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Provider selection */}
            <div>
              <Label className="font-semibold text-slate-700">2. Choisir la passerelle / fournisseur</Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableProviders.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedProvider(p.id); setConfigFields({}); }}
                    className={`rounded-xl border p-3.5 cursor-pointer transition flex flex-col justify-between ${selectedProvider === p.id ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[#16212B]">{p.label}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${p.tagColor}`}>{p.tag}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Connection Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="font-semibold text-slate-700">{t('colName')}</Label>
                <Input
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  placeholder={`Ex: ${curDef?.label ?? 'Passerelle'} Principale`}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Step 3: Provider specific configuration fields */}
            {curDef && curDef.fields.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <Info className="h-4 w-4 text-blue-600" />
                  Paramètres de configuration : {curDef.label}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {curDef.fields.map((f) => (
                    <div key={f.key} className={f.key === 'endpointUrl' || f.key === 'url' ? 'sm:col-span-2' : ''}>
                      <Label className="text-xs font-semibold text-slate-700">{f.label}</Label>
                      <Input
                        type={f.type ?? 'text'}
                        value={configFields[f.key] ?? ''}
                        onChange={(e) => setConfigFields({ ...configFields, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className="mt-1 bg-white"
                      />
                      {f.help && <p className="mt-1 text-[11px] text-slate-500">{f.help}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {formError && <p className="mt-4 text-sm text-rose-600 font-medium">{formError}</p>}

          <div className="mt-6 flex gap-2 border-t pt-4">
            <Button onClick={submitCreate} disabled={saving} className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Cable className="me-2 h-4 w-4" />}
              {t('btnCreate')}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="cursor-pointer">{t('btnCancel')}</Button>
          </div>
        </Card>
      )}

      {/* Existing connections table */}
      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          <Smartphone className="mx-auto h-10 w-10 text-slate-400 mb-3" />
          <p className="font-semibold text-slate-700">Aucune passerelle configurée</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Ajoutez votre smartphone Android, votre QR code WhatsApp ou un compte SMS.to/Twilio/Resend pour commencer les envois en direct.
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-4 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            <Plus className="me-2 h-4 w-4" /> Configurer une passerelle
          </Button>
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
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const pDef = PROVIDER_DEFS[c.provider];
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-[#16212B] text-start">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(c.channel)}
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{getChannelLabel(c.channel)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs text-slate-800">{pDef?.label ?? c.provider}</span>
                          {pDef && <span className="text-[10px] text-slate-500">{pDef.tag}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <Badge className={`border ${CONNECTION_STATUS_BADGE[c.status]}`}>
                          {c.status === 'connected' ? t('statusConnected') : c.status === 'disconnected' ? t('statusDisconnected') : t('statusError')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 text-start">
                        {Object.entries(c.config ?? {}).map(([k, v]) => `${k}=${String(v)}`).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-start text-xs">
                        {fmtDate(c.lastTestedAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testConn(c.id)}
                            disabled={testingId === c.id}
                            className="cursor-pointer"
                            title="Tester la connexion"
                          >
                            {testingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-600" />}
                            <span className="ms-1 hidden sm:inline">{t('btnTest')}</span>
                          </Button>

                          {c.provider === 'whatsapp-waha' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openWahaQr(c)}
                              className="cursor-pointer text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
                              title="Scanner le code QR WhatsApp"
                            >
                              <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="ms-1 hidden sm:inline">QR Code</span>
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSendTest(c)}
                            className="cursor-pointer text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                            title="Envoyer un message de test en direct"
                          >
                            <Send className="h-3.5 w-3.5 text-blue-600" />
                            <span className="ms-1 hidden sm:inline">Test Direct</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConn(c.id)}
                            className="cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live test message modal */}
      <Dialog open={sendTestOpen} onOpenChange={setSendTestOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#16212B]">
              <Send className="h-5 w-5 text-blue-600" />
              Tester l'envoi en direct
            </DialogTitle>
          </DialogHeader>

          {activeSendConn && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div><strong>Passerelle :</strong> {activeSendConn.name} ({activeSendConn.provider})</div>
                <div><strong>Canal :</strong> {getChannelLabel(activeSendConn.channel)}</div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  {activeSendConn.channel === 'email' ? 'Adresse email destinataire' : 'Numéro de téléphone destinataire'}
                </Label>
                <Input
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder={activeSendConn.channel === 'email' ? 'votre-email@exemple.com' : '+2126XXXXXXXX'}
                  className="mt-1 font-mono text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {activeSendConn.channel === 'email' ? 'Un email de test sera expédié via la passerelle.' : 'Format marocain : 06XXXXXXXX ou +2126XXXXXXXX.'}
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Contenu du message</Label>
                <textarea
                  rows={3}
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2.5 text-sm"
                />
              </div>

              {sendTestResult && (
                <div className={`rounded-xl border p-3 text-xs ${sendTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  {sendTestResult.message}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              onClick={submitSendTest}
              disabled={sendingTest || !testRecipient.trim()}
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sendingTest ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
              Expédier le test
            </Button>
            <Button variant="outline" onClick={() => setSendTestOpen(false)} className="cursor-pointer">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WAHA Live QR Modal */}
      <Dialog open={wahaQrOpen} onOpenChange={setWahaQrOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold text-[#16212B]">
              <QrCode className="h-5 w-5 text-emerald-600" />
              Appairer WhatsApp (Code QR)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-slate-500">
                Ouvrez WhatsApp sur le smartphone de votre école &gt; <strong>Appareils connectés</strong> &gt; <strong>Connecter un appareil</strong> &gt; Pointez la caméra sur ce code QR.
              </p>
              {wahaQrData?.session && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-600 mt-1">
                  <span>Session isolée :</span>
                  <strong className="text-emerald-700">{wahaQrData.session}</strong>
                </div>
              )}
            </div>

            {wahaQrLoading && !wahaQrData ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="text-xs text-slate-500 font-medium">Connexion au serveur WAHA &amp; génération du QR...</span>
              </div>
            ) : wahaQrData?.status === 'CONNECTED' || wahaQrData?.status === 'WORKING' ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h3 className="font-bold text-sm">WhatsApp est connecté et actif !</h3>
                <p className="text-xs text-emerald-700">Votre passerelle est opérationnelle pour l&apos;envoi automatique des notifications.</p>
              </div>
            ) : wahaQrData?.qrDataUrl ? (
              <div className="space-y-3">
                <div className="inline-block p-3 rounded-2xl border-2 border-emerald-100 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wahaQrData.qrDataUrl}
                    alt="Code QR WhatsApp"
                    className="w-64 h-64 mx-auto rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                  <span>En attente de scan... (actualisation automatique)</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {wahaQrData?.message || "En attente du service WAHA..."}
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => wahaQrConn && openWahaQr(wahaQrConn)}
                    className="text-xs cursor-pointer"
                  >
                    Réessayer
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => setWahaQrOpen(false)} className="cursor-pointer text-xs">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info notice */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>Toutes les passerelles réelles (WhatsApp WAHA, Android SMS, Twilio, SMS.to, Resend, Brevo) transmettent les messages en temps réel. Le simulateur local permet de tester sans frais réseau.</span>
      </div>
    </div>
  );
}
