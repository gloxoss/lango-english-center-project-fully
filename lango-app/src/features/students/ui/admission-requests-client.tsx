'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Pencil,
  Calendar,
  MapPin,
  UserCheck,
  MessageSquare,
  FileText,
  Loader2,
  Check,
  User,
  Phone,
  Mail,
  GraduationCap,
  Sparkles,
  Send,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';

type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  status: string;
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
type StaffOption = { id: string; fullName?: string; name?: string; email?: string; role?: string };
type Interview = {
  id?: string;
  scheduledAt: string;
  interviewerId: string | null;
  location: string | null;
  status: string;
  notes: string | null;
};
type Comment = { id: string; body: string; createdAt: string; authorName: string | null };

type EditForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  city: string;
  motherTongue: string;
  bloodGroup: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
};

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  applied: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dot: 'bg-amber-500' },
  new: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dot: 'bg-amber-500' },
  in_review: { bg: 'bg-[#DCEBF4]/70 border-[#2487B8]/30', text: 'text-[#1B6C93]', dot: 'bg-[#2487B8]' },
  contacted: { bg: 'bg-[#DCEBF4]/70 border-[#2487B8]/30', text: 'text-[#1B6C93]', dot: 'bg-[#2487B8]' },
  qualified: { bg: 'bg-[#DDF5EC] border-[#17A673]/30', text: 'text-[#17A673]', dot: 'bg-[#17A673]' },
  approved: { bg: 'bg-[#DDF5EC] border-[#17A673]/30', text: 'text-[#17A673]', dot: 'bg-[#17A673]' },
  converted: { bg: 'bg-[#DDF5EC] border-[#17A673]/30', text: 'text-[#17A673]', dot: 'bg-[#17A673]' },
  rejected: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', dot: 'bg-rose-500' },
  lost: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', dot: 'bg-rose-500' },
};

function getStatusBadge(status: string | null | undefined): { bg: string; text: string; dot: string } {
  const s = (status || '').toLowerCase().trim();
  if (STATUS_BADGE[s]) {
    return STATUS_BADGE[s];
  }
  return {
    bg: 'bg-amber-50 border-amber-200/80',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  };
}

function isPendingStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase().trim();
  return s === 'applied' || s === 'new' || s === 'in_review' || s === 'contacted';
}

