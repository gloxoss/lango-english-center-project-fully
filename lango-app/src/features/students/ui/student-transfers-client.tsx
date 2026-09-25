'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  History,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

type StudentResult = {
  id: string;
  fullName: string;
  matricule: string | null;
  className: string | null;
  classSectionId?: string | null;
  branchId?: string | null;
  phone?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
};

type StudentDetailed = StudentResult & {
  financialStatus?: 'À jour' | 'Partiel' | 'En retard' | string;
  outstandingAmount?: number;
  overdueAmount?: number;
  hasOverdueInvoices?: boolean;
};

type BranchOption = {
  id: string;
  name: string;
  city: string | null;
  code?: string | null;
  enrolled?: number;
};

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
  branchId?: string | null;
  maxStudents?: number | null;
  enrolledCount?: number;
};

type RecentTransfer = {
  id: string;
  createdAt: string;
  studentId: string;
  studentName: string;
  studentMatricule: string | null;
  fromBranchId: string | null;
  toBranchId: string | null;
  toBranchName: string | null;
  reason: string;
  effectiveDate: string;
};

type TransferStats = {
  transfersThisMonth: number;
  byBranch: { branchId: string; name: string; studentCount: number }[];
  recentTransfers?: RecentTransfer[];
};

export function StudentTransfersClient({ locale = 'fr' }: { locale?: string } = {}) {
  const t = useTranslations('Students.transfers');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();
  const isRtl = locale === 'ar';

  // Data state
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [stats, setStats] = useState<TransferStats | null>(null);

  // Search state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentDetailed | null>(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);

  // Stepper state: 1: Student, 2: Destination & Capacity, 3: Synthesis & Confirm
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Transfer form state
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetClassSectionId, setTargetClassSectionId] = useState('');
  const [transferReason, setTransferReason] = useState<string>('Déménagement familial');
  const [customReason, setCustomReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]!);

  // Execution state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadStats = useCallback(() => {
    fetch('/api/students/transfer-stats')
      .then(r => (r.ok ? r.json() : null))
      .then(j => j?.success && setStats(j.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings/branches')
      .then(r => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setBranches(j.data);
        }
      })
      .catch(() => {});

    loadStats();
  }, [loadStats]);

  // Load class sections scoped by targetBranchId
  useEffect(() => {
    if (!targetBranchId) {
      setClassSections([]);
      return;
    }
    setLoadingSections(true);
    fetch(`/api/academics/class-sections?branchId=${targetBranchId}&pageSize=100`)
      .then(r => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setClassSections(j.data);
        } else {
          setClassSections([]);
        }
      })
      .catch(() => setClassSections([]))
      .finally(() => setLoadingSections(false));
  }, [targetBranchId]);

  // Debounced student search
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      fetch(`/api/students?search=${encodeURIComponent(query)}&pageSize=10`)
        .then(r => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.success && Array.isArray(j.data)) {
            setResults(j.data);
          } else {
            setResults([]);
          }
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(handle);
  }, [search]);

  // Handle student selection and enrich with authoritative student 360 data
  const handleSelectStudent = (r: StudentResult) => {
    setSelected(r);
    setResults([]);
    setSearch('');
    setLoadingStudentDetail(true);

    fetch(`/api/students/${r.id}`)
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          const detail = json.data;
          setSelected({
            ...r,
            branchId: detail.branchId ?? r.branchId,
            classSectionId: detail.classSectionId ?? r.classSectionId,
            className: detail.className ?? r.className,
            financialStatus: detail.financialStatus || detail.paymentStatus,
            outstandingAmount: detail.outstandingAmount ?? 0,
            overdueAmount: detail.overdueAmount ?? 0,
            hasOverdueInvoices: (detail.overdueAmount ?? 0) > 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStudentDetail(false));
  };

  // Branch metadata enriched with actual enrollment stats from DB
  const enrichedBranches = useMemo(() => {
    return branches.map((b) => {
      const branchStat = stats?.byBranch?.find(s => s.branchId === b.id);
      const enrolled = branchStat?.studentCount ?? 0;
      return {
        ...b,
        enrolled,
      };
    });
  }, [branches, stats]);

  const selectedTargetBranch = useMemo(() => {
    return enrichedBranches.find(b => b.id === targetBranchId);
  }, [enrichedBranches, targetBranchId]);

  const selectedTargetClass = useMemo(() => {
    return classSections.find(c => c.id === targetClassSectionId);
  }, [classSections, targetClassSectionId]);

  // Resolve student origin branch name
  const studentOriginBranch = useMemo(() => {
    if (!selected) {
      return null;
    }
    if (selected.branchId) {
      const match = branches.find(b => b.id === selected.branchId);
      if (match) {
        return match.name;
      }
    }
    return t('sourceCampus');
  }, [selected, branches, t]);

  const totalEnrolledAcrossNetwork = useMemo(() => {
    if (!stats?.byBranch) {
      return 0;
    }
    return stats.byBranch.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);
  }, [stats]);

  const isSameCampusMove = useMemo(() => {
    return Boolean(selected && targetBranchId && selected.branchId === targetBranchId);
  }, [selected, targetBranchId]);

  const handleExecuteTransfer = async () => {
    if (!selected || !targetBranchId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setWarnings([]);

    const resolvedReason = customReason.trim() || transferReason;

    try {
      const res = await fetch(`/api/students/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: targetBranchId,
          classSectionId: targetClassSectionId || undefined,
          reason: resolvedReason,
          effectiveDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || tCommon('error');
        setError(msg);
        toast.error(msg);
        return;
      }

      const successMsg = json.message || t('successAlertTitle');
      setSuccess(successMsg);
      if (json.warnings && Array.isArray(json.warnings)) {
        setWarnings(json.warnings);
      }
      toast.success(successMsg);

      // Reset selection and step
      setSelected(null);
      setSearch('');
      setTargetBranchId('');
      setTargetClassSectionId('');
      setCustomReason('');
      setWizardStep(1);
      loadStats();
    } catch {
      const netErr = tCommon('error');
      setError(netErr);
      toast.error(netErr);
    } finally {
      setSubmitting(false);
    }
  };

  const canTransfer = can('students.update');
  if (!canTransfer) {
    return (
      <div className="
        mx-auto mt-12 max-w-lg space-y-3 rounded-2xl border border-slate-200
        bg-white p-8 text-center shadow-xs
      "
      >
        <AlertCircle className="mx-auto size-10 text-amber-500" />
        <h2 className="text-base font-bold text-[#16212B]">{t('unauthorized')}</h2>
        <p className="text-xs text-slate-500">{t('unauthorizedDesc')}</p>
      </div>
    );
  }

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16 text-start" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="
              inline-flex items-center gap-1 rounded-full border
              border-[#2487B8]/30 bg-[#DCEBF4] px-2.5 py-0.5 text-[11px]
              font-bold text-[#1B6C93]
            "
            >
              <ArrowLeftRight className="size-3.5" />
              {' '}
              {t('badge')}
            </span>
            <span className="text-xs font-semibold text-slate-400">{t('subBadge')}</span>
          </div>
          <h1 className="
            mt-1 text-2xl font-extrabold tracking-tight text-[#16212B]
          "
          >
            {t('title')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="
        grid grid-cols-1 gap-3
        sm:grid-cols-3
      "
      >
        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <div className="flex items-center justify-between">
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {t('kpiMutationsMonth')}
            </p>
            <History className="size-4 text-[#2487B8]" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold text-[#16212B]">{stats?.transfersThisMonth ?? 0}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{t('kpiMutationsSub')}</p>
        </Card>

        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <div className="flex items-center justify-between">
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {t('kpiCampuses')}
            </p>
            <Building2 className="size-4 text-[#17A673]" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold text-[#16212B]">{branches.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{t('kpiCampusesSub')}</p>
        </Card>

        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <div className="flex items-center justify-between">
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {t('kpiTotalStudents')}
            </p>
            <Users className="size-4 text-purple-600" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold text-[#16212B]">{totalEnrolledAcrossNetwork}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{t('kpiTotalStudentsSub')}</p>
        </Card>
      </div>

      {/* Success Alert */}
      {success && (
        <div className="
          flex items-center justify-between rounded-2xl border
          border-[#17A673]/30 bg-[#DDF5EC] p-4 text-xs font-semibold
          text-[#17A673] shadow-2xs
        "
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-[#17A673]" />
            <div>
              <p className="text-sm font-bold">{t('successAlertTitle')}</p>
              <p className="mt-0.5 text-xs text-slate-600">{success}</p>
              {warnings.length > 0 && (
                <ul className="
                  mt-1 list-inside list-disc text-[11px] text-amber-700
                "
                >
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSuccess(null)}
            className="
              h-7 cursor-pointer border-[#17A673]/40 bg-white text-xs
              text-[#17A673]
              hover:bg-[#DDF5EC]
            "
          >
            {tCommon('close')}
          </Button>
        </div>
      )}

      {/* Stepper Timeline Header */}
      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
      "
      >
        <div className="
          grid grid-cols-1 gap-2
          md:grid-cols-3
        "
        >
          {/* Step 1 Pill */}
          <div
            onClick={() => setWizardStep(1)}
            className={`
              flex cursor-pointer items-center gap-3 rounded-xl p-3
              transition-all
              ${
    wizardStep === 1
      ? `
        border border-[#2487B8]/40 bg-[#DCEBF4]/50 shadow-2xs ring-1
        ring-[#2487B8]/30
      `
      : wizardStep > 1
        ? 'border border-emerald-200/60 bg-emerald-50/70'
        : 'border border-slate-100 bg-slate-50/60'
    }
            `}
          >
            <div
              className={`
                flex size-7 shrink-0 items-center justify-center rounded-lg
                text-xs font-bold
                ${
    wizardStep === 1
      ? 'bg-[#2487B8] text-white shadow-2xs'
      : wizardStep > 1
        ? 'bg-[#17A673] text-white shadow-2xs'
        : 'bg-slate-200 text-slate-600'
    }
              `}
            >
              {wizardStep > 1 ? <Check className="size-4 stroke-3" /> : '1'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#16212B]">{t('step1')}</p>
              <p className="truncate text-[10px] text-slate-500">
                {selected ? selected.fullName : t('step1Desc')}
              </p>
            </div>
          </div>

          {/* Step 2 Pill */}
          <div
            onClick={() => selected && setWizardStep(2)}
            className={`
              flex items-center gap-3 rounded-xl p-3 transition-all
              ${
    !selected
      ? 'cursor-not-allowed bg-slate-50/50 opacity-50'
      : 'cursor-pointer'
    }
              ${
    wizardStep === 2
      ? `
        border border-[#2487B8]/40 bg-[#DCEBF4]/50 shadow-2xs ring-1
        ring-[#2487B8]/30
      `
      : wizardStep > 2
        ? 'border border-emerald-200/60 bg-emerald-50/70'
        : 'border border-slate-100 bg-slate-50/60'
    }
            `}
          >
            <div
              className={`
                flex size-7 shrink-0 items-center justify-center rounded-lg
                text-xs font-bold
                ${
    wizardStep === 2
      ? 'bg-[#2487B8] text-white shadow-2xs'
      : wizardStep > 2
        ? 'bg-[#17A673] text-white shadow-2xs'
        : 'bg-slate-200 text-slate-600'
    }
              `}
            >
              {wizardStep > 2 ? <Check className="size-4 stroke-3" /> : '2'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#16212B]">{t('step2')}</p>
              <p className="truncate text-[10px] text-slate-500">
                {selectedTargetBranch ? selectedTargetBranch.name : t('step2Desc')}
              </p>
            </div>
          </div>

          {/* Step 3 Pill */}
          <div
            onClick={() => selected && targetBranchId && setWizardStep(3)}
            className={`
              flex items-center gap-3 rounded-xl p-3 transition-all
              ${
    !selected || !targetBranchId
      ? 'cursor-not-allowed bg-slate-50/50 opacity-50'
      : 'cursor-pointer'
    }
              ${
    wizardStep === 3
      ? `
        border border-[#2487B8]/40 bg-[#DCEBF4]/50 shadow-2xs ring-1
        ring-[#2487B8]/30
      `
      : 'border border-slate-100 bg-slate-50/60'
    }
            `}
          >
            <div
              className={`
                flex size-7 shrink-0 items-center justify-center rounded-lg
                text-xs font-bold
                ${
    wizardStep === 3
      ? 'bg-[#2487B8] text-white shadow-2xs'
      : 'bg-slate-200 text-slate-600'
    }
              `}
            >
              3
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#16212B]">{t('step3')}</p>
              <p className="truncate text-[10px] text-slate-500">{t('step3Desc')}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 1: Student Search & Selection */}
      {wizardStep === 1 && (
        <Card className="
          space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">{t('step1Title')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('step1Subtitle')}
            </p>
          </div>

          {!selected
            ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className={`
                      absolute
                      ${isRtl ? 'inset-e-3.5' : 'inset-s-3.5'}
                      top-1/2 size-4 -translate-y-1/2 text-slate-400
                    `}
                    />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className={`
                        h-11
                        ${isRtl ? 'pe-10' : 'ps-10'}
                        rounded-xl border-slate-200 bg-slate-50/50 text-start
                        text-xs
                        focus:border-[#2487B8]
                      `}
                    />
                  </div>

                  {searching && (
                    <div className="
                      flex items-center justify-center gap-2 rounded-xl
                      bg-slate-50 p-6 text-center text-xs text-slate-400
                    "
                    >
                      <Loader2 className="size-4 animate-spin text-[#2487B8]" />
                      <span>{t('searching')}</span>
                    </div>
                  )}

                  {!searching && search.trim().length >= 2 && results.length === 0 && (
                    <div className="
                      rounded-xl border border-dashed border-slate-200
                      bg-slate-50/50 p-6 text-center
                    "
                    >
                      <p className="text-xs font-bold text-slate-600">{t('noStudentFound', { query: search })}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{t('noStudentFoundHint')}</p>
                    </div>
                  )}

                  {results.length > 0 && (
                    <div className="
                      max-h-72 space-y-2 overflow-y-auto rounded-xl border
                      border-slate-200 bg-slate-50/50 p-2
                    "
                    >
                      {results.map((r) => {
                        const branchLabel = r.branchId
                          ? branches.find(b => b.id === r.branchId)?.name || t('sourceCampus')
                          : t('sourceCampus');
                        const initials = r.fullName.slice(0, 2).toUpperCase();

                        return (
                          <div
                            key={r.id}
                            onClick={() => handleSelectStudent(r)}
                            className="
                              group flex cursor-pointer items-center
                              justify-between rounded-xl border
                              border-slate-200/70 bg-white p-3 transition-all
                              hover:border-[#2487B8]/40 hover:bg-[#DCEBF4]/30
                            "
                          >
                            <div className="flex items-center gap-3">
                              <div className="
                                flex size-9 shrink-0 items-center justify-center
                                rounded-xl bg-[#DCEBF4] text-xs font-black
                                text-[#1B6C93]
                              "
                              >
                                {initials}
                              </div>
                              <div>
                                <p className="
                                  text-xs font-bold text-[#16212B]
                                  transition-colors
                                  group-hover:text-[#2487B8]
                                "
                                >
                                  {r.fullName}
                                </p>
                                <div className="
                                  mt-0.5 flex flex-wrap items-center gap-1.5
                                  text-[10px] text-slate-500
                                "
                                >
                                  {r.matricule && (
                                    <span className="
                                      rounded-sm bg-slate-100 px-1.5 py-0.5
                                      font-mono font-semibold text-slate-600
                                    "
                                    >
                                      {r.matricule}
                                    </span>
                                  )}
                                  <span>·</span>
                                  <span>{r.className || 'Classe non assignée'}</span>
                                  <span>·</span>
                                  <span className="font-medium text-[#2487B8]">{branchLabel}</span>
                                </div>
                              </div>
                            </div>

                            {/* The row selects on mouse click; this button is the keyboard path. */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleSelectStudent(r); }}
                              className="
                                h-8 gap-1 text-xs font-bold text-[#2487B8]
                                group-hover:bg-[#2487B8] group-hover:text-white
                              "
                            >
                              {t('selectStudent')}
                              {' '}
                              <ChevronIcon className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {search.trim().length < 2 && (
                    <div className="
                      rounded-2xl border border-dashed border-slate-200
                      bg-slate-50/40 p-8 text-center
                    "
                    >
                      <Search className="mx-auto mb-2 size-8 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">{t('searchHint')}</p>
                    </div>
                  )}
                </div>
              )
            : (
          /* Selected Student Dossier Card */
                <div className="
                  space-y-4 rounded-2xl border border-[#2487B8]/30
                  bg-[#DCEBF4]/20 p-5 shadow-2xs
                "
                >
                  <div className="
                    flex flex-col justify-between gap-4
                    sm:flex-row sm:items-center
                  "
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="
                        flex size-12 items-center justify-center rounded-2xl
                        bg-[#2487B8] text-sm font-black text-white shadow-2xs
                      "
                      >
                        {selected.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="
                            text-base font-extrabold text-[#16212B]
                          "
                          >
                            {selected.fullName}
                          </h3>
                          <Badge className="
                            border-[#17A673]/30 bg-[#DDF5EC] text-[10px]
                            font-bold text-[#17A673]
                          "
                          >
                            {t('activeEnrolled')}
                          </Badge>
                          {loadingStudentDetail && (
                            <Loader2 className="
                              size-3 animate-spin text-slate-400
                            "
                            />
                          )}
                        </div>
                        <p className="
                          mt-0.5 flex flex-wrap items-center gap-2 text-xs
                          text-slate-600
                        "
                        >
                          <span className="font-mono font-bold text-slate-700">{selected.matricule || 'Sans matricule'}</span>
                          <span>·</span>
                          <span className="font-semibold text-[#1B6C93]">{selected.className || 'Classe non assignée'}</span>
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelected(null);
                        setTargetBranchId('');
                      }}
                      className="
                        h-8 cursor-pointer border-slate-200 text-xs font-bold
                        text-slate-600
                        hover:text-rose-600
                      "
                    >
                      {t('changeStudent')}
                    </Button>
                  </div>

                  <div className="
                    grid grid-cols-1 gap-3 border-t border-[#2487B8]/20 pt-3
                    text-xs
                    sm:grid-cols-3
                  "
                  >
                    <div className="
                      rounded-xl border border-[#2487B8]/20 bg-white/70 p-3
                    "
                    >
                      <span className="
                        block text-[10px] font-bold tracking-wider
                        text-slate-400 uppercase
                      "
                      >
                        {t('sourceCampus')}
                      </span>
                      <span className="
                        mt-0.5 block text-xs font-bold text-slate-800
                      "
                      >
                        {studentOriginBranch}
                      </span>
                    </div>
                    <div className="
                      rounded-xl border border-[#2487B8]/20 bg-white/70 p-3
                    "
                    >
                      <span className="
                        block text-[10px] font-bold tracking-wider
                        text-slate-400 uppercase
                      "
                      >
                        {t('financialSituation')}
                      </span>
                      {selected.hasOverdueInvoices
                        ? (
                            <span className="
                              mt-0.5 flex items-center gap-1 text-xs font-bold
                              text-rose-600
                            "
                            >
                              <AlertTriangle className="size-3.5 shrink-0" />
                              {t('financialOverdue', { amount: selected.overdueAmount ?? 0 })}
                            </span>
                          )
                        : (selected.outstandingAmount ?? 0) > 0
                            ? (
                                <span className="
                                  mt-0.5 text-xs font-bold text-amber-600
                                "
                                >
                                  {t('financialPending', { count: 1, amount: selected.outstandingAmount ?? 0 })}
                                </span>
                              )
                            : (
                                <span className="
                                  mt-0.5 block text-xs font-bold text-[#17A673]
                                "
                                >
                                  {t('financialOk')}
                                </span>
                              )}
                    </div>
                    <div className="
                      rounded-xl border border-[#2487B8]/20 bg-white/70 p-3
                    "
                    >
                      <span className="
                        block text-[10px] font-bold tracking-wider
                        text-slate-400 uppercase
                      "
                      >
                        {t('adminStatus')}
                      </span>
                      <span className="
                        mt-0.5 block text-xs font-bold text-slate-800
                      "
                      >
                        {t('adminStatusAllowed')}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => setWizardStep(2)}
                      className="
                        h-10 cursor-pointer gap-2 rounded-xl bg-[#2487B8] px-5
                        text-xs font-bold text-white shadow-2xs
                        hover:bg-[#1B6C93]
                      "
                    >
                      <span>{t('continueToStep2')}</span>
                      <ArrowIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
        </Card>
      )}

      {/* STEP 2: Destination Branch & Class Selection */}
      {wizardStep === 2 && selected && (
        <Card className="
          space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">{t('step2Title')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('step2Subtitle', { name: selected.fullName })}
            </p>
          </div>

          {/* Campus Cards Grid */}
          <div className="space-y-3">
            <label className="
              flex items-center gap-1.5 text-xs font-bold text-slate-700
            "
            >
              <Building2 className="size-4 text-[#2487B8]" />
              <span>{t('chooseDestinationCampus')}</span>
            </label>

            <div className="
              grid grid-cols-1 gap-3
              sm:grid-cols-2
              lg:grid-cols-3
            "
            >
              {enrichedBranches.map((b) => {
                const isCurrentBranch = selected.branchId === b.id;
                const isSelected = targetBranchId === b.id;
                const enrolled = b.enrolled || 0;

                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setTargetBranchId(b.id);
                      setTargetClassSectionId('');
                    }}
                    className={`
                      relative cursor-pointer rounded-2xl border p-4
                      transition-all
                      ${
                  isSelected
                    ? `
                      border-[#2487B8] bg-[#DCEBF4]/30 shadow-xs ring-2
                      ring-[#2487B8]/40
                    `
                    : isCurrentBranch
                      ? `
                        border-emerald-200 bg-emerald-50/40
                        hover:border-emerald-300
                      `
                      : `
                        border-slate-200 bg-white
                        hover:border-slate-300 hover:shadow-2xs
                      `
                  }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="
                            truncate text-xs font-bold text-[#16212B]
                          "
                          >
                            {b.name}
                          </h4>
                          {isCurrentBranch && (
                            <Badge className="
                              border-emerald-300 bg-emerald-100 text-[9px]
                              font-bold text-emerald-800
                            "
                            >
                              {t('currentCampusBadge')}
                            </Badge>
                          )}
                        </div>
                        {b.city && (
                          <span className="
                            mt-1 flex items-center gap-1 text-[10px] font-medium
                            text-slate-500
                          "
                          >
                            <MapPin className="size-2.5 text-slate-400" />
                            {' '}
                            {b.city}
                          </span>
                        )}
                      </div>

                      <div
                        className={`
                          flex size-5 shrink-0 items-center justify-center
                          rounded-full text-xs
                          ${
                  isSelected
                    ? 'bg-[#2487B8] text-white'
                    : 'border border-slate-300'
                  }
                        `}
                      >
                        {isSelected && <Check className="size-3 stroke-3" />}
                      </div>
                    </div>

                    <div className="
                      mt-3 border-t border-slate-100 pt-2.5 text-xs
                    "
                    >
                      <div className="
                        flex justify-between text-[10px] font-semibold
                      "
                      >
                        <span className="text-slate-400">{t('currentEnrollment')}</span>
                        <span className="font-bold text-slate-700">{t('studentsCount', { count: enrolled })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class Section Selection */}
          {targetBranchId && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <label className="
                flex items-center gap-1.5 text-xs font-bold text-slate-700
              "
              >
                <GraduationCap className="size-4 text-[#2487B8]" />
                <span>{t('chooseSectionOptional')}</span>
              </label>

              {loadingSections
                ? (
                    <div className="
                      flex items-center justify-center gap-2 rounded-xl
                      bg-slate-50 p-6 text-center text-xs text-slate-400
                    "
                    >
                      <Loader2 className="size-4 animate-spin text-[#2487B8]" />
                      <span>Chargement des sections du campus...</span>
                    </div>
                  )
                : (
                    <div className="
                      grid grid-cols-1 gap-3
                      sm:grid-cols-2
                      lg:grid-cols-3
                    "
                    >
                      {/* Unassigned Option (Valid for cross-campus transfer) */}
                      {!isSameCampusMove && (
                        <div
                          onClick={() => setTargetClassSectionId('')}
                          className={`
                            cursor-pointer rounded-xl border p-3.5 text-xs
                            transition-all
                            ${
                        targetClassSectionId === ''
                          ? `
                            border-[#2487B8] bg-[#DCEBF4]/30 font-bold
                            text-[#1B6C93] ring-1 ring-[#2487B8]
                          `
                          : `
                            border-slate-200 bg-white text-slate-600
                            hover:border-slate-300
                          `
                        }
                          `}
                        >
                          <p className="font-bold">{t('unassignedSection')}</p>
                          <p className="
                            mt-0.5 text-[10px] font-normal text-slate-400
                          "
                          >
                            {t('unassignedSectionDesc')}
                          </p>
                        </div>
                      )}

                      {classSections.map((cs) => {
                        const isSelected = targetClassSectionId === cs.id;
                        const isCurrentSection = selected.classSectionId === cs.id;
                        const enrolled = cs.enrolledCount ?? 0;
                        const max = cs.maxStudents;
                        const isUnconfigured = max === null || max === undefined;
                        const isFull = !isUnconfigured && enrolled >= max && !isCurrentSection;
                        const isBlocked = isFull || isUnconfigured;

                        return (
                          <div
                            key={cs.id}
                            onClick={() => {
                              if (!isBlocked) {
                                setTargetClassSectionId(cs.id);
                              }
                            }}
                            className={`
                              rounded-xl border p-3.5 text-xs transition-all
                              ${
                          isBlocked
                            ? `
                              cursor-not-allowed border-slate-200 bg-slate-50/80
                              opacity-60
                            `
                            : isSelected
                              ? `
                                cursor-pointer border-[#2487B8] bg-[#DCEBF4]/30
                                ring-1 ring-[#2487B8]
                              `
                              : `
                                cursor-pointer border-slate-200 bg-white
                                hover:border-slate-300
                              `
                          }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className="
                                truncate font-bold text-[#16212B]
                              "
                              >
                                {cs.className}
                              </span>
                              <span className="
                                rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono
                                text-[10px] text-slate-600
                              "
                              >
                                {cs.sectionName}
                              </span>
                            </div>

                            <div className="
                              mt-2 flex items-center justify-between text-[10px]
                            "
                            >
                              {isUnconfigured
                                ? (
                                    <span className="
                                      flex items-center gap-1 font-bold
                                      text-amber-700
                                    "
                                    >
                                      <AlertTriangle className="
                                        size-3 text-amber-500
                                      "
                                      />
                                      {t('capacityUnconfigured', { enrolled })}
                                    </span>
                                  )
                                : isFull
                                  ? (
                                      <span className="
                                        flex items-center gap-1 font-bold
                                        text-rose-600
                                      "
                                      >
                                        <AlertCircle className="size-3" />
                                        {t('capacityFull', { max })}
                                      </span>
                                    )
                                  : (
                                      <span className="
                                        font-medium text-slate-500
                                      "
                                      >
                                        {t('capacityFree', { enrolled, max })}
                                      </span>
                                    )}

                              {isCurrentSection && (
                                <Badge
                                  variant="neutral"
                                  className="
                                    bg-slate-200 text-[9px] text-slate-700
                                  "
                                >
                                  Section actuelle
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {classSections.length === 0 && (
                        <div className="
                          col-span-full rounded-xl border border-dashed
                          border-slate-200 bg-slate-50 p-4 text-center text-xs
                          text-slate-500
                        "
                        >
                          {t('noSectionsInCampus')}
                        </div>
                      )}
                    </div>
                  )}
            </div>
          )}

          <div className="
            flex items-center justify-between border-t border-slate-100 pt-4
          "
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWizardStep(1)}
              className="cursor-pointer border-slate-200 text-xs"
            >
              {t('backToStep1')}
            </Button>
            <Button
              disabled={!targetBranchId || (isSameCampusMove && !targetClassSectionId)}
              onClick={() => setWizardStep(3)}
              className="
                h-10 cursor-pointer gap-2 rounded-xl bg-[#2487B8] px-5 text-xs
                font-bold text-white shadow-2xs
                hover:bg-[#1B6C93]
              "
            >
              <span>{t('continueToStep3')}</span>
              <ArrowIcon className="size-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Transfer Synthesis & Final Execution */}
      {wizardStep === 3 && selected && (
        <Card className="
          space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">{t('step3Title')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('step3Subtitle')}
            </p>
          </div>

          {/* Comparison Side-by-Side Card */}
          <div className="
            grid grid-cols-1 gap-4 rounded-2xl border border-slate-200
            bg-slate-50 p-4
            md:grid-cols-2
          "
          >
            {/* Source */}
            <div className="
              space-y-2 rounded-xl border border-slate-200/70 bg-white p-3.5
              shadow-2xs
            "
            >
              <div className="flex items-center justify-between">
                <span className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('sourceHeading')}
                </span>
                <Badge
                  variant="neutral"
                  className="bg-slate-100 text-[10px] font-bold text-slate-600"
                >
                  {t('sourceBadge')}
                </Badge>
              </div>
              <p className="text-sm font-extrabold text-[#16212B]">{selected.fullName}</p>
              <p className="font-mono text-xs text-slate-500">{selected.matricule || 'Sans matricule'}</p>
              <div className="space-y-1 border-t border-slate-100 pt-2 text-xs">
                <p className="text-slate-500">
                  {t('sourceCampusLabel')}
                  {' '}
                  <strong className="text-slate-700">{studentOriginBranch}</strong>
                </p>
                <p className="text-slate-500">
                  {t('sourceClassLabel')}
                  {' '}
                  <strong className="text-slate-700">{selected.className || t('unassignedSection')}</strong>
                </p>
              </div>
            </div>

            {/* Target */}
            <div className="
              space-y-2 rounded-xl border border-[#2487B8]/30 bg-[#DCEBF4]/30
              p-3.5 shadow-2xs
            "
            >
              <div className="flex items-center justify-between">
                <span className="
                  text-[10px] font-bold tracking-wider text-[#1B6C93] uppercase
                "
                >
                  {t('targetHeading')}
                </span>
                <Badge className="bg-[#2487B8] text-[10px] font-bold text-white">{t('targetBadge')}</Badge>
              </div>
              <p className="text-sm font-extrabold text-[#16212B]">{selectedTargetBranch?.name}</p>
              <p className="text-xs font-semibold text-[#1B6C93]">{selectedTargetBranch?.city || 'Maroc'}</p>
              <div className="
                space-y-1 border-t border-[#2487B8]/20 pt-2 text-xs
              "
              >
                <p className="text-slate-500">
                  {t('targetClassLabel')}
                  {' '}
                  <strong className="text-[#16212B]">
                    {selectedTargetClass ? `${selectedTargetClass.className} (${selectedTargetClass.sectionName})` : t('unassignedSection')}
                  </strong>
                </p>
                <p className="text-slate-500">
                  {t('transferTypeLabel')}
                  {' '}
                  <strong className="text-[#17A673]">
                    {isSameCampusMove ? t('typeIntraCampus') : t('typeInterCampus')}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* Form Options: Reason, Effective Date, Checkboxes */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                {t('motifLabel')}
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  { key: 'motifFamilyRelocation', label: t('motifFamilyRelocation') },
                  { key: 'motifSibling', label: t('motifSibling') },
                  { key: 'motifPedagogical', label: t('motifPedagogical') },
                  { key: 'motifParentRequest', label: t('motifParentRequest') },
                  { key: 'motifAdminRegularization', label: t('motifAdminRegularization') },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTransferReason(label);
                      setCustomReason('');
                    }}
                    className={`
                      cursor-pointer rounded-lg border px-2.5 py-1 text-xs
                      transition-all
                      ${
                  transferReason === label && !customReason
                    ? 'border-[#2487B8] bg-[#2487B8] font-bold text-white'
                    : `
                      border-slate-200 bg-white text-slate-600
                      hover:bg-slate-50
                    `
                  }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Input
                placeholder={t('motifPlaceholder')}
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="
                  h-9 rounded-xl border-slate-200 bg-white text-start text-xs
                "
              />
            </div>

            <div className="max-w-md">
              <label className="mb-1 block text-xs font-bold text-slate-700">
                {t('effectiveDateLabel')}
              </label>
              <Input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
                className="h-9 rounded-xl border-slate-200 bg-white text-xs"
              />
              <span className="mt-0.5 block text-[10px] text-slate-400">{t('effectiveDateMaxHint')}</span>
            </div>

            {/* Legal Notice Box */}
            <div className="
              flex items-start gap-2.5 rounded-xl border border-slate-200/80
              bg-slate-50 p-3.5 text-[11px] text-slate-600
            "
            >
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#17A673]" />
              <div>
                <span className="font-bold text-slate-800">{t('auditNoticeTitle')}</span>
                <p className="mt-0.5">{t('auditNoticeText')}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="
              rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs
              font-semibold text-rose-700
            "
            >
              {error}
            </div>
          )}

          <div className="
            flex items-center justify-between border-t border-slate-100 pt-4
          "
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWizardStep(2)}
              className="cursor-pointer border-slate-200 text-xs"
            >
              {t('backToStep2')}
            </Button>
            <Button
              disabled={submitting}
              onClick={handleExecuteTransfer}
              className="
                h-10 cursor-pointer gap-2 rounded-xl bg-[#17A673] px-6 text-xs
                font-bold text-white shadow-2xs
                hover:bg-[#149063]
              "
            >
              {submitting
                ? (
                    <Loader2 className="size-4 animate-spin" />
                  )
                : (
                    <CheckCircle2 className="size-4" />
                  )}
              <span>{submitting ? t('submittingBtn') : t('confirmTransferBtn')}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Transfers History Section */}
      <Card className="
        space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs
      "
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-[#2487B8]" />
            <h3 className="text-sm font-extrabold text-[#16212B]">
              {t('historyTitle')}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">{t('historyBadge')}</span>
        </div>

        {stats?.recentTransfers && stats.recentTransfers.length > 0
          ? (
              <div className="
                overflow-x-auto rounded-xl border border-slate-200/80
              "
              >
                <table className="w-full text-start text-xs">
                  <thead className="
                    border-b border-slate-200 bg-slate-50 text-[10px] font-bold
                    text-slate-500 uppercase
                  "
                  >
                    <tr>
                      <th className="px-3 py-2.5 text-start">{t('colDate')}</th>
                      <th className="px-3 py-2.5 text-start">{t('colStudent')}</th>
                      <th className="px-3 py-2.5 text-start">{t('colMatricule')}</th>
                      <th className="px-3 py-2.5 text-start">{t('colDestination')}</th>
                      <th className="px-3 py-2.5 text-start">{t('colMotif')}</th>
                      <th className="px-3 py-2.5 text-center">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recentTransfers.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="
                          px-3 py-2.5 font-mono text-[11px] text-slate-600
                        "
                        >
                          {item.createdAt?.slice(0, 10)}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#16212B]">
                          {item.studentName}
                        </td>
                        <td className="
                          px-3 py-2.5 font-mono text-[11px] text-slate-500
                        "
                        >
                          {item.studentMatricule || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#1B6C93]">
                          {item.toBranchName || 'Campus assigné'}
                        </td>
                        <td className="
                          max-w-xs truncate px-3 py-2.5 text-slate-600
                        "
                        >
                          {item.reason}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge className="
                            border-[#17A673]/30 bg-[#DDF5EC] text-[10px]
                            font-bold text-[#17A673]
                          "
                          >
                            {t('statusEffective')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          : (
              <div className="
                rounded-xl border border-slate-100 bg-slate-50/50 p-8
                text-center
              "
              >
                <p className="text-xs font-bold text-slate-500">{t('noTransfersYet')}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t('noTransfersHint')}</p>
              </div>
            )}
      </Card>
    </div>
  );
}
