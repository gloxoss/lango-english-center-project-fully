'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, RefreshCw, Megaphone, AlertCircle, Cable, Users, FileText, CheckCircle2,
} from 'lucide-react';
import { api, CHANNEL_LABELS, CHANNEL_BADGE, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE, fmtDate, fmtCount } from './broadcast-ui';

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

export function BroadcastOverviewView() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? '';
  const [data, setData] = useState<{ connections: number; segments: number; templates: number; campaigns: Campaign[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError('Impossible de charger le tableau de bord de diffusion.');
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
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error ?? 'Erreur inconnue.'}
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  const active = data.campaigns.filter((c) => ['queued', 'sending', 'scheduled'].includes(c.status));
  const completed = data.campaigns.filter((c) => c.status === 'completed');
  const sentTotal = data.campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0);
  const deliveredTotal = data.campaigns.reduce((s, c) => s + (c.deliveredCount ?? 0), 0);

  const recent = [...data.campaigns].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Diffusion & communication</h1>
          <p className="text-sm text-slate-500">Campagnes, audiences, modèles et automations.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Actualiser</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi href={`/${locale}/dashboard/broadcast/connections`} icon={<Cable className="h-5 w-5" />} label="Connexions" value={fmtCount(data.connections)} />
        <Kpi href={`/${locale}/dashboard/broadcast/segments`} icon={<Users className="h-5 w-5" />} label="Segments" value={fmtCount(data.segments)} />
        <Kpi href={`/${locale}/dashboard/broadcast/templates`} icon={<FileText className="h-5 w-5" />} label="Modèles" value={fmtCount(data.templates)} />
        <Kpi href={`/${locale}/dashboard/broadcast/campaigns`} icon={<Megaphone className="h-5 w-5" />} label="Campagnes" value={fmtCount(data.campaigns.length)} accent />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <p className="text-sm text-slate-500">Envois total</p>
          <p className="text-2xl font-bold text-[#16212B]">{fmtCount(sentTotal)}</p>
        </Card>
        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-2xs">
          <p className="text-sm text-emerald-700">Délivrés</p>
          <p className="text-2xl font-bold text-emerald-700">{fmtCount(deliveredTotal)}</p>
        </Card>
        <Card className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-2xs">
          <p className="text-sm text-amber-700">En cours / planifiées</p>
          <p className="text-2xl font-bold text-amber-700">{fmtCount(active.length)}</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-[#16212B]">Campagnes récentes</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Ciblés</th>
                <th className="px-4 py-3">Envoyés</th>
                <th className="px-4 py-3">Délivrés</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucune campagne pour l’instant.</td></tr>
              )}
              {recent.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-[#16212B]">{c.name}</td>
                  <td className="px-4 py-3"><Badge className={`border ${CHANNEL_BADGE[c.channel]}`}>{CHANNEL_LABELS[c.channel]}</Badge></td>
                  <td className="px-4 py-3"><Badge className={`border ${CAMPAIGN_STATUS_BADGE[c.status]}`}>{CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}</Badge></td>
                  <td className="px-4 py-3">{fmtCount(c.targetedCount)}</td>
                  <td className="px-4 py-3">{fmtCount(c.sentCount)}</td>
                  <td className="px-4 py-3 text-emerald-700">{fmtCount(c.deliveredCount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/${locale}/dashboard/broadcast/campaigns/${c.id}`}><Button variant="outline" size="sm">Détail</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Diffusion simulée : aucun SMS/e-mail réel envoyé (fournisseur de test).
      </div>
    </div>
  );
}
