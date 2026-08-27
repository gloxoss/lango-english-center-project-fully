'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileCheck2, Download, Ban, Repeat2, ArrowLeft, Loader2 } from 'lucide-react';

type CertificateEvent = {
  id: string;
  eventKind: 'issued' | 'replaced' | 'revoked';
  actorId: string;
  reason: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type Detail = {
  id: string;
  definitionId: string;
  versionId: string;
  recipientId: string;
  serialNumber: string;
  status: 'valid' | 'replaced' | 'revoked';
  evidenceSnapshot?: unknown;
  issuedBy: string;
  issuedAt: string;
  definitionTitle: string;
  definitionAllowedTargetType: string;
  recipientName: string | null;
  versionNumber: number;
  events: CertificateEvent[];
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' | 'warning' }> = {
  valid: { label: 'Valide', variant: 'success' },
  revoked: { label: 'Révoqué', variant: 'danger' },
  replaced: { label: 'Remplacé', variant: 'neutral' },
};

const EVENT_LABELS: Record<string, { label: string, tint: string }> = {
  issued: { label: 'Certificat émis', tint: 'bg-emerald-500' },
  replaced: { label: 'Remplacé', tint: 'bg-[#0EA5C4]' },
  revoked: { label: 'Révoqué', tint: 'bg-rose-500' },
};

export default function IssuedCertificateDetailPage() {
  const params = useParams<{ locale?: string; id?: string }>();
  const locale = params?.locale ?? 'fr';
  const id = params?.id ?? '';
  const router = useRouter();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState('');
  const [replacing, setReplacing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/certificates/issued/${id}`).then(r => r.json());
      if (res.success) setDetail(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/certificates/issued/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) alert(json.message || json.error?.message || 'Erreur lors de la révocation');
      setRevokeOpen(false);
      setRevokeReason('');
      await load();
    } finally {
      setRevoking(false);
    }
  };

  const handleReplace = async () => {
    setReplacing(true);
    try {
      const res = await fetch(`/api/certificates/issued/${id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: replaceReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) alert(json.message || json.error?.message || 'Erreur lors du remplacement');
      setReplaceOpen(false);
      setReplaceReason('');
      await load();
    } finally {
      setReplacing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Chargement...</div>;
  }

  if (!detail) {
    return <div className="p-8 text-center text-red-500">Certificat introuvable.</div>;
  }

  const meta = detail.events[detail.events.length - 1]?.metadata as { render?: Record<string, string> } | null;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Certificat {detail.serialNumber}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {detail.definitionTitle} • {detail.recipientName ?? '—'} • version {detail.versionNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/certificates/issued/${detail.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-1.5" />PDF
          </a>
          {detail.status === 'valid' && (
            <>
              <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-medium cursor-pointer text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => { setReplaceOpen(true); setReplaceReason(''); }}>
                <Repeat2 className="w-4 h-4 mr-1.5" />Remplacer
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { setRevokeOpen(true); setRevokeReason(''); }}>
                <Ban className="w-4 h-4 mr-1.5" />Révoquer
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary */}
        <Card className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <h2 className="text-sm font-extrabold text-[#16212B]">Informations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bénéficiaire</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">{detail.recipientName ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Définition</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">{detail.definitionTitle}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">N° série</p>
              <p className="text-sm font-mono font-bold text-slate-700 mt-0.5">{detail.serialNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Version</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">v{detail.versionNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statut</p>
              <p className="mt-1">
                <Badge variant={STATUS_BADGE[detail.status]?.variant || 'neutral'}>
                  {STATUS_BADGE[detail.status]?.label || detail.status}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Émis le</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">
                {new Date(detail.issuedAt).toLocaleDateString('fr-FR')} à {new Date(detail.issuedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          {meta?.render && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Données de rendu</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {Object.entries(meta.render).filter(([k]) => k !== 'qrCode').map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[10px] text-slate-400 font-mono">{k}</span>
                    <span className="text-xs text-slate-600 ml-1.5 break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Timeline */}
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#16212B] mb-4">Journal des événements</h2>
          <div className="space-y-0">
            {detail.events.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Aucun événement.</p>
            ) : (
              detail.events.map((ev, i) => (
                <div key={ev.id} className="flex gap-3 pb-5 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${EVENT_LABELS[ev.eventKind]?.tint || 'bg-slate-300'} shrink-0 mt-0.5`} />
                    {i < detail.events.length - 1 && <div className="w-px flex-1 bg-slate-100" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-xs font-bold text-slate-700">{EVENT_LABELS[ev.eventKind]?.label || ev.eventKind}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(ev.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {ev.reason && <p className="text-[10px] text-slate-500 mt-0.5">{ev.reason}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Link href={`/${locale}/dashboard/certificates/issued`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2487B8] hover:underline">
        <ArrowLeft className="w-4 h-4" />Retour aux certificats émis
      </Link>

      {/* Revoke dialog */}
      <Dialog open={revokeOpen} onOpenChange={(o) => { if (!o && !revoking) setRevokeOpen(false); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Révoquer le certificat</DialogTitle>
            <DialogDescription>Un certificat révoqué n'est plus vérifiable.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-bold text-slate-700">Motif (optionnel)</Label>
            <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} rows={3} maxLength={500} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)} className="text-xs h-9 cursor-pointer" disabled={revoking}>Annuler</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 className="w-4 h-4 animate-spin" />}
              {revoking ? 'Révocation...' : 'Révoquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace dialog */}
      <Dialog open={replaceOpen} onOpenChange={(o) => { if (!o && !replacing) setReplaceOpen(false); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Remplacer le certificat</DialogTitle>
            <DialogDescription>Un nouveau certificat sera émis et l'original marqué « remplacé ».</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-bold text-slate-700">Motif (optionnel)</Label>
            <textarea value={replaceReason} onChange={e => setReplaceReason(e.target.value)} rows={3} maxLength={500} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceOpen(false)} className="text-xs h-9 cursor-pointer" disabled={replacing}>Annuler</Button>
            <Button className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleReplace} disabled={replacing}>
              {replacing && <Loader2 className="w-4 h-4 animate-spin" />}
              {replacing ? 'Remplacement...' : 'Remplacer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
