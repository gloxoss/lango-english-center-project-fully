'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle2, XCircle, Eye, Clock } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  status: 'applied' | 'approved' | 'rejected' | 'in_review';
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  gender: string | null;
  nationality: string | null;
  motherTongue: string | null;
  city: string | null;
  bloodGroup: string | null;
  applicationDate: string;
  checklistDocumentsReceived: boolean;
  checklistInterviewDone: boolean;
  checklistFileComplete: boolean;
};

type ClassSectionOption = { id: string; className: string; sectionName: string };
type StaffOption = { id: string; name: string };
type Interview = { scheduledAt: string; interviewerId: string | null; location: string | null; status: string; notes: string | null };
type Comment = { id: string; body: string; createdAt: string; authorName: string | null };

const STATUS_LABEL: Record<Applicant['status'], string> = {
  applied: 'Reçue', in_review: 'En revue', approved: 'Approuvée', rejected: 'Rejetée',
};
const STATUS_BADGE: Record<Applicant['status'], string> = {
  applied: 'bg-amber-100 text-amber-700', in_review: 'bg-[#DCEBF4] text-[#1B6C93]',
  approved: 'bg-[#DDF5EC] text-[#17A673]', rejected: 'bg-rose-100 text-rose-600',
};

// Real admission review workspace (future-implementation/dropped-features-
// rebuild): a single interview per applicant, a staff-only append-only notes
// thread, and a fixed 3-item checklist - on top of the already-real
// GET/PATCH/PUT /api/students/admissions approval flow (matricule/guardian-
// link/login-access generation).
export function AdmissionRequestsClient({ locale: _locale }: { locale?: string } = {}) {
  const { can } = usePermissions();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classSectionId, setClassSectionId] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decisionResult, setDecisionResult] = useState<{ tempPassword: string | null; loginAccessDeliveryStatus: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [interview, setInterview] = useState<Interview | null | undefined>(undefined);
  const [interviewForm, setInterviewForm] = useState({ scheduledAt: '', interviewerId: '', location: '', status: 'scheduled' });
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [newComment, setNewComment] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/students/admissions')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setApplicants(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch('/api/academics/class-sections?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setClassSections(j.data));
    fetch('/api/users?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setStaff(j.data));
  }, []);

  useEffect(() => {
    setInterview(undefined);
    setComments(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const activeIdForFetch = applicants.find(a => a.id === selectedId)?.id ?? applicants[0]?.id;

  useEffect(() => {
    if (!activeIdForFetch) return;
    fetch(`/api/students/admissions/${activeIdForFetch}/interview`).then(r => r.json()).then((j) => {
      if (j?.success) {
        setInterview(j.data);
        if (j.data) {
          setInterviewForm({
            scheduledAt: j.data.scheduledAt?.slice(0, 16) ?? '',
            interviewerId: j.data.interviewerId ?? '',
            location: j.data.location ?? '',
            status: j.data.status ?? 'scheduled',
          });
        }
      }
    });
    fetch(`/api/students/admissions/${activeIdForFetch}/comments`).then(r => r.json()).then(j => j?.success && setComments(j.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdForFetch]);

  const saveInterview = async () => {
    if (!activeIdForFetch || !interviewForm.scheduledAt) return;
    const res = await fetch(`/api/students/admissions/${activeIdForFetch}/interview`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
        interviewerId: interviewForm.interviewerId || undefined,
        location: interviewForm.location || undefined,
        status: interviewForm.status,
      }),
    });
    const json = await res.json();
    if (json?.success) {
      setInterview(json.data);
    }
  };

  const addComment = async () => {
    if (!activeIdForFetch || !newComment.trim()) return;
    const res = await fetch(`/api/students/admissions/${activeIdForFetch}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment.trim() }),
    });
    const json = await res.json();
    if (json?.success) {
      setComments(prev => [...(prev ?? []), json.data]);
      setNewComment('');
    }
  };

  const toggleChecklist = async (field: 'checklistDocumentsReceived' | 'checklistInterviewDone' | 'checklistFileComplete', value: boolean) => {
    if (!activeIdForFetch) return;
    setApplicants(prev => prev.map(a => (a.id === activeIdForFetch ? { ...a, [field]: value } : a)));
    await fetch(`/api/students/admissions/${activeIdForFetch}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const filtered = applicants.filter((a) => {
    const matchesStatus = statusFilter === 'all' || a.status === 'applied' || a.status === 'in_review';
    const matchesSearch = `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const activeCandidate = applicants.find(a => a.id === selectedId) ?? filtered[0] ?? null;

  const decide = async (status: 'approved' | 'rejected' | 'in_review') => {
    if (!activeCandidate) {
      return;
    }
    setDeciding(true);
    setError(null);
    setDecisionResult(null);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeCandidate.id, status, classSectionId: status === 'approved' && classSectionId ? classSectionId : undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec de la décision.');
        return;
      }
      if (status === 'approved') {
        setDecisionResult({ tempPassword: json.data.tempPassword ?? null, loginAccessDeliveryStatus: json.data.loginAccessDeliveryStatus ?? null });
      }
      load();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setDeciding(false);
    }
  };

  const canDecide = can('admissions.manage');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Demandes d&apos;admission</h1>
          <p className="text-xs text-slate-500 mt-1">{filtered.length} demande(s) réelle(s) {statusFilter === 'pending' ? 'en attente' : 'au total'}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStatusFilter('pending')} className={`h-9 px-3 rounded-xl text-xs font-bold ${statusFilter === 'pending' ? 'bg-[#2487B8] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>En attente</button>
          <button onClick={() => setStatusFilter('all')} className={`h-9 px-3 rounded-xl text-xs font-bold ${statusFilter === 'all' ? 'bg-[#2487B8] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Toutes</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-3">
          <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
            </div>
          </Card>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {!loading && filtered.length === 0 && (
              <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
                <p className="text-xs text-slate-400">Aucune demande.</p>
              </Card>
            )}
            {filtered.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedId(a.id); setDecisionResult(null); setError(null); }}
                className={`w-full text-left p-3 rounded-2xl border transition ${(activeCandidate?.id === a.id) ? 'border-[#2487B8] bg-[#DCEBF4]/20' : 'border-slate-200/80 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-[#16212B] truncate">{a.firstName} {a.lastName}</p>
                  <Badge className={`${STATUS_BADGE[a.status]} border-none text-[9px] font-bold shrink-0`}>{STATUS_LABEL[a.status]}</Badge>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{a.email}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          {!activeCandidate
            ? (
                <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
                  <Eye className="w-10 h-10 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">Sélectionnez une demande pour voir le dossier complet.</p>
                </Card>
              )
            : (
                <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-[#16212B]">{activeCandidate.firstName} {activeCandidate.lastName}</h2>
                      <p className="text-xs text-slate-500">Reçue le {activeCandidate.applicationDate.slice(0, 10)}</p>
                    </div>
                    <Badge className={`${STATUS_BADGE[activeCandidate.status]} border-none text-[10px] font-bold`}>{STATUS_LABEL[activeCandidate.status]}</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    {[
                      ['Email', activeCandidate.email],
                      ['Téléphone', activeCandidate.phone],
                      ['Date de naissance', activeCandidate.dateOfBirth],
                      ['Genre', activeCandidate.gender === 'male' ? 'Homme' : activeCandidate.gender === 'female' ? 'Femme' : activeCandidate.gender],
                      ['Nationalité', activeCandidate.nationality],
                      ['Ville', activeCandidate.city],
                      ['Langue maternelle', activeCandidate.motherTongue],
                      ['Groupe sanguin', activeCandidate.bloodGroup],
                      ['Tuteur', activeCandidate.guardianName],
                      ['Téléphone tuteur', activeCandidate.guardianPhone],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                        <p className="font-semibold text-[#16212B] mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Entretien</p>
                      {interview === undefined
                        ? <p className="text-[11px] text-slate-400">Chargement...</p>
                        : (
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                              <Input
                                type="datetime-local"
                                value={interviewForm.scheduledAt}
                                onChange={e => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                                className="h-9 rounded-xl text-xs"
                              />
                              <select value={interviewForm.interviewerId} onChange={e => setInterviewForm({ ...interviewForm, interviewerId: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-2">
                                <option value="">Interviewer...</option>
                                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <Input placeholder="Lieu" value={interviewForm.location} onChange={e => setInterviewForm({ ...interviewForm, location: e.target.value })} className="h-9 rounded-xl text-xs" />
                              <select value={interviewForm.status} onChange={e => setInterviewForm({ ...interviewForm, status: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-2">
                                <option value="scheduled">Planifié</option>
                                <option value="completed">Terminé</option>
                                <option value="cancelled">Annulé</option>
                              </select>
                              <div className="sm:col-span-4">
                                {!interview && <p className="text-[10px] text-slate-400 mb-1">Aucun entretien planifié</p>}
                                <Button size="sm" disabled={!interviewForm.scheduledAt} onClick={saveInterview} className="h-8 rounded-lg bg-[#2487B8] hover:bg-[#1B6C93] text-white text-[11px] font-bold">
                                  {interview ? 'Mettre à jour' : 'Planifier'}
                                </Button>
                              </div>
                            </div>
                          )}
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Notes internes (équipe uniquement)</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
                        {comments === null && <p className="text-[11px] text-slate-400">Chargement...</p>}
                        {comments !== null && comments.length === 0 && <p className="text-[11px] text-slate-400">Aucune note pour le moment</p>}
                        {comments?.map(c => (
                          <div key={c.id} className="p-2 rounded-lg bg-slate-50 text-[11px]">
                            <p className="text-[#16212B]">{c.body}</p>
                            <p className="text-slate-400 mt-0.5">{c.authorName ?? '—'} · {new Date(c.createdAt).toLocaleString('fr-FR')}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ajouter une note..." className="h-8 rounded-lg text-xs flex-1" />
                        <Button size="sm" disabled={!newComment.trim()} onClick={addComment} className="h-8 rounded-lg bg-[#2487B8] hover:bg-[#1B6C93] text-white text-[11px] font-bold">
                          Ajouter
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Checklist de dossier</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        {([
                          ['checklistDocumentsReceived', 'Pièces reçues'],
                          ['checklistInterviewDone', 'Entretien fait'],
                          ['checklistFileComplete', 'Dossier complet'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center gap-1.5 font-semibold text-slate-600">
                            <input
                              type="checkbox"
                              checked={activeCandidate[field]}
                              onChange={e => toggleChecklist(field, e.target.checked)}
                              className="rounded border-slate-300"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

                  {decisionResult && (
                    <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-xl text-xs font-semibold text-[#17A673] space-y-1">
                      <p>Élève inscrit avec succès.</p>
                      {decisionResult.tempPassword && <p>Mot de passe temporaire (à communiquer, affiché une seule fois) : <span className="font-mono">{decisionResult.tempPassword}</span></p>}
                      {decisionResult.loginAccessDeliveryStatus === 'no_guardian_phone' && <p className="text-amber-700">Aucun téléphone tuteur — le lien d&apos;invitation n&apos;a pas pu être envoyé.</p>}
                      {decisionResult.loginAccessDeliveryStatus === 'sent' && <p>Lien d&apos;invitation envoyé (SMS).</p>}
                    </div>
                  )}

                  {canDecide && (activeCandidate.status === 'applied' || activeCandidate.status === 'in_review') && (
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Classe (optionnel) :</label>
                        <select value={classSectionId} onChange={e => setClassSectionId(e.target.value)} className="h-9 px-3 rounded-xl border border-slate-200 text-xs bg-white">
                          <option value="">Non assigné</option>
                          {classSections.map(cs => <option key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button disabled={deciding} onClick={() => decide('approved')} className="h-9 rounded-xl bg-[#17A673] hover:bg-[#149063] text-white text-xs font-bold gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                        </Button>
                        {activeCandidate.status === 'applied' && (
                          <Button disabled={deciding} variant="outline" onClick={() => decide('in_review')} className="h-9 rounded-xl text-xs font-bold gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Mettre en revue
                          </Button>
                        )}
                        <Button disabled={deciding} variant="outline" onClick={() => decide('rejected')} className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> Rejeter
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
        </div>
      </div>
    </div>
  );
}
