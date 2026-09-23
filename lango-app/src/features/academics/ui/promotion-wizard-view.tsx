'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ClassSection = {
  id: string;
  className: string;
  sectionName: string;
  cycle?: string | null;
};

type SessionYear = {
  id: string;
  name: string;
  isDefault: boolean;
  startDate: string;
};

type DecisionType = 'promote' | 'repeat' | 'graduate' | 'transfer' | 'withdraw' | 'hold';

type StudentDecisionState = {
  studentId: string;
  fullName: string;
  matricule: string;
  decision: DecisionType;
  targetClassSectionId: string | null;
  averagePercentage?: number;
  grade20?: number;
  isBorderline?: boolean;
  reason?: string;
  userStatus?: string;
  hasUnpaidFees?: boolean;
  unpaidBalance?: number;
};

type CapacityBreakdown = {
  offeringId?: string | null;
  classSectionId: string | null;
  className: string;
  sectionName: string;
  maxStudents?: number | null;
  currentStudentsCount: number;
  proposedStudentsCount: number;
  projectedOccupancy?: number;
  remainingAfter?: number | null;
  headroom: number | null;
  isConfigured?: boolean;
  isExceeded: boolean;
};

type PromotionBatchHistory = {
  id: string;
  sourceClassSectionId: string;
  targetSessionYearId: string;
  targetSessionYearName: string;
  status: 'committed' | 'reverted';
  operatorId: string;
  createdAt: string;
};

type PreviewMeta = {
  sourceSection?: {
    id: string;
    classId: string;
    className: string;
    cycle: string | null;
    sectionName: string;
  };
  nextClassName?: string | null;
  isTerminalClass?: boolean;
  passThreshold?: number;
  gradingScale?: string;
  passThresholdRaw?: number;
  total?: number;
  toPromote?: number;
  toRetain?: number;
  toDefer?: number;
  borderlineCount?: number;
  availableSections?: ClassSection[];
  nextClassSections?: ClassSection[];
  currentClassSections?: ClassSection[];
};

