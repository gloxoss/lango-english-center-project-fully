'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, Loader2, MessageSquarePlus, Search,
} from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import { api, fmtDateTime } from './reception-api';
import { ReceptionInquiryDialog } from './reception-inquiry-dialog';

type Inquiry = {
  id: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  interestLevel: string | null;
  assignedToId: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

const SOURCE_LABELS: Record<string, string> = {
  walk_in: 'Visite / Accueil',
  phone: 'Téléphone',
  web: 'Site web',
  referral: 'Recommandation',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle',
  contacted: 'Contactée',
  qualified: 'Qualifiée',
  converted: 'Convertie',
  lost: 'Perdue',
};

const INTEREST_LABELS: Record<string, string> = {
  high: 'Élevé',
  medium: 'Moyen',
  low: 'Faible',
};

export function ReceptionInquiriesView() {
  const [data, setData] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<Inquiry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ pageSize: '100', sortBy: 'createdAt', sortDir: 'desc' });
    if (q.trim()) qs.set('q', q.trim());
    if (status !== 'all') qs.set('status', status);
    const res = await api<Inquiry[]>(`/api/reception/inquiries?${qs}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setData(res.data);
      setTotal(res.total ?? 0);
    } else {
      setError(res.error?.message ?? 'Chargement impossible.');
    }
  }, [q, status]);

  useEffect(() => { load(); }, [load]);

  if (loading && data.length === 0) return <PortalStateView state="loading" />;
  if (error && data.length === 0) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>Réessayer</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Renseignements</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Demandes du front office, routing et suivi. La conversion vers une admission relève des Admissions.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
          <MessageSquarePlus className="h-4 w-4" /> Nouvelle demande
        </Button>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="iq-search">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="iq-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, téléphone, email…"
                className="w-56 pl-8"
                aria-label="Rechercher une demande"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iq-status">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="iq-status" className="w-44" aria-label="Filtrer par statut"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="new">Nouvelles</SelectItem>
                <SelectItem value="contacted">Contactées</SelectItem>
                <SelectItem value="qualified">Qualifiées</SelectItem>
                <SelectItem value="lost">Perdues</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto text-xs text-slate-400">{total} demandes</span>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucune demande pour cette sélection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-bold">Contact</th>
                  <th className="py-2 pr-3 font-bold">Canal</th>
                  <th className="py-2 pr-3 font-bold">Intérêt</th>
                  <th className="py-2 pr-3 font-bold">Statut</th>
                  <th className="py-2 pr-3 font-bold">Créée</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((inq) => (
                  <tr key={inq.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-[#16212B]">{inq.contactName}</p>
                      {inq.phone || inq.email ? (
                        <p className="font-mono text-xs text-slate-400">{inq.phone ?? inq.email}</p>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{SOURCE_LABELS[inq.source] ?? inq.source}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{inq.interestLevel ? (INTEREST_LABELS[inq.interestLevel] ?? inq.interestLevel) : '—'}</td>
                    <td className="py-2.5 pr-3">
                      <Badge className={inq.status === 'lost' ? 'bg-slate-100 text-slate-500' : 'bg-[#DCEBF4] text-[#1B6C93]'}>
                        {STATUS_LABELS[inq.status] ?? inq.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{fmtDateTime(inq.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setFollowUpTarget(inq)}>
                        <MessageSquarePlus className="h-3 w-3" /> Suivi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReceptionInquiryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => { setCreateOpen(false); load(); }}
      />

      <FollowUpDialog
        inquiry={followUpTarget}
        onClose={() => setFollowUpTarget(null)}
        onDone={() => { setFollowUpTarget(null); load(); setActionMsg('Suivi enregistré.'); }}
      />
    </div>
  );
}

function FollowUpDialog({ inquiry, onClose, onDone }: {
  inquiry: Inquiry | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState('call');
  const [notes, setNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inquiry) { setType('call'); setNotes(''); setScheduledFor(''); setError(null); }
  }, [inquiry]);

  if (!inquiry) return null;

  const submit = async () => {
    if (!notes.trim()) {
      setError('Les notes de suivi sont obligatoires.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api(`/api/reception/inquiries/${inquiry.id}/follow-ups`, {
      method: 'POST',
      body: {
        type,
        notes: notes.trim(),
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? 'Enregistrement impossible.');
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="followup-desc">
        <DialogHeader>
          <DialogTitle>Suivi · {inquiry.contactName}</DialogTitle>
          <DialogDescription id="followup-desc">
            Tracer un appel, un email ou un rendez-vous de suivi. La conversion en candidature reste du ressort des Admissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fu-type">Type de suivi</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="fu-type" aria-label="Type de suivi"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Appel</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Rendez-vous</SelectItem>
                  <SelectItem value="visit">Visite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-when">Planifié pour</Label>
              <Input id="fu-when" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-notes">Notes *</Label>
            <Textarea id="fu-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Résumé de l'échange, prochaine étape…" />
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-rose-600" role="alert"><AlertCircle className="h-4 w-4" />{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Fermer</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-1 h-4 w-4" />} Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
