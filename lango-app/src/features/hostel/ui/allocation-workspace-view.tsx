'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, BedDouble, CheckCircle2, ClipboardList, Loader2, Plus, Users, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { api, errMessage } from './api';

type StudentRow = { id: string; matricule: string | null; fullName: string; className: string | null };
type BedRow = { id: string; roomId: string; code: string; status: string };
type RoomRow = { id: string; code: string; name: string | null; status: string };

type ApplicationRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  requestedStartDate: string;
  requestedEndDate: string;
  preferredRoomId: string | null;
  priorityReason: string | null;
  guardianConsentStatus: string;
  decision: string | null;
  decisionReason: string | null;
  createdAt: string;
};

type AllocationRow = {
  id: string;
  applicationId: string | null;
  studentId: string;
  studentName: string | null;
  bedId: string;
  bedCode: string;
  roomId: string;
  roomCode: string;
  hostelId: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  state: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  notes: string | null;
  createdAt: string;
};

type PreviewResult = { bedId: string; studentId: string; eligible: boolean; reasons: string[] };

const STATE_LABELS: Record<string, string> = {
  reserved: 'Réservé',
  checked_in: 'Présent',
  checked_out: 'Sorti',
  cancelled: 'Annulé',
};

const DECISION_LABELS: Record<string, string> = {
  approved: 'Approuvée',
  denied: 'Refusée',
  waitlisted: 'Liste d\'attente',
  withdrawn: 'Retirée',
};

const emptyAppForm = {
  studentId: '',
  requestedStartDate: '',
  requestedEndDate: '',
  preferredRoomId: 'none',
  priorityReason: '',
  guardianConsentStatus: 'not_required',
};

const emptyAllocForm = {
  studentId: '',
  bedId: '',
  effectiveStartDate: '',
  effectiveEndDate: '',
  notes: '',
};

