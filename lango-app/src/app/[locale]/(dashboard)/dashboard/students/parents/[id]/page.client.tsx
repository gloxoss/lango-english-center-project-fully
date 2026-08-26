'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, User, Phone, Mail, Briefcase, MapPin,
  Users, Star, AlertCircle, Pencil, Trash2, ShieldCheck, CheckCircle2,
  Wallet, Clock, KeyRound,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type CoGuardian = { guardianId: string; name: string; relationshipType: string };

type LinkedStudent = {
  linkId: string;
  studentId: string;
  studentName: string;
  studentMatricule: string | null;
  relationshipType: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  emergencyPriority: number | null;
  canPickup: boolean;
  coGuardians: CoGuardian[];
};

type GuardianDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  address: string | null;
  defaultRelation: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  preferredLanguage: string | null;
  createdAt: string;
  updatedAt: string;
  linkedStudents: LinkedStudent[];
};

type PaymentEntry = { type: 'invoice' | 'payment'; id: string; studentId: string; studentName: string; amount: number; status: string; date: string };
type ActivityEntry = { action: string; entityType: string; actorId: string; createdAt: string };

const TABS = [
  { id: 'children', label: 'Enfants liés' },
  { id: 'info', label: 'Informations' },
  { id: 'payments', label: 'Paiements' },
  { id: 'activity', label: 'Activité' },
] as const;

type TabId = typeof TABS[number]['id'];

function RelationBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    Parent: 'bg-[#DCEBF4] text-[#1B6C93]',
    Père: 'bg-[#DCEBF4] text-[#1B6C93]',
    Mère: 'bg-purple-100 text-purple-700',
    Tuteur: 'bg-amber-100 text-amber-700',
    'Grand-parent': 'bg-emerald-100 text-emerald-700',
  };
  const cls = map[type] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      {type}
    </span>
  );
}