export function PromotionWizardView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');

  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');
  const [sectionsList, setSectionsList] = useState<ClassSection[]>([]);
  const [sessionYears, setSessionYears] = useState<SessionYear[]>([]);

  const [selectedSourceSection, setSelectedSourceSection] = useState<string>('');
  const [selectedTargetSession, setSelectedTargetSession] = useState<string>('');
  const [batchIdempotencyKey, setBatchIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const [studentsDecisions, setStudentsDecisions] = useState<StudentDecisionState[]>([]);
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Review Filter: 'all' | 'promote' | 'borderline' | 'repeat' | 'hold'
  const [reviewFilter, setReviewFilter] = useState<'all' | 'promote' | 'borderline' | 'repeat' | 'hold'>('all');

  const [capacityBreakdown, setCapacityBreakdown] = useState<CapacityBreakdown[]>([]);
  const [hasCapacityExceeded, setHasCapacityExceeded] = useState(false);
  const [hasCapacityUnconfigured, setHasCapacityUnconfigured] = useState(false);
  const [_checkingCapacity, setCheckingCapacity] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // History state
  const [historyBatches, setHistoryBatches] = useState<PromotionBatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  // Initial fetch: sections & session years
  useEffect(() => {
    Promise.all([
      fetch('/api/academics/class-sections?pageSize=100').then(r => r.json()),
      fetch('/api/academics/session-years?pageSize=100').then(r => r.json()),
    ]).then(([clsRes, sessRes]) => {
      if (clsRes.success && Array.isArray(clsRes.data)) {
        const flattened: ClassSection[] = clsRes.data.map((s: any) => ({
          id: s.id,
          className: s.className,
          sectionName: s.sectionName,
          cycle: s.cycle,
        }));
        setSectionsList(flattened);
        const firstSection = flattened[0];
        if (firstSection) {
          setSelectedSourceSection(firstSection.id);
        }
      }
      if (sessRes.success && Array.isArray(sessRes.data)) {
        setSessionYears(sessRes.data);
        const def = sessRes.data.find((s: SessionYear) => s.isDefault);
        const next = (sessRes.data as SessionYear[])
          .filter(s => def && s.startDate > def.startDate)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
        setSelectedTargetSession(next?.id ?? '');
      }
    });
  }, []);

  // Fetch real grade-based student recommendations and metadata when source section changes
  useEffect(() => {
    if (!selectedSourceSection) {
      return;
    }
    setLoadingStudents(true);
    fetch(`/api/students/promotions/preview?sourceSectionId=${selectedSourceSection}`)
      .then(r => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setPreviewMeta(res.meta || null);
          const mapped: StudentDecisionState[] = res.data.map((item: any) => ({
            studentId: item.studentId,
            fullName: item.studentName,
            matricule: item.matricule || 'N/A',
            decision: item.decision || (item.recommendation === 'promote' ? 'promote' : item.recommendation === 'retain' ? 'repeat' : 'hold'),
            targetClassSectionId: item.recommendedTargetSectionId || null,
            averagePercentage: item.averagePercentage ?? undefined,
            grade20: item.grade20 ?? undefined,
            isBorderline: !!item.isBorderline,
            userStatus: item.currentStatus,
            hasUnpaidFees: !!item.hasUnpaidFees,
            unpaidBalance: item.unpaidBalance || 0,
          }));
          setStudentsDecisions(mapped);
        } else {
          setStudentsDecisions([]);
          setPreviewMeta(null);
        }
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedSourceSection]);

  // Capacity check query when target session or decisions change
  useEffect(() => {
    if (!selectedTargetSession || studentsDecisions.length === 0) {
      return;
    }

    const targetCounts: Record<string, number> = {};
    studentsDecisions.forEach((s) => {
      if ((s.decision === 'promote' || s.decision === 'repeat') && s.targetClassSectionId) {
        targetCounts[s.targetClassSectionId] = (targetCounts[s.targetClassSectionId] || 0) + 1;
      }
    });

    const assignmentsPayload = Object.entries(targetCounts).map(([secId, count]) => ({
      classSectionId: secId,
      studentCount: count,
    }));

    if (assignmentsPayload.length === 0) {
      setCapacityBreakdown([]);
      setHasCapacityExceeded(false);
      setHasCapacityUnconfigured(false);
      return;
    }

    setCheckingCapacity(true);
    fetch('/api/academics/promotions/capacity-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetSessionYearId: selectedTargetSession,
        assignments: assignmentsPayload,
      }),
    })
      .then(r => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCapacityBreakdown(res.data.breakdown || []);
          setHasCapacityExceeded(res.data.hasCapacityExceeded || false);
          setHasCapacityUnconfigured(res.data.hasCapacityUnconfigured || false);
        }
      })
      .finally(() => setCheckingCapacity(false));
  }, [selectedTargetSession, studentsDecisions]);

  // Load history batches
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/students/promotions');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistoryBatches(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleDecisionChange = (studentId: string, decision: DecisionType) => {
    setStudentsDecisions(prev =>
      prev.map((s) => {
        if (s.studentId !== studentId) {
          return s;
        }
        let newTargetSectionId = s.targetClassSectionId;

        // Auto-assign appropriate target if switching to promote vs repeat vs graduate
        if (decision === 'graduate' || decision === 'transfer' || decision === 'withdraw' || decision === 'hold') {
          newTargetSectionId = null;
        } else if (decision === 'promote') {
          if (!newTargetSectionId || (previewMeta?.currentClassSections?.some(cs => cs.id === newTargetSectionId))) {
            const nextSec = previewMeta?.nextClassSections?.[0];
            newTargetSectionId = nextSec ? nextSec.id : null;
          }
        } else if (decision === 'repeat') {
          if (!newTargetSectionId || (previewMeta?.nextClassSections?.some(cs => cs.id === newTargetSectionId))) {
            newTargetSectionId = previewMeta?.sourceSection?.id || previewMeta?.currentClassSections?.[0]?.id || null;
          }
        }

        return { ...s, decision, targetClassSectionId: newTargetSectionId };
      }),
    );
  };

  const handleTargetSectionChange = (studentId: string, targetClassSectionId: string) => {
    setStudentsDecisions(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, targetClassSectionId } : s)),
    );
  };

  // Bulk Action 1: Re-apply Automatic Standard Threshold (≥ 10/20)
  const handleApplyAutoThreshold = () => {
    const thresholdPct = previewMeta?.passThreshold ?? 50;
    const isTerminal = previewMeta?.isTerminalClass ?? false;
    const defaultPromoteSec = previewMeta?.nextClassSections?.[0]?.id || null;
    const defaultRepeatSec = previewMeta?.sourceSection?.id || null;

    setStudentsDecisions(prev =>
      prev.map((s) => {
        if (s.averagePercentage == null) {
          return { ...s, decision: 'hold', targetClassSectionId: null };
        }
        if (s.averagePercentage >= thresholdPct) {
          return {
            ...s,
            decision: isTerminal ? 'graduate' : 'promote',
            targetClassSectionId: isTerminal ? null : (s.targetClassSectionId || defaultPromoteSec),
          };
        }
        return {
          ...s,
          decision: 'repeat',
          targetClassSectionId: defaultRepeatSec,
        };
      }),
    );
    toast.success(t('toastAutoThresholdSuccess'));
  };

  // Bulk Action 2: Deliberation Rescue (Promote students with GPA ≥ 9.50/20)
  const handleDeliberateRescue = () => {
    const defaultPromoteSec = previewMeta?.nextClassSections?.[0]?.id || null;
    const isTerminal = previewMeta?.isTerminalClass ?? false;
    let count = 0;

    setStudentsDecisions(prev =>
      prev.map((s) => {
        const score = s.grade20 ?? (s.averagePercentage != null ? s.averagePercentage / 5 : null);
        if (score !== null && score >= 9.5 && score < 10 && s.decision !== 'promote') {
          count++;
          return {
            ...s,
            decision: isTerminal ? 'graduate' : 'promote',
            targetClassSectionId: isTerminal ? null : (s.targetClassSectionId || defaultPromoteSec),
            reason: t('reasonCouncilDeliberationRescue'),
          };
        }
        return s;
      }),
    );

    if (count > 0) {
      toast.success(t('toastRescueCountSuccess', { count }));
    } else {
      toast.info(t('toastNoRescueFound'));
    }
  };

  // Bulk Action 3: Balance Promoted Students across Target Sections (A, B, C)
  const handleBalanceTargetSections = () => {
    const nextSections = previewMeta?.nextClassSections || [];
    if (nextSections.length === 0) {
      toast.error(t('toastNoTargetSectionForBalance'));
      return;
    }

    let nextSecIndex = 0;
    let count = 0;

    setStudentsDecisions(prev =>
      prev.map((s) => {
        if (s.decision === 'promote') {
          const assignedSection = nextSections[nextSecIndex % nextSections.length]!;
          nextSecIndex++;
          count++;
          return {
            ...s,
            targetClassSectionId: assignedSection.id,
          };
        }
        return s;
      }),
    );

    toast.success(t('toastBalanceSuccess', {
      count,
      sectionsCount: nextSections.length,
      sectionNames: nextSections.map(s => s.sectionName).join(', '),
    }));
  };

  // Commit promotion to backend
  const handleCommitPromotion = async () => {
    if (!selectedSourceSection || !selectedTargetSession || studentsDecisions.length === 0 || studentsDecisions.some(s => s.decision === 'hold')) {
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        sourceClassSectionId: selectedSourceSection,
        targetSessionYearId: selectedTargetSession,
        idempotencyKey: batchIdempotencyKey,
        decisions: studentsDecisions.map(s => ({
          studentId: s.studentId,
          decision: s.decision,
          targetClassSectionId: (s.decision === 'promote' || s.decision === 'repeat') ? (s.targetClassSectionId || undefined) : undefined,
          averagePercentage: s.averagePercentage,
          reason: s.reason || t('defaultDeliberationReason'),
        })),
      };

      const res = await fetch('/api/students/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: t('promotionSuccess') });
        toast.success(t('promotionSuccess'));
        setStudentsDecisions([]);
        setBatchIdempotencyKey(crypto.randomUUID());
      } else {
        setMessage({ type: 'error', text: data.error?.message || t('errorValidationFailed') });
        toast.error(data.error?.message || t('errorValidationFailed'));
      }
    } catch {
      setMessage({ type: 'error', text: t('errorNetworkValidation') });
      toast.error(t('errorNetworkValidation'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevertBatch = async (batchId: string) => {
    setRevertingId(batchId);
    setMessage(null);
    try {
      const res = await fetch('/api/academics/promotions/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: t('revertSuccess') });
        toast.success(t('revertSuccess'));
        await loadHistory();
      } else {
        setMessage({ type: 'error', text: data.error?.message || t('errorCannotRevertBatch') });
        toast.error(data.error?.message || t('errorCannotRevertBatch'));
      }
    } catch {
      setMessage({ type: 'error', text: t('errorNetworkRevert') });
    } finally {
      setRevertingId(null);
    }
  };

  // KPIs Calculation
  const stats = useMemo(() => {
    const total = studentsDecisions.length;
    const toPromote = studentsDecisions.filter(s => s.decision === 'promote' || s.decision === 'graduate').length;
    const toRepeat = studentsDecisions.filter(s => s.decision === 'repeat').length;
    const toHold = studentsDecisions.filter(s => s.decision === 'hold').length;
    const assessed = studentsDecisions.filter(s => s.averagePercentage != null).length;
    const passedAssessed = studentsDecisions.filter(s => s.averagePercentage != null && (s.decision === 'promote' || s.decision === 'graduate')).length;
    const borderline = studentsDecisions.filter((s) => {
      const score = s.grade20 ?? (s.averagePercentage != null ? s.averagePercentage / 5 : null);
      return score !== null && score >= 9.0 && score < 10.0;
    }).length;
    const passRate = assessed > 0 ? Math.round((passedAssessed / assessed) * 100) : null;

    return { total, assessed, toPromote, toRepeat, toHold, borderline, passRate };
  }, [studentsDecisions]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    if (reviewFilter === 'all') {
      return studentsDecisions;
    }
    if (reviewFilter === 'promote') {
      return studentsDecisions.filter(s => s.decision === 'promote' || s.decision === 'graduate');
    }
    if (reviewFilter === 'repeat') {
      return studentsDecisions.filter(s => s.decision === 'repeat');
    }
    if (reviewFilter === 'hold') {
      return studentsDecisions.filter(s => s.decision === 'hold');
    }
    if (reviewFilter === 'borderline') {
      return studentsDecisions.filter((s) => {
        const score = s.grade20 ?? (s.averagePercentage != null ? s.averagePercentage / 5 : null);
        return score !== null && score >= 9.0 && score < 10.0;
      });
    }
    return studentsDecisions;
  }, [studentsDecisions, reviewFilter]);

  const decisionLabels: Record<DecisionType, string> = {
    promote: t('decisionPromote'),
    repeat: t('decisionRepeat'),
    graduate: t('decisionGraduate'),
    transfer: t('decisionTransfer'),
    withdraw: t('decisionWithdraw'),
    hold: t('decisionHold'),
  };

  // Group available sections by class name for select dropdowns
  const groupedSections = useMemo(() => {
    const list = previewMeta?.availableSections || sectionsList;
    const groups: Record<string, ClassSection[]> = {};
    list.forEach((sec) => {
      if (!groups[sec.className]) {
        groups[sec.className] = [];
      }
      groups[sec.className]!.push(sec);
    });
    return groups;
  }, [previewMeta, sectionsList]);

  const selectedTargetObj = useMemo(
    () => sessionYears.find(s => s.id === selectedTargetSession),
    [sessionYears, selectedTargetSession],
  );

  const isTargetPremature = useMemo(() => {
    if (!selectedTargetObj) {
      return false;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    return todayStr < selectedTargetObj.startDate;
  }, [selectedTargetObj]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 text-start">
      {/* Header */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="
              text-2xl font-extrabold tracking-tight text-[#16212B]
            "
            >
              {t('promotionWizardTitle')}
            </h1>
            <Badge className="
              border-none bg-[#EBF5FB] text-[11px] font-bold text-[#2487B8]
            "
            >
              {t('councilOfClass')}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t('promotionHeaderSubtitle')}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`
            flex items-center gap-2 rounded-xl border p-4 text-xs
            ${
        message.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
        }
          `}
        >
          {message.type === 'success'
            ? (
                <CheckCircle2 className="size-4 shrink-0" />
              )
            : (
                <AlertCircle className="size-4 shrink-0" />
              )}
          {message.text}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as any)}
        className="w-full"
      >
        <TabsList className="rounded-xl bg-slate-100 p-1">
          <TabsTrigger
            value="wizard"
            className="rounded-lg px-4 text-xs font-bold"
          >
            <Sparkles className="me-1.5 size-3.5" />
            {t('tabPromotionWizard')}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg px-4 text-xs font-bold"
          >
            <RotateCcw className="me-1.5 size-3.5" />
            {t('tabHistoryRevert')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="mt-4 space-y-6">
          {/* Progression Banner & Configuration */}
          <Card className="
            rounded-2xl border border-slate-200/80 bg-white shadow-xs
          "
          >
            <CardHeader className="pb-3">
              <div className="
                flex flex-col justify-between gap-4
                lg:flex-row lg:items-center
              "
              >
                <div>
                  <CardTitle className="text-base font-bold text-[#16212B]">{t('promotionConfigTitle')}</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {t('promotionConfigDesc')}
                  </CardDescription>
                </div>

                {/* Progression Route Indicator */}
                {previewMeta?.sourceSection && (
                  <div className="
                    flex items-center gap-2 rounded-xl border
                    border-slate-200/80 bg-slate-50 px-3 py-2 text-xs
                  "
                  >
                    <span className="font-bold text-[#16212B]">
                      {previewMeta.sourceSection.className}
                      {' '}
                      -
                      {previewMeta.sourceSection.sectionName}
                    </span>
                    <ArrowRight className="size-3.5 text-[#2487B8]" />
                    <span className="font-bold text-[#2487B8]">
                      {previewMeta.isTerminalClass
                        ? t('terminalClassTarget')
                        : previewMeta.nextClassName
                          ? t('nextClassLevelWithSuffix', { className: previewMeta.nextClassName })
                          : t('defaultTargetClassLabel')}
                    </span>
                    <Badge
                      variant="neutral"
                      className="ms-2 text-[10px] font-bold"
                    >
                      {t('thresholdBadge', { threshold: previewMeta.passThresholdRaw ?? 10 })}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="
              grid grid-cols-1 gap-4 pt-0
              sm:grid-cols-2
              lg:grid-cols-3
            "
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">{t('sourceSessionYearLabel')}</label>
                <div className="
                  flex h-10 items-center justify-between rounded-xl border
                  border-slate-200 bg-slate-50 px-3 text-xs font-bold
                  text-[#16212B]
                "
                >
                  <span>{sessionYears.find(y => y.isDefault)?.name || t('sessionNotConfigured')}</span>
                  <Badge className="
                    border-emerald-200 bg-emerald-50 text-[10px] font-bold
                    text-emerald-700
                  "
                  >
                    {t('sessionActiveBadge')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">{t('sourceSectionLabel')}</label>
                <Select
                  value={selectedSourceSection}
                  onValueChange={(val) => {
                    setSelectedSourceSection(val);
                    setBatchIdempotencyKey(crypto.randomUUID());
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200">
                    <SelectValue placeholder={t('chooseSectionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionsList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.className}
                        {' '}
                        -
                        {s.sectionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  {t('targetSessionLabel')}
                </label>
                <Select value={selectedTargetSession} onValueChange={setSelectedTargetSession}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200">
                    <SelectValue placeholder={t('chooseTargetSessionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionYears.filter((s) => {
                      const source = sessionYears.find(y => y.isDefault);
                      return source && s.startDate > source.startDate;
                    }).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {' '}
                        {s.isDefault ? t('sessionActiveTag') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            {sessionYears.length > 0 && !sessionYears.some((s) => {
              const source = sessionYears.find(y => y.isDefault);
              return source && s.startDate > source.startDate;
            }) && (
              <div className="
                mx-6 mb-4 flex items-center gap-2 rounded-xl border
                border-amber-200 bg-amber-50 p-3 text-xs font-medium
                text-amber-900
              "
              >
                <AlertCircle className="size-4 shrink-0 text-amber-700" />
                <span>{t('noTargetSessionWarning')}</span>
              </div>
            )}
            {isTargetPremature && selectedTargetObj && (
              <div className="
                mx-6 mb-4 flex items-center gap-2 rounded-xl border
                border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-900
              "
              >
                <Sparkles className="size-4 shrink-0 text-sky-600" />
                <span>{t('prematureActivationWarning', { date: selectedTargetObj.startDate })}</span>
              </div>
            )}
          </Card>

          {/* Conseil de Classe KPI Summary */}
          <div className="
            grid grid-cols-1 gap-4
            sm:grid-cols-2
            lg:grid-cols-4
          "
          >
            <Card className="
              flex items-center justify-between rounded-2xl border
              border-slate-200/80 bg-white p-4 shadow-xs
            "
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">{t('kpiSectionEnrollment')}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{stats.total}</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {t('kpiEvaluatedStudents', { count: stats.assessed })}
                </p>
              </div>
              <div className="
                flex size-10 items-center justify-center rounded-xl bg-blue-50
                text-[#2487B8]
              "
              >
                <Users className="size-5" />
              </div>
            </Card>

            <Card className="
              flex items-center justify-between rounded-2xl border
              border-slate-200/80 bg-white p-4 shadow-xs
            "
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">{t('kpiAdmittedToNextLevel')}</p>
                <p className="text-2xl font-extrabold text-emerald-600">{stats.toPromote}</p>
                <p className="text-[11px] font-bold text-emerald-600">
                  {t('kpiSuccessRate')}
                  {' '}
                  {stats.passRate === null ? '—' : `${stats.passRate}%`}
                </p>
              </div>
              <div className="
                flex size-10 items-center justify-center rounded-xl
                bg-emerald-50 text-emerald-600
              "
              >
                <CheckCircle2 className="size-5" />
              </div>
            </Card>

            <Card className="
              flex items-center justify-between rounded-2xl border
              border-slate-200/80 bg-white p-4 shadow-xs
            "
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">{t('kpiCasesToDeliberate')}</p>
                <p className="text-2xl font-extrabold text-amber-600">{stats.borderline}</p>
                <p className="text-[11px] font-semibold text-amber-600">{t('kpiDeliberateThresholdRange')}</p>
              </div>
              <div className="
                flex size-10 items-center justify-center rounded-xl bg-amber-50
                text-amber-600
              "
              >
                <Scale className="size-5" />
              </div>
            </Card>

            <Card className="
              flex items-center justify-between rounded-2xl border
              border-slate-200/80 bg-white p-4 shadow-xs
            "
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">{t('kpiDecidedRepeats')}</p>
                <p className="text-2xl font-extrabold text-rose-600">{stats.toRepeat}</p>
                <p className="text-[11px] font-semibold text-rose-600">
                  {t('kpiRetentionIn', { level: previewMeta?.sourceSection?.className || 'niveau' })}
                </p>
              </div>
              <div className="
                flex size-10 items-center justify-center rounded-xl bg-rose-50
                text-rose-600
              "
              >
                <RotateCcw className="size-5" />
              </div>
            </Card>
          </div>

          {/* Live Capacity Check Banner & Transparent Reconciled Arithmetic */}
          {capacityBreakdown.length > 0 && (
            <Card className="
              rounded-2xl border border-slate-200/80 bg-white shadow-xs
            "
            >
              <CardContent className="space-y-3 p-4">
                <div className="
                  flex flex-wrap items-center justify-between gap-4
                "
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      rounded-xl p-2.5
                      ${
            hasCapacityExceeded
              ? 'bg-red-50 text-red-600'
              : hasCapacityUnconfigured
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
            }
                    `}
                    >
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#16212B]">{t('capacityCheckTitle')}</p>
                      <p className="text-xs text-slate-500">
                        {hasCapacityExceeded ? t('badgeCapacityExceeded') : hasCapacityUnconfigured ? t('capacityUnconfiguredTag') : t('badgeCapacityValid')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasCapacityUnconfigured && (
                      <Badge
                        variant="warning"
                        className="
                          border-amber-200 bg-amber-50 text-xs font-bold
                          text-amber-800
                        "
                      >
                        {t('capacityUnconfiguredTag')}
                      </Badge>
                    )}
                    {hasCapacityExceeded
                      ? (
                          <Badge variant="danger" className="text-xs font-bold">
                            {t('badgeCapacityExceeded')}
                          </Badge>
                        )
                      : !hasCapacityUnconfigured
                          ? (
                              <Badge
                                variant="success"
                                className="text-xs font-bold"
                              >
                                {t('badgeCapacityValid')}
                              </Badge>
                            )
                          : null}
                  </div>
                </div>

                {/* Arithmetic Reconciliation Breakdown Table / Cards */}
                <div className="
                  grid grid-cols-1 gap-3 border-t border-slate-100 pt-2
                  md:grid-cols-2
                "
                >
                  {capacityBreakdown.map((b) => {
                    const projected = b.projectedOccupancy ?? (b.currentStudentsCount + b.proposedStudentsCount);
                    const remaining = b.remainingAfter ?? b.headroom;
                    const max = b.maxStudents;
                    return (
                      <div
                        key={b.classSectionId}
                        className="
                          space-y-1.5 rounded-xl border border-slate-200/70
                          bg-slate-50/70 p-3 text-xs
                        "
                      >
                        <div className="
                          flex items-center justify-between font-bold
                          text-[#16212B]
                        "
                        >
                          <span>
                            {b.className}
                            {' '}
                            -
                            {' '}
                            {b.sectionName}
                          </span>
                          <span className={b.isExceeded
                            ? `font-extrabold text-red-600`
                            : `font-semibold text-emerald-700`}
                          >
                            {b.isConfigured ? `${remaining} ${t('capacityRemaining')}` : t('capacityUnconfiguredTag')}
                          </span>
                        </div>
                        <div className="
                          flex flex-wrap items-center justify-between gap-1
                          rounded-lg border border-slate-200/50 bg-white p-2
                          font-mono text-[11px] text-slate-600
                        "
                        >
                          <span>
                            {t('capacityCurrentOccupancy')}
                            :
                            {' '}
                            <strong>{b.currentStudentsCount}</strong>
                          </span>
                          <span>+</span>
                          <span>
                            {t('capacityIncomingBatch')}
                            :
                            {' '}
                            <strong>{b.proposedStudentsCount}</strong>
                          </span>
                          <span>=</span>
                          <span>
                            {t('capacityProjected')}
                            :
                            {' '}
                            <strong>{projected}</strong>
                          </span>
                          <span>/</span>
                          <span>
                            {t('capacityMaxPlaces')}
                            :
                            {' '}
                            <strong>{max ?? '—'}</strong>
                          </span>
                        </div>
                        {b.isConfigured && (
                          <p className="
                            text-end font-mono text-[10px] text-slate-500
                          "
                          >
                            {t('capacityMathFormula', { max: max ?? 0, projected, remaining: remaining ?? 0 })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Decision Matrix & Deliberation Engine */}
          {!selectedTargetSession && (
            <Card className="
              border-amber-200 bg-amber-50 p-4 text-xs font-semibold
              text-amber-900
            "
            >
              {t('promotionNeedsNextSession')}
            </Card>
          )}
          {stats.toHold > 0 && (
            <Card className="
              border-amber-200 bg-amber-50 p-4 text-xs font-semibold
              text-amber-900
            "
            >
              {t('promotionPendingDecisions', { count: stats.toHold })}
            </Card>
          )}
          <Card className="
            rounded-2xl border border-slate-200/80 bg-white shadow-xs
          "
          >
            <CardHeader className="
              flex flex-col justify-between gap-4 border-b border-slate-100 pb-4
              xl:flex-row xl:items-center
            "
            >
              <div>
                <CardTitle className="
                  flex items-center gap-2 text-base font-bold text-[#16212B]
                "
                >
                  <span>{t('studentDecisionMatrixTitle')}</span>
                  <Badge variant="neutral" className="text-xs font-bold">
                    {t('studentsCountBadge', { count: studentsDecisions.length })}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs text-slate-500">
                  {t('studentDecisionMatrixDesc')}
                </CardDescription>
              </div>

              {/* One-Click Review & Action Tools */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleApplyAutoThreshold}
                  disabled={studentsDecisions.length === 0}
                  className="
                    h-9 gap-1.5 rounded-xl border-slate-200 text-xs
                    hover:bg-slate-50
                  "
                  title={t('tooltipAutoThreshold')}
                >
                  <Sparkles className="size-3.5 text-[#2487B8]" />
                  <span>{t('btnAutoThreshold')}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDeliberateRescue}
                  disabled={studentsDecisions.length === 0}
                  className="
                    h-9 gap-1.5 rounded-xl border-amber-200 bg-amber-50/50
                    text-xs text-amber-800
                    hover:bg-amber-100/60
                  "
                  title={t('tooltipRescueCandidates')}
                >
                  <Scale className="size-3.5 text-amber-600" />
                  <span>{t('btnRescueCandidates')}</span>
                </Button>

                {!previewMeta?.isTerminalClass && (
                  <Button
                    variant="outline"
                    onClick={handleBalanceTargetSections}
                    disabled={studentsDecisions.length === 0}
                    className="
                      h-9 gap-1.5 rounded-xl border-slate-200 text-xs
                      text-slate-700
                      hover:bg-slate-50
                    "
                    title={t('tooltipBalanceSections')}
                  >
                    <Shuffle className="size-3.5 text-slate-600" />
                    <span>{t('btnBalanceSections')}</span>
                  </Button>
                )}

                <Button
                  onClick={handleCommitPromotion}
                  disabled={submitting || studentsDecisions.length === 0 || !selectedTargetSession || stats.toHold > 0 || hasCapacityExceeded || hasCapacityUnconfigured}
                  className="
                    h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs text-white
                    shadow-2xs
                    hover:bg-[#1B6C93]
                  "
                >
                  {submitting
                    ? <Loader2 className="size-4 animate-spin" />
                    : (
                        <Send className="size-3.5" />
                      )}
                  <span>{t('btnCommitPromotion')}</span>
                </Button>
              </div>
            </CardHeader>

            {/* Filter Pills Toolbar */}
            <div className="
              flex flex-wrap items-center gap-2 border-b border-slate-50 px-6
              pt-4 pb-2
            "
            >
              <span className="me-1 text-xs font-bold text-slate-400">{t('filterExamsLabel')}</span>
              <Button
                size="sm"
                variant={reviewFilter === 'all' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('all')}
                className={`
                  h-8 rounded-full px-3 text-xs font-bold
                  ${reviewFilter === 'all'
      ? `bg-[#16212B] text-white`
      : `text-slate-600`}
                `}
              >
                {t('filterAllStudents')}
                {' '}
                (
                {studentsDecisions.length}
                )
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'promote' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('promote')}
                className={`
                  h-8 rounded-full px-3 text-xs font-bold
                  ${reviewFilter === 'promote'
      ? `bg-emerald-600 text-white`
      : `
        text-emerald-700
        hover:bg-emerald-50
      `}
                `}
              >
                {t('filterAdmitted')}
                {' '}
                (
                {stats.toPromote}
                )
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'borderline' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('borderline')}
                className={`
                  h-8 rounded-full px-3 text-xs font-bold
                  ${reviewFilter === 'borderline'
      ? `bg-amber-600 text-white`
      : `
        text-amber-700
        hover:bg-amber-50
      `}
                `}
              >
                {t('filterBorderline')}
                {' '}
                (
                {stats.borderline}
                )
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'repeat' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('repeat')}
                className={`
                  h-8 rounded-full px-3 text-xs font-bold
                  ${reviewFilter === 'repeat'
      ? `bg-rose-600 text-white`
      : `
        text-rose-700
        hover:bg-rose-50
      `}
                `}
              >
                {t('filterRepeats')}
                {' '}
                (
                {stats.toRepeat}
                )
              </Button>
              {stats.toHold > 0 && (
                <Button
                  size="sm"
                  variant={reviewFilter === 'hold' ? 'default' : 'ghost'}
                  onClick={() => setReviewFilter('hold')}
                  className={`
                    h-8 rounded-full px-3 text-xs font-bold
                    ${reviewFilter === 'hold'
                  ? `bg-slate-600 text-white`
                  : `
                    text-slate-600
                    hover:bg-slate-50
                  `}
                  `}
                >
                  {t('filterHold')}
                  {' '}
                  (
                  {stats.toHold}
                  )
                </Button>
              )}
            </div>

            <CardContent className="pt-2">
              {/* Desktop Table View (hidden md:block) */}
              <div className="
                hidden
                md:block
              "
              >
                <Table>
                  <TableHeader>
                    <TableRow className="
                      border-slate-100
                      hover:bg-transparent
                    "
                    >
                      <TableHead className="
                        w-28 text-start text-xs font-bold text-slate-700
                      "
                      >
                        {t('colMatricule')}
                      </TableHead>
                      <TableHead className="
                        text-start text-xs font-bold text-slate-700
                      "
                      >
                        {t('colFullName')}
                      </TableHead>
                      <TableHead className="
                        w-36 text-start text-xs font-bold text-slate-700
                      "
                      >
                        {t('colAverageScore')}
                      </TableHead>
                      <TableHead className="
                        w-32 text-start text-xs font-bold text-slate-700
                      "
                      >
                        {t('colTuitionFees')}
                      </TableHead>
                      <TableHead className="
                        w-44 text-start text-xs font-bold text-slate-700
                      "
                      >
                        {t('colDecision')}
                      </TableHead>
                      <TableHead className="
                        text-start text-xs font-bold text-slate-700
                      "
                      >
                        {t('colTargetSection')}
                      </TableHead>
                      <TableHead className="
                        w-28 text-end text-xs font-bold text-slate-700
                      "
                      >
                        {t('colAction')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingStudents
                      ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="
                                py-12 text-center text-xs text-slate-400
                              "
                            >
                              <div className="
                                flex flex-col items-center justify-center gap-2
                              "
                              >
                                <Loader2 className="
                                  size-5 animate-spin text-[#2487B8]
                                "
                                />
                                <span>{t('loadingStudents')}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      : filteredStudents.length === 0
                        ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="
                                  py-12 text-center text-xs text-slate-400
                                "
                              >
                                {t('noStudentsInSection')}
                              </TableCell>
                            </TableRow>
                          )
                        : (
                            filteredStudents.map((stu) => {
                              const score20 = stu.grade20 ?? (stu.averagePercentage != null ? Math.round((stu.averagePercentage / 5) * 100) / 100 : null);
                              const isPassing = score20 !== null && score20 >= (previewMeta?.passThresholdRaw ?? 10);
                              const isCandidate = score20 !== null && score20 >= 9.0 && score20 < 10.0;

                              return (
                                <TableRow
                                  key={stu.studentId}
                                  className="
                                    border-slate-100
                                    hover:bg-slate-50/50
                                  "
                                >
                                  <TableCell className="
                                    text-start font-mono text-xs font-semibold
                                    text-[#16212B]
                                  "
                                  >
                                    {stu.matricule}
                                  </TableCell>
                                  <TableCell className="text-start">
                                    <div className="flex items-center gap-2.5">
                                      <div className="
                                        flex size-7 shrink-0 items-center
                                        justify-center rounded-full bg-slate-100
                                        text-[11px] font-bold text-[#16212B]
                                      "
                                      >
                                        {stu.fullName.slice(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="
                                          text-xs/snug font-bold text-[#16212B]
                                        "
                                        >
                                          {stu.fullName}
                                        </p>
                                        {stu.reason && (
                                          <p className="
                                            text-[10px] font-medium
                                            text-amber-700
                                          "
                                          >
                                            {stu.reason}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-start">
                                    {score20 !== null
                                      ? (
                                          <div className="
                                            flex items-center gap-1.5
                                          "
                                          >
                                            <Badge
                                              className={`
                                                rounded-lg border px-2 py-0.5
                                                text-xs font-bold
                                                ${
                                          isPassing
                                            ? `
                                              border-emerald-200 bg-emerald-50
                                              text-emerald-700
                                            `
                                            : isCandidate
                                              ? `
                                                border-amber-200 bg-amber-50
                                                text-amber-800
                                              `
                                              : `
                                                border-rose-200 bg-rose-50
                                                text-rose-700
                                              `
                                          }
                                              `}
                                            >
                                              {score20.toFixed(2)}
                                              {' '}
                                              / 20
                                            </Badge>
                                            <span className="
                                              text-[11px] font-medium
                                              text-slate-400
                                            "
                                            >
                                              (
                                              {stu.averagePercentage}
                                              %)
                                            </span>
                                          </div>
                                        )
                                      : (
                                          <Badge
                                            variant="neutral"
                                            className="
                                              text-[11px] text-slate-400
                                            "
                                          >
                                            {t('badgeNotAssessed')}
                                          </Badge>
                                        )}
                                  </TableCell>
                                  <TableCell className="text-start">
                                    {stu.hasUnpaidFees
                                      ? (
                                          <Badge className="
                                            border border-amber-200 bg-amber-50
                                            text-[11px] font-bold text-amber-800
                                          "
                                          >
                                            {t('badgeUnpaid', { amount: stu.unpaidBalance ?? 0 })}
                                          </Badge>
                                        )
                                      : (
                                          <Badge className="
                                            border border-emerald-200
                                            bg-emerald-50 text-[11px] font-bold
                                            text-emerald-700
                                          "
                                          >
                                            {t('badgeUpToDate')}
                                          </Badge>
                                        )}
                                  </TableCell>
                                  <TableCell className="text-start">
                                    <Select
                                      value={stu.decision}
                                      onValueChange={val => handleDecisionChange(stu.studentId, val as DecisionType)}
                                    >
                                      <SelectTrigger className="
                                        h-8 w-44 rounded-xl border-slate-200
                                        text-xs font-semibold
                                      "
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="promote">
                                          <span className="
                                            font-bold text-emerald-700
                                          "
                                          >
                                            {decisionLabels.promote}
                                          </span>
                                        </SelectItem>
                                        <SelectItem value="repeat">
                                          <span className="
                                            font-bold text-rose-700
                                          "
                                          >
                                            {decisionLabels.repeat}
                                          </span>
                                        </SelectItem>
                                        <SelectItem value="graduate">
                                          <span className="
                                            font-bold text-blue-700
                                          "
                                          >
                                            {decisionLabels.graduate}
                                            {' '}
                                            {t('alumniParentheses')}
                                          </span>
                                        </SelectItem>
                                        <SelectItem value="transfer">{decisionLabels.transfer}</SelectItem>
                                        <SelectItem value="withdraw">{decisionLabels.withdraw}</SelectItem>
                                        <SelectItem value="hold">{decisionLabels.hold}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-start">
                                    {stu.decision === 'graduate'
                                      ? (
                                          <Badge className="
                                            gap-1 border border-blue-200
                                            bg-blue-50 py-1 text-xs font-bold
                                            text-blue-700
                                          "
                                          >
                                            <GraduationCap className="size-3.5" />
                                            <span>{t('alumniBacGraduate')}</span>
                                          </Badge>
                                        )
                                      : (stu.decision === 'promote' || stu.decision === 'repeat')
                                          ? (
                                              <Select
                                                value={stu.targetClassSectionId || ''}
                                                onValueChange={val => handleTargetSectionChange(stu.studentId, val)}
                                              >
                                                <SelectTrigger className="
                                                  h-8 w-52 rounded-xl
                                                  border-slate-200 text-xs
                                                  font-medium
                                                "
                                                >
                                                  <SelectValue placeholder={t('chooseSectionPlaceholder')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {Object.entries(groupedSections).map(([className, secs]) => (
                                                    <SelectGroup key={className}>
                                                      <SelectLabel className="
                                                        px-2 text-[11px]
                                                        font-bold tracking-wider
                                                        text-slate-400 uppercase
                                                      "
                                                      >
                                                        {className}
                                                      </SelectLabel>
                                                      {secs.map(sec => (
                                                        <SelectItem
                                                          key={sec.id}
                                                          value={sec.id}
                                                          className="text-xs"
                                                        >
                                                          {sec.className}
                                                          {' '}
                                                          - Section
                                                          {sec.sectionName}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectGroup>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            )
                                          : (
                                              <span className="
                                                text-xs text-slate-400
                                              "
                                              >
                                                —
                                                {' '}
                                                {t('statusUnassigned')}
                                              </span>
                                            )}
                                  </TableCell>
                                  <TableCell className="text-end">
                                    {isCandidate && stu.decision !== 'promote' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDecisionChange(stu.studentId, 'promote')}
                                        className="
                                          h-7 rounded-lg border-amber-200
                                          bg-amber-50 px-2 text-[11px] font-bold
                                          text-amber-800
                                          hover:bg-amber-100
                                        "
                                      >
                                        {t('rescueActionBtn')}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile 390px Card View (block md:hidden) */}
              <div className="
                block space-y-3 pb-2
                md:hidden
              "
              >
                {loadingStudents
                  ? (
                      <div className="
                        flex flex-col items-center justify-center gap-2 py-12
                        text-center text-xs text-slate-400
                      "
                      >
                        <Loader2 className="size-5 animate-spin text-[#2487B8]" />
                        <span>{t('loadingStudents')}</span>
                      </div>
                    )
                  : filteredStudents.length === 0
                    ? (
                        <div className="
                          py-12 text-center text-xs text-slate-400
                        "
                        >
                          {t('noStudentsInSection')}
                        </div>
                      )
                    : (
                        filteredStudents.map((stu) => {
                          const score20 = stu.grade20 ?? (stu.averagePercentage != null ? Math.round((stu.averagePercentage / 5) * 100) / 100 : null);
                          const isPassing = score20 !== null && score20 >= (previewMeta?.passThresholdRaw ?? 10);
                          const isCandidate = score20 !== null && score20 >= 9.0 && score20 < 10.0;

                          return (
                            <div
                              key={stu.studentId}
                              className="
                                space-y-3 rounded-2xl border border-slate-200/90
                                bg-white p-3.5 shadow-xs
                              "
                            >
                              {/* Top Row: Identity & Average */}
                              <div className="
                                flex items-start justify-between gap-2
                              "
                              >
                                <div className="
                                  flex min-w-0 items-center gap-2.5
                                "
                                >
                                  <div className="
                                    flex size-9 shrink-0 items-center
                                    justify-center rounded-full bg-slate-100
                                    text-xs font-bold text-[#16212B]
                                  "
                                  >
                                    {stu.fullName.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="
                                      truncate text-sm font-bold text-[#16212B]
                                    "
                                    >
                                      {stu.fullName}
                                    </p>
                                    <span className="
                                      font-mono text-[11px] font-semibold
                                      text-slate-500
                                    "
                                    >
                                      {stu.matricule}
                                    </span>
                                  </div>
                                </div>

                                {score20 !== null
                                  ? (
                                      <div className="shrink-0 text-end">
                                        <Badge className={`
                                          rounded-lg border px-2 py-0.5 text-xs
                                          font-bold
                                          ${
                                      isPassing
                                        ? `
                                          border-emerald-200 bg-emerald-50
                                          text-emerald-700
                                        `
                                        : isCandidate
                                          ? `
                                            border-amber-200 bg-amber-50
                                            text-amber-800
                                          `
                                          : `
                                            border-rose-200 bg-rose-50
                                            text-rose-700
                                          `
                                      }
                                        `}
                                        >
                                          {score20.toFixed(2)}
                                          {' '}
                                          / 20
                                        </Badge>
                                        <p className="
                                          mt-0.5 text-[10px] text-slate-400
                                        "
                                        >
                                          (
                                          {stu.averagePercentage}
                                          %)
                                        </p>
                                      </div>
                                    )
                                  : (
                                      <Badge
                                        variant="neutral"
                                        className="
                                          shrink-0 text-[10px] text-slate-400
                                        "
                                      >
                                        {t('badgeNotAssessed')}
                                      </Badge>
                                    )}
                              </div>

                              {/* Second Row: Tuition Fees & Deliberation Reason */}
                              <div className="
                                flex flex-wrap items-center justify-between
                                gap-2 border-t border-slate-100 pt-1 text-xs
                              "
                              >
                                <span className="
                                  text-[11px] font-semibold text-slate-500
                                "
                                >
                                  {t('colTuitionFees')}
                                  {' '}
                                  :
                                </span>
                                {stu.hasUnpaidFees
                                  ? (
                                      <Badge className="
                                        border border-amber-200 bg-amber-50
                                        text-[11px] font-bold text-amber-800
                                      "
                                      >
                                        {t('badgeUnpaid', { amount: stu.unpaidBalance ?? 0 })}
                                      </Badge>
                                    )
                                  : (
                                      <Badge className="
                                        border border-emerald-200 bg-emerald-50
                                        text-[11px] font-bold text-emerald-700
                                      "
                                      >
                                        {t('badgeUpToDate')}
                                      </Badge>
                                    )}
                              </div>

                              {stu.reason && (
                                <p className="
                                  rounded-lg border border-amber-100
                                  bg-amber-50/70 p-2 text-[11px] font-medium
                                  text-amber-800
                                "
                                >
                                  {stu.reason}
                                </p>
                              )}

                              {/* Third Row: Editable Decision (min-h-[44px] touch target) */}
                              <div className="space-y-1">
                                <label className="
                                  text-xs font-bold text-slate-700
                                "
                                >
                                  {t('mobileStudentDecisionLabel')}
                                </label>
                                <Select
                                  value={stu.decision}
                                  onValueChange={val => handleDecisionChange(stu.studentId, val as DecisionType)}
                                >
                                  <SelectTrigger className="
                                    min-h-[44px] w-full rounded-xl
                                    border-slate-200 text-xs font-semibold
                                  "
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="promote">
                                      <span className="
                                        font-bold text-emerald-700
                                      "
                                      >
                                        {decisionLabels.promote}
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="repeat">
                                      <span className="font-bold text-rose-700">
                                        {decisionLabels.repeat}
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="graduate">
                                      <span className="font-bold text-blue-700">
                                        {decisionLabels.graduate}
                                        {' '}
                                        {t('alumniParentheses')}
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="transfer">{decisionLabels.transfer}</SelectItem>
                                    <SelectItem value="withdraw">{decisionLabels.withdraw}</SelectItem>
                                    <SelectItem value="hold">{decisionLabels.hold}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Fourth Row: Target Section (min-h-[44px] touch target) */}
                              <div className="space-y-1">
                                <label className="
                                  text-xs font-bold text-slate-700
                                "
                                >
                                  {t('mobileStudentTargetSectionLabel')}
                                </label>
                                {stu.decision === 'graduate'
                                  ? (
                                      <div className="
                                        flex min-h-[44px] items-center gap-1.5
                                        rounded-xl border border-blue-200
                                        bg-blue-50 px-3 text-xs font-bold
                                        text-blue-700
                                      "
                                      >
                                        <GraduationCap className="size-4" />
                                        <span>{t('alumniBacGraduate')}</span>
                                      </div>
                                    )
                                  : (stu.decision === 'promote' || stu.decision === 'repeat')
                                      ? (
                                          <Select
                                            value={stu.targetClassSectionId || ''}
                                            onValueChange={val => handleTargetSectionChange(stu.studentId, val)}
                                          >
                                            <SelectTrigger className="
                                              min-h-[44px] w-full rounded-xl
                                              border-slate-200 text-xs
                                              font-medium
                                            "
                                            >
                                              <SelectValue placeholder={t('chooseSectionPlaceholder')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {Object.entries(groupedSections).map(([className, secs]) => (
                                                <SelectGroup key={className}>
                                                  <SelectLabel className="
                                                    px-2 text-[11px] font-bold
                                                    tracking-wider
                                                    text-slate-400 uppercase
                                                  "
                                                  >
                                                    {className}
                                                  </SelectLabel>
                                                  {secs.map(sec => (
                                                    <SelectItem
                                                      key={sec.id}
                                                      value={sec.id}
                                                      className="text-xs"
                                                    >
                                                      {sec.className}
                                                      {' '}
                                                      - Section
                                                      {sec.sectionName}
                                                    </SelectItem>
                                                  ))}
                                                </SelectGroup>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )
                                      : (
                                          <div className="
                                            flex min-h-[44px] items-center
                                            rounded-xl border border-slate-200
                                            bg-slate-50 px-3 text-xs
                                            text-slate-400
                                          "
                                          >
                                            —
                                            {' '}
                                            {t('statusUnassigned')}
                                          </div>
                                        )}
                              </div>

                              {/* Fifth Row: Action Button if eligible for rescue */}
                              {isCandidate && stu.decision !== 'promote' && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleDecisionChange(stu.studentId, 'promote')}
                                  className="
                                    min-h-[44px] w-full rounded-xl
                                    border-amber-200 bg-amber-50 text-xs
                                    font-bold text-amber-800
                                    hover:bg-amber-100
                                  "
                                >
                                  <Scale className="
                                    me-1.5 size-4 text-amber-600
                                  "
                                  />
                                  {t('rescueActionBtn')}
                                  {' '}
                                  {t('admitAtCouncilSuffix')}
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="
            rounded-2xl border border-slate-200/80 bg-white shadow-xs
          "
          >
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#16212B]">{t('historyBatchesTitle')}</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {t('historyBatchesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory
                ? (
                    <p className="py-6 text-center text-xs text-slate-400">{t('loadingHistory')}</p>
                  )
                : historyBatches.length === 0
                  ? (
                      <p className="py-6 text-center text-xs text-slate-400">{t('noHistoryBatches')}</p>
                    )
                  : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100">
                            <TableHead className="
                              text-start text-xs font-bold text-slate-700
                            "
                            >
                              {t('colPromotionDate')}
                            </TableHead>
                            <TableHead className="
                              text-start text-xs font-bold text-slate-700
                            "
                            >
                              {t('targetSessionLabel')}
                            </TableHead>
                            <TableHead className="
                              text-start text-xs font-bold text-slate-700
                            "
                            >
                              {tCommon('status')}
                            </TableHead>
                            <TableHead className="
                              text-end text-xs font-bold text-slate-700
                            "
                            >
                              {tCommon('actions')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyBatches.map(batch => (
                            <TableRow
                              key={batch.id}
                              className="border-slate-100"
                            >
                              <TableCell className="
                                text-start text-xs text-slate-600
                              "
                              >
                                {new Date(batch.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="
                                text-start text-xs font-semibold text-[#16212B]
                              "
                              >
                                {batch.targetSessionYearName || t('targetSessionLabel')}
                              </TableCell>
                              <TableCell className="text-start">
                                <Badge
                                  variant={batch.status === 'committed' ? 'success' : 'neutral'}
                                  className="text-xs capitalize"
                                >
                                  {batch.status === 'committed' ? t('statusCommitted') : t('statusReverted')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-end">
                                {batch.status === 'committed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRevertBatch(batch.id)}
                                    disabled={revertingId === batch.id}
                                    className="
                                      h-8 gap-1 rounded-xl border-red-200
                                      text-xs text-red-600
                                      hover:bg-red-50
                                    "
                                  >
                                    <RotateCcw className="size-3.5" />
                                    {revertingId === batch.id ? t('reverting') : t('btnRevertBatch')}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