export function AllocationWorkspaceView() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentsError, setStudentsError] = useState(false);

  const [appModal, setAppModal] = useState(false);
  const [allocModal, setAllocModal] = useState(false);
  const [appForm, setAppForm] = useState(emptyAppForm);
  const [allocForm, setAllocForm] = useState(emptyAllocForm);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<PreviewResult[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [allocStateFilter, setAllocStateFilter] = useState('all');
  const [appDecisionFilter, setAppDecisionFilter] = useState('all');

  const loadApplications = useCallback(async () => {
    const qs = appDecisionFilter !== 'all' ? `?decision=${encodeURIComponent(appDecisionFilter)}` : '';
    const res = await api<ApplicationRow[]>(`/api/addons/hostel/applications${qs}`);
    if (res.ok && Array.isArray(res.data)) setApplications(res.data);
    else setError(errMessage(res));
  }, [appDecisionFilter]);

  const loadAllocations = useCallback(async () => {
    const qs = allocStateFilter !== 'all' ? `?state=${encodeURIComponent(allocStateFilter)}` : '';
    const res = await api<AllocationRow[]>(`/api/addons/hostel/allocations${qs}`);
    if (res.ok && Array.isArray(res.data)) setAllocations(res.data);
    else setError(errMessage(res));
  }, [allocStateFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadApplications(),
      loadAllocations(),
      api<StudentRow[]>('/api/students').then(res => {
        if (res.ok && Array.isArray(res.data)) setStudents(res.data);
        else setStudentsError(true);
      }).catch(() => setStudentsError(true)),
      api<BedRow[]>('/api/addons/hostel/beds').then(res => {
        if (res.ok && Array.isArray(res.data)) setBeds(res.data.filter(b => b.status === 'active'));
      }).catch(() => {}),
      api<RoomRow[]>('/api/addons/hostel/rooms').then(res => {
        if (res.ok && Array.isArray(res.data)) setRooms(res.data);
      }).catch(() => {}),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [loadApplications, loadAllocations]);

  const roomByBed = new Map<string, RoomRow>();
  for (const bed of beds) {
    const room = rooms.find(r => r.id === bed.roomId);
    if (room) roomByBed.set(bed.id, room);
  }

  // ---- Applications ----

  const saveApplication = async () => {
    if (!appForm.studentId || !appForm.requestedStartDate || !appForm.requestedEndDate) return;
    setSaving(true);
    setError(null);
    const body = {
      studentId: appForm.studentId,
      requestedStartDate: appForm.requestedStartDate,
      requestedEndDate: appForm.requestedEndDate,
      preferredRoomId: appForm.preferredRoomId && appForm.preferredRoomId !== 'none' ? appForm.preferredRoomId : null,
      priorityReason: appForm.priorityReason.trim() || null,
      guardianConsentStatus: appForm.guardianConsentStatus,
    };
    const res = await api('/api/addons/hostel/applications', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setAppModal(false);
      await loadApplications();
    } else {
      setError(errMessage(res));
    }
  };

  const decideApplication = async (id: string, decision: string) => {
    const res = await api(`/api/addons/hostel/applications/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    if (res.ok) await loadApplications();
    else setError(errMessage(res));
  };

  // ---- Allocations ----

  const runPreview = async () => {
    if (!allocForm.studentId || !allocForm.bedId || !allocForm.effectiveStartDate || !allocForm.effectiveEndDate) return;
    setPreviewing(true);
    setError(null);
    const res = await api<PreviewResult>('/api/addons/hostel/allocations/preview', {
      method: 'POST',
      body: JSON.stringify({
        studentId: allocForm.studentId,
        bedId: allocForm.bedId,
        startDate: allocForm.effectiveStartDate,
        endDate: allocForm.effectiveEndDate,
      }),
    });
    setPreviewing(false);
    if (res.ok && res.data) setPreview(res.data);
    else setError(errMessage(res));
  };

  const commitAllocation = async () => {
    if (!allocForm.studentId || !allocForm.bedId || !allocForm.effectiveStartDate || !allocForm.effectiveEndDate) return;
    setSaving(true);
    setError(null);
    const body = {
      studentId: allocForm.studentId,
      bedId: allocForm.bedId,
      effectiveStartDate: allocForm.effectiveStartDate,
      effectiveEndDate: allocForm.effectiveEndDate,
      notes: allocForm.notes.trim() || null,
    };
    const res = await api('/api/addons/hostel/allocations/commit', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setAllocModal(false);
      setPreview(null);
      setAllocForm(emptyAllocForm);
      await loadAllocations();
    } else {
      setError(errMessage(res));
    }
  };

  const previewBulk = async () => {
    const rows = bulkText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [studentId, bedId, startDate, endDate] = l.split('|').map(s => s.trim());
      return { studentId, bedId, startDate, endDate };
    }).filter(r => r.studentId && r.bedId && r.startDate && r.endDate);
    if (rows.length === 0) { setError('Chaque ligne doit suivre: élève|lit|début|fin'); return; }
    setBulkBusy(true);
    setError(null);
    const res = await api<PreviewResult[]>('/api/addons/hostel/allocations/bulk/preview', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
    setBulkBusy(false);
    if (res.ok && Array.isArray(res.data)) setBulkPreview(res.data);
    else setError(errMessage(res));
  };

  const commitBulk = async () => {
    const rows = bulkText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [studentId, bedId, effectiveStartDate, effectiveEndDate] = l.split('|').map(s => s.trim());
      return { studentId, bedId, effectiveStartDate, effectiveEndDate };
    }).filter(r => r.studentId && r.bedId && r.effectiveStartDate && r.effectiveEndDate);
    if (rows.length === 0) return;
    setBulkBusy(true);
    setError(null);
    const res = await api('/api/addons/hostel/allocations/bulk/commit', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
    setBulkBusy(false);
    if (res.ok) {
      setBulkText('');
      setBulkPreview(null);
      await loadAllocations();
    } else {
      setError(errMessage(res));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#16212B]">Espace d&apos;affectations</h1>
        <p className="text-sm text-slate-500">Demandes d&apos;internat, affectations aux lits et engagement en lot.</p>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications"><ClipboardList className="mr-2 h-4 w-4" /> Applications</TabsTrigger>
          <TabsTrigger value="allocations"><BedDouble className="mr-2 h-4 w-4" /> Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Select value={appDecisionFilter} onValueChange={v => setAppDecisionFilter(v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="approved">Approuvées</SelectItem>
                  <SelectItem value="denied">Refusées</SelectItem>
                  <SelectItem value="waitlisted">Liste d&apos;attente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setAppForm(emptyAppForm); setAppModal(true); }}><Plus className="mr-2 h-4 w-4" /> Nouvelle demande</Button>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
              ) : applications.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">Aucune demande d&apos;internat.</div>
              ) : (
                applications.map(app => (
                  <div key={app.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Users className="h-5 w-5" /></div>
                      <div>
                        <p className="font-semibold text-[#16212B]">{app.studentName ?? app.studentId}</p>
                        <p className="text-xs text-slate-500">
                          {app.requestedStartDate} → {app.requestedEndDate}
                          {app.guardianConsentStatus === 'approved' ? ' · consentement OK' : app.guardianConsentStatus === 'required' ? ' · consentement requis' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={app.decision === 'approved' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : app.decision === 'denied' ? 'bg-red-100 text-red-700' : app.decision ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}>
                        {app.decision ? DECISION_LABELS[app.decision] ?? app.decision : 'En attente'}
                      </Badge>
                      {!app.decision && (
                        <>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-green-700" onClick={() => decideApplication(app.id, 'approved')}><CheckCircle2 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-red-700" onClick={() => decideApplication(app.id, 'denied')}><XCircle className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-amber-700" onClick={() => decideApplication(app.id, 'waitlisted')}>Attente</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={allocStateFilter} onValueChange={v => setAllocStateFilter(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                <SelectItem value="reserved">Réservé</SelectItem>
                <SelectItem value="checked_in">Présent</SelectItem>
                <SelectItem value="checked_out">Sorti</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setAllocForm(emptyAllocForm); setPreview(null); setAllocModal(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle affectation
            </Button>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
              ) : allocations.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">Aucune affectation.</div>
              ) : (
                allocations.map(row => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <Link href={`/dashboard/hostel/allocations/${row.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
                      <div>
                        <p className="font-semibold text-[#16212B]">{row.studentName ?? row.studentId}</p>
                        <p className="text-xs text-slate-500">
                          {row.roomCode} · {row.bedCode} · {row.effectiveStartDate} → {row.effectiveEndDate}
                        </p>
                      </div>
                    </Link>
                    <Badge className={row.state === 'checked_in' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : row.state === 'reserved' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}>
                      {STATE_LABELS[row.state] ?? row.state}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-[#16212B]">Affectation en lot</h2>
              <p className="text-xs text-slate-500">Une ligne par affectation : élève|lit|date-début|date-fin</p>
            </div>
            <div className="space-y-3 p-4">
              <Textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                rows={5}
                placeholder="STU-123|BED-456|2026-09-01|2027-06-30"
              />
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={previewBulk} disabled={bulkBusy || !bulkText.trim()}>
                  {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Prévisualiser
                </Button>
                <Button onClick={commitBulk} disabled={bulkBusy || !bulkText.trim()}>Engager en lot</Button>
              </div>
              {bulkPreview && (
                <div className="space-y-1">
                  {bulkPreview.map((p, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2 text-sm ${p.eligible ? 'bg-[#D1F5E8]/40 text-[#0b5c3a]' : 'bg-red-50 text-red-700'}`}>
                      <span className="font-medium">{p.studentId}</span> → <span>{p.bedId}</span> : {p.eligible ? 'Éligible' : p.reasons.join(' ; ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={appModal} onOpenChange={setAppModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle demande d&apos;internat</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Élève *</label>
              {studentsError ? (
                <Input value={appForm.studentId} onChange={e => setAppForm({ ...appForm, studentId: e.target.value })} placeholder="ID de l'élève (rôle sans students.read)" />
              ) : (
                <Select value={appForm.studentId} onValueChange={v => setAppForm({ ...appForm, studentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}{s.matricule ? ` (${s.matricule})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Début souhaité *</label>
                <Input type="date" value={appForm.requestedStartDate} onChange={e => setAppForm({ ...appForm, requestedStartDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fin souhaitée *</label>
                <Input type="date" value={appForm.requestedEndDate} onChange={e => setAppForm({ ...appForm, requestedEndDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Consentement tuteur</label>
              <Select value={appForm.guardianConsentStatus} onValueChange={v => setAppForm({ ...appForm, guardianConsentStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_required">Non requis</SelectItem>
                  <SelectItem value="required">Requis</SelectItem>
                  <SelectItem value="approved">Approuvé</SelectItem>
                  <SelectItem value="denied">Refusé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Motif prioritaire</label>
              <Textarea value={appForm.priorityReason} onChange={e => setAppForm({ ...appForm, priorityReason: e.target.value })} rows={2} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppModal(false)}>Annuler</Button>
            <Button onClick={saveApplication} disabled={saving || !appForm.studentId || !appForm.requestedStartDate || !appForm.requestedEndDate}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={allocModal} onOpenChange={setAllocModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle affectation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Élève *</label>
              {studentsError ? (
                <Input value={allocForm.studentId} onChange={e => setAllocForm({ ...allocForm, studentId: e.target.value })} placeholder="ID de l'élève" />
              ) : (
                <Select value={allocForm.studentId} onValueChange={v => setAllocForm({ ...allocForm, studentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}{s.matricule ? ` (${s.matricule})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lit *</label>
              <Select value={allocForm.bedId} onValueChange={v => setAllocForm({ ...allocForm, bedId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un lit" /></SelectTrigger>
                <SelectContent>
                  {beds.map(b => {
                    const room = roomByBed.get(b.id);
                    return <SelectItem key={b.id} value={b.id}>{b.code}{room ? ` (${room.code})` : ''}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Début *</label>
                <Input type="date" value={allocForm.effectiveStartDate} onChange={e => setAllocForm({ ...allocForm, effectiveStartDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fin *</label>
                <Input type="date" value={allocForm.effectiveEndDate} onChange={e => setAllocForm({ ...allocForm, effectiveEndDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <Input value={allocForm.notes} onChange={e => setAllocForm({ ...allocForm, notes: e.target.value })} />
            </div>
            <Button variant="outline" onClick={runPreview} disabled={previewing || !allocForm.studentId || !allocForm.bedId || !allocForm.effectiveStartDate || !allocForm.effectiveEndDate} className="w-full">
              {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Vérifier l&apos;éligibilité
            </Button>
            {preview && (
              <div className={`rounded-xl px-3 py-2 text-sm ${preview.eligible ? 'bg-[#D1F5E8]/40 text-[#0b5c3a]' : 'bg-red-50 text-red-700'}`}>
                {preview.eligible
                  ? 'Éligible — vous pouvez engager l\'affectation.'
                  : preview.reasons.join(' ; ')}
              </div>
            )}
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocModal(false)}>Annuler</Button>
            <Button onClick={commitAllocation} disabled={saving || !allocForm.studentId || !allocForm.bedId || !allocForm.effectiveStartDate || !allocForm.effectiveEndDate || (preview !== null && !preview.eligible)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Engager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
