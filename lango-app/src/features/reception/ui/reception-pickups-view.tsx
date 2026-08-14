'use client';

import { useCallback, useEffect, useState } from 'react';
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
  AlertCircle, KeyRound, Loader2, LogOut, Search, ShieldAlert,
} from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import { api, fmtDateTime } from './reception-api';

type StudentHit = { id: string; matricule: string | null; name: string };
type Authorization = { id: string; authorizedFrom: string; authorizedUntil: string; reason: string | null };
type PickupPerson = {
  pickupPersonId: string;
  firstName: string;
  lastName: string;
  relationshipType: string;
  isPrimaryContact: boolean | null;
  canPickup: boolean | null;
  activeAuthorizations: Authorization[];
};
type StudentPickups = { student: StudentHit; pickups: PickupPerson[] };
type Gate = { id: string; gateCode: string; gateName: string; direction: string; branchId: string | null };

export function ReceptionPickupsView() {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentPickups | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [createAuth, setCreateAuth] = useState<{ person: PickupPerson } | null>(null);
  const [release, setRelease] = useState<{ person: PickupPerson; authorization: Authorization } | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Probe access first. Default receptionist role does NOT carry
  // reception.pickup.release — the API answers 403 and we render a graceful
  // forbidden state instead of a broken list.
  const probe = useCallback(async () => {
    setLoadState('loading');
    const res = await api<Authorization[]>('/api/reception/pickups/authorizations');
    if (res.status === 403) { setLoadState('forbidden'); return; }
    if (res.ok) { setLoadState('ready'); return; }
    setLoadError(res.error?.message ?? 'Chargement impossible.');
    setLoadState('error');
  }, []);

  useEffect(() => { probe(); }, [probe]);

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) {
      setSearchError('Saisissez au moins 3 caractères (nom, matricule ou téléphone).');
      setHits([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const res = await api<StudentHit[]>(`/api/reception/pickups/students?q=${encodeURIComponent(term)}`);
    setSearching(false);
    if (res.ok && Array.isArray(res.data)) {
      setHits(res.data);
      if (res.data.length === 0) setSearchError('Aucun élève trouvé.');
    } else {
      setHits([]);
      setSearchError(res.error?.message ?? 'Recherche impossible.');
    }
  };

  const selectStudent = async (id: string) => {
    setSearchError(null);
    setSelected(null);
    const res = await api<StudentPickups>(`/api/reception/pickups/students/${id}/pickups`);
    if (res.ok && res.data) {
      setSelected(res.data);
    } else {
      setSearchError(res.error?.message ?? 'Chargement impossible.');
    }
  };

  const openRelease = async (person: PickupPerson, authorization: Authorization) => {
    setActionMsg(null);
    const g = await api<Gate[]>('/api/reception/gates');
    if (g.ok && Array.isArray(g.data)) setGates(g.data);
    else setGates([]);
    setRelease({ person, authorization });
  };

  if (loadState === 'loading') return <PortalStateView state="loading" />;
  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          <PortalStateView state="forbidden" />
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            La sortie d&apos;un élève exige une autorisation de retrait effective et un pouvoir de libération
            explicite. Votre profil ne dispose pas de cette habilitation ; adressez-vous à un responsable
            autorisé.
          </p>
        </Card>
      </div>
    );
  }
  if (loadState === 'error') return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={probe}>Réessayer</Button>} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Retraits &amp; autorisations</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Rechercher un élève, vérifier les personnes autorisées et libérer le retrait (habilitation spécifique requise).
          </p>
        </div>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              placeholder="Rechercher un élève (nom, matricule, téléphone)…"
              className="pl-8"
              aria-label="Rechercher un élève"
            />
          </div>
          <Button onClick={search} disabled={searching} size="sm">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
          </Button>
        </div>

        {searchError && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <AlertCircle className="h-4 w-4 text-rose-500" />{searchError}
          </p>
        )}

        {hits.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200/80">
            {hits.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => selectStudent(s.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#16212B]">{s.name}</span>
                    {s.matricule ? <span className="block font-mono text-xs text-slate-400">{s.matricule}</span> : null}
                  </span>
                  <span className="text-xs font-bold text-[#2487B8]">Consulter →</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-[#16212B]">{selected.student.name}</h2>
              {selected.student.matricule ? <span className="font-mono text-xs text-slate-400">{selected.student.matricule}</span> : null}
            </div>
            {selected.pickups.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Aucune personne autorisée pour ce retrait.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {selected.pickups.map((p) => (
                  <div key={p.pickupPersonId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#16212B]">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-500">
                        {p.relationshipType}
                        {p.isPrimaryContact ? ' · contact principal' : ''}
                        {p.canPickup ? ' · retrait autorisé' : ''}
                      </p>
                      {p.activeAuthorizations.length > 0 && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {p.activeAuthorizations.length} autorisation(s) active(s) · {p.activeAuthorizations.map((a) => fmtDateTime(a.authorizedFrom)).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setCreateAuth({ person: p })}>
                        <KeyRound className="h-3 w-3" /> Autoriser
                      </Button>
                      {p.activeAuthorizations.map((a) => (
                        <Button key={a.id} size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700" onClick={() => openRelease(p, a)}>
                          <LogOut className="h-3 w-3" /> Libérer
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {createAuth && selected && (
        <CreateAuthorizationDialog
          studentId={selected.student.id}
          person={createAuth.person}
          onClose={() => setCreateAuth(null)}
          onDone={() => { setCreateAuth(null); selectStudent(selected.student.id); }}
        />
      )}

      {release && selected && (
        <ReleaseDialog
          studentId={selected.student.id}
          studentName={selected.student.name}
          person={release.person}
          authorization={release.authorization}
          gates={gates}
          onClose={() => setRelease(null)}
          onDone={() => { setRelease(null); selectStudent(selected.student.id); setActionMsg('Retrait libéré.'); }}
        />
      )}
    </div>
  );
}

function CreateAuthorizationDialog({ studentId, person, onClose, onDone }: {
  studentId: string;
  person: PickupPerson;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    authorizedFrom: '', authorizedUntil: '', reason: '', relationshipType: person.relationshipType,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.authorizedFrom || !form.authorizedUntil) {
      setError('La fenêtre de validité est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api('/api/reception/pickups/authorizations', {
      method: 'POST',
      body: {
        studentId,
        pickupPersonId: person.pickupPersonId,
        relationshipType: form.relationshipType,
        authorizedFrom: new Date(form.authorizedFrom).toISOString(),
        authorizedUntil: new Date(form.authorizedUntil).toISOString(),
        reason: form.reason.trim() || null,
      },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? 'Création impossible.');
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="auth-create-desc">
        <DialogHeader>
          <DialogTitle>Autoriser le retrait · {person.firstName} {person.lastName}</DialogTitle>
          <DialogDescription id="auth-create-desc">
            Définir une fenêtre de validité. Le retrait ne pourra être libéré qu&apos;avec une autorisation active et effective.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pa-rel">Lien</Label>
            <Input id="pa-rel" value={form.relationshipType} onChange={(e) => setForm({ ...form, relationshipType: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pa-from">Début *</Label>
              <Input id="pa-from" type="datetime-local" value={form.authorizedFrom} onChange={(e) => setForm({ ...form, authorizedFrom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-until">Fin *</Label>
              <Input id="pa-until" type="datetime-local" value={form.authorizedUntil} onChange={(e) => setForm({ ...form, authorizedUntil: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pa-reason">Motif</Label>
            <Textarea id="pa-reason" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex. Sortie anticipée, autorisation ponctuelle…" />
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Fermer</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />} Créer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDialog({ studentId, studentName, person, authorization, gates, onClose, onDone }: {
  studentId: string;
  studentName: string;
  person: PickupPerson;
  authorization: Authorization;
  gates: Gate[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [gateId, setGateId] = useState('');
  const [method, setMethod] = useState<'badge_qr' | 'manual'>('manual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gates.length > 0 && !gateId) setGateId(gates[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gates]);

  const submit = async () => {
    if (!gateId) {
      setError('Un portail est requis pour la libération.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api('/api/reception/pickups/release', {
      method: 'POST',
      body: {
        studentId,
        authorizationId: authorization.id,
        method,
        gateId,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? 'Libération impossible.');
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="release-desc">
        <DialogHeader>
          <DialogTitle>Libérer le retrait · {studentName}</DialogTitle>
          <DialogDescription id="release-desc">
            Personne autorisée : <span className="font-semibold">{person.firstName} {person.lastName}</span> ({person.relationshipType}). Fenêtre de validité jusqu&apos;au {fmtDateTime(authorization.authorizedUntil)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rel-gate">Portail de sortie *</Label>
            <Select value={gateId} onValueChange={setGateId}>
              <SelectTrigger id="rel-gate" aria-label="Portail de sortie"><SelectValue placeholder="Choisir un portail" /></SelectTrigger>
              <SelectContent>
                {gates.map((g) => <SelectItem key={g.id} value={g.id}>{g.gateName} ({g.gateCode})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-method">Méthode de vérification</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as 'badge_qr' | 'manual')}>
              <SelectTrigger id="rel-method" aria-label="Méthode de vérification"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manuelle</SelectItem>
                <SelectItem value="badge_qr">Badge / QR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Libérer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
