'use client';

import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  GraduationCap,
  Hash,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  Send,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  status: string;
  nationalId: string | null;
  branchId: string | null;
  branchName?: string | null;
  sessionYearId: string | null;
  sessionYearName?: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  gender: string | null;
  nationality: string | null;
  motherTongue: string | null;
  city: string | null;
  bloodGroup: string | null;
  applicationDate: string;
  convertedUserId: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  enrolledAt: string | null;
  checklistDocumentsReceived: boolean;
  checklistInterviewDone: boolean;
  checklistFileComplete: boolean;
  derivedChecklist?: {
    documentsReceived: boolean;
    interviewDone: boolean;
    fileComplete: boolean;
  };
  convertedStudent?: {
    id: string;
    matricule: string | null;
    userStatus: string | null;
    className?: string | null;
  } | null;
  interview?: Interview | null;
  comments?: Comment[];
  documents?: Array<{
    id: string;
    documentType: string;
    fileExt: string;
    uploadedAt: string;
  }>;
};

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
  maxStudents?: number | null;
  currentOccupancy?: number;
  branchId?: string | null;
};
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
  nationalId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
};

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  applied: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dot: 'bg-amber-500' },
  in_review: { bg: 'bg-[#DCEBF4]/70 border-[#2487B8]/30', text: 'text-[#1B6C93]', dot: 'bg-[#2487B8]' },
  approved: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', dot: 'bg-teal-600' },
  enrolled: { bg: 'bg-[#DDF5EC] border-[#17A673]/30', text: 'text-[#17A673]', dot: 'bg-[#17A673]' },
  rejected: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', dot: 'bg-rose-500' },
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

function computeAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }
  try {
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) {
      return null;
    }
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 ? age : null;
  } catch {
    return null;
  }
}

