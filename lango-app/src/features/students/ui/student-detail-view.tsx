'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar, Droplet, Globe,
  FileText, CheckCircle2, Wallet, Users, TrendingUp, Pencil, ExternalLink,
  GraduationCap, Undo2, AlertTriangle, IdCard,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';

type GuardianLink = { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; relationshipType: string };
type AttendanceDay = { date: string; status: string; lateMinutes: number | null };
type Payment = { id: string; amount: number; paymentMethod: string; paymentDate: string };

type StudentDetail = {
  id: string;
  role: string;
  matricule: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  nationality: string | null;
  motherTongue: string | null;
  city: string | null;
  bloodGroup: string | null;
  academicYearName: string | null;
  className: string | null;
  status: string;
  photoUrl: string | null;
  createdAt: string;
  guardians: GuardianLink[];
  attendance?: { last30Days: AttendanceDay[]; rate: number | null };
  // Omitted entirely by the API for roles without finance.read (e.g.
  // teacher) - same shape as `attendance` above for accountant.
  payments?: Payment[];
  balanceDue?: number;
  alumniTransitionedAt?: string | null;
  cohortName?: string | null;
  alumniDirectory?: {
    currentEmployer: string | null;
    showName: boolean;
    showCohort: boolean;
    showCurrentEmployer: boolean;
    showContactInfo: boolean;
  } | null;
  alumniRequests?: Array<{
    id: string;
    type: string;
    status: string;
    note: string | null;
    decisionNote: string | null;
    createdAt: string;
  }>;
};

type DocumentStatus = { documentType: string; uploaded: boolean; uploadedAt: string | null };

const DOC_KEY_MAP: Record<string, string> = {
  photo: 'docPhoto',
  birth_certificate: 'docBirthCert',
  school_certificate: 'docSchoolCert',
  guardian_cni: 'docGuardianCni',
  bulletin: 'docReportCards',
};

const MOTHER_TONGUE_KEY_MAP: Record<string, string> = {
  arabic: 'langArabic',
  french: 'langFrench',
  tamazight: 'langTamazight',
  english: 'langEnglish',
  other: 'langOther',
};

type TabId = 'profil' | 'documents' | 'tuteurs' | 'academique' | 'finance';

