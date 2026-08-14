'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, RefreshCw, Megaphone, AlertCircle, ArrowLeft, CheckCircle2, XCircle,
  Download, Send, RotateCcw, History, CalendarClock, Eye,
} from 'lucide-react';
import {
  api, CHANNEL_LABELS, CHANNEL_BADGE, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE,
  DELIVERY_STATUS_LABELS, RECIPIENT_STATUS_LABELS, RECIPIENT_KIND_LABELS, SKIP_REASON_LABELS,
  fmtDate, fmtCount,
} from './broadcast-ui';

type Campaign = {
  id: string; name: string; channel: string; status: string; scheduleAt: string | null;
  connectionId: string | null; segmentId: string | null; templateId: string | null; bodyText: string;
  targetedCount: number | null; enqueuedCount: number | null; sentCount: number | null;
  deliveredCount: number | null; failedCount: number | null; createdAt: string; updatedAt: string;
};

type Report = {
  name: string; channel: string; status: string; scheduleAt: string | null;
  counts: { targeted: number; enqueued: number; sent: number; delivered: number; failed: number; skipped: number; pending: number; invalid: number; dedup: number; consentExcluded: number; suppressionExcluded: number };
  byStatus: { status: string; n: number }[];
};

type DeliveryEvent = { id: string; eventType: string; status: string; detail: Record<string, unknown> | null; createdAt: string };

type DeliveryRow = {
  recipient: { id: string; recipientKind: string; contactName: string | null; phone: string | null; email: string | null; status: string; skipReason: string | null; createdAt: string };
  delivery: { id: string; status: string; providerRef: string | null; failureReason: string | null; retryCount: number; maxRetries: number; sentAt: string | null; deliveredAt: string | null; failedAt: string | null } | null;
};

const maskContact = (kind: 'phone' | 'email', value: string | null) => {
  if (!value) return '—';
  if (kind === 'phone') return value.length < 6 ? value : `${value.slice(0, 2)}…${value.slice(-2)}`;
  const [local, domain] = value.split('@');
  if (!domain || local === undefined) return value;
  return `${local.slice(0, 2)}***@${domain}`;
};