export function AdmissionRequestsClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const tScreen = useTranslations('AdmissionRequests');
  const { can } = usePermissions();

  const getDocumentLabel = (docType: string): string => {
    switch (docType) {
      case 'photo': return t('docPhoto');
      case 'birth_certificate': return t('docBirthCertificate');
      case 'school_certificate': return t('docSchoolCertificate');
      case 'guardian_cni': return t('docGuardianCni');
      case 'bulletin': return t('docBulletin');
      default: return docType;
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    const s = (status || '').toLowerCase().trim();
    switch (s) {
      case 'applied':
      case 'new':
        return t('applicantReceived');
      case 'in_review':
      case 'contacted':
        return t('applicantInReview');
      case 'approved':
        return t('applicantApprovedNotEnrolled');
      case 'enrolled':
      case 'converted':
        return t('applicantEnrolled');
      case 'rejected':
      case 'lost':
        return t('applicantRejected');
      default:
        return t('applicantReceived');
    }
  };

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ total: 0, pending: 0, in_review: 0, approved: 0, enrolled: 0, rejected: 0 });
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const listRequestRef = useRef(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<Applicant | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const detailRequestRef = useRef(0);

  // Mobile detail drawer
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Decision actions
  const [deciding, setDeciding] = useState(false);

  // Enrollment Confirmation Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollClassSectionId, setEnrollClassSectionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Checklist state
  const [togglingField, setTogglingField] = useState<string | null>(null);

  // Comments state
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Server load
  const loadList = useCallback(async (pageNum: number, searchStr: string, statusStr: string) => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', '15');
      if (searchStr.trim()) {
        params.set('search', searchStr.trim());
      }
      if (statusStr) {
        params.set('status', statusStr);
      }

      const res = await fetch(`/api/students/admissions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error('Failed loading admissions');
      }
      if (requestId === listRequestRef.current) {
        setListError(false);
        setApplicants(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
        setPage(json.page || 1);
        if (json.summary) {
          setSummary(json.summary);
        }

        // Auto-select first item if current selection not in view
        setSelectedId(previousId => (json.data || []).some((a: Applicant) => a.id === previousId)
          ? previousId
          : json.data?.[0]?.id ?? null);
        if (json.data?.length === 0) {
          setActiveDetail(null);
        }
      }
    } catch {
      if (requestId === listRequestRef.current) {
        setListError(true);
        toast.error(t('toastListLoadError'));
      }
    } finally {
      if (requestId === listRequestRef.current) {
        setLoading(false);
      }
    }
  }, [t]);

  // Load detail for selected applicant
  const loadDetail = async (id: string) => {
    const requestId = ++detailRequestRef.current;
    setLoadingDetail(true);
    setDetailError(false);
    try {
      const res = await fetch(`/api/students/admissions/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error('Failed loading admission details');
      }
      if (requestId === detailRequestRef.current) {
        setActiveDetail(json.data);
      }
    } catch {
      if (requestId === detailRequestRef.current) {
        setDetailError(true);
      }
    } finally {
      if (requestId === detailRequestRef.current) {
        setLoadingDetail(false);
      }
    }
  };

  // Debounced search and filter changes share one request.
  useEffect(() => {
    const handler = setTimeout(() => {
      void loadList(1, search, statusFilter);
    }, 350);
    return () => clearTimeout(handler);
  }, [search, statusFilter, loadList]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const loadSections = async () => {
      try {
        const allSections: ClassSectionOption[] = [];
        for (let nextPage = 1; ; nextPage++) {
          const response = await fetch(`/api/academics/class-sections?page=${nextPage}&pageSize=100`);
          const result = await response.json();
          if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error('Failed loading class sections');
          }
          allSections.push(...result.data);
          if (allSections.length >= result.total) {
            break;
          }
          if (result.data.length === 0) {
            throw new Error('Incomplete class section pages');
          }
        }
        setClassSections(allSections);
      } catch {
        toast.error(tScreen('classesLoadError'));
      }
    };
    void loadSections();
  }, [tScreen]);

  const activeCandidate = (activeDetail?.id === selectedId ? activeDetail : null) || applicants.find(a => a.id === selectedId) || null;
  const activeCandidateAge = computeAge(activeCandidate?.dateOfBirth);

  // Toggle checklist
  const toggleChecklist = async (field: 'checklistDocumentsReceived' | 'checklistInterviewDone' | 'checklistFileComplete', currentValue: boolean, label: string) => {
    if (!activeCandidate) {
      return;
    }
    setTogglingField(field);
    const nextValue = !currentValue;
    try {
      const res = await fetch(`/api/students/admissions/${activeCandidate.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextValue }),
      });
      if (!res.ok) {
        toast.error(t('toastChecklistUpdateFailed'));
        return;
      }
      setActiveDetail(prev => prev ? { ...prev, [field]: nextValue } : null);
      setApplicants(prev => prev.map(a => a.id === activeCandidate.id ? { ...a, [field]: nextValue } : a));
      toast.success(nextValue ? t('toastChecklistValidated', { label }) : t('toastChecklistUnvalidated', { label }));
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setTogglingField(null);
    }
  };

  // Add internal note
  const addComment = async () => {
    if (!activeCandidate || !newComment.trim()) {
      return;
    }
    setAddingComment(true);
    try {
      const res = await fetch(`/api/students/admissions/${activeCandidate.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(tScreen('actionFailed'));
        return;
      }
      setNewComment('');
      loadDetail(activeCandidate.id);
      toast.success(t('toastNoteAdded'));
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setAddingComment(false);
    }
  };

  // Move to review
  const startReview = async () => {
    if (!activeCandidate) {
      return;
    }
    setDeciding(true);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeCandidate.id, status: 'in_review' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(tScreen('actionFailed'));
        return;
      }
      toast.info(t('toastReviewStarted'));
      loadList(page, search, statusFilter);
      loadDetail(activeCandidate.id);
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setDeciding(false);
    }
  };

  // Approve admission (Decision Only!)
  const approveDecisionOnly = async () => {
    if (!activeCandidate) {
      return;
    }
    setDeciding(true);
    try {
      const res = await fetch(`/api/students/admissions/${activeCandidate.id}/approve`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(tScreen('actionFailed'));
        return;
      }
      toast.success(t('toastApprovedSuccess'));
      loadList(page, search, statusFilter);
      loadDetail(activeCandidate.id);
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setDeciding(false);
    }
  };

  // Reject admission with reason
  const confirmRejection = async () => {
    if (!activeCandidate) {
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/students/admissions/${activeCandidate.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(tScreen('rejectFailed'));
        return;
      }
      setRejectModalOpen(false);
      setRejectionReason('');
      toast.success(t('toastRejected'));
      loadList(page, search, statusFilter);
      loadDetail(activeCandidate.id);
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setRejecting(false);
    }
  };

  // Confirm Enrollment (Consequential Conversion Transaction)
  const confirmEnrollment = async () => {
    if (!activeCandidate) {
      return;
    }
    setEnrolling(true);
    try {
      const res = await fetch(`/api/students/admissions/${activeCandidate.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSectionId: enrollClassSectionId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(tScreen('actionFailed'));
        return;
      }
      setEnrollModalOpen(false);
      setEnrollClassSectionId('');
      toast.success(json.data?.matricule
        ? t('toastEnrollmentSuccess', { matricule: json.data.matricule })
        : tScreen('enrolledWithoutMatricule'));
      loadList(page, search, statusFilter);
      loadDetail(activeCandidate.id);
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setEnrolling(false);
    }
  };

  const openEdit = () => {
    if (!activeCandidate) {
      return;
    }
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
      nationalId: activeCandidate.nationalId ?? '',
      guardianName: activeCandidate.guardianName ?? '',
      guardianPhone: activeCandidate.guardianPhone ?? '',
      guardianEmail: activeCandidate.guardianEmail ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!activeCandidate || !editForm) {
      return;
    }
    setSaving(true);
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
          nationalId: editForm.nationalId.trim() || undefined,
          guardianName: editForm.guardianName.trim() || undefined,
          guardianPhone: editForm.guardianPhone.trim() || undefined,
          guardianEmail: editForm.guardianEmail.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(tScreen('actionFailed'));
        return;
      }
      setEditOpen(false);
      toast.success(t('toastSaved'));
      loadList(page, search, statusFilter);
      loadDetail(activeCandidate.id);
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setSaving(false);
    }
  };

  const canManage = can('admissions.manage');
  const isFinalized = activeCandidate?.status === 'approved' || activeCandidate?.status === 'enrolled' || activeCandidate?.status === 'rejected';
  const canEdit = canManage && !isFinalized;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      {/* Top Header */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('admissionsTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('admissionsSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`
              flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5
              text-xs font-bold transition-colors
              ${
    statusFilter === 'pending'
      ? 'bg-[#2487B8] text-white shadow-2xs'
      : `
        border border-slate-200 bg-white text-slate-600
        hover:bg-slate-50
      `
    }
            `}
          >
            <span>{t('pendingFilter')}</span>
            <span className={`
              rounded-full px-1.5 py-0.5 font-mono text-[10px]
              ${statusFilter === 'pending'
      ? `bg-white/20 text-white`
      : `bg-slate-100 text-slate-600`}
            `}
            >
              {summary.pending}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`
              flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5
              text-xs font-bold transition-colors
              ${
    statusFilter === 'approved'
      ? 'bg-teal-600 text-white shadow-2xs'
      : `
        border border-slate-200 bg-white text-slate-600
        hover:bg-slate-50
      `
    }
            `}
          >
            <span>{t('approvedFilter')}</span>
            <span className={`
              rounded-full px-1.5 py-0.5 font-mono text-[10px]
              ${statusFilter === 'approved'
      ? `bg-white/20 text-white`
      : `bg-slate-100 text-slate-600`}
            `}
            >
              {summary.approved}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('enrolled')}
            className={`
              flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5
              text-xs font-bold transition-colors
              ${
    statusFilter === 'enrolled'
      ? 'bg-[#17A673] text-white shadow-2xs'
      : `
        border border-slate-200 bg-white text-slate-600
        hover:bg-slate-50
      `
    }
            `}
          >
            <span>{t('enrolledFilter')}</span>
            <span className={`
              rounded-full px-1.5 py-0.5 font-mono text-[10px]
              ${statusFilter === 'enrolled'
      ? `bg-white/20 text-white`
      : `bg-slate-100 text-slate-600`}
            `}
            >
              {summary.enrolled}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`
              flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5
              text-xs font-bold transition-colors
              ${
    statusFilter === 'all'
      ? 'bg-[#2487B8] text-white shadow-2xs'
      : `
        border border-slate-200 bg-white text-slate-600
        hover:bg-slate-50
      `
    }
            `}
          >
            <span>{t('allFilter')}</span>
            <span className={`
              rounded-full px-1.5 py-0.5 font-mono text-[10px]
              ${statusFilter === 'all'
      ? `bg-white/20 text-white`
      : `bg-slate-100 text-slate-600`}
            `}
            >
              {summary.total}
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid: Master List & Detail Panel */}
      <div className="
        grid grid-cols-1 items-start gap-6
        lg:grid-cols-12
      "
      >
        {/* Master List (Desktop: col-4, Mobile: hidden when mobile detail is active) */}
        <div className={`
          space-y-3
          lg:col-span-4
          ${mobileDetailOpen
      ? `
        hidden
        lg:block
      `
      : `block`}
        `}
        >
          <Card className="
            rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs
          "
          >
            <div className="relative">
              <Search className="
                absolute inset-s-3 top-1/2 size-3.5 -translate-y-1/2
                text-slate-400
              "
              />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="
                  h-9 rounded-xl border-none bg-slate-50 ps-9 text-start text-xs
                "
              />
            </div>
          </Card>

          <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
            {loading && (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
                <p className="mt-2 text-xs text-slate-400">{tCommon('loading')}</p>
              </div>
            )}
            {!loading && listError && (
              <div
                role="alert"
                className="
                  rounded-xl border border-red-200 bg-red-50 p-3 text-xs
                  text-red-700
                "
              >
                {t('toastListLoadError')}
                {' '}
                <button type="button" className="underline" onClick={() => void loadList(page, search, statusFilter)}>{tScreen('retry')}</button>
              </div>
            )}
            {!loading && !listError && applicants.length === 0 && (
              <Card className="
                space-y-2 rounded-2xl border border-slate-200/80 bg-white p-6
                text-center shadow-2xs
              "
              >
                <p className="text-xs font-bold text-slate-700">{t('noAdmissionsInFilter')}</p>
                <p className="text-[11px] text-slate-400">{t('noAdmissionsFilterHint')}</p>
                {(search.trim() !== '' || statusFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                    }}
                    className="
                      mt-2 h-7 cursor-pointer rounded-xl border-slate-200
                      text-xs text-slate-600
                      hover:bg-slate-50
                    "
                  >
                    {t('resetFilters')}
                  </Button>
                )}
              </Card>
            )}
            {!loading && applicants.map((a) => {
              const isSelected = activeCandidate?.id === a.id;
              const badge = getStatusBadge(a.status);
              const initials = `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`.toUpperCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(a.id);
                    setMobileDetailOpen(true);
                  }}
                  className={`
                    w-full cursor-pointer rounded-2xl border p-3.5 text-start
                    transition-all
                    ${
                isSelected
                  ? `
                    border-[#2487B8] bg-[#DCEBF4]/25 shadow-xs ring-1
                    ring-[#2487B8]/30
                  `
                  : `
                    border-slate-200/80 bg-white
                    hover:border-slate-300 hover:bg-slate-50/50
                  `
                }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      flex size-9 shrink-0 items-center justify-center
                      rounded-xl text-xs font-bold
                      ${
                isSelected
                  ? 'bg-[#2487B8] text-white'
                  : `bg-slate-100 text-slate-600`
                }
                    `}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-xs font-bold text-[#16212B]">
                          {a.firstName}
                          {' '}
                          {a.lastName}
                        </p>
                        <span className={`
                          inline-flex shrink-0 items-center gap-1 rounded-full
                          border px-2 py-0.5 text-[10px] font-semibold
                          ${badge.bg}
                          ${badge.text}
                        `}
                        >
                          <span className={`
                            size-1.5 rounded-full
                            ${badge.dot}
                          `}
                          />
                          {getStatusLabel(a.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{a.email}</p>
                      {a.nationalId && (
                        <p className="
                          mt-0.5 font-mono text-[10px] text-slate-600
                        "
                        >
                          {t('massarCode')}
                          {' '}
                          :
                          {a.nationalId}
                        </p>
                      )}
                      <div className="
                        mt-2 flex items-center justify-between border-t
                        border-slate-100 pt-1.5 text-[10px] text-slate-400
                      "
                      >
                        <span>{t('receivedDate', { date: a.applicationDate?.slice(0, 10) })}</span>
                        {a.city && <span className="font-medium text-slate-500">{a.city}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="
              flex items-center justify-between px-2 pt-1 text-xs text-slate-500
            "
            >
              <span>{t('totalRequests', { count: total })}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  aria-label={tScreen('previousPage')}
                  onClick={() => loadList(page - 1, search, statusFilter)}
                  className="size-7 rounded-lg p-0"
                >
                  <ChevronLeft className="
                    size-3.5
                    rtl:rotate-180
                  "
                  />
                </Button>
                <span className="px-2 font-mono text-xs">
                  {page}
                  {' '}
                  /
                  {' '}
                  {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  aria-label={tScreen('nextPage')}
                  onClick={() => loadList(page + 1, search, statusFilter)}
                  className="size-7 rounded-lg p-0"
                >
                  <ChevronRight className="
                    size-3.5
                    rtl:rotate-180
                  "
                  />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Detail Pane (Desktop: col-8, Mobile: visible when mobileDetailOpen is true) */}
        <div className={`
          lg:col-span-8
          ${mobileDetailOpen
      ? 'block'
      : `
        hidden
        lg:block
      `}
        `}
        >
          {/* Mobile Back Button */}
          {mobileDetailOpen && (
            <div className="
              mb-3
              lg:hidden
            "
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileDetailOpen(false)}
                className="gap-1.5 rounded-xl text-xs"
              >
                <ArrowLeft className="
                  size-3.5
                  rtl:rotate-180
                "
                />
                {t('backToList')}
              </Button>
            </div>
          )}

          {applicants.length === 0 && !listError
            ? (
                <Card className="
                  flex flex-col items-center justify-center gap-3 rounded-2xl
                  border border-slate-200/80 bg-white p-12 text-center
                  shadow-2xs
                "
                >
                  <div className="
                    flex size-12 items-center justify-center rounded-2xl
                    bg-slate-100 text-slate-400
                  "
                  >
                    <Search className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{t('noAdmissionsInFilter')}</p>
                    <p className="mt-1 max-w-sm text-xs text-slate-400">
                      {t('noAdmissionsFilterHint')}
                    </p>
                  </div>
                  {(search.trim() !== '' || statusFilter !== 'all') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                      }}
                      className="
                        mt-1 h-8 cursor-pointer rounded-xl border-slate-200 px-3
                        text-xs font-bold text-slate-700
                        hover:bg-slate-50
                      "
                    >
                      {t('resetFilters')}
                    </Button>
                  )}
                </Card>
              )
            : !activeCandidate
                ? (
                    <Card className="
                      flex flex-col items-center justify-center gap-3
                      rounded-2xl border border-slate-200/80 bg-white p-12
                      text-center shadow-2xs
                    "
                    >
                      <Eye className="size-10 text-slate-200" />
                      <p className="text-sm font-bold text-slate-400">{t('selectAdmissionToView')}</p>
                    </Card>
                  )
                : (
                    <Card className="
                      space-y-6 rounded-2xl border border-slate-200/80 bg-white
                      p-6 shadow-2xs
                    "
                    >
                      {loadingDetail && (
                        <p
                          role="status"
                          className="text-xs text-slate-500"
                        >
                          {tCommon('loading')}
                        </p>
                      )}
                      {detailError && (
                        <div role="alert" className="text-xs text-red-700">
                          {tScreen('detailLoadError')}
                          {' '}
                          <button type="button" className="underline" onClick={() => void loadDetail(activeCandidate.id)}>{tScreen('retry')}</button>
                        </div>
                      )}
                      {/* Candidate Hero Card */}
                      <div className="
                        flex flex-col justify-between gap-4 border-b
                        border-slate-100 pb-5
                        sm:flex-row sm:items-center
                      "
                      >
                        <div className="flex items-center gap-4">
                          <div className="
                            flex size-12 shrink-0 items-center justify-center
                            rounded-2xl bg-[#DCEBF4] text-lg font-black
                            text-[#1B6C93] shadow-2xs
                          "
                          >
                            {`${activeCandidate.firstName.charAt(0)}${activeCandidate.lastName.charAt(0)}`.toUpperCase()}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-black text-[#16212B]">
                                {activeCandidate.firstName}
                                {' '}
                                {activeCandidate.lastName}
                              </h2>
                              <span className={`
                                inline-flex items-center gap-1.5 rounded-full
                                border px-2.5 py-0.5 text-xs font-bold
                                ${getStatusBadge(activeCandidate.status).bg}
                                ${getStatusBadge(activeCandidate.status).text}
                              `}
                              >
                                <span className={`
                                  size-1.5 rounded-full
                                  ${getStatusBadge(activeCandidate.status).dot}
                                `}
                                />
                                {getStatusLabel(activeCandidate.status)}
                              </span>
                              {activeCandidate.nationalId && (
                                <Badge
                                  variant="neutral"
                                  className="
                                    bg-slate-50 font-mono text-xs text-slate-700
                                  "
                                >
                                  {t('massarCode')}
                                  {' '}
                                  :
                                  {activeCandidate.nationalId}
                                </Badge>
                              )}
                            </div>
                            <div className="
                              mt-1 flex flex-wrap items-center gap-3 text-xs
                              text-slate-400
                            "
                            >
                              {activeCandidate.branchName && (
                                <span className="
                                  flex items-center gap-1 font-medium
                                  text-slate-600
                                "
                                >
                                  <Building2 className="size-3.5 text-slate-400" />
                                  {activeCandidate.branchName}
                                </span>
                              )}
                              {activeCandidate.sessionYearName && (
                                <span className="
                                  flex items-center gap-1 font-medium
                                  text-slate-600
                                "
                                >
                                  <Calendar className="size-3.5 text-slate-400" />
                                  {activeCandidate.sessionYearName}
                                </span>
                              )}
                              {activeCandidate.applicationDate && <span>{t('submittedOn', { date: activeCandidate.applicationDate.slice(0, 10) })}</span>}
                            </div>
                          </div>
                        </div>

                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={openEdit}
                            className="
                              h-8 cursor-pointer gap-1.5 self-start rounded-xl
                              border-slate-200 px-3 text-xs font-bold
                              text-slate-700
                              hover:bg-slate-50
                              sm:self-auto
                            "
                          >
                            <Pencil className="size-3.5" />
                            <span>{t('modify')}</span>
                          </Button>
                        )}
                      </div>

                      {/* Status Specific Banners */}
                      {activeCandidate.status === 'approved' && !activeCandidate.convertedUserId && (
                        <div className="
                          flex flex-col justify-between gap-4 rounded-2xl border
                          border-teal-200/80 bg-teal-50/70 p-4
                          sm:flex-row sm:items-center
                        "
                        >
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="
                              mt-0.5 size-5 shrink-0 text-teal-600
                            "
                            />
                            <div>
                              <p className="text-xs font-bold text-teal-900">
                                {t('approvedBannerTitle')}
                              </p>
                              <p className="mt-0.5 text-[11px] text-teal-700">
                                {t('approvedBannerSubtitle')}
                              </p>
                            </div>
                          </div>
                          {canManage && (
                            <Button
                              onClick={() => setEnrollModalOpen(true)}
                              className="
                                h-9 shrink-0 cursor-pointer gap-1.5 rounded-xl
                                bg-teal-600 px-4 text-xs font-bold text-white
                                shadow-2xs
                                hover:bg-teal-700
                              "
                            >
                              <GraduationCap className="size-4" />
                              <span>{t('finalizeEnrollment')}</span>
                            </Button>
                          )}
                        </div>
                      )}

                      {activeCandidate.status === 'enrolled' && (
                        <div className="
                          flex flex-col justify-between gap-4 rounded-2xl border
                          border-[#17A673]/30 bg-[#DDF5EC] p-4
                          sm:flex-row sm:items-center
                        "
                        >
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="
                              mt-0.5 size-5 shrink-0 text-[#17A673]
                            "
                            />
                            <div>
                              <p className="text-xs font-bold text-[#16212B]">
                                {t('enrolledBannerTitle')}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                {activeCandidate.convertedStudent?.matricule
                                  ? t('enrolledBannerOfficialMatricule', { matricule: activeCandidate.convertedStudent.matricule })
                                  : t('officialMatricule')}
                                {activeCandidate.enrolledAt && ` · ${t('enrolledBannerDate', { date: activeCandidate.enrolledAt.slice(0, 10) })}`}
                              </p>
                            </div>
                          </div>
                          {activeCandidate.convertedUserId && (
                            <Link
                              href={`/dashboard/students/${activeCandidate.convertedUserId}`}
                              className="
                                inline-flex items-center gap-1.5 rounded-xl
                                border border-[#17A673]/30 bg-white px-3 py-1.5
                                text-xs font-bold text-[#17A673] shadow-2xs
                                hover:underline
                              "
                            >
                              <span>{t('viewStudentProfile')}</span>
                              <ExternalLink className="
                                size-3.5
                                rtl:rotate-180
                              "
                              />
                            </Link>
                          )}
                        </div>
                      )}

                      {activeCandidate.status === 'rejected' && (
                        <div className="
                          flex items-start gap-3 rounded-2xl border
                          border-rose-200 bg-rose-50 p-4
                        "
                        >
                          <XCircle className="
                            mt-0.5 size-5 shrink-0 text-rose-500
                          "
                          />
                          <div>
                            <p className="text-xs font-bold text-rose-900">{t('rejectedBannerTitle')}</p>
                            {activeCandidate.rejectionReason && (
                              <p className="mt-1 text-[11px] text-rose-700">
                                {t('rejectionReasonPrefix', { reason: activeCandidate.rejectionReason })}
                              </p>
                            )}
                            {activeCandidate.rejectedAt && (
                              <p className="mt-0.5 text-[10px] text-rose-500">
                                {t('decisionDatePrefix', { date: activeCandidate.rejectedAt.slice(0, 10) })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Information Cards */}
                      <div className="
                        grid grid-cols-1 gap-4
                        md:grid-cols-2
                      "
                      >
                        {/* Candidate Info */}
                        <div className="
                          space-y-2.5 rounded-2xl border border-slate-100
                          bg-slate-50/70 p-4
                        "
                        >
                          <p className="
                            text-xs font-extrabold tracking-wider text-slate-600
                            uppercase
                          "
                          >
                            {t('candidateInfoTitle')}
                          </p>
                          <div className="space-y-1.5 text-xs text-slate-600">
                            <p className="flex items-center gap-2">
                              <Mail className="size-3.5 text-slate-400" />
                              <span>{activeCandidate.email}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Phone className="size-3.5 text-slate-400" />
                              <span>{activeCandidate.phone}</span>
                            </p>
                            {activeCandidate.dateOfBirth && (
                              <p className="flex items-center gap-2">
                                <Calendar className="size-3.5 text-slate-400" />
                                <span>
                                  {activeCandidate.dateOfBirth.slice(0, 10)}
                                  {activeCandidateAge != null ? ` (${t('ageYears', { years: activeCandidateAge })})` : ''}
                                </span>
                              </p>
                            )}
                            {activeCandidate.city && (
                              <p className="flex items-center gap-2">
                                <MapPin className="size-3.5 text-slate-400" />
                                <span>{activeCandidate.city}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Guardian Info */}
                        <div className="
                          space-y-2.5 rounded-2xl border border-slate-100
                          bg-slate-50/70 p-4
                        "
                        >
                          <p className="
                            text-xs font-extrabold tracking-wider text-slate-600
                            uppercase
                          "
                          >
                            {t('guardianInfoTitle')}
                          </p>
                          <div className="space-y-1.5 text-xs text-slate-600">
                            <p className="font-bold text-[#16212B]">
                              {activeCandidate.guardianName || t('notSpecified')}
                            </p>
                            {activeCandidate.guardianPhone && (
                              <p className="flex items-center gap-2">
                                <Phone className="size-3.5 text-slate-400" />
                                <span>{activeCandidate.guardianPhone}</span>
                              </p>
                            )}
                            {activeCandidate.guardianEmail && (
                              <p className="flex items-center gap-2">
                                <Mail className="size-3.5 text-slate-400" />
                                <span>{activeCandidate.guardianEmail}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Uploaded Documents Inspection Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="
                            text-xs font-extrabold tracking-wider text-slate-700
                            uppercase
                          "
                          >
                            {t('documentsSectionTitle')}
                          </h3>
                          <span className="text-[10px] text-slate-400">
                            {t('uploadedDocumentsCount', { count: activeDetail?.documents?.length ?? 0 })}
                          </span>
                        </div>

                        <div className="
                          grid grid-cols-1 gap-2.5
                          sm:grid-cols-2
                          lg:grid-cols-3
                        "
                        >
                          {['photo', 'birth_certificate', 'school_certificate', 'guardian_cni', 'bulletin'].map((docType) => {
                            const uploadedDoc = activeDetail?.documents?.find(d => d.documentType === docType);
                            const label = getDocumentLabel(docType);
                            return (
                              <div
                                key={docType}
                                className={`
                                  flex flex-col justify-between gap-2
                                  rounded-2xl border p-3 text-xs
                                  ${
                              uploadedDoc
                                ? 'border-slate-200/80 bg-white shadow-2xs'
                                : `
                                  border-dashed border-slate-200 bg-slate-50/50
                                  text-slate-400
                                `
                              }
                                `}
                              >
                                <div className="
                                  flex items-start justify-between gap-2
                                "
                                >
                                  <div>
                                    <p className={`
                                      text-xs font-bold
                                      ${uploadedDoc
                                ? `text-[#16212B]`
                                : `text-slate-500`}
                                    `}
                                    >
                                      {label}
                                    </p>
                                    <p className="
                                      mt-0.5 text-[10px] text-slate-400
                                    "
                                    >
                                      {uploadedDoc ? t('docUploadedExt', { ext: uploadedDoc.fileExt }) : t('docNotProvided')}
                                    </p>
                                  </div>
                                  {uploadedDoc
                                    ? (
                                        <span className="
                                          mt-1 size-2 shrink-0 rounded-full
                                          bg-[#17A673]
                                        "
                                        />
                                      )
                                    : (
                                        <span className="
                                          mt-1 size-2 shrink-0 rounded-full
                                          bg-slate-300
                                        "
                                        />
                                      )}
                                </div>

                                {uploadedDoc && (
                                  <div className="
                                    flex items-center gap-1.5 border-t
                                    border-slate-100 pt-1
                                  "
                                  >
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(`/api/students/admissions/${activeCandidate.id}/documents/${docType}`, '_blank')}
                                      className="
                                        h-7 gap-1 rounded-lg border-slate-200
                                        px-2.5 text-[11px] font-bold
                                        text-slate-700
                                        hover:bg-slate-50
                                      "
                                    >
                                      <ExternalLink className="
                                        size-3 text-slate-400
                                      "
                                      />
                                      <span>{t('inspectDocument')}</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => window.open(`/api/students/admissions/${activeCandidate.id}/documents/${docType}?download=1`, '_blank')}
                                      aria-label={tScreen('downloadDocument', { name: label })}
                                      className="
                                        h-7 rounded-lg px-2 text-[11px]
                                        font-bold text-slate-600
                                        hover:bg-slate-100
                                      "
                                    >
                                      <Download className="size-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Checklist Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="
                            text-xs font-extrabold tracking-wider text-slate-700
                            uppercase
                          "
                          >
                            {t('checklistTitle')}
                          </h3>
                          <span className="text-[10px] text-slate-400">{t('checklistSubtitle')}</span>
                        </div>

                        <div className="
                          grid grid-cols-1 gap-3
                          sm:grid-cols-3
                        "
                        >
                          {[
                            {
                              field: 'checklistInterviewDone' as const,
                              label: t('checklistInterviewDoneTitle'),
                              desc: t('checklistInterviewDoneDesc'),
                              isChecked: activeCandidate.derivedChecklist?.interviewDone ?? activeCandidate.checklistInterviewDone,
                            },
                            {
                              field: 'checklistDocumentsReceived' as const,
                              label: t('checklistDocsReceivedTitle'),
                              desc: t('checklistDocsReceivedDesc'),
                              isChecked: activeCandidate.derivedChecklist?.documentsReceived ?? activeCandidate.checklistDocumentsReceived,
                            },
                            {
                              field: 'checklistFileComplete' as const,
                              label: t('checklistFileCompleteTitle'),
                              desc: t('checklistFileCompleteDesc'),
                              isChecked: activeCandidate.derivedChecklist?.fileComplete ?? activeCandidate.checklistFileComplete,
                            },
                          ].map(({ field, label, desc, isChecked }) => {
                            const isToggling = togglingField === field;
                            return (
                              <button
                                key={field}
                                type="button"
                                disabled={isToggling || isFinalized}
                                onClick={() => toggleChecklist(field, isChecked, label)}
                                className={`
                                  cursor-pointer rounded-2xl border p-3.5
                                  text-start transition-all
                                  ${
                              isChecked
                                ? `
                                  border-[#17A673]/60 bg-[#DDF5EC]/30 shadow-2xs
                                `
                                : `
                                  border-slate-200/80 bg-slate-50/50
                                  hover:border-slate-300 hover:bg-slate-50
                                `
                              }
                                `}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={`
                                      mt-0.5 flex size-5 shrink-0 items-center
                                      justify-center rounded-lg
                                      ${
                              isChecked
                                ? 'bg-[#17A673] text-white'
                                : `
                                  border border-slate-300 bg-white
                                  text-transparent
                                `
                              }
                                    `}
                                  >
                                    {isToggling
                                      ? (
                                          <Loader2 className="
                                            size-3 animate-spin text-slate-500
                                          "
                                          />
                                        )
                                      : (
                                          <Check className="size-3.5 stroke-3" />
                                        )}
                                  </div>
                                  <div>
                                    <p className={`
                                      text-xs font-bold
                                      ${isChecked
                                ? `text-[#16212B]`
                                : `text-slate-700`}
                                    `}
                                    >
                                      {label}
                                    </p>
                                    <p className="
                                      mt-0.5 text-[10px] leading-snug
                                      text-slate-400
                                    "
                                    >
                                      {desc}
                                    </p>
                                  </div>
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
                            <MessageSquare className="size-3.5 text-slate-400" />
                            <h3 className="
                              text-xs font-extrabold tracking-wider
                              text-slate-700 uppercase
                            "
                            >
                              {t('internalNotesTitle')}
                            </h3>
                          </div>
                          <span className="text-[10px] text-slate-400">{t('internalNotesSubtitle')}</span>
                        </div>

                        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                          {(!activeDetail?.comments || activeDetail.comments.length === 0)
                            ? (
                                <div className="
                                  rounded-xl border border-slate-100 bg-slate-50
                                  p-4 text-center
                                "
                                >
                                  <p className="text-xs text-slate-400">{t('noInternalNotes')}</p>
                                </div>
                              )
                            : (
                                activeDetail.comments.map(c => (
                                  <div
                                    key={c.id}
                                    className="
                                      space-y-1 rounded-xl border
                                      border-slate-100/80 bg-slate-50 p-3
                                      text-xs
                                    "
                                  >
                                    <p className="
                                      leading-relaxed font-medium text-[#16212B]
                                    "
                                    >
                                      {c.body}
                                    </p>
                                    <div className="
                                      flex items-center justify-between pt-1
                                      text-[10px] text-slate-400
                                    "
                                    >
                                      <span className="
                                        font-semibold text-slate-600
                                      "
                                      >
                                        {c.authorName ?? t('administrativeTeam')}
                                      </span>
                                      <span>{new Date(c.createdAt).toLocaleString(_locale === 'ar' ? 'ar-MA' : _locale === 'en' ? 'en-GB' : 'fr-FR')}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                addComment();
                              }
                            }}
                            placeholder={t('addNotePlaceholder')}
                            className="
                              h-9 flex-1 rounded-xl border-slate-200 bg-white
                              text-xs
                            "
                          />
                          <Button
                            size="sm"
                            disabled={addingComment || !newComment.trim()}
                            onClick={addComment}
                            className="
                              h-9 cursor-pointer gap-1.5 rounded-xl bg-[#2487B8]
                              px-4 text-xs font-bold text-white shadow-2xs
                              hover:bg-[#1B6C93]
                            "
                          >
                            {addingComment
                              ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                )
                              : (
                                  <Send className="size-3.5" />
                                )}
                            <span>{tCommon('add')}</span>
                          </Button>
                        </div>
                      </div>

                      {/* Decision Action Bar */}
                      {canManage && (activeCandidate.status === 'applied' || activeCandidate.status === 'in_review') && (
                        <div className="
                          flex flex-wrap items-center justify-end gap-2.5
                          border-t border-slate-100 pt-5
                        "
                        >
                          {activeCandidate.status === 'applied' && (
                            <Button
                              disabled={deciding}
                              variant="outline"
                              onClick={startReview}
                              className="
                                h-10 cursor-pointer gap-1.5 rounded-xl
                                border-slate-200 px-4 text-xs font-bold
                                text-slate-700
                                hover:bg-slate-50
                              "
                            >
                              <Clock className="size-3.5 text-slate-500" />
                              <span>{t('applicantInReview')}</span>
                            </Button>
                          )}
                          <Button
                            disabled={deciding}
                            variant="outline"
                            onClick={() => setRejectModalOpen(true)}
                            className="
                              h-10 cursor-pointer gap-1.5 rounded-xl
                              border-rose-200 px-4 text-xs font-bold
                              text-rose-600
                              hover:bg-rose-50
                            "
                          >
                            <XCircle className="size-3.5 text-rose-500" />
                            <span>{t('applicantRejected')}</span>
                          </Button>
                          <Button
                            disabled={deciding}
                            onClick={approveDecisionOnly}
                            className="
                              h-10 cursor-pointer gap-2 rounded-xl bg-teal-600
                              px-5 text-xs font-bold text-white shadow-2xs
                              hover:bg-teal-700
                            "
                          >
                            {deciding
                              ? (
                                  <Loader2 className="size-4 animate-spin" />
                                )
                              : (
                                  <CheckCircle2 className="size-4" />
                                )}
                            <span>{t('approveAdmissionAction')}</span>
                          </Button>
                        </div>
                      )}
                    </Card>
                  )}
        </div>
      </div>

      {/* Enrollment Confirmation Modal */}
      <Dialog open={enrollModalOpen} onOpenChange={setEnrollModalOpen}>
        <DialogContent className="max-w-xl space-y-4 rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-lg font-extrabold text-[#16212B]
            "
            >
              <GraduationCap className="size-5 text-teal-600" />
              <span>{t('enrollmentModalTitle')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t('enrollmentModalSubtitle')}
            </DialogDescription>
          </DialogHeader>

          {activeCandidate && (
            <div className="space-y-4 pt-1 text-xs">
              {/* Candidate Info Box */}
              <div className="
                space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5
              "
              >
                <div className="
                  flex items-center justify-between text-sm font-bold
                  text-[#16212B]
                "
                >
                  <span>
                    {activeCandidate.firstName}
                    {' '}
                    {activeCandidate.lastName}
                  </span>
                  {activeCandidate.nationalId && (
                    <span className="
                      rounded-sm bg-slate-200/80 px-2 py-0.5 font-mono text-xs
                      text-slate-700
                    "
                    >
                      {t('massarCode')}
                      {' '}
                      :
                      {activeCandidate.nationalId}
                    </span>
                  )}
                </div>
                <div className="
                  flex flex-wrap items-center gap-3 text-[11px] text-slate-500
                "
                >
                  <span>
                    {t('targetBranch')}
                    {' '}
                    :
                    {' '}
                    <strong className="text-slate-700">{activeCandidate.branchName || t('notSpecified')}</strong>
                  </span>
                  <span>
                    {t('targetSessionYear')}
                    {' '}
                    :
                    {' '}
                    <strong className="text-slate-700">{activeCandidate.sessionYearName || t('notSpecified')}</strong>
                  </span>
                </div>
              </div>

              {/* Class & Section Selection */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  {t('classSectionSelect')}
                </label>
                <select
                  value={enrollClassSectionId}
                  onChange={e => setEnrollClassSectionId(e.target.value)}
                  className="
                    h-10 w-full rounded-xl border border-slate-200 bg-white px-3
                    text-xs text-slate-800
                    focus:ring-1 focus:ring-[#2487B8] focus:outline-none
                  "
                >
                  <option value="">{t('unassignedClassOption')}</option>
                  {classSections.map((cs) => {
                    const isFull = cs.maxStudents != null && (cs.currentOccupancy ?? 0) >= cs.maxStudents;
                    return (
                      <option key={cs.id} value={cs.id} disabled={isFull}>
                        {cs.className}
                        {' '}
                        {cs.sectionName}
                        {' '}
                        —
                        {' '}
                        {cs.currentOccupancy ?? 0}
                        /
                        {cs.maxStudents ?? t('sectionCapacityUnconfigured')}
                        {' '}
                        {t('placesWord')}
                        {' '}
                        {isFull ? `(${t('sectionFull').toUpperCase()})` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400">
                  {t('unassignedClassNotice')}
                </p>
              </div>

              {/* Guardian Resolution Info */}
              <div className="
                flex items-start gap-2.5 rounded-xl border border-teal-100
                bg-teal-50/60 p-3
              "
              >
                <UserCheck className="mt-0.5 size-4 shrink-0 text-teal-600" />
                <div>
                  <p className="text-xs font-bold text-teal-900">{t('guardianManagementTitle')}</p>
                  <p className="mt-0.5 text-[11px] text-teal-800">
                    {activeCandidate.guardianPhone
                      ? t('guardianManagementNotice')
                      : t('guardianManagementEmpty')}
                  </p>
                </div>
              </div>

              {/* Official Matricule Notice */}
              <div className="
                flex items-start gap-2.5 rounded-xl border border-slate-100
                bg-slate-50 p-3
              "
              >
                <Hash className="mt-0.5 size-4 shrink-0 text-slate-500" />
                <p className="text-[11px] text-slate-600">
                  {t('matriculeWillBeGenerated')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={enrolling}
              onClick={() => setEnrollModalOpen(false)}
              className="rounded-xl text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={enrolling}
              onClick={confirmEnrollment}
              className="
                h-9 cursor-pointer gap-1.5 rounded-xl bg-[#17A673] px-4 text-xs
                font-bold text-white shadow-2xs
                hover:bg-[#149063]
              "
            >
              {enrolling
                ? <Loader2 className="size-3.5 animate-spin" />
                : (
                    <CheckCircle2 className="size-3.5" />
                  )}
              <span>{t('confirmEnrollment')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md space-y-4 rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-lg font-extrabold text-[#16212B]
            "
            >
              <XCircle className="size-5 text-rose-600" />
              <span>{t('rejectionModalTitle')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t('rejectionModalSubtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-xs">
            <label className="block font-bold text-slate-700">
              {t('rejectionReasonLabel')}
            </label>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder={t('rejectionReasonPlaceholder')}
              rows={3}
              className="
                w-full resize-none rounded-xl border border-slate-200 bg-white
                p-2.5 text-xs text-slate-800
                focus:ring-1 focus:ring-rose-500 focus:outline-none
              "
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rejecting}
              onClick={() => setRejectModalOpen(false)}
              className="rounded-xl text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={rejecting}
              onClick={confirmRejection}
              className="
                h-9 cursor-pointer gap-1.5 rounded-xl bg-rose-600 px-4 text-xs
                font-bold text-white shadow-2xs
                hover:bg-rose-700
              "
            >
              {rejecting
                ? <Loader2 className="size-3.5 animate-spin" />
                : (
                    <XCircle className="size-3.5" />
                  )}
              <span>{t('confirmRejection')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Applicant Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">{t('editRequest')}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t('editCandidateSubtitle')}
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="
              grid grid-cols-1 gap-3 pt-2
              sm:grid-cols-2
            "
            >
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">
                  {t('firstName')}
                  {' '}
                  *
                </span>
                <Input
                  value={editForm.firstName}
                  onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">
                  {t('lastName')}
                  {' '}
                  *
                </span>
                <Input
                  value={editForm.lastName}
                  onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">
                  {t('email')}
                  {' '}
                  *
                </span>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">
                  {t('phone')}
                  {' '}
                  *
                </span>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">
                  {t('massarCode')}
                  {' '}
                  (
                  {t('notSpecified')}
                  )
                </span>
                <Input
                  value={editForm.nationalId}
                  onChange={e => setEditForm({ ...editForm, nationalId: e.target.value.toUpperCase() })}
                  placeholder="G134567890"
                  className="h-9 rounded-xl font-mono text-xs uppercase"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">{t('dateOfBirth')}</span>
                <Input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">{t('guardianName')}</span>
                <Input
                  value={editForm.guardianName}
                  onChange={e => setEditForm({ ...editForm, guardianName: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-600">{t('guardianPhone')}</span>
                <Input
                  type="tel"
                  value={editForm.guardianPhone}
                  onChange={e => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </label>
            </div>
          )}
          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
              className="rounded-xl text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={saveEdit}
              className="
                rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