function toDatetimeLocal(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function computeAge(dateOfBirth: string | null | undefined): string | null {
  if (!dateOfBirth) return null;
  try {
    const birth = new Date(dateOfBirth);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 ? `${age} ans` : null;
  } catch {
    return null;
  }
}

export function AdmissionRequestsClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();

  const getStatusLabel = (status: string | null | undefined) => {
    const s = (status || '').toLowerCase().trim();
    switch (s) {
      case 'applied':
      case 'new':
        return t('applicantReceived') || 'Reçue';
      case 'in_review':
      case 'contacted':
        return t('applicantInReview') || 'En revue';
      case 'approved':
      case 'converted':
      case 'qualified':
        return t('applicantApproved') || 'Approuvée';
      case 'rejected':
      case 'lost':
        return t('applicantRejected') || 'Rejetée';
      default:
        return status ? status.charAt(0).toUpperCase() + status.slice(1) : (t('applicantReceived') || 'Reçue');
    }
  };

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

  // Interview state
  const [interview, setInterview] = useState<Interview | null | undefined>(undefined);
  const [interviewForm, setInterviewForm] = useState({ scheduledAt: '', interviewerId: '', location: 'Salle des entretiens', status: 'scheduled' });
  const [savingInterview, setSavingInterview] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  // Checklist state
  const [togglingField, setTogglingField] = useState<string | null>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

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
      .then(j => j?.success && Array.isArray(j.data) && setClassSections(j.data))
      .catch(() => {});
    fetch('/api/users?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && Array.isArray(j.data) && setStaff(j.data))
      .catch(() => {});
  }, []);

  const filtered = applicants.filter((a) => {
    const matchesStatus = statusFilter === 'all' || isPendingStatus(a.status);
    const term = search.toLowerCase().trim();
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    const email = a.email.toLowerCase();
    const phone = (a.phone || '').toLowerCase();
    const matchesSearch = !term || fullName.includes(term) || email.includes(term) || phone.includes(term);
    return matchesStatus && matchesSearch;
  });

  // Single authoritative candidate selection
  const activeCandidate = (selectedId ? applicants.find(a => a.id === selectedId) : null) ?? filtered[0] ?? null;
  const activeCandidateId = activeCandidate?.id ?? null;

  // Fetch interview and comments for activeCandidateId
  useEffect(() => {
    if (!activeCandidateId) {
      setInterview(null);
      setComments(null);
      setInterviewForm({ scheduledAt: '', interviewerId: '', location: 'Salle des entretiens', status: 'scheduled' });
      return;
    }

    setInterview(undefined);
    setComments(null);
    setInterviewError(null);

    fetch(`/api/students/admissions/${activeCandidateId}/interview`)
      .then(r => r.json())
      .then((j) => {
        if (j?.success) {
          setInterview(j.data);
          if (j.data) {
            setInterviewForm({
              scheduledAt: toDatetimeLocal(j.data.scheduledAt),
              interviewerId: j.data.interviewerId ?? '',
              location: j.data.location ?? 'Salle des entretiens',
              status: j.data.status ?? 'scheduled',
            });
          } else {
            setInterviewForm({
              scheduledAt: '',
              interviewerId: '',
              location: 'Salle des entretiens',
              status: 'scheduled',
            });
          }
        } else {
          setInterview(null);
        }
      })
      .catch(() => setInterview(null));

    fetch(`/api/students/admissions/${activeCandidateId}/comments`)
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setComments(j.data);
        } else {
          setComments([]);
        }
      })
      .catch(() => setComments([]));
  }, [activeCandidateId]);

  const saveInterview = async () => {
    if (!activeCandidateId || !interviewForm.scheduledAt) {
      toast.error('Veuillez renseigner la date et l\'heure de l\'entretien');
      return;
    }

    setSavingInterview(true);
    setInterviewError(null);

    try {
      const res = await fetch(`/api/students/admissions/${activeCandidateId}/interview`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
          interviewerId: interviewForm.interviewerId || undefined,
          location: interviewForm.location?.trim() || undefined,
          status: interviewForm.status,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        const msg = json?.error?.message || json?.message || 'Erreur lors de l\'enregistrement de l\'entretien';
        setInterviewError(msg);
        toast.error(msg);
        return;
      }

      setInterview(json.data);
      toast.success(interview ? 'Entretien mis à jour avec succès' : 'Entretien planifié avec succès');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau';
      setInterviewError(msg);
      toast.error(msg);
    } finally {
      setSavingInterview(false);
    }
  };

  const addComment = async () => {
    if (!activeCandidateId || !newComment.trim()) return;
    setAddingComment(true);
    try {
      const res = await fetch(`/api/students/admissions/${activeCandidateId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message || 'Échec de l\'ajout de la note');
        return;
      }
      setComments(prev => [...(prev ?? []), json.data]);
      setNewComment('');
      toast.success('Note interne enregistrée');
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setAddingComment(false);
    }
  };

  const toggleChecklist = async (
    field: 'checklistDocumentsReceived' | 'checklistInterviewDone' | 'checklistFileComplete',
    currentValue: boolean,
    label: string,
  ) => {
    if (!activeCandidateId) return;
    const nextValue = !currentValue;
    setTogglingField(field);

    // Optimistic UI update
    setApplicants(prev => prev.map(a => (a.id === activeCandidateId ? { ...a, [field]: nextValue } : a)));

    try {
      const res = await fetch(`/api/students/admissions/${activeCandidateId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextValue }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        // Rollback
        setApplicants(prev => prev.map(a => (a.id === activeCandidateId ? { ...a, [field]: currentValue } : a)));
        toast.error('Échec de la mise à jour de la checklist');
        return;
      }
      toast.success(nextValue ? `${label} : Validé ✓` : `${label} : Non validé`);
    } catch {
      setApplicants(prev => prev.map(a => (a.id === activeCandidateId ? { ...a, [field]: currentValue } : a)));
      toast.error('Erreur réseau lors de la mise à jour');
    } finally {
      setTogglingField(null);
    }
  };

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
        body: JSON.stringify({
          id: activeCandidate.id,
          status,
          classSectionId: status === 'approved' && classSectionId ? classSectionId : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || t('errDecisionFailed');
        setError(msg);
        toast.error(msg);
        return;
      }
      if (status === 'approved') {
        setDecisionResult({
          tempPassword: json.data.tempPassword ?? null,
          loginAccessDeliveryStatus: json.data.loginAccessDeliveryStatus ?? null,
        });
        toast.success('Candidature approuvée avec succès !');
      } else if (status === 'in_review') {
        toast.info('Candidature déplacée en revue');
      } else {
        toast.error('Candidature rejetée');
      }
      load();
    } catch {
      setError(tCommon('error'));
      toast.error(tCommon('error'));
    } finally {
      setDeciding(false);
    }
  };

  const openEdit = () => {
    if (!activeCandidate) return;
    setEditForm({
      firstName: activeCandidate.firstName,
      lastName: activeCandidate.lastName,
      email: activeCandidate.email,
      phone: activeCandidate.phone,
      dateOfBirth: activeCandidate.dateOfBirth?.slice(0, 10) ?? '',
      gender: activeCandidate.gender ?? '',
      nationality: activeCandidate.nationality ?? '',
      city: activeCandidate.city ?? '',
      motherTongue: activeCandidate.motherTongue ?? '',
      bloodGroup: activeCandidate.bloodGroup ?? '',
      guardianName: activeCandidate.guardianName ?? '',
      guardianPhone: activeCandidate.guardianPhone ?? '',
      guardianEmail: activeCandidate.guardianEmail ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!activeCandidate || !editForm) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCandidate.id,
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          dateOfBirth: editForm.dateOfBirth || undefined,
          gender: editForm.gender || undefined,
          nationality: editForm.nationality.trim() || undefined,
          city: editForm.city.trim() || undefined,
          motherTongue: editForm.motherTongue.trim() || undefined,
          bloodGroup: editForm.bloodGroup.trim() || undefined,
          guardianName: editForm.guardianName.trim() || undefined,
          guardianPhone: editForm.guardianPhone.trim() || undefined,
          guardianEmail: editForm.guardianEmail.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || t('errUpdateFailed');
        setError(msg);
        toast.error(msg);
        return;
      }
      setEditOpen(false);
      toast.success('Dossier candidat mis à jour');
      load();
    } catch {
      setError(tCommon('error'));
      toast.error(tCommon('error'));
    } finally {
      setSaving(false);
    }
  };

  const canDecide = can('admissions.manage');
  const isFinalized = activeCandidate?.status === 'approved' || activeCandidate?.status === 'converted' || activeCandidate?.status === 'rejected' || activeCandidate?.status === 'lost';
  const canEdit = can('admissions.manage') && !isFinalized;

  const pendingCount = applicants.filter(a => isPendingStatus(a.status)).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('admissionsTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {filtered.length} {statusFilter === 'pending' ? t('pendingFilter') : t('allFilter')} ({applicants.length} au total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-[#2487B8] text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{t('pendingFilter')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {pendingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-[#2487B8] text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{t('allFilter')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {applicants.length}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Applicants Directory */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={tCommon('search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none text-start"
              />
            </div>
          </Card>

          <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            {!loading && filtered.length === 0 && (
              <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
                <p className="text-xs text-slate-400">{t('noAdmissions')}</p>
              </Card>
            )}
            {filtered.map((a) => {
              const isSelected = activeCandidate?.id === a.id;
              const badge = getStatusBadge(a.status);
              const initials = `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`.toUpperCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(a.id);
                    setDecisionResult(null);
                    setError(null);
                  }}
                  className={`w-full text-start p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#2487B8] bg-[#DCEBF4]/25 shadow-xs ring-1 ring-[#2487B8]/30'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                      isSelected ? 'bg-[#2487B8] text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-xs font-bold text-[#16212B] truncate">
                          {a.firstName} {a.lastName}
                        </p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badge.bg} ${badge.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {getStatusLabel(a.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{a.email}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-100">
                        <span>Reçue le {a.applicationDate?.slice(0, 10)}</span>
                        {a.city && <span className="font-medium text-slate-500">{a.city}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-8">
          {!activeCandidate ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Eye className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('selectRequestToView')}</p>
            </Card>
          ) : (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
              {/* Candidate Hero Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] font-black text-lg flex items-center justify-center shrink-0 shadow-2xs">
                    {`${activeCandidate.firstName.charAt(0)}${activeCandidate.lastName.charAt(0)}`.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-extrabold text-[#16212B] tracking-tight">
                        {activeCandidate.firstName} {activeCandidate.lastName}
                      </h2>
                      {(() => {
                        const activeBadge = getStatusBadge(activeCandidate.status);
                        return (
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${activeBadge.bg} ${activeBadge.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${activeBadge.dot}`} />
                            {getStatusLabel(activeCandidate.status)}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dossier déposé le <span className="font-semibold text-slate-700">{activeCandidate.applicationDate?.slice(0, 10)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openEdit}
                      className="h-9 rounded-xl text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      {t('modify')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Bio & Contact Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Email', value: activeCandidate.email, icon: Mail, isLink: `mailto:${activeCandidate.email}` },
                  { label: t('phone'), value: activeCandidate.phone, icon: Phone, isLink: `tel:${activeCandidate.phone}` },
                  {
                    label: t('fieldBirthDate'),
                    value: activeCandidate.dateOfBirth
                      ? `${activeCandidate.dateOfBirth} ${computeAge(activeCandidate.dateOfBirth) ? `(${computeAge(activeCandidate.dateOfBirth)})` : ''}`
                      : null,
                    icon: CalendarDays,
                  },
                  {
                    label: t('fieldGender'),
                    value: activeCandidate.gender === 'male'
                      ? t('genderMale')
                      : activeCandidate.gender === 'female'
                        ? t('genderFemale')
                        : activeCandidate.gender === 'other'
                          ? t('genderOther')
                          : activeCandidate.gender,
                    icon: User,
                  },
                  { label: t('fieldNationality'), value: activeCandidate.nationality, icon: MapPin },
                  { label: t('fieldCity'), value: activeCandidate.city, icon: MapPin },
                  { label: t('fieldMotherTongue'), value: activeCandidate.motherTongue, icon: MessageSquare },
                  { label: t('fieldBloodGroup'), value: activeCandidate.bloodGroup, icon: FileText },
                  { label: t('guardian'), value: activeCandidate.guardianName, icon: UserCheck },
                  { label: t('guardianPhone'), value: activeCandidate.guardianPhone, icon: Phone, isLink: activeCandidate.guardianPhone ? `tel:${activeCandidate.guardianPhone}` : undefined },
                ]
                  .filter(item => item.value)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Icon className="w-3 h-3 shrink-0" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">{item.label}</p>
                        </div>
                        {item.isLink ? (
                          <a
                            href={item.isLink}
                            className="text-xs font-semibold text-[#2487B8] hover:underline mt-1 block truncate"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-xs font-semibold text-[#16212B] mt-1 truncate">{item.value}</p>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Admission Interview Section */}
              <div className="rounded-2xl border border-slate-200/80 p-5 bg-gradient-to-b from-white to-slate-50/40 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#16212B]">Entretien d'admission</h3>
                      <p className="text-[11px] text-slate-500">Planification et affectation de l'évaluation</p>
                    </div>
                  </div>
                  {interview ? (
                    <Badge variant="neutral" className={`text-xs font-bold capitalize px-2.5 py-0.5 rounded-full ${
                      interview.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : interview.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {interview.status === 'completed' ? '✓ Entretien Réalisé' : interview.status === 'cancelled' ? '✕ Annulé' : 'Planifié'}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="text-xs font-bold text-slate-500 bg-slate-100 border-slate-200">
                      Non planifié
                    </Badge>
                  )}
                </div>

                {interview === undefined ? (
                  <div className="py-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                    <p className="text-xs text-slate-400 mt-1">{tCommon('loading')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <label className="flex flex-col gap-1">
                        <span className="font-bold text-slate-600 text-[11px]">Date & Heure *</span>
                        <Input
                          type="datetime-local"
                          value={interviewForm.scheduledAt}
                          onChange={e => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                          className="h-9 rounded-xl text-xs bg-white border-slate-200"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="font-bold text-slate-600 text-[11px]">Interviewer / Responsable</span>
                        <select
                          value={interviewForm.interviewerId}
                          onChange={e => setInterviewForm({ ...interviewForm, interviewerId: e.target.value })}
                          className="h-9 rounded-xl border border-slate-200 px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2487B8]"
                        >
                          <option value="">Sélectionner un interviewer...</option>
                          {staff.map((s) => {
                            const name = s.fullName || s.name || s.email || 'Personnel';
                            const roleTag = s.role === 'teacher' ? 'Enseignant' : s.role === 'school_admin' ? 'Direction' : s.role || 'Staff';
                            return (
                              <option key={s.id} value={s.id}>
                                {name} ({roleTag})
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="font-bold text-slate-600 text-[11px]">Lieu / Salle</span>
                        <Input
                          placeholder="ex. Salle des entretiens A"
                          value={interviewForm.location}
                          onChange={e => setInterviewForm({ ...interviewForm, location: e.target.value })}
                          className="h-9 rounded-xl text-xs bg-white border-slate-200"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="font-bold text-slate-600 text-[11px]">Statut</span>
                        <select
                          value={interviewForm.status}
                          onChange={e => setInterviewForm({ ...interviewForm, status: e.target.value })}
                          className="h-9 rounded-xl border border-slate-200 px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2487B8]"
                        >
                          <option value="scheduled">Planifié</option>
                          <option value="completed">Terminé</option>
                          <option value="cancelled">Annulé</option>
                        </select>
                      </label>
                    </div>

                    {interviewError && (
                      <p className="text-xs text-rose-600 font-semibold">{interviewError}</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-slate-400">
                        {interview ? 'Modifier la date ou le statut enregistre immédiatement l\'historique.' : 'Sélectionnez une date pour créer l\'entretien.'}
                      </p>
                      <Button
                        size="sm"
                        disabled={savingInterview || !interviewForm.scheduledAt}
                        onClick={saveInterview}
                        className="h-9 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 cursor-pointer shadow-2xs"
                      >
                        {savingInterview ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enregistrement...</span>
                          </>
                        ) : (
                          <>
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span>{interview ? 'Mettre à jour l\'entretien' : 'Planifier l\'entretien'}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Admission Checklist Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Checklist de dossier
                    </h3>
                    <p className="text-[11px] text-slate-400">Cliquez pour valider ou invalider chaque étape du dossier</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#2487B8]">
                    {[activeCandidate.checklistDocumentsReceived, activeCandidate.checklistInterviewDone, activeCandidate.checklistFileComplete].filter(Boolean).length} / 3 validées
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      field: 'checklistDocumentsReceived' as const,
                      label: 'Pièces reçues',
                      desc: 'Documents administratifs & d\'identité vérifiés',
                      icon: FileText,
                    },
                    {
                      field: 'checklistInterviewDone' as const,
                      label: 'Entretien fait',
                      desc: 'Entretien d\'admission réalisé et validé',
                      icon: UserCheck,
                    },
                    {
                      field: 'checklistFileComplete' as const,
                      label: 'Dossier complet',
                      desc: 'Dossier final prêt pour décision définitive',
                      icon: CheckCircle2,
                    },
                  ].map(({ field, label, desc, icon: Icon }) => {
                    const isChecked = Boolean(activeCandidate[field]);
                    const isLoading = togglingField === field;
                    return (
                      <button
                        key={field}
                        type="button"
                        disabled={isLoading}
                        onClick={() => toggleChecklist(field, isChecked, label)}
                        className={`group relative flex items-start gap-3 p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                          isChecked
                            ? 'border-[#17A673]/60 bg-[#DDF5EC]/30 shadow-2xs'
                            : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isChecked
                              ? 'bg-[#17A673] text-white shadow-2xs'
                              : 'border border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                          }`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 stroke-[3]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold leading-tight ${isChecked ? 'text-[#16212B]' : 'text-slate-700'}`}>
                            {label}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Internal Notes Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Notes internes (équipe uniquement)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">Confidentiel · Visible uniquement par le personnel</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {comments === null && (
                    <div className="py-3 text-center">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                      <p className="text-[11px] text-slate-400 mt-1">{tCommon('loading')}</p>
                    </div>
                  )}
                  {comments !== null && comments.length === 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 text-center border border-slate-100">
                      <p className="text-xs text-slate-400">Aucune note pour le moment. Ajoutez une observation d'équipe ci-dessous.</p>
                    </div>
                  )}
                  {comments?.map(c => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100/80 text-xs space-y-1">
                      <p className="text-[#16212B] font-medium leading-relaxed">{c.body}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span className="font-semibold text-slate-600">{c.authorName ?? 'Équipe'}</span>
                        <span>{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addComment();
                      }
                    }}
                    placeholder={t('addNotePlaceholder')}
                    className="h-9 rounded-xl text-xs flex-1 bg-white border-slate-200"
                  />
                  <Button
                    size="sm"
                    disabled={addingComment || !newComment.trim()}
                    onClick={addComment}
                    className="h-9 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {addingComment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{tCommon('add')}</span>
                  </Button>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              {/* Decision Result Notice */}
              {decisionResult && (
                <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/40 rounded-2xl text-xs font-semibold text-[#17A673] space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#17A673] shrink-0" />
                    <p className="font-bold text-sm">{t('studentEnrolledSuccess')}</p>
                  </div>
                  {decisionResult.tempPassword && (
                    <div className="bg-white/80 p-2.5 rounded-xl border border-[#17A673]/30 font-mono text-xs text-[#16212B]">
                      {t('tempPasswordNotice', { password: decisionResult.tempPassword })}
                    </div>
                  )}
                  {decisionResult.loginAccessDeliveryStatus === 'no_guardian_phone' && (
                    <p className="text-amber-800 text-[11px]">{t('noPhoneNotice')}</p>
                  )}
                  {decisionResult.loginAccessDeliveryStatus === 'sent' && (
                    <p className="text-[#17A673] text-[11px]">{t('inviteSentSms')}</p>
                  )}
                </div>
              )}

              {/* Decision Action Bar */}
              {canDecide && isPendingStatus(activeCandidate.status) && (
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-[#16212B]">Affectation à une classe (optionnel)</p>
                        <p className="text-[11px] text-slate-400">L'élève sera automatiquement inscrit dans cette section lors de l'approbation</p>
                      </div>
                    </div>
                    <select
                      value={classSectionId}
                      onChange={e => setClassSectionId(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2487B8]"
                    >
                      <option value="">{t('unassigned')}</option>
                      {classSections.map(cs => (
                        <option key={cs.id} value={cs.id}>
                          {cs.className} {cs.sectionName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    {(activeCandidate.status === 'applied' || activeCandidate.status === 'new' || activeCandidate.status === 'contacted') && (
                      <Button
                        disabled={deciding}
                        variant="outline"
                        onClick={() => decide('in_review')}
                        className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {t('applicantInReview')}
                      </Button>
                    )}
                    <Button
                      disabled={deciding}
                      variant="outline"
                      onClick={() => decide('rejected')}
                      className="h-10 px-4 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      {t('applicantRejected')}
                    </Button>
                    <Button
                      disabled={deciding}
                      onClick={() => decide('approved')}
                      className="h-10 px-5 rounded-xl bg-[#17A673] hover:bg-[#149063] text-white text-xs font-bold gap-2 cursor-pointer shadow-2xs"
                    >
                      {deciding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{t('applicantApproved')}</span>
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Edit Applicant Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">{t('editRequest')}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Mettez à jour les informations du candidat. Les modifications restent possibles tant qu&apos;aucune décision définitive n&apos;a été prise.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Prénom *</span>
                <Input
                  value={editForm.firstName}
                  onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Nom *</span>
                <Input
                  value={editForm.lastName}
                  onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Email *</span>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Téléphone *</span>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Date de naissance</span>
                <Input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Genre</span>
                <select
                  value={editForm.gender}
                  onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                  className="h-9 rounded-xl border border-slate-200 px-2.5 text-xs bg-white text-slate-800"
                >
                  <option value="">Non renseigné</option>
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Nationalité</span>
                <Input
                  value={editForm.nationality}
                  onChange={e => setEditForm({ ...editForm, nationality: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Ville</span>
                <Input
                  value={editForm.city}
                  onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Langue maternelle</span>
                <Input
                  value={editForm.motherTongue}
                  onChange={e => setEditForm({ ...editForm, motherTongue: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Groupe sanguin</span>
                <Input
                  value={editForm.bloodGroup}
                  onChange={e => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Tuteur</span>
                <Input
                  value={editForm.guardianName}
                  onChange={e => setEditForm({ ...editForm, guardianName: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">Téléphone tuteur</span>
                <Input
                  type="tel"
                  value={editForm.guardianPhone}
                  onChange={e => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="font-bold text-slate-600">Email tuteur</span>
                <Input
                  type="email"
                  value={editForm.guardianEmail}
                  onChange={e => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
            </div>
          )}
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="h-9 rounded-xl text-xs font-bold"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={saving}
              onClick={saveEdit}
              className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? tCommon('loading') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