export function StudentDetailView({ id, locale }: { id: string; locale: string }) {
  const router = useRouter();
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const tGuardians = useTranslations('Guardians');
  const { can } = usePermissions();

  const tabs: { id: TabId; label: string }[] = [
    { id: 'profil', label: t('tabProfile') },
    { id: 'documents', label: t('tabDocuments') },
    { id: 'tuteurs', label: t('tabGuardians') },
    { id: 'academique', label: t('tabAcademic') },
    { id: 'finance', label: t('tabFinance') },
  ];
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('profil');
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionResult, setTransitionResult] = useState<{ tempPassword: string | null; loginAccessDeliveryStatus: string | null } | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [reinstating, setReinstating] = useState(false);
  const [alumniDocs, setAlumniDocs] = useState<{ id: string; documentType: string; verificationCode: string; issuedAt: string; status: string }[] | null>(null);
  const [newDocType, setNewDocType] = useState('transcript');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [issuingDoc, setIssuingDoc] = useState(false);
  const [issueDocError, setIssueDocError] = useState<string | null>(null);
  const [issueCardOpen, setIssueCardOpen] = useState(false);

  const loadAlumniDocs = () => {
    fetch(`/api/students/alumni/${id}/documents`).then(r => r.json()).then(j => j?.success && setAlumniDocs(j.data));
  };

  const handleIssueDocument = async () => {
    if (!newDocFile) return;
    setIssuingDoc(true);
    setIssueDocError(null);
    try {
      const formData = new FormData();
      formData.append('documentType', newDocType);
      formData.append('file', newDocFile);
      const res = await fetch(`/api/students/alumni/${id}/documents`, { method: 'POST', body: formData });
      const json = await res.json();
      if (!json.success) {
        setIssueDocError(json.error?.message || json.message || t('errIssuingFailed'));
        return;
      }
      setNewDocFile(null);
      loadAlumniDocs();
    } catch {
      setIssueDocError(tCommon('error'));
    } finally {
      setIssuingDoc(false);
    }
  };

  const handleTransition = async () => {
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await fetch(`/api/students/${id}/transition-to-alumni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!json.success) {
        setTransitionError(json.error?.message || json.message || t('errTransitionFailed'));
        return;
      }
      setTransitionResult({ tempPassword: json.data.tempPassword ?? null, loginAccessDeliveryStatus: json.data.loginAccessDeliveryStatus ?? null });
      setStudent(prev => (prev ? { ...prev, role: 'alumni' } : prev));
    } catch {
      setTransitionError(tCommon('error'));
    } finally {
      setTransitioning(false);
    }
  };

  const handleReinstate = async () => {
    setReinstating(true);
    try {
      const res = await fetch(`/api/students/${id}/reinstate-from-alumni`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setStudent(prev => (prev ? { ...prev, role: 'student' } : prev));
      }
    } finally {
      setReinstating(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/students?id=${id}`).then(r => r.json()),
      fetch(`/api/students/documents?studentId=${id}`).then(r => (r.ok ? r.json() : { success: false })),
    ])
      .then(([studentJson, docsJson]) => {
        if (studentJson.success) {
          setStudent(studentJson.data);
        } else {
          setError(studentJson.message ?? t('emptyRosterFound'));
        }
        if (docsJson.success) {
          setDocuments(docsJson.data);
        }
      })
      .catch(() => setError(tCommon('error')))
      .finally(() => setLoading(false));
  }, [id, t, tCommon]);

  useEffect(() => {
    if (student?.role === 'alumni') {
      loadAlumniDocs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.role, id]);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">{tCommon('loading')}</div>;
  }

  if (error || !student) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold">
        {error ?? t('emptyRosterFound')}
      </div>
    );
  }

  const initials = student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const totalPaid = (student.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const displayClassLabel = student.className
    ? (student.role === 'alumni' && student.cohortName ? `${student.className} (Promo ${student.cohortName})` : student.className)
    : (student.role === 'alumni' ? (student.cohortName ? `Promo ${student.cohortName}` : 'Ancien(ne) élève') : t('unassigned'));

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <button
        onClick={() => router.push(`/${locale}/dashboard/students`)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#1B6C93] font-semibold transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {t('backToDirectory')}
      </button>

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white text-xl font-extrabold">
            {student.photoUrl
              ? (
                // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded file
                <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                )
              : initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{student.fullName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
              <span className="font-mono">{student.matricule ?? '—'}</span>
              <span className="font-medium text-slate-700">{displayClassLabel}</span>
              {student.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#2487B8]" />{student.phone}</span>}
              {student.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#2487B8]" />{student.email}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge className={student.status === 'Actif' ? 'bg-[#DDF5EC] text-[#17A673] border-none' : 'bg-slate-100 text-slate-500 border-none'}>
              {student.status}
            </Badge>
            {student.role === 'alumni' && (
              <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px]">{t('alumniBadge')}</Badge>
            )}
            {can('cards.issue') && student.role === 'student' && (
              <Button size="sm" onClick={() => setIssueCardOpen(true)} className="h-8 rounded-full text-xs gap-1.5">
                <IdCard className="w-3.5 h-3.5" />
                {t('issueCard')}
              </Button>
            )}
            {can('admissions.manage') && student.role === 'student' && (
              <Button size="sm" variant="outline" onClick={() => setShowTransitionDialog(true)} className="h-8 rounded-full text-xs gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                {t('markAsAlumni')}
              </Button>
            )}
            {can('admissions.manage') && student.role === 'alumni' && (
              <Button size="sm" variant="outline" disabled={reinstating} onClick={handleReinstate} className="h-8 rounded-full text-xs gap-1.5">
                <Undo2 className="w-3.5 h-3.5" />
                {reinstating ? t('reintegrating') : t('reintegrateAsStudent')}
              </Button>
            )}
          </div>
        </div>
        {transitionResult && (
          <div className="mt-4 p-3.5 bg-[#DDF5EC] border border-[#17A673]/30 rounded-xl text-xs font-semibold text-[#17A673] space-y-1">
            <p>{t('transitionSuccess')}</p>
            {transitionResult.tempPassword && <p>{t('tempPasswordNotice', { password: transitionResult.tempPassword })}</p>}
            {transitionResult.loginAccessDeliveryStatus === 'no_phone' && <p className="text-amber-700">{t('noPhoneNotice')}</p>}
            {transitionResult.loginAccessDeliveryStatus === 'sent' && <p>{t('inviteSentSms')}</p>}
          </div>
        )}
      </Card>

      <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('confirmTransitionTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 mt-2">
            {t('confirmTransitionDesc', { name: student.fullName })}
          </p>
          {transitionError && <p className="text-xs font-semibold text-rose-600 mt-2">{transitionError}</p>}
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowTransitionDialog(false)} className="rounded-full text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={transitioning}
              onClick={async () => { await handleTransition(); setShowTransitionDialog(false); }}
              className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white border-0"
            >
              {transitioning ? t('transitionInProgress') : t('confirmTransitionBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.filter(tab => tab.id !== 'finance' || can('finance.read')).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-[#16212B] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profil' && (
        <div className="space-y-6">
          {/* Section Ancien Élève spécifique */}
          {student.role === 'alumni' && (
            <Card className="p-6 bg-gradient-to-br from-slate-50 via-white to-sky-50/20 rounded-2xl border border-[#2487B8]/25 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center font-bold shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#16212B]">Parcours & Statut Ancien Élève</h2>
                    <p className="text-[11px] text-slate-500">Dossier archivé et suivi post-scolaire</p>
                  </div>
                </div>
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[11px] font-bold px-3 py-1">
                  {student.cohortName ? `Promotion ${student.cohortName}` : 'Ancien Élève'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Promotion / Cohorte
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.cohortName ?? student.academicYearName ?? 'Session 2025-2026'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Dernière classe
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.className ?? 'Terminale (Diplômé)'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Date de diplomation / sortie
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.alumniTransitionedAt ? student.alumniTransitionedAt.slice(0, 10) : '—'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Situation actuelle / Études supérieures
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.alumniDirectory?.currentEmployer || 'Université Mohammed VI Polytechnique (UM6P)'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Annuaire des anciens
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${student.alumniDirectory?.showName ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    {student.alumniDirectory?.showName ? 'Visible dans l’annuaire' : 'Profil confidentiel'}
                  </span>
                </div>
              </div>

              {/* Demandes formulées par l'ancien élève */}
              {student.alumniRequests && student.alumniRequests.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <p className="text-[11px] font-extrabold text-[#16212B] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#2487B8]" />
                    Demandes administratives ({student.alumniRequests.length})
                  </p>
                  <div className="space-y-2">
                    {student.alumniRequests.map(req => (
                      <div key={req.id} className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3 text-xs shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#16212B] capitalize">{req.type}</span>
                            <span className="text-[10px] text-slate-400 font-mono">· {req.createdAt.slice(0, 10)}</span>
                          </div>
                          {req.note && <p className="text-slate-500 text-[11px] mt-0.5 truncate">{req.note}</p>}
                        </div>
                        <Badge className={
                          req.status === 'ready' || req.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          req.status === 'refused' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-blue-50 text-blue-700 border border-blue-200'
                        }>
                          {req.status === 'received' ? 'Reçue' : req.status === 'accepted' ? 'Acceptée' : req.status === 'preparing' ? 'En préparation' : req.status === 'ready' ? 'Prête' : req.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Fiche d'Informations Personnelles */}
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                <User className="w-4 h-4 text-[#2487B8]" />
                Informations Personnelles
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: Calendar, label: t('fieldBirthDate'), value: student.dateOfBirth },
                { icon: User, label: t('fieldGender'), value: student.gender === 'male' ? t('genderMale') : student.gender === 'female' ? t('genderFemale') : student.gender === 'other' ? t('genderOther') : null },
                { icon: Globe, label: t('fieldNationality'), value: student.nationality },
                { icon: Globe, label: t('fieldMotherTongue'), value: student.motherTongue ? (MOTHER_TONGUE_KEY_MAP[student.motherTongue] ? t(MOTHER_TONGUE_KEY_MAP[student.motherTongue] as any) : student.motherTongue) : null },
                { icon: MapPin, label: t('fieldCity'), value: student.city },
                { icon: Droplet, label: t('fieldBloodGroup'), value: student.bloodGroup },
                { icon: Calendar, label: t('fieldAcademicYear'), value: student.academicYearName },
                { icon: MapPin, label: t('fieldAddress'), value: student.address, full: true },
              ].map(f => (
                <div key={f.label} className={f.full ? 'sm:col-span-2 lg:col-span-3' : ''}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <f.icon className="w-3 h-3" />
                    {f.label}
                  </label>
                  <p className={`text-sm font-semibold mt-0.5 ${f.value ? 'text-[#16212B]' : 'text-slate-400 font-normal italic'}`}>
                    {f.value || '— Non renseigné'}
                  </p>
                </div>
              ))}
            </div>

            {can('students.update') && (
              <div className="pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" className="h-9 rounded-full text-xs gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  {t('modify')}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'documents' && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {documents.map(doc => (
              <div key={doc.documentType} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className={`flex size-9 items-center justify-center rounded-lg ${doc.uploaded ? 'bg-[#D1F5E8]' : 'bg-slate-100'}`}>
                  {doc.uploaded ? <CheckCircle2 className="size-4 text-[#17A673]" /> : <FileText className="size-4 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#16212B]">{DOC_KEY_MAP[doc.documentType] ? t(DOC_KEY_MAP[doc.documentType] as any) : doc.documentType}</p>
                  <p className="text-[10px] text-slate-400">{doc.uploaded ? t('uploadedOn', { date: doc.uploadedAt?.slice(0, 10) ?? '' }) : t('notProvided')}</p>
                </div>
              </div>
            ))}
            {documents.length === 0 && <p className="text-xs text-slate-400 col-span-full text-center py-8">{t('noDocumentsRecorded')}</p>}
          </div>
        </Card>
      )}

      {activeTab === 'documents' && student.role === 'alumni' && can('admissions.manage') && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-[#16212B]">{t('alumniDocsTitle')}</h3>
          <div className="space-y-2">
            {alumniDocs === null && <p className="text-xs text-slate-400">{tCommon('loading')}</p>}
            {alumniDocs !== null && alumniDocs.filter(d => d.status === 'active').length === 0 && (
              <p className="text-xs text-slate-400">{t('noAlumniDocs')}</p>
            )}
            {alumniDocs?.filter(d => d.status === 'active').map(doc => (
              <div key={doc.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#16212B]">{doc.documentType}</p>
                  <p className="text-[10px] font-mono text-slate-500">{doc.verificationCode}</p>
                </div>
                <span className="text-[10px] text-slate-400">{doc.issuedAt?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <select value={newDocType} onChange={e => setNewDocType(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-xs">
              <option value="transcript">{t('docTypeTranscript')}</option>
              <option value="certificate">{t('docTypeCertificate')}</option>
              <option value="attestation">{t('docTypeAttestation')}</option>
            </select>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setNewDocFile(e.target.files?.[0] ?? null)} className="text-xs flex-1" />
            <Button size="sm" disabled={!newDocFile || issuingDoc} onClick={handleIssueDocument} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {issuingDoc ? t('issuingBtn') : t('issueBtn')}
            </Button>
          </div>
          {issueDocError && <p className="text-xs font-semibold text-rose-600">{issueDocError}</p>}
        </Card>
      )}

      {activeTab === 'tuteurs' && (
        <div className="space-y-3">
          {student.guardians.length === 0 && (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Users className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('noGuardiansLinked')}</p>
            </Card>
          )}
          {student.guardians.map(g => (
            <Card key={g.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#1B6C93] font-extrabold text-sm shrink-0">
                  {`${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#16212B]">{g.firstName} {g.lastName}</p>
                  <p className="text-[10px] text-slate-400">{g.relationshipType} · {g.phone ?? '—'}</p>
                </div>
              </div>
              <Link href={`/${locale}/dashboard/students/parents/${g.id}`} className="flex items-center gap-1 text-xs font-bold text-[#2487B8] hover:underline">
                {tGuardians('viewFullProfile')}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'academique' && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          {student.attendance && student.attendance.last30Days.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-[#16212B]">{t('attendanceLast30Days')}</h3>
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none font-extrabold">
                  {student.attendance.rate !== null ? `${student.attendance.rate}%` : '—'}
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {student.attendance.last30Days.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-xs">
                    <span className="text-slate-500">{a.date}</span>
                    <span className={`font-bold ${a.status === 'present' ? 'text-[#17A673]' : 'text-rose-600'}`}>
                      {a.status}
                      {a.lateMinutes ? ` (+${a.lateMinutes}min)` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : student.role === 'alumni' ? (
            <div className="py-8 text-center space-y-2">
              <GraduationCap className="w-9 h-9 text-[#2487B8] mx-auto opacity-70" />
              <p className="text-xs font-bold text-[#16212B]">Dossier scolaire archivé (Diplômé)</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Les relevés de présence quotidiens sont clôturés depuis la promotion de l&apos;élève ({student.cohortName ? `Promotion ${student.cohortName}` : 'Ancien Élève'}).
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">{tCommon('empty')}</p>
          )}
        </Card>
      )}

      {activeTab === 'finance' && (
        student.payments && student.balanceDue !== undefined
          ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <p className="text-xs font-bold text-slate-400">{t('totalPaid')}</p>
                    <p className="text-xl font-extrabold text-[#16212B]">{totalPaid.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}</p>
                  </Card>
                  <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <p className="text-xs font-bold text-slate-400">{t('balanceDue')}</p>
                    <p className={`text-xl font-extrabold ${student.balanceDue > 0 ? 'text-rose-600' : 'text-[#17A673]'}`}>
                      {student.balanceDue.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
                    </p>
                  </Card>
                </div>
                <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                      <tr>
                        <th className="py-3 px-4">{tCommon('date')}</th>
                        <th className="py-3 px-4">{t('methodHeader')}</th>
                        <th className="py-3 px-4 text-end">{tCommon('total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {student.payments.map(p => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-4 text-slate-500">{p.paymentDate.slice(0, 10)}</td>
                          <td className="py-2.5 px-4 text-slate-600">{p.paymentMethod}</td>
                          <td className="py-2.5 px-4 text-end font-bold text-[#16212B]">{Number(p.amount).toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}</td>
                        </tr>
                      ))}
                      {student.payments.length === 0 && (
                        <tr><td colSpan={3} className="py-8 text-center text-slate-400">{tCommon('empty')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </Card>
                <Link href={`/${locale}/dashboard/finance/invoices?studentId=${student.id}`} className="flex items-center gap-1.5 text-xs font-bold text-[#2487B8] hover:underline w-fit">
                  <Wallet className="w-3.5 h-3.5" />
                  {t('viewStudentInvoices')}
                </Link>
              </div>
            )
          : <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs"><p className="text-xs text-slate-400 text-center py-8">{tCommon('empty')}</p></Card>
      )}

      <IssueCardDialog
        open={issueCardOpen}
        onOpenChange={setIssueCardOpen}
        subjectType="student"
        templateType="student_id"
        subjectId={student.id}
        subjectLabel={t('student')}
        subjectName={student.fullName}
      />
    </div>
  );
}
