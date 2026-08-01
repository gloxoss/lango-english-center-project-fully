'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, TrendingUp, ShieldCheck, XCircle,
  Plus, AlertCircle, CheckCircle2,
} from 'lucide-react';

type ApplicantStatus = 'applied' | 'in_review' | 'approved' | 'rejected';

type ApiApplicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  status: ApplicantStatus;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  applicationDate: string;
};

type ApiClassSection = { id: string; className: string; sectionName: string };

const COLUMNS: { status: ApplicantStatus; title: string; color: string }[] = [
  { status: 'applied', title: 'Nouvelles demandes', color: 'border-t-[#2487B8]' },
  { status: 'in_review', title: 'Dossier en cours', color: 'border-t-[#E8A33D]' },
  { status: 'approved', title: 'Inscription confirmée', color: 'border-t-emerald-500' },
  { status: 'rejected', title: 'Rejetée', color: 'border-t-[#E5544B]' },
];

function age(dateOfBirth: string | null): string {
  if (!dateOfBirth) {
    return '—';
  }
  const years = Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} ans`;
}

export function AdmissionRequestsView() {
  const [applicants, setApplicants] = useState<ApiApplicant[]>([]);
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', guardianName: '', guardianPhone: '', guardianEmail: '' });
  const [adding, setAdding] = useState(false);

  const [approveTarget, setApproveTarget] = useState<ApiApplicant | null>(null);
  const [approveClassSectionId, setApproveClassSectionId] = useState('');
  const [approving, setApproving] = useState(false);

  async function loadApplicants() {
    try {
      const res = await fetch('/api/students/admissions');
      const json = await res.json();
      if (json.success) {
        setApplicants(json.data);
      }
    } catch (err) {
      console.error('Failed loading admission requests', err);
    }
  }

  useEffect(() => {
    loadApplicants();
    fetch('/api/academics/class-sections?pageSize=100')
      .then(res => res.json())
      .then((json) => { if (json.success) setClassSections(json.data); })
      .catch(err => console.error('Failed loading class sections', err));
  }, []);

  async function updateStatus(id: string, status: ApplicantStatus, classSectionId?: string) {
    setError(null);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(classSectionId ? { classSectionId } : {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la mise à jour du statut.');
        return false;
      }
      await loadApplicants();
      return true;
    } catch (err) {
      console.error('Status update failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
      return false;
    }
  }

  async function handleAddLead() {
    if (!newLead.firstName || !newLead.lastName || !newLead.email || !newLead.phone) {
      setError('Nom, prénom, email et téléphone sont requis.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newLead.firstName,
          lastName: newLead.lastName,
          email: newLead.email,
          phone: newLead.phone,
          ...(newLead.dateOfBirth ? { dateOfBirth: newLead.dateOfBirth } : {}),
          ...(newLead.guardianName ? { guardianName: newLead.guardianName } : {}),
          ...(newLead.guardianPhone ? { guardianPhone: newLead.guardianPhone } : {}),
          ...(newLead.guardianEmail ? { guardianEmail: newLead.guardianEmail } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la création de la demande.');
        return;
      }
      setIsAddOpen(false);
      setNewLead({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', guardianName: '', guardianPhone: '', guardianEmail: '' });
      await loadApplicants();
    } catch (err) {
      console.error('Create admission request failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setAdding(false);
    }
  }

  async function handleConfirmApprove() {
    if (!approveTarget) {
      return;
    }
    setApproving(true);
    const ok = await updateStatus(approveTarget.id, 'approved', approveClassSectionId || undefined);
    setApproving(false);
    if (ok) {
      setApproveTarget(null);
      setApproveClassSectionId('');
    }
  }

  const total = applicants.length;
  const countFor = (s: ApplicantStatus) => applicants.filter(a => a.status === s).length;
  const conversionRate = total > 0 ? ((countFor('approved') / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Demandes d&apos;admission</h1>
            <p className="text-xs text-slate-500 mt-1">Suivi des candidatures et pré-inscriptions</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-10 rounded-full px-4 gap-1.5 text-xs bg-[#0066FF] text-white hover:bg-[#0052CC]"
          >
            <Plus className="w-4 h-4" /> Nouvelle demande
          </Button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Demandes au total', value: String(total), icon: Users },
            { label: 'Taux de conversion', value: `${conversionRate}%`, icon: TrendingUp },
            { label: 'Dossiers en cours', value: String(countFor('in_review')), icon: AlertCircle },
            { label: 'Inscriptions confirmées', value: String(countFor('approved')), icon: ShieldCheck },
          ].map(kpi => (
            <Card key={kpi.label} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                <kpi.icon className="w-5 h-5" />
              </div>
            </Card>
          ))}
        </div>

        {/* Kanban Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const items = applicants.filter(a => a.status === col.status);
            return (
              <div key={col.status} className={`bg-slate-50/80 rounded-2xl border-t-4 ${col.color} overflow-hidden`}>
                <div className="px-3 py-3 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#16212B]">{col.title}</span>
                  <span className="text-xs font-extrabold text-[#2487B8] bg-[#DCEBF4] w-6 h-6 rounded-full flex items-center justify-center">{items.length}</span>
                </div>
                <div className="px-2 pb-2 space-y-2 max-h-[600px] overflow-y-auto">
                  {items.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4">Aucune demande</p>}
                  {items.map((item) => (
                    <Card key={item.id} className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                          {item.firstName[0]}{item.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-extrabold text-[#16212B] truncate">{item.firstName} {item.lastName}</p>
                          <p className="text-[9px] text-slate-400">{age(item.dateOfBirth)}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mb-1">{item.email}</p>
                      <p className="text-[9px] text-slate-400">Parent : {item.guardianName ?? '—'}</p>
                      <p className="text-[9px] text-slate-400">{item.guardianPhone ?? item.phone}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400">{new Date(item.applicationDate).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {col.status === 'applied' && (
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={() => updateStatus(item.id, 'in_review')} className="flex-1 text-[9px] py-1.5 rounded-lg bg-[#FCF0DC] text-[#E8A33D] font-bold hover:bg-[#F8E4C0]">Mettre en cours</button>
                          <button onClick={() => updateStatus(item.id, 'rejected')} className="text-[9px] py-1.5 px-2 rounded-lg bg-slate-100 text-slate-500 font-bold hover:bg-slate-200"><XCircle className="w-3 h-3" /></button>
                        </div>
                      )}
                      {col.status === 'in_review' && (
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={() => { setApproveTarget(item); setApproveClassSectionId(''); }} className="flex-1 text-[9px] py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200">Approuver</button>
                          <button onClick={() => updateStatus(item.id, 'rejected')} className="text-[9px] py-1.5 px-2 rounded-lg bg-slate-100 text-slate-500 font-bold hover:bg-slate-200"><XCircle className="w-3 h-3" /></button>
                        </div>
                      )}
                      {col.status === 'approved' && (
                        <div className="flex items-center gap-1.5 mt-2 text-[9px] text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Élève inscrit dans l&apos;annuaire
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NEW LEAD DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Nouvelle demande d&apos;admission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Prénom *</label>
                <Input value={newLead.firstName} onChange={e => setNewLead({ ...newLead, firstName: e.target.value })} className="h-9 text-xs rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom *</label>
                <Input value={newLead.lastName} onChange={e => setNewLead({ ...newLead, lastName: e.target.value })} className="h-9 text-xs rounded-xl" />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Email *</label>
              <Input type="email" value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone *</label>
              <Input value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} placeholder="Ex. 06 61 22 33 44" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date de naissance</label>
              <Input type="date" value={newLead.dateOfBirth} onChange={e => setNewLead({ ...newLead, dateOfBirth: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Parent / Tuteur</label>
              <Input value={newLead.guardianName} onChange={e => setNewLead({ ...newLead, guardianName: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone du parent</label>
              <Input value={newLead.guardianPhone} onChange={e => setNewLead({ ...newLead, guardianPhone: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" disabled={adding} onClick={handleAddLead} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">{adding ? 'Ajout...' : 'Ajouter la demande'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVE DIALOG */}
      <Dialog open={!!approveTarget} onOpenChange={open => !open && setApproveTarget(null)}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Approuver la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <p className="text-slate-600">
              {approveTarget?.firstName} {approveTarget?.lastName} sera inscrit(e) dans l&apos;annuaire des élèves.
            </p>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Classe (optionnel)</label>
              <Select value={approveClassSectionId} onValueChange={setApproveClassSectionId}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder="Non classé" /></SelectTrigger>
                <SelectContent>
                  {classSections.map(cs => (
                    <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveTarget(null)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" disabled={approving} onClick={handleConfirmApprove} className="rounded-full text-xs h-9 bg-emerald-600 text-white hover:bg-emerald-700">{approving ? 'Approbation...' : 'Confirmer l\'approbation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