export function CampaignDetailView({ campaignId: propId }: { campaignId?: string }) {
  const params = useParams<{ locale?: string; id?: string }>();
  const id = propId ?? (params?.id as string | undefined) ?? '';
  const locale = params?.locale ?? '';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [recipients, setRecipients] = useState<DeliveryRow[]>([]);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [events, setEvents] = useState<Record<string, DeliveryEvent[]>>({});
  const [scheduleAt, setScheduleAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const c = await api<Campaign>(`/api/addons/broadcast/campaigns/${id}`);
    if (!c.ok || !c.data) { setError(c.error?.message ?? 'Campagne introuvable.'); setLoading(false); return; }
    setCampaign(c.data);
    const r = await api<Report>(`/api/addons/broadcast/campaigns/${id}/report`);
    if (r.ok && r.data) setReport(r.data);
    const rec = await api<{ rows: DeliveryRow[]; total: number }>(`/api/addons/broadcast/campaigns/${id}/recipients?pageSize=100`);
    if (rec.ok && rec.data) { setRecipients(rec.data.rows); setTotalRecipients(rec.data.total); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: () => Promise<boolean>, okText: string, errText: string) => {
    setBusy(true);
    setActionMsg(null);
    const ok = await action();
    setBusy(false);
    setActionMsg(ok ? { ok: true, text: okText } : { ok: false, text: errText });
    if (ok) load();
  };

  const approve = () => act(async () => (await api(`/api/addons/broadcast/campaigns/${id}/approve`, { method: 'POST' })).ok, 'Campagne approuvée et lancée.', 'Approbation impossible.');
  const cancel = () => act(async () => (await api(`/api/addons/broadcast/campaigns/${id}/cancel`, { method: 'POST' })).ok, 'Campagne annulée.', 'Annulation impossible.');
  const processQueue = () => act(async () => (await api('/api/addons/broadcast/worker/process', { method: 'POST', body: JSON.stringify({ batch: 100 }) })).ok, 'File traitée.', 'Traitement impossible.');
  const runPreview = () => act(async () => (await api(`/api/addons/broadcast/campaigns/${id}/preview`, { method: 'POST' })).ok, 'Aperçu recalculé.', 'Aperçu impossible.');

  const schedule = async () => {
    if (!scheduleAt) return;
    await act(
      async () => (await api(`/api/addons/broadcast/campaigns/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduleAt }) })).ok,
      'Campagne programmée.',
      'Programmation impossible.',
    );
    setScheduleAt('');
  };

  const exportCsv = async () => {
    const res = await fetch(`/api/addons/broadcast/campaigns/${id}/export`, { credentials: 'include' });
    if (!res.ok) { setActionMsg({ ok: false, text: 'Export impossible.' }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campagne-${campaign?.name?.toLowerCase().replace(/\s+/g, '-') ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setActionMsg({ ok: true, text: 'Export CSV téléchargé (contacts masqués).' });
  };

  const showEvents = async (deliveryId: string) => {
    if (events[deliveryId]) { setEvents((prev) => { const n = { ...prev }; delete n[deliveryId]; return n; }); return; }
    const r = await api<DeliveryEvent[]>(`/api/addons/broadcast/deliveries/${deliveryId}/events`);
    if (r.ok && r.data) setEvents((prev) => ({ ...prev, [deliveryId]: r.data ?? [] }));
  };

  const retryDelivery = async (deliveryId: string) => {
    const r = await api(`/api/addons/broadcast/deliveries/${deliveryId}/retry`, { method: 'POST' });
    if (r.ok) { setActionMsg({ ok: true, text: 'Envoi relancé.' }); load(); }
    else setActionMsg({ ok: false, text: r.error?.message ?? 'Relance impossible.' });
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement de la campagne…</div>;
  }

  if (error || !campaign) {
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error ?? 'Campagne introuvable.'}
        <Link href={`/${locale}/dashboard/broadcast/campaigns`}><Button variant="outline" size="sm">Retour</Button></Link>
      </div>
    );
  }

  const counts = report?.counts;
  const editable = campaign.status === 'draft' || campaign.status === 'pending_approval';
  const cancellable = ['pending_approval', 'scheduled', 'queued', 'sending'].includes(campaign.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard/broadcast/campaigns`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#16212B]">{campaign.name}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Badge className={`border ${CHANNEL_BADGE[campaign.channel]}`}>{CHANNEL_LABELS[campaign.channel]}</Badge>
              <Badge className={`border ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}>{CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}</Badge>
              {campaign.scheduleAt && <span className="inline-flex items-center gap-1 text-xs"><CalendarClock className="h-3.5 w-3.5" />{fmtDate(campaign.scheduleAt)}</span>}
              <span className="text-xs">créée le {fmtDate(campaign.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && <Button onClick={approve} disabled={busy}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Approuver & lancer</Button>}
          {cancellable && <Button variant="outline" onClick={cancel} disabled={busy}><XCircle className="mr-1.5 h-4 w-4" /> Annuler</Button>}
          {editable && (
            <>
              <Button variant="outline" onClick={runPreview} disabled={busy}><Eye className="mr-1.5 h-4 w-4" /> Prévisualiser</Button>
              <div className="flex items-center gap-1">
                <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2 text-sm" />
                <Button variant="outline" size="icon" onClick={schedule} disabled={busy || !scheduleAt} title="Programmer"><CalendarClock className="h-4 w-4" /></Button>
              </div>
            </>
          )}
          <Button variant="outline" onClick={processQueue} disabled={busy}><Send className="mr-1.5 h-4 w-4" /> Traiter la file</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" /> Exporter CSV</Button>
          <Button variant="ghost" size="icon" onClick={load} title="Actualiser"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {actionMsg && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${actionMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {actionMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {actionMsg.text}
        </div>
      )}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <p className="text-sm font-medium text-slate-500">Message</p>
        <p className="mt-1 whitespace-pre-wrap text-[#16212B]">{campaign.bodyText || '—'}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Ciblés', value: counts?.targeted },
          { label: 'Envoyables', value: counts?.enqueued },
          { label: 'Envoyés', value: counts?.sent },
          { label: 'Délivrés', value: counts?.delivered },
          { label: 'Échecs', value: counts?.failed },
          { label: 'Exclus', value: counts?.skipped },
          { label: 'En attente', value: counts?.pending },
          { label: 'Cout estimé (SMS)', value: counts?.enqueued },
        ].map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="text-2xl font-bold text-[#16212B]">{kpi.value != null ? fmtCount(kpi.value) : '—'}</p>
          </Card>
        ))}
      </div>

      {counts && (counts.invalid > 0 || counts.consentExcluded > 0 || counts.suppressionExcluded > 0 || counts.dedup > 0) && (
        <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="text-amber-800">Contact invalide : <b>{fmtCount(counts.invalid)}</b></p>
          <p className="text-amber-800">Consentement retiré : <b>{fmtCount(counts.consentExcluded)}</b></p>
          <p className="text-amber-800">Opposition : <b>{fmtCount(counts.suppressionExcluded)}</b></p>
          <p className="text-amber-800">Doublons : <b>{fmtCount(counts.dedup)}</b></p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold text-[#16212B]">Destinataires ({fmtCount(totalRecipients)})</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Motif d’exclusion</th>
                <th className="px-4 py-3">Envoi</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recipients.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Aucun destinataire (campagne non approuvée).</td></tr>
              )}
              {recipients.map((row) => {
                const r = row.recipient;
                const d = row.delivery;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-[#16212B]">{r.contactName ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className="border border-slate-200 bg-slate-50 text-slate-600">{RECIPIENT_KIND_LABELS[r.recipientKind] ?? r.recipientKind}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{r.phone ? maskContact('phone', r.phone) : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{r.email ? maskContact('email', r.email) : '—'}</td>
                    <td className="px-4 py-3">
                      {r.status === 'skipped'
                        ? <Badge className="border border-slate-200 bg-slate-100 text-slate-500">Exclu</Badge>
                        : <Badge className="border border-blue-100 bg-blue-50 text-blue-700">{RECIPIENT_STATUS_LABELS[r.status] ?? r.status}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.skipReason ? (SKIP_REASON_LABELS[r.skipReason] ?? r.skipReason) : '—'}</td>
                    <td className="px-4 py-3">
                      {d ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Badge className={`border ${d.status === 'delivered' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : d.status === 'failed' || d.status === 'bounced' || d.status === 'complained' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {DELIVERY_STATUS_LABELS[d.status] ?? d.status}
                          </Badge>
                          {d.retryCount > 0 && <span className="text-slate-400">×{d.retryCount}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Événements" onClick={() => showEvents(d.id)}><History className="h-3.5 w-3.5" /></Button>
                          {(d.status === 'failed' || d.status === 'bounced') && (
                            <Button variant="ghost" size="icon" title="Relancer" onClick={() => retryDelivery(d.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {Object.entries(events).map(([deliveryId, evs]) => (
          <Card key={deliveryId} className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <h3 className="mb-2 text-sm font-semibold text-[#16212B]">Journal d’envoi</h3>
            <div className="space-y-1 text-sm">
              {evs.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <Badge className={`border ${e.status === 'delivered' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : e.status === 'failed' || e.status === 'bounced' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{DELIVERY_STATUS_LABELS[e.status] ?? e.status}</Badge>
                  <span className="text-xs text-slate-400">{e.eventType}</span>
                  <span className="text-xs text-slate-500">{fmtDate(e.createdAt)}</span>
                  {e.detail && Object.keys(e.detail).length > 0 && <span className="text-xs text-slate-400">{JSON.stringify(e.detail)}</span>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
