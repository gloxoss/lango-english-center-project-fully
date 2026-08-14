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
  AlertCircle, CheckCircle2, ListTodo, Loader2, Plus, UserCheck, XCircle,
} from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import {
  api, fmtDateTime, HANDOFF_PRIORITY_LABELS, HANDOFF_STATUS_LABELS, type Handoff,
} from './reception-api';

type Staff = { id: string; name: string; role: string };

const CATEGORY_LABELS: Record<string, string> = {
  admissions: 'Admissions',
  finance: 'Finance',
  teacher: 'Enseignant',
  admin: 'Administration',
  security: 'Sécurité',
};

export function ReceptionHandoffsView() {
  const [data, setData] = useState<Handoff[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [resolving, setResolving] = useState<Handoff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ pageSize: '100' });
    if (status !== 'all') qs.set('status', status);
    if (assignedToMe) qs.set('assignedToMe', 'true');
    const res = await api<Handoff[]>(`/api/reception/handoffs?${qs}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setData(res.data);
      setTotal(res.total ?? 0);
    } else {
      setError(res.error?.message ?? 'Chargement impossible.');
    }
  }, [status, assignedToMe]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'acknowledge' | 'cancel', body: Record<string, unknown> = {}) => {
    setActionMsg(null);
    const res = await api(`/api/reception/handoffs/${id}/${action}`, { method: 'POST', body });
    if (!res.ok) {
      setActionMsg(res.error?.message ?? 'Action impossible.');
      return;
    }
    setActionMsg('Action effectuée.');
    load();
  };

  const openCreate = () => {
    loadStaff(setStaff);
    setCreateOpen(true);
  };

  if (loading && data.length === 0) return <PortalStateView state="loading" />;
  if (error && data.length === 0) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>Réessayer</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Transferts &amp; tâches</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Coordonner une demande vers Admissions, Finance, un enseignant, l&apos;administration ou la sécurité.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
          <Plus className="h-4 w-4" /> Nouvelle tâche
        </Button>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hf-status">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="hf-status" className="w-44" aria-label="Filtrer par statut"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="open">Ouvertes</SelectItem>
                <SelectItem value="acknowledged">Prise en charge</SelectItem>
                <SelectItem value="resolved">Résolues</SelectItem>
                <SelectItem value="cancelled">Annulées</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={assignedToMe ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssignedToMe((v) => !v)}
            className="gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" /> Mes tâches
          </Button>
          <span className="ml-auto text-xs text-slate-400">{total} tâches</span>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucune tâche pour cette sélection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-bold">Tâche</th>
                  <th className="py-2 pr-3 font-bold">Catégorie</th>
                  <th className="py-2 pr-3 font-bold">Assignée à</th>
                  <th className="py-2 pr-3 font-bold">Priorité</th>
                  <th className="py-2 pr-3 font-bold">Échéance</th>
                  <th className="py-2 pr-3 font-bold">Statut</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((h) => (
                  <tr key={h.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-[#16212B]">{h.title}</p>
                      {h.description ? <p className="max-w-xs text-xs text-slate-500">{h.description}</p> : null}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{CATEGORY_LABELS[h.category] ?? h.category}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{h.assignedToName ?? '—'}</td>
                    <td className="py-2.5 pr-3">
                      <Badge className={h.priority === 'urgent' || h.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}>
                        {HANDOFF_PRIORITY_LABELS[h.priority] ?? h.priority}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{h.deadline ? fmtDateTime(h.deadline) : '—'}</td>
                    <td className="py-2.5 pr-3">
                      <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{HANDOFF_STATUS_LABELS[h.status] ?? h.status}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {h.status === 'open' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => act(h.id, 'acknowledge')}>
                            <UserCheck className="h-3 w-3" /> Prendre en charge
                          </Button>
                        )}
                        {(h.status === 'open' || h.status === 'acknowledged') && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700" onClick={() => setResolving(h)}>
                            <CheckCircle2 className="h-3 w-3" /> Résoudre
                          </Button>
                        )}
                        {h.status === 'open' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-rose-600" onClick={() => act(h.id, 'cancel', { reason: 'Annulation à la réception' })}>
                            <XCircle className="h-3 w-3" /> Annuler
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateHandoffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        staff={staff}
        onCreated={() => { setCreateOpen(false); load(); }}
      />

      <ResolveHandoffDialog
        handoff={resolving}
        onClose={() => setResolving(null)}
        onDone={() => { setResolving(null); load(); }}
      />
    </div>
  );
}

async function loadStaff(setter: (s: Staff[]) => void) {
  const res = await api<Staff[]>('/api/reception/staff');
  if (res.ok && Array.isArray(res.data)) setter(res.data);
}

function CreateHandoffDialog({ open, onOpenChange, staff, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: Staff[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    category: 'admin', title: '', description: '', priority: 'medium',
    assignedToId: '', deadline: '', subjectType: '', subjectId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idem, setIdem] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        category: 'admin', title: '', description: '', priority: 'medium',
        assignedToId: '', deadline: '', subjectType: '', subjectId: '',
      });
      setError(null);
      setIdem(crypto.randomUUID());
    }
  }, [open]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api<{ data: Handoff }>('/api/reception/handoffs', {
      method: 'POST',
      body: {
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        assignedToId: form.assignedToId || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        subjectType: form.subjectType.trim() || null,
        subjectId: form.subjectId.trim() || null,
        idempotencyKey: idem,
      },
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else setError(res.error?.message ?? 'Création impossible.');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="handoff-dialog-desc">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
          <DialogDescription id="handoff-dialog-desc">
            Transmettre une demande de coordination. La tâche n&apos;exécute pas l&apos;action du service destinataire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hf-title">Titre *</Label>
            <Input id="hf-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Relancer l'inscription du prospect…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hf-cat">Catégorie *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="hf-cat" aria-label="Catégorie de la tâche"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admissions">Admissions</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="teacher">Enseignant</SelectItem>
                  <SelectItem value="admin">Administration</SelectItem>
                  <SelectItem value="security">Sécurité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-prio">Priorité</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger id="hf-prio" aria-label="Priorité de la tâche"><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hf-desc">Description</Label>
            <Textarea id="hf-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Contexte de la demande…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hf-assign">Assignée à</Label>
              <Select value={form.assignedToId} onValueChange={(v) => setForm({ ...form, assignedToId: v })}>
                <SelectTrigger id="hf-assign" aria-label="Personne assignée"><SelectValue placeholder="Membre du personnel" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-deadline">Échéance</Label>
              <Input id="hf-deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hf-subject-type">Type d&apos;objet</Label>
              <Select value={form.subjectType} onValueChange={(v) => setForm({ ...form, subjectType: v })}>
                <SelectTrigger id="hf-subject-type" aria-label="Type d'objet lié"><SelectValue placeholder="Objet lié" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  <SelectItem value="student">Élève</SelectItem>
                  <SelectItem value="guardian">Parent</SelectItem>
                  <SelectItem value="visitor">Visiteur</SelectItem>
                  <SelectItem value="appointment">Rendez-vous</SelectItem>
                  <SelectItem value="inquiry">Demande</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-subject-id">Référence objet</Label>
              <Input id="hf-subject-id" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} placeholder="Identifiant / matricule" />
            </div>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-rose-600" role="alert"><AlertCircle className="h-4 w-4" />{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ListTodo className="mr-1 h-4 w-4" />} Créer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResolveHandoffDialog({ handoff, onClose, onDone }: {
  handoff: Handoff | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (handoff) { setNotes(''); setError(null); }
  }, [handoff]);

  if (!handoff) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await api(`/api/reception/handoffs/${handoff.id}/resolve`, {
      method: 'POST',
      body: { resolutionNotes: notes.trim() },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? 'Résolution impossible.');
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="resolve-desc">
        <DialogHeader>
          <DialogTitle>Résoudre · {handoff.title}</DialogTitle>
          <DialogDescription id="resolve-desc">Indiquer le résultat de la prise en charge.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rsv-notes">Notes de résolution *</Label>
            <Textarea id="rsv-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Détail du traitement effectué…" />
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Fermer</Button>
            <Button onClick={submit} disabled={submitting || notes.trim().length === 0}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Résoudre
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