export default function GuardianDetailPage() {
  const params = useParams();
  const router = useRouter();
  const guardianId = typeof params.id === 'string' ? params.id : '';
  const locale = typeof params.locale === 'string' ? params.locale : 'fr';
  const { can } = usePermissions();

  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('children');

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Partial<GuardianDetail>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Unlink state
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedStudent | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Payments / activity (fetched lazily on first tab visit)
  const [payments, setPayments] = useState<PaymentEntry[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    if (!guardianId) return;
    setLoading(true);
    fetch(`/api/students/parents/${guardianId}`)
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setGuardian(json.data);
          setEditFields({
            firstName: json.data.firstName,
            lastName: json.data.lastName,
            email: json.data.email,
            phone: json.data.phone,
            occupation: json.data.occupation,
            address: json.data.address,
            emailOptIn: json.data.emailOptIn,
            smsOptIn: json.data.smsOptIn,
            preferredLanguage: json.data.preferredLanguage,
          });
        } else {
          setError(json.message ?? 'Tuteur introuvable.');
        }
      })
      .catch(err => { console.error(err); setError('Impossible de charger les données.'); })
      .finally(() => setLoading(false));
  }, [guardianId]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/students/parents/${guardianId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFields.firstName,
          lastName: editFields.lastName,
          email: editFields.email || null,
          phone: editFields.phone || null,
          occupation: editFields.occupation || null,
          address: editFields.address || null,
          emailOptIn: editFields.emailOptIn,
          smsOptIn: editFields.smsOptIn,
          preferredLanguage: editFields.preferredLanguage || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSaveError(json.message ?? 'Impossible de sauvegarder.');
        return;
      }
      setGuardian(prev => prev ? { ...prev, ...json.data } : null);
      setEditMode(false);
    } catch (err) {
      console.error(err);
      setSaveError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/students/parents/link?guardianId=${guardianId}&studentId=${unlinkTarget.studentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? 'Impossible de délier.');
        return;
      }
      setGuardian(prev => prev
        ? { ...prev, linkedStudents: prev.linkedStudents.filter(s => s.linkId !== unlinkTarget.linkId) }
        : null,
      );
      setUnlinkTarget(null);
    } catch (err) {
      console.error(err);
      setError('Connexion impossible.');
    } finally {
      setUnlinking(false);
    }
  }

  useEffect(() => {
    if (!guardianId) return;
    if (activeTab === 'payments' && payments === null) {
      fetch(`/api/students/parents/${guardianId}/payments`).then(r => r.json()).then(j => j?.success && setPayments(j.data));
    }
    if (activeTab === 'activity' && activity === null) {
      fetch(`/api/students/parents/${guardianId}/activity`).then(r => r.json()).then(j => j?.success && setActivity(j.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, guardianId]);

  async function handleLinkFieldChange(student: LinkedStudent, patch: { emergencyPriority?: number | null; canPickup?: boolean }) {
    setGuardian(prev => prev
      ? { ...prev, linkedStudents: prev.linkedStudents.map(s => (s.linkId === student.linkId ? { ...s, ...patch } : s)) }
      : null);
    await fetch('/api/students/parents/link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guardianId, studentId: student.studentId, ...patch }),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-[#2487B8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !guardian) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error ?? 'Tuteur introuvable.'}</span>
      </div>
    );
  }

  const fullName = `${guardian.firstName} ${guardian.lastName}`;
  const initials = `${guardian.firstName[0] ?? ''}${guardian.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => router.push(`/${locale}/dashboard/students/parents`)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#1B6C93] font-semibold transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux tuteurs
        </button>
      </div>

      {/* Profile card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white text-xl font-extrabold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{fullName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
              {guardian.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#2487B8]" />
                  {guardian.phone}
                </span>
              )}
              {guardian.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#2487B8]" />
                  {guardian.email}
                </span>
              )}
              {guardian.occupation && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {guardian.occupation}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {guardian.linkedStudents.length} enfant{guardian.linkedStudents.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.filter(tab => tab.id !== 'payments' || can('finance.read')).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#16212B] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Children */}
      {activeTab === 'children' && (
        <div className="space-y-3">
          {guardian.linkedStudents.length === 0 && (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Users className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Aucun enfant lié</p>
              <p className="text-xs text-slate-300">Liez un élève depuis le profil de l'élève.</p>
            </Card>
          )}
          {guardian.linkedStudents.map(student => (
            <Card key={student.linkId} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#1B6C93] font-extrabold text-sm shrink-0">
                  {student.studentName?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/students/${student.studentId}`)}
                    className="text-sm font-extrabold text-[#16212B] hover:text-[#2487B8] transition-colors"
                  >
                    {student.studentName}
                  </button>
                  {student.studentMatricule && (
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{student.studentMatricule}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <RelationBadge type={student.relationshipType} />
                  {student.isPrimaryContact && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3" />
                      Principal
                    </span>
                  )}
                  {student.isEmergencyContact && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      Urgence
                    </span>
                  )}
                  <button
                    onClick={() => setUnlinkTarget(student)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                    title="Délier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px]">
                <label className="flex items-center gap-1.5 font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={student.canPickup}
                    onChange={e => handleLinkFieldChange(student, { canPickup: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Autorisé(e) à récupérer l'élève
                </label>
                <label className="flex items-center gap-1.5 font-semibold text-slate-600">
                  Priorité contact d'urgence :
                  <input
                    type="number"
                    min={1}
                    value={student.emergencyPriority ?? ''}
                    onChange={e => handleLinkFieldChange(student, { emergencyPriority: e.target.value ? Number(e.target.value) : null })}
                    className="w-14 h-7 rounded-lg border border-slate-200 px-2 text-center"
                    placeholder="—"
                  />
                </label>
                {student.coGuardians.length > 0 && (
                  <span className="text-slate-400">
                    Co-tuteur{student.coGuardians.length > 1 ? 's' : ''}
                    {' : '}
                    {student.coGuardians.map(g => g.name).join(', ')}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#16212B]">Informations personnelles</h3>
            {!editMode && (
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="h-8 rounded-full text-xs gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                Modifier
              </Button>
            )}
          </div>

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}

          {editMode
            ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Prénom', key: 'firstName' as const },
                  { label: 'Nom', key: 'lastName' as const },
                  { label: 'Email', key: 'email' as const },
                  { label: 'Téléphone', key: 'phone' as const },
                  { label: 'Profession', key: 'occupation' as const },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{f.label}</label>
                    <Input
                      value={(editFields[f.key] as string) ?? ''}
                      onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Adresse</label>
                  <textarea
                    rows={2}
                    value={(editFields.address as string) ?? ''}
                    onChange={e => setEditFields(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 resize-none focus:outline-none focus:border-[#2487B8]"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Préférences de communication</label>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={editFields.emailOptIn ?? true}
                        onChange={e => setEditFields(prev => ({ ...prev, emailOptIn: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      Recevoir des emails
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={editFields.smsOptIn ?? true}
                        onChange={e => setEditFields(prev => ({ ...prev, smsOptIn: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      Recevoir des SMS
                    </label>
                    <select
                      value={editFields.preferredLanguage ?? ''}
                      onChange={e => setEditFields(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                      className="h-8 px-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="">Langue préférée...</option>
                      <option value="fr">Français</option>
                      <option value="ar">Arabe</option>
                      <option value="en">Anglais</option>
                    </select>
                  </div>
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setEditMode(false); setSaveError(null); }} className="rounded-full text-xs h-9">
                    Annuler
                  </Button>
                  <Button disabled={saving} onClick={handleSave} className="rounded-full text-xs h-9 bg-[#0066FF] text-white border-0">
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            )
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { icon: User, label: 'Prénom', value: guardian.firstName },
                  { icon: User, label: 'Nom', value: guardian.lastName },
                  { icon: Mail, label: 'Email', value: guardian.email },
                  { icon: Phone, label: 'Téléphone', value: guardian.phone },
                  { icon: Briefcase, label: 'Profession', value: guardian.occupation },
                  { icon: MapPin, label: 'Adresse', value: guardian.address, full: true },
                ].map(f => (
                  f.value
                    ? (
                      <div key={f.label} className={f.full ? 'sm:col-span-2' : ''}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <f.icon className="w-3 h-3" />
                          {f.label}
                        </label>
                        <p className="text-sm font-semibold text-[#16212B] mt-0.5">{f.value}</p>
                      </div>
                    )
                    : null
                ))}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Préférences de communication</label>
                  <p className="text-sm font-semibold text-[#16212B] mt-0.5">
                    {[guardian.emailOptIn && 'Email', guardian.smsOptIn && 'SMS'].filter(Boolean).join(' · ') || 'Aucune'}
                    {guardian.preferredLanguage && ` · Langue : ${guardian.preferredLanguage.toUpperCase()}`}
                  </p>
                </div>
              </div>
            )}
        </Card>
      )}

      {/* Tab: Payments (real household payment history, aggregated across every linked student) */}
      {activeTab === 'payments' && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {payments === null && (
            <div className="p-12 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-4 border-[#2487B8] border-t-transparent animate-spin" />
            </div>
          )}
          {payments !== null && payments.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <Wallet className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Aucun paiement enregistré</p>
            </div>
          )}
          {payments !== null && payments.length > 0 && (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                <tr>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Élève</th>
                  <th className="py-2.5 px-4">Montant</th>
                  <th className="py-2.5 px-4">Statut</th>
                  <th className="py-2.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={`${p.type}-${p.id}`}>
                    <td className="py-2.5 px-4 font-bold text-[#16212B]">{p.type === 'invoice' ? 'Facture' : 'Paiement'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{p.studentName}</td>
                    <td className="py-2.5 px-4 font-mono">{p.amount.toLocaleString('fr-MA')} MAD</td>
                    <td className="py-2.5 px-4 text-slate-500">{p.status}</td>
                    <td className="py-2.5 px-4 text-slate-400">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Tab: Activity (reuses the real auditLogs table, no fabricated columns) */}
      {activeTab === 'activity' && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {activity === null && (
            <div className="p-12 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-4 border-[#2487B8] border-t-transparent animate-spin" />
            </div>
          )}
          {activity !== null && activity.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Aucune activité récente</p>
            </div>
          )}
          {activity !== null && activity.length > 0 && (
            <div className="divide-y divide-slate-100">
              {activity.map((a, i) => (
                <div key={i} className="p-3.5 flex items-center gap-3 text-xs">
                  <KeyRound className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="font-bold text-[#16212B]">{a.action}</span>
                  <span className="text-slate-400">{a.entityType}</span>
                  <span className="text-slate-400 ml-auto">{new Date(a.createdAt).toLocaleString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Unlink confirm dialog */}
      <Dialog open={!!unlinkTarget} onOpenChange={open => !open && setUnlinkTarget(null)}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Délier l'élève</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 mt-2">
            Vous allez délier <strong>{unlinkTarget?.studentName}</strong> de ce tuteur.
            Cette action peut être annulée en recréant le lien depuis le profil de l'élève.
          </p>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setUnlinkTarget(null)} className="rounded-full text-xs h-9">
              Annuler
            </Button>
            <Button
              disabled={unlinking}
              onClick={handleUnlink}
              className="rounded-full text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white border-0"
            >
              {unlinking ? 'Suppression...' : 'Délier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
