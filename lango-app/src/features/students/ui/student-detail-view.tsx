'use client';

import { useEffect, useState, useTransition } from 'react';
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar, Droplet, Globe,
  FileText, CheckCircle2, Wallet, Users, TrendingUp, Pencil, ExternalLink,
  GraduationCap, Undo2, AlertTriangle, IdCard, ShieldCheck, Trash2, UserPlus, Plus,
  Eye, Upload, Download, RefreshCw, ChevronDown, Clock, AlertCircle, ShieldAlert,
  History, BookOpen, Search, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';
import { openDocumentPreview } from '@/features/documents/ui/pdf-preview';

type GuardianLink = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  relationshipType: string;
};

type LegacyGuardian = {
  name: string;
  phone: string | null;
  isVerified: false;
};

type AttendanceDay = { date: string; status: string; lateMinutes: number | null };

type Payment = { id: string; amount: number; paymentMethod: string; paymentDate: string };

type PlacementHistoryItem = {
  id: string;
  sessionYearName: string | null;
  className: string | null;
  sectionName: string | null;
  status: string;
  isCurrent: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

type RecentAssessmentItem = {
  id: string;
  title: string;
  subject?: string;
  score?: number | null;
  maxScore?: number;
  finalPercentage?: number | string | null;
  gradeCode?: string | null;
  termName?: string | null;
  date: string;
};

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
  academicYearId?: string | null;
  academicYearName: string | null;
  className: string | null;
  nationalId?: string | null;
  status: string;
  photoUrl: string | null;
  createdAt: string;
  guardians: GuardianLink[];
  legacyGuardian?: LegacyGuardian | null;
  currentPlacement?: {
    id: string;
    sessionYearName: string | null;
    className: string | null;
    sectionName: string | null;
    status: string;
    isCurrent: boolean;
  } | null;
  placementsHistory?: PlacementHistoryItem[];
  recentAssessments?: RecentAssessmentItem[];
  attendance?: {
    last30Days: AttendanceDay[];
    rate: number | null;
    totalRecorded?: number;
    presentCount?: number;
    absentCount?: number;
    excusedCount?: number;
    lateCount?: number;
  };
  payments?: Payment[];
  totalInvoiced?: number;
  totalPaid?: number;
  balanceDue?: number;
  overdueAmount?: number;
  overdueCount?: number;
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

type DocumentStatus = {
  documentType: string;
  uploaded: boolean;
  uploadedAt: string | null;
  fileExt?: string | null;
  url?: string | null;
};

const DOC_KEY_MAP: Record<string, string> = {
  photo: 'docPhoto',
  birth_certificate: 'docBirthCert',
  school_certificate: 'docSchoolCert',
  guardian_cni: 'docGuardianCni',
  bulletin: 'docReportCards',
};

// Document labels live in StudentDetail.docs.<type>.{label,desc}.
const DOC_TYPES = new Set(['photo', 'birth_certificate', 'school_certificate', 'guardian_cni', 'bulletin']);

// Relationship values are stored as these French words; labels follow the UI language.
const RELATION_KEYS: Record<string, string> = { 'Père': 'father', 'Mère': 'mother', 'Tuteur légal': 'legalGuardian', 'Grand-parent': 'grandparent', 'Oncle / Tante': 'uncleAunt', Autre: 'other', Tuteur: 'guardian' };

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
  const sd = useTranslations('StudentDetail');
  const tHome = useTranslations('DashboardHome');
  const relationLabel = (value: string) => (RELATION_KEYS[value] ? sd(`relations.${RELATION_KEYS[value]}` as 'relations.father') : value);
  const methodLabel = (value: string) => (tHome.has(`method_${value}`) ? tHome(`method_${value}` as 'method_cash') : value);
  const lifecycleLabel = (value: string) => (sd.has(`lifecycle.${value}`) ? sd(`lifecycle.${value}` as 'lifecycle.active') : value);
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

  // Unified Lifecycle Dialog state
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>('active');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Reissue / Card Issue state
  const [issueCardOpen, setIssueCardOpen] = useState(false);

  // Link Guardian Dialog state
  const [showLinkGuardianDialog, setShowLinkGuardianDialog] = useState(false);
  const [guardianSearchQuery, setGuardianSearchQuery] = useState('');
  const [searchedGuardians, setSearchedGuardians] = useState<Array<{ id: string; name: string; phone: string; email: string; relation: string }>>([]);
  const [searchingGuardians, setSearchingGuardians] = useState(false);
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('Père');
  const [linkingGuardian, setLinkingGuardian] = useState(false);
  const [unlinkingGuardianId, setUnlinkingGuardianId] = useState<string | null>(null);

  // Edit Profile Dialog state
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [academicYearsList, setAcademicYearsList] = useState<Array<{ id: string; name: string; isCurrent?: boolean }>>([]);
  const [academicYearsError, setAcademicYearsError] = useState<string | null>(null);
  const [academicYearsRetry, setAcademicYearsRetry] = useState(0);

  // Documents state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [deletingDocType, setDeletingDocType] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    gender: 'male',
    nationality: '',
    motherTongue: 'arabic',
    city: '',
    bloodGroup: '',
    nationalId: '',
    address: '',
    academicYearId: '',
  });

  const reloadStudentData = async () => {
    try {
      const res = await fetch(`/api/students?id=${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setStudent(json.data);
      }
    } catch (err) {
      console.error('Failed to reload student', err);
    }
  };

  const reloadDocuments = async () => {
    try {
      const res = await fetch(`/api/students/documents?studentId=${id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDocuments(json.data);
      }
    } catch (e) {
      console.error('Failed to reload documents', e);
    }
  };

  const handleDocumentUpload = async (docType: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error(sd('fileTooLarge'));
      return;
    }
    setUploadingDocType(docType);
    try {
      const formData = new FormData();
      formData.append('studentId', id);
      formData.append('documentType', docType);
      formData.append('file', file);
      const res = await fetch('/api/students/documents', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success(sd('docUploaded'));
        await reloadDocuments();
      } else {
        toast.error(json.message || sd('uploadError'));
      }
    } catch {
      toast.error(sd('networkError'));
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleDocumentDelete = async (docType: string) => {
    if (!confirm(sd('confirmDeleteDoc'))) return;
    setDeletingDocType(docType);
    try {
      const res = await fetch(`/api/students/documents?studentId=${id}&documentType=${docType}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(sd('docDeleted'));
        await reloadDocuments();
      } else {
        toast.error(json.message || sd('deleteError'));
      }
    } catch {
      toast.error(sd('networkError'));
    } finally {
      setDeletingDocType(null);
    }
  };

  const handleOpenEditProfile = () => {
    if (!student) return;
    setEditForm({
      fullName: student.fullName || '',
      phone: student.phone || '',
      email: student.email || '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
      gender: student.gender || 'male',
      // Empty stays empty: pre-filling 'Marocaine' / 'Casablanca' wrote invented
      // values into the record the moment the form was saved.
      nationality: student.nationality || '',
      motherTongue: student.motherTongue || 'arabic',
      city: student.city || '',
      bloodGroup: student.bloodGroup || '',
      nationalId: student.nationalId || '',
      address: student.address || '',
      academicYearId: student.academicYearId || '',
    });
    setShowEditProfileDialog(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.fullName.trim()) {
      toast.error(sd('fullNameRequired'));
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          fullName: editForm.fullName.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          dateOfBirth: editForm.dateOfBirth || null,
          gender: editForm.gender || null,
          nationality: editForm.nationality.trim() || null,
          motherTongue: editForm.motherTongue || null,
          city: editForm.city.trim() || null,
          bloodGroup: editForm.bloodGroup || null,
          nationalId: editForm.nationalId.trim() || null,
          address: editForm.address.trim() || null,
          academicYearId: editForm.academicYearId || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(sd('profileSaved'));
        setShowEditProfileDialog(false);
        await reloadStudentData();
      } else {
        toast.error(json.message || sd('updateError'));
      }
    } catch {
      toast.error(sd('networkError'));
    } finally {
      setSavingProfile(false);
    }
  };

  // Search guardians via server-side endpoint with debounce
  const searchGuardians = async (query: string) => {
    setSearchingGuardians(true);
    try {
      const res = await fetch(`/api/students/parents?q=${encodeURIComponent(query)}&pageSize=20`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSearchedGuardians(json.data);
      }
    } catch (err) {
      console.error('Failed to search guardians', err);
    } finally {
      setSearchingGuardians(false);
    }
  };

  useEffect(() => {
    if (showLinkGuardianDialog) {
      searchGuardians(guardianSearchQuery);
    }
  }, [showLinkGuardianDialog, guardianSearchQuery]);

  const handleLinkGuardian = async () => {
    if (!selectedGuardianId) return;
    setLinkingGuardian(true);
    try {
      const res = await fetch('/api/students/parents/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardianId: selectedGuardianId,
          studentId: id,
          relationshipType: selectedRelation,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(sd('guardianLinked'));
        setShowLinkGuardianDialog(false);
        setSelectedGuardianId('');
        await reloadStudentData();
      } else {
        toast.error(json.message || sd('linkError'));
      }
    } catch {
      toast.error(sd('networkError'));
    } finally {
      setLinkingGuardian(false);
    }
  };

  const handleUnlinkGuardian = async (guardianId: string) => {
    setUnlinkingGuardianId(guardianId);
    try {
      const res = await fetch(`/api/students/parents/link?guardianId=${guardianId}&studentId=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(sd('guardianUnlinked'));
        await reloadStudentData();
      } else {
        toast.error(json.message || sd('unlinkError'));
      }
    } catch {
      toast.error(sd('networkError'));
    } finally {
      setUnlinkingGuardianId(null);
    }
  };

  // Authoritative Lifecycle status transition
  const handleLifecycleTransition = async () => {
    if (!targetStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          targetStatus,
          reason: statusReason.trim() || sd('defaultStatusReason'),
          effectiveDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(sd('statusUpdated', { status: lifecycleLabel(targetStatus) }));
        setShowStatusDialog(false);
        setStatusReason('');
        await reloadStudentData();
      } else {
        toast.error(json.message || sd('statusError'));
      }
    } catch {
      toast.error(sd('networkError'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch('/api/academics/academic-years')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setAcademicYearsList(j.data);
          setAcademicYearsError(null);
        } else {
          setAcademicYearsError(sd('yearsLoadError'));
        }
      })
      .catch(() => setAcademicYearsError(sd('yearsNetworkError')));
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
  }, [id, academicYearsRetry, t, tCommon]);

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

  // Authoritative financial figures directly from DB aggregates
  const totalInvoiced = student.totalInvoiced ?? 0;
  const totalPaid = student.totalPaid ?? 0;
  const balanceDue = student.balanceDue ?? 0;
  const overdueAmount = student.overdueAmount ?? 0;

  const displayClassLabel = student.className
    ? (student.role === 'alumni' && student.cohortName ? `${student.className} (${sd('cohort', { name: student.cohortName })})` : student.className)
    : (student.role === 'alumni' ? (student.cohortName ? sd('cohort', { name: student.cohortName }) : sd('alumniFallback')) : t('unassigned'));

  // Localized attendance status helper
  const renderAttendanceStatus = (statusStr: string) => {
    const s = statusStr.toLowerCase();
    if (s === 'present') return <span className="font-bold text-[#17A673]">{t('statusPresent')}</span>;
    if (s === 'absent') return <span className="font-bold text-rose-600">{t('statusAbsent')}</span>;
    if (s === 'late') return <span className="font-bold text-amber-600">{t('statusLate')}</span>;
    if (s === 'excused') return <span className="font-bold text-sky-600">{t('statusExcused')}</span>;
    return <span className="font-bold text-slate-600 capitalize">{statusStr}</span>;
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Academic-years load failure — visible with retry, never silent (audit 2026-09-22 P2) */}
      {academicYearsError && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          <span>{academicYearsError}</span>
          <button
            type="button"
            onClick={() => setAcademicYearsRetry(n => n + 1)}
            className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 hover:bg-amber-50 transition-colors cursor-pointer"
          >
            {sd('retry')}
          </button>
        </div>
      )}

      {/* Back to directory */}
      <button
        onClick={() => router.push(`/${locale}/dashboard/students`)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#1B6C93] font-semibold transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {t('backToDirectory')}
      </button>

      {/* STUDENT IDENTITY HEADER */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar / Photo */}
          <div className="w-16 h-16 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white text-xl font-extrabold shadow-xs">
            {student.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- runtime photo
              <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          {/* Core Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{student.fullName}</h1>
              <Badge className={student.status === 'Actif' || student.status === 'active' ? 'bg-[#DDF5EC] text-[#17A673] border-none' : 'bg-slate-100 text-slate-600 border-none'}>
                {student.status}
              </Badge>
              {student.role === 'alumni' && (
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px]">{t('alumniBadge')}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">{student.matricule ?? '—'}</span>
              <span className="font-medium text-slate-700">{displayClassLabel}</span>
              {student.academicYearName && (
                <span className="text-slate-500 font-medium">{sd('session', { name: student.academicYearName })}</span>
              )}
              {student.phone && (
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#2487B8]" />{student.phone}</span>
              )}
              {/* Synthetic placeholder emails like @placeholder.local are filtered in API; only real emails render */}
              {student.email && (
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#2487B8]" />{student.email}</span>
              )}
            </div>
          </div>

          {/* Action Buttons: Responsive Hierarchy */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-start sm:justify-end mt-2 sm:mt-0">
            {/* Primary Action: Cashier */}
            {can('finance.manage') && (
              <Button
                size="sm"
                onClick={() => router.push(`/${locale}/dashboard/finance/collection-desk?studentId=${student.id}`)}
                className="h-8 rounded-full text-xs gap-1.5 bg-[#17A673] hover:bg-[#13885E] text-white font-bold shadow-xs flex-1 sm:flex-initial"
              >
                <Wallet className="w-3.5 h-3.5" />
                {sd('collect')}
              </Button>
            )}

            {/* Desktop Quick Action: Issue Card */}
            {can('cards.issue') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIssueCardOpen(true)}
                className="hidden md:inline-flex h-8 rounded-full text-xs gap-1.5 border-slate-200 font-semibold"
              >
                <IdCard className="w-3.5 h-3.5 text-[#2487B8]" />
                {t('issueCard')}
              </Button>
            )}

            {/* Secondary Actions Dropdown (Prevents stacking large buttons on Mobile) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs gap-1.5 border-slate-200 font-semibold">
                  {sd('actions')}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white rounded-xl shadow-lg border border-slate-200 p-1 text-xs">
                {can('cards.issue') && (
                  <DropdownMenuItem onClick={() => setIssueCardOpen(true)} className="gap-2 cursor-pointer md:hidden">
                    <IdCard className="w-3.5 h-3.5 text-[#2487B8]" />
                    {t('issueCard')}
                  </DropdownMenuItem>
                )}
                {can('students.update') && (
                  <DropdownMenuItem onClick={() => setShowStatusDialog(true)} className="gap-2 cursor-pointer">
                    <History className="w-3.5 h-3.5 text-slate-600" />
                    {t('changeStatus')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openDocumentPreview({ kind: 'student_profile', sourceId: student.id }, locale)} className="gap-2 cursor-pointer">
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  {t('printProfile')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* TABS NAVIGATION */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
        {tabs.filter(tab => tab.id !== 'finance' || can('finance.read')).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-[#16212B] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PROFIL */}
      {activeTab === 'profil' && (
        <div className="space-y-6">
          {/* Academic Context & Enrollment Summary (Authoritative Source: studentPlacements -> sessionYears) */}
          <Card className="p-5 bg-gradient-to-br from-white via-sky-50/20 to-white rounded-2xl border border-[#2487B8]/20 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2487B8]" />
                <h2 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wide">
                  {t('academicContextTitle')}
                </h2>
              </div>
              <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px] font-bold">
                {sd('activePlacement')}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {sd('currentYear')}
                </span>
                <p className="font-extrabold text-[#16212B] mt-0.5">
                  {student.academicYearName || sd('notAssignedF')}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {sd('classSection')}
                </span>
                <p className="font-extrabold text-[#16212B] mt-0.5">
                  {student.className || sd('notAssignedM')}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t('placementStatusLabel')}
                </span>
                <p className="font-extrabold text-emerald-700 mt-0.5 capitalize">
                  {student.currentPlacement?.status
                    ? (t.has(`placementStatuses.${student.currentPlacement.status}`) ? t(`placementStatuses.${student.currentPlacement.status}`) : student.currentPlacement.status)
                    : '—'}
                </p>
              </div>
            </div>
          </Card>

          {/* Section Ancien Élève spécifique si rôle alumni */}
          {student.role === 'alumni' && (
            <Card className="p-6 bg-gradient-to-br from-slate-50 via-white to-sky-50/20 rounded-2xl border border-[#2487B8]/25 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center font-bold shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#16212B]">{sd('alumniTitle')}</h2>
                    <p className="text-[11px] text-slate-500">{sd('alumniSubtitle')}</p>
                  </div>
                </div>
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[11px] font-bold px-3 py-1">
                  {student.cohortName ? sd('promotion', { name: student.cohortName }) : sd('alumniFallback')}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {sd('cohortLabel')}
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.cohortName ?? student.academicYearName ?? '—'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {sd('lastClass')}
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.className ?? '—'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {sd('exitDate')}
                  </span>
                  <p className="text-xs font-bold text-[#16212B]">
                    {student.alumniTransitionedAt ? student.alumniTransitionedAt.slice(0, 10) : '—'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Fiche d'Informations Personnelles */}
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                <User className="w-4 h-4 text-[#2487B8]" />
                {sd('personalInfo')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: Calendar, label: t('fieldBirthDate'), value: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : null },
                {
                  icon: User,
                  label: t('fieldGender'),
                  value: student.gender === 'male' ? t('genderMale') : student.gender === 'female' ? t('genderFemale') : student.gender === 'other' ? t('genderOther') : null,
                },
                { icon: Globe, label: t('fieldNationality'), value: student.nationality },
                {
                  icon: Globe,
                  label: t('fieldMotherTongue'),
                  value: student.motherTongue ? (MOTHER_TONGUE_KEY_MAP[student.motherTongue] ? t(MOTHER_TONGUE_KEY_MAP[student.motherTongue] as any) : student.motherTongue) : null,
                },
                { icon: MapPin, label: t('fieldCity'), value: student.city },
                { icon: Droplet, label: t('fieldBloodGroup'), value: student.bloodGroup },
                { icon: MapPin, label: t('fieldAddress'), value: student.address, full: true },
              ].map(f => (
                <div key={f.label} className={f.full ? 'sm:col-span-2 lg:col-span-3' : ''}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <f.icon className="w-3 h-3" />
                    {f.label}
                  </label>
                  <p className={`text-sm font-semibold mt-0.5 ${f.value ? 'text-[#16212B]' : 'text-slate-400 font-normal italic'}`}>
                    {f.value || `— ${sd('notProvided')}`}
                  </p>
                </div>
              ))}
            </div>

            {can('students.update') && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <Button
                  type="button"
                  onClick={handleOpenEditProfile}
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full text-xs gap-1.5 hover:bg-slate-50 border-slate-200 text-[#16212B] font-semibold"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#2487B8]" />
                  {t('modify')}
                </Button>
              </div>
            )}
          </Card>

          {/* CNDP Moroccan Law 09-08 Informational Treatment (Truthful: removed false "✓ Conforme CNDP" verdict) */}
          <Card className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-[#16212B]">{t('cndpTitle')}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('cndpNotice')}
                </p>
              </div>
            </div>
            <Badge className="bg-slate-200/70 text-slate-700 border border-slate-300 text-[10px] font-bold px-2.5 py-1 shrink-0">
              {sd('cndpBadge')}
            </Badge>
          </Card>
        </div>
      )}

      {/* TAB 2: DOCUMENTS */}
      {activeTab === 'documents' && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-[#16212B]">{sd('docsTitle')}</h2>
              <p className="text-[11px] text-slate-500">
                {sd('docsSubtitle')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadDocuments}
              className="h-8 rounded-full text-xs font-semibold border-slate-200 hover:bg-slate-50 self-start sm:self-auto gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              {sd('refresh')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map(doc => {
              const meta = DOC_TYPES.has(doc.documentType)
                ? { label: sd(`docs.${doc.documentType}.label` as 'docs.photo.label'), desc: sd(`docs.${doc.documentType}.desc` as 'docs.photo.desc') }
                : {
                    label: DOC_KEY_MAP[doc.documentType] ? t(DOC_KEY_MAP[doc.documentType] as any) : doc.documentType,
                    desc: sd('docGenericDesc'),
                  };
              const isUploading = uploadingDocType === doc.documentType;
              const isDeleting = deletingDocType === doc.documentType;
              const isGuardianCniWithoutGuardian = doc.documentType === 'guardian_cni' && student.guardians.length === 0;

              return (
                <div
                  key={doc.documentType}
                  className={`p-4 rounded-2xl border transition-all ${
                    doc.uploaded
                      ? 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/40 to-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                          doc.uploaded
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {doc.uploaded ? <CheckCircle2 className="size-5" /> : <FileText className="size-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#16212B] leading-tight">{meta.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{meta.desc}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              doc.uploaded
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {/* Strictly binary: Fourni or Manquant (no misleading "En attente") */}
                            {doc.uploaded ? t('docProvided') : t('docMissing')}
                          </span>
                          {doc.uploaded && doc.uploadedAt && (
                            <span className="text-[10px] text-slate-400">
                              {sd('uploadedOn', { date: doc.uploadedAt.slice(0, 10) })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning if guardian CNI uploaded but no official guardian relationship exists */}
                  {isGuardianCniWithoutGuardian && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{sd('cniNoGuardian')}</span>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {doc.uploaded && (
                        <>
                          <a
                            href={`/api/students/documents?studentId=${id}&documentType=${doc.documentType}&view=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#1B6C93] hover:bg-[#DCEBF4]/50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {sd('view')}
                          </a>
                          <a
                            href={`/api/students/documents?studentId=${id}&documentType=${doc.documentType}&download=1`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {sd('download')}
                          </a>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#2487B8] hover:bg-[#1B6C93] transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploading ? sd('uploading') : doc.uploaded ? sd('replace') : sd('add')}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          className="hidden"
                          disabled={isUploading}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleDocumentUpload(doc.documentType, file);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {doc.uploaded && (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDocumentDelete(doc.documentType)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={sd('deleteDoc')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {documents.length === 0 && (
              <p className="text-xs text-slate-400 col-span-full text-center py-8">{t('noDocumentsRecorded')}</p>
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: TUTEURS (Relational projection with legacy fallback card) */}
      {activeTab === 'tuteurs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#16212B]">{sd('guardiansTitle')}</h2>
              <p className="text-[11px] text-slate-500">{sd('guardiansSubtitle')}</p>
            </div>
            {can('students.guardians.manage') && (
              <Button
                size="sm"
                onClick={() => {
                  setGuardianSearchQuery(student.legacyGuardian?.name ?? '');
                  setShowLinkGuardianDialog(true);
                }}
                className="h-9 rounded-full text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {sd('linkGuardianButton')}
              </Button>
            )}
          </div>

          {/* Fallback Card if only legacy flat guardian exists and no relational guardian is linked */}
          {student.guardians.length === 0 && student.legacyGuardian && (
            <Card className="p-5 bg-amber-50/70 border border-amber-200/90 rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-[#16212B]">{student.legacyGuardian.name}</p>
                      <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold">
                        {t('declaredGuardianTitle')}
                      </Badge>
                    </div>
                    {student.legacyGuardian.phone && (
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-[#2487B8]" />
                        {student.legacyGuardian.phone}
                      </p>
                    )}
                    <p className="text-[11px] text-amber-900/80 mt-1.5 leading-snug max-w-xl">
                      {t('declaredGuardianNotice')}
                    </p>
                  </div>
                </div>

                {can('students.guardians.manage') && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setGuardianSearchQuery(student.legacyGuardian?.name ?? '');
                      setShowLinkGuardianDialog(true);
                    }}
                    className="h-8 rounded-full text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('confirmGuardianCta')}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Truly empty state: No relational guardian and no legacy string */}
          {student.guardians.length === 0 && !student.legacyGuardian && (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Users className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('noGuardiansLinked')}</p>
              {can('students.guardians.manage') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkGuardianDialog(true)}
                  className="rounded-full text-xs font-bold border-slate-200 mt-2"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {sd('linkFirstGuardian')}
                </Button>
              )}
            </Card>
          )}

          {/* Official Relational Guardians */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {student.guardians.map(g => (
              <Card key={g.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#1B6C93] font-extrabold text-sm shrink-0">
                    {`${g.firstName[0] ?? ''}${g.lastName[0] ?? ''}`.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-[#16212B] truncate">{g.firstName} {g.lastName}</p>
                      <Badge className="bg-slate-100 text-slate-700 text-[10px] font-bold border-none px-2 py-0.5">
                        {relationLabel(g.relationshipType)}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {g.phone || g.email || sd('noContact')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/${locale}/dashboard/students/parents/${g.id}`}
                    className="p-2 rounded-xl text-slate-400 hover:text-[#2487B8] hover:bg-slate-50 transition-colors"
                    title={tGuardians('viewFullProfile')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  {can('students.guardians.manage') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={unlinkingGuardianId === g.id}
                      onClick={() => handleUnlinkGuardian(g.id)}
                      className="p-2 h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={sd('unlinkGuardian')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ACADÉMIQUE */}
      {activeTab === 'academique' && (
        <div className="space-y-6">
          {/* Attendance Section */}
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[#16212B]">{t('attendanceLast30Days')}</h3>
                  <Badge variant="neutral" className="text-[10px] font-semibold text-slate-500 bg-slate-50 border-slate-200">
                    {sd('rateOnRecorded')}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  {sd('presentCount', { count: student.attendance?.presentCount ?? 0 })} / {sd('recordedCount', { count: student.attendance?.totalRecorded ?? 0 })}
                </p>
              </div>
              <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-sm font-extrabold px-3 py-1">
                {student.attendance?.rate !== null && student.attendance?.rate !== undefined ? `${student.attendance.rate}%` : '—'}
              </Badge>
            </div>

            {/* Metric counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">{t('statusPresent')}</span>
                <p className="text-lg font-extrabold text-emerald-700">{student.attendance?.presentCount ?? 0}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                <span className="text-[10px] font-bold text-rose-800 uppercase">{t('statusAbsent')}</span>
                <p className="text-lg font-extrabold text-rose-700">{student.attendance?.absentCount ?? 0}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[10px] font-bold text-amber-800 uppercase">{t('statusLate')}</span>
                <p className="text-lg font-extrabold text-amber-700">{student.attendance?.lateCount ?? 0}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100">
                <span className="text-[10px] font-bold text-sky-800 uppercase">{t('statusExcused')}</span>
                <p className="text-lg font-extrabold text-sky-700">{student.attendance?.excusedCount ?? 0}</p>
              </div>
            </div>

            {/* Attendance Days List */}
            {student.attendance && student.attendance.last30Days.length > 0 ? (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pt-2">
                {student.attendance.last30Days.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
                    <span className="text-slate-600 font-medium">{a.date}</span>
                    <div className="flex items-center gap-1.5">
                      {renderAttendanceStatus(a.status)}
                      {a.lateMinutes ? <span className="text-[10px] text-amber-600 font-mono">(+{a.lateMinutes} min)</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">{sd('noAttendance')}</p>
            )}
          </Card>

          {/* Academic Placement History */}
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
              <History className="w-4 h-4 text-[#2487B8]" />
              {t('placementHistoryTitle')}
            </h3>
            <div className="space-y-2">
              {(student.placementsHistory ?? []).map(p => (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    p.isCurrent ? 'bg-[#EDF5F9] border-[#2487B8]/30 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-[#16212B]">
                      {p.sessionYearName || '—'}
                    </span>
                    <span>·</span>
                    <span>{p.className || sd('classFallback')} {p.sectionName ? `(${p.sectionName})` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isCurrent ? (
                      <Badge className="bg-[#17A673] text-white border-none text-[10px] font-bold">
                        {sd('current')}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-700 border-none text-[10px]">
                        {p.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {(!student.placementsHistory || student.placementsHistory.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-4">{sd('noPlacementHistory')}</p>
              )}
            </div>
          </Card>

          {/* Recent Evaluations / Assessments */}
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2487B8]" />
                {t('recentAssessmentsTitle')}
              </h3>
              <Link
                href={`/${locale}/dashboard/academics/assessment/marksheet`}
                className="text-xs font-bold text-[#2487B8] hover:underline flex items-center gap-1"
              >
                {sd('viewAcademicRecord')}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {(student.recentAssessments ?? []).map(a => (
                <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-[#16212B]">{a.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {[a.subject, a.termName || (a.gradeCode ? sd('mention', { code: a.gradeCode }) : sd('assessment'))].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="font-mono text-sm font-extrabold text-[#1B6C93]">
                      {a.score != null && a.maxScore != null
                        ? `${a.score} / ${a.maxScore}`
                        : a.finalPercentage != null
                          ? `${(Number(a.finalPercentage) * 0.2).toFixed(1)} / 20`
                          : a.gradeCode || '—'}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{a.date?.slice(0, 10)}</p>
                  </div>
                </div>
              ))}
              {(!student.recentAssessments || student.recentAssessments.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-4">{sd('noAssessments')}</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: FINANCE (Authoritative aggregates for Current Session Year) */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Header period notice */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#16212B]">
                {sd('financeTitle')}
              </h2>
              <p className="text-[11px] text-slate-500">
                {sd('financeSubtitle', { year: student.academicYearName || sd('notAssignedF') })}
              </p>
            </div>
            <Link
              href={`/${locale}/dashboard/finance/invoices?studentId=${student.id}`}
              className="text-xs font-bold text-[#2487B8] hover:underline flex items-center gap-1"
            >
              {t('viewStudentInvoices')}
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('totalInvoiced')}</p>
              <p className="text-xl font-extrabold text-[#16212B] mt-1">
                {totalInvoiced.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
              </p>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('totalPaidAmount')}</p>
              <p className="text-xl font-extrabold text-[#17A673] mt-1">
                {totalPaid.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
              </p>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('totalBalance')}</p>
              <p className={`text-xl font-extrabold mt-1 ${balanceDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {balanceDue.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
              </p>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('totalOverdue')}</p>
              <p className={`text-xl font-extrabold mt-1 ${overdueAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {overdueAmount.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
              </p>
            </Card>
          </div>

          {/* Recent Payments Section */}
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wide">
                {sd('recentPayments')}
              </h3>
              <Badge className="bg-slate-100 text-slate-600 border-none text-[10px]">
                {sd('transactions', { count: (student.payments ?? []).length })}
              </Badge>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4 text-start">{tCommon('date')}</th>
                    <th className="py-3 px-4 text-start">{t('methodHeader')}</th>
                    <th className="py-3 px-4 text-end">{tCommon('total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(student.payments ?? []).map(p => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 text-slate-500">{p.paymentDate.slice(0, 10)}</td>
                      <td className="py-2.5 px-4 text-slate-700 font-medium">{methodLabel(p.paymentMethod)}</td>
                      <td className="py-2.5 px-4 text-end font-bold text-[#16212B]">
                        {Number(p.amount).toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
                      </td>
                    </tr>
                  ))}
                  {(!student.payments || student.payments.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400">
                        {sd('noPaymentsPeriod')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (No horizontal scrolling at 390px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {(student.payments ?? []).map(p => (
                <div key={p.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-[#16212B]">{methodLabel(p.paymentMethod)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.paymentDate.slice(0, 10)}</p>
                  </div>
                  <span className="font-extrabold text-[#17A673]">
                    {Number(p.amount).toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {tCommon('currency')}
                  </span>
                </div>
              ))}
              {(!student.payments || student.payments.length === 0) && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {sd('noPayments')}
                </div>
              )}
            </div>
          </Card>

          {/* Cashier CTA Button */}
          {can('finance.manage') && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/${locale}/dashboard/finance/collection-desk?studentId=${student.id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#17A673] hover:bg-[#13885E] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Wallet className="w-4 h-4" />
                {sd('collectAtDesk')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* UNIFIED LIFECYCLE STATUS TRANSITION DIALOG */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <History className="w-5 h-5 text-[#2487B8]" />
              {t('changeStatus')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-2 text-xs">
            <p className="text-slate-600">
              {sd('statusIntro')} <strong>{student.fullName}</strong>
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{sd('newStatus')}</label>
              <select
                value={targetStatus}
                onChange={e => setTargetStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
              >
                {(['active', 'withdrawn', 'transferred', 'graduated', 'archived'] as const).map(s => (
                  <option key={s} value={s}>{lifecycleLabel(s)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{sd('reasonLabel')}</label>
              <textarea
                rows={2}
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                placeholder={sd('reasonPlaceholder')}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-[#16212B] resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowStatusDialog(false)} className="rounded-full text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={updatingStatus}
              onClick={handleLifecycleTransition}
              className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white border-0 font-bold"
            >
              {updatingStatus ? sd('updating') : sd('confirmTransition')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEARCHABLE LINK GUARDIAN DIALOG */}
      <Dialog open={showLinkGuardianDialog} onOpenChange={setShowLinkGuardianDialog}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#2487B8]" />
              {sd('linkDialogTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Search Input for scalability */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">{sd('searchGuardians')}</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={guardianSearchQuery}
                  onChange={e => setGuardianSearchQuery(e.target.value)}
                  placeholder={sd('searchGuardiansPlaceholder')}
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-[#16212B]"
                />
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-1 bg-slate-50/50">
              {searchingGuardians && (
                <p className="text-[11px] text-slate-400 text-center py-3">{sd('searching')}</p>
              )}
              {!searchingGuardians && searchedGuardians.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-3">{sd('noGuardianFound')}</p>
              )}
              {!searchingGuardians && searchedGuardians.map(g => (
                <label
                  key={g.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedGuardianId === g.id
                      ? 'bg-sky-50 border-[#2487B8] text-[#16212B]'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="guardianSelect"
                      checked={selectedGuardianId === g.id}
                      onChange={() => setSelectedGuardianId(g.id)}
                      className="text-[#2487B8]"
                    />
                    <div>
                      <p className="font-extrabold text-[#16212B] leading-tight">{g.name}</p>
                      <p className="text-[10px] text-slate-500">{g.phone || g.email || sd('noContact')}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{relationLabel(g.relation || 'Tuteur')}</span>
                </label>
              ))}
            </div>

            {/* Relationship Type */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">{sd('relationLabel')}</label>
              <select
                value={selectedRelation}
                onChange={e => setSelectedRelation(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
              >
                {(['Père', 'Mère', 'Tuteur légal', 'Grand-parent', 'Oncle / Tante', 'Autre'] as const).map(value => (
                  <option key={value} value={value}>{relationLabel(value)}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLinkGuardianDialog(false)}
              className="rounded-full text-xs h-9"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleLinkGuardian}
              disabled={linkingGuardian || !selectedGuardianId}
              className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              {linkingGuardian ? sd('linking') : sd('confirmLink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT PERSONAL INFO DIALOG */}
      <Dialog open={showEditProfileDialog} onOpenChange={setShowEditProfileDialog}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#2487B8]" />
              {sd('editTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{sd('fullNameRequiredLabel')}</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                  placeholder={sd('fullNamePlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{t('fieldBirthDate')}</label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={e => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{t('fieldGender')}</label>
                <select
                  value={editForm.gender}
                  onChange={e => setEditForm(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                >
                  <option value="male">{t('genderMale')}</option>
                  <option value="female">{t('genderFemale')}</option>
                  <option value="other">{t('genderOther')}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{t('fieldNationality')}</label>
                <input
                  type="text"
                  value={editForm.nationality}
                  onChange={e => setEditForm(prev => ({ ...prev, nationality: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                  placeholder={sd('nationalityPlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{t('fieldMotherTongue')}</label>
                <select
                  value={editForm.motherTongue}
                  onChange={e => setEditForm(prev => ({ ...prev, motherTongue: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                >
                  {Object.entries(MOTHER_TONGUE_KEY_MAP).map(([value, key]) => (
                    <option key={value} value={value}>{t(key as any)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{t('fieldCity')}</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                  placeholder={sd('cityPlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{t('fieldBloodGroup')}</label>
                <select
                  value={editForm.bloodGroup}
                  onChange={e => setEditForm(prev => ({ ...prev, bloodGroup: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                >
                  <option value="">{`-- ${sd('notProvided')} --`}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{sd('phoneLabel')}</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                  placeholder={sd('phonePlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{sd('emailLabel')}</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                  placeholder={sd('emailPlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{sd('massarLabel')}</label>
                <input
                  type="text"
                  value={editForm.nationalId}
                  onChange={e => setEditForm(prev => ({ ...prev, nationalId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
                  placeholder={sd('massarPlaceholder')}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 block">{t('fieldAddress')}</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B] resize-none"
                  placeholder={sd('addressPlaceholder')}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditProfileDialog(false)}
                className="rounded-full text-xs h-9"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={savingProfile || !editForm.fullName.trim()}
                className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
              >
                {savingProfile ? sd('saving') : sd('saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ISSUING STUDENT CARD DIALOG */}
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
