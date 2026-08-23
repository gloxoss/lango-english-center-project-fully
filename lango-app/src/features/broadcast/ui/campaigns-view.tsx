'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, Megaphone, AlertCircle, X, Eye, CheckCircle2, CalendarClock,
} from 'lucide-react';
import { api, CHANNEL_LABELS, CHANNEL_BADGE, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE, fmtDate, fmtCount, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

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
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? '';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Campaign[]>('/api/addons/broadcast/campaigns');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error ?? { message: 'Impossible de charger les campagnes.' });
    setLoading(false);
  }, []);

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
      setFormError(res.error?.message ?? 'Création impossible.');
    }
  };

  const runPreview = async () => {
    if (!campaignId) return;
    setPreviewError(null);
    setPreview(null);
    const res = await api<Preview>(`/api/addons/broadcast/campaigns/${campaignId}/preview`, { method: 'POST' });
    if (res.ok && res.data) setPreview(res.data);
    else setPreviewError(res.error?.message ?? 'Aperçu impossible.');
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
      setFormError(res.error?.message ?? 'Approbation impossible.');
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement des campagnes…</div>;
  }

  if (error && !rows) {
    if (isAddonNotActivated(error)) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error.message ?? 'Module non activé.'}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error.message ?? 'Erreur inconnue.'}
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Campagnes de diffusion</h1>
          <p className="text-sm text-slate-500">Composez, prévisualisez et lancez vos envois groupés.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Nouvelle campagne</Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">Composer une campagne</h2>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCampaignId(null); setPreview(null); }}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Rentrée septembre" />
            </div>
            <div>
              <Label>Canal</Label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label>Connexion</Label>
              <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">— Sélectionner —</option>
                {connections.filter((c) => c.channel === channel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Segment d’audience</Label>
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">— Sélectionner —</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmtCount(s.memberCount)})</option>)}
              </select>
            </div>
            <div>
              <Label>Modèle (facultatif)</Label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">— Aucun —</option>
                {templates.filter((t) => t.channel === channel).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {channel === 'email' && (
              <div>
                <Label>Objet</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Message</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3} placeholder="Bonjour {{firstName}}, …" />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}

          {!campaignId ? (
            <div className="mt-4 flex gap-2">
              <Button onClick={createCampaign} disabled={saving || !name.trim() || !connectionId || !segmentId || !bodyText.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />} Créer la campagne
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Button onClick={runPreview} variant="outline"><Eye className="mr-2 h-4 w-4" /> Prévisualiser l’audience</Button>
                <Button onClick={approve}><CheckCircle2 className="mr-2 h-4 w-4" /> Approuver & lancer</Button>
              </div>
              {previewError && <p className="text-sm text-rose-600">{previewError}</p>}
              {preview && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div><p className="text-xs text-slate-500">Ciblés</p><p className="font-semibold text-[#16212B]">{fmtCount(preview.targeted)}</p></div>
                  <div><p className="text-xs text-slate-500">Envoyables</p><p className="font-semibold text-emerald-700">{fmtCount(preview.enqueued)}</p></div>
                  <div><p className="text-xs text-slate-500">Contact invalide</p><p className="font-semibold text-slate-600">{fmtCount(preview.invalid)}</p></div>
                  <div><p className="text-xs text-slate-500">Consentement</p><p className="font-semibold text-amber-600">{fmtCount(preview.consentExcluded)}</p></div>
                  <div><p className="text-xs text-slate-500">Opposition</p><p className="font-semibold text-amber-600">{fmtCount(preview.suppressionExcluded)}</p></div>
                  <div><p className="text-xs text-slate-500">Doublons</p><p className="font-semibold text-slate-600">{fmtCount(preview.dedup)}</p></div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucune campagne pour l’instant. Composez votre première diffusion.
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Programmée</th>
                <th className="px-4 py-3">Ciblés</th>
                <th className="px-4 py-3">Envoyés</th>
                <th className="px-4 py-3">Délivrés</th>
                <th className="px-4 py-3">Échecs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-[#16212B]">{c.name}</td>
                  <td className="px-4 py-3"><Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{CHANNEL_LABELS[c.channel]}</Badge></td>
                  <td className="px-4 py-3"><Badge className={`border ${CAMPAIGN_STATUS_BADGE[c.status]}`}>{CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{c.scheduleAt ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{fmtDate(c.scheduleAt)}</span> : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#16212B]">{fmtCount(c.targetedCount)}</td>
                  <td className="px-4 py-3">{fmtCount(c.sentCount)}</td>
                  <td className="px-4 py-3 text-emerald-700">{fmtCount(c.deliveredCount)}</td>
                  <td className="px-4 py-3 text-rose-600">{fmtCount(c.failedCount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/${locale}/dashboard/broadcast/campaigns/${c.id}`}>
                      <Button variant="outline" size="sm">Détail</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
