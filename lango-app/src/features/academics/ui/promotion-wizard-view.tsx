'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle, CheckCircle2, RotateCcw, ShieldCheck, Sparkles, Send, Loader2,
  ArrowRight, Users, GraduationCap, Scale, Shuffle
} from 'lucide-react';
import { toast } from 'sonner';

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
  cycle?: string | null;
}

interface SessionYear {
  id: string;
  name: string;
  isDefault: boolean;
}

type DecisionType = 'promote' | 'repeat' | 'graduate' | 'transfer' | 'withdraw' | 'hold';

interface StudentDecisionState {
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
}

interface CapacityBreakdown {
  offeringId: string | null;
  classSectionId: string | null;
  className: string;
  sectionName: string;
  capacity: number | null;
  currentStudentsCount: number;
  proposedStudentsCount: number;
  headroom: number | null;
  isExceeded: boolean;
}

interface PromotionBatchHistory {
  id: string;
  sourceClassSectionId: string;
  targetSessionYearId: string;
  targetSessionYearName: string;
  status: 'committed' | 'reverted';
  operatorId: string;
  createdAt: string;
}

interface PreviewMeta {
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
}

export function PromotionWizardView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');

  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');
  const [sectionsList, setSectionsList] = useState<ClassSection[]>([]);
  const [sessionYears, setSessionYears] = useState<SessionYear[]>([]);

  const [selectedSourceSection, setSelectedSourceSection] = useState<string>('');
  const [selectedTargetSession, setSelectedTargetSession] = useState<string>('');

  const [studentsDecisions, setStudentsDecisions] = useState<StudentDecisionState[]>([]);
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Review Filter: 'all' | 'promote' | 'borderline' | 'repeat' | 'hold'
  const [reviewFilter, setReviewFilter] = useState<'all' | 'promote' | 'borderline' | 'repeat' | 'hold'>('all');

  const [capacityBreakdown, setCapacityBreakdown] = useState<CapacityBreakdown[]>([]);
  const [hasCapacityExceeded, setHasCapacityExceeded] = useState(false);
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
      fetch('/api/academics/class-sections?pageSize=200').then((r) => r.json()),
      fetch('/api/academics/session-years').then((r) => r.json()),
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
        if (def) setSelectedTargetSession(def.id);
        else if (sessRes.data.length > 0) setSelectedTargetSession(sessRes.data[0].id);
      }
    });
  }, []);

  // Fetch real grade-based student recommendations and metadata when source section changes
  useEffect(() => {
    if (!selectedSourceSection) return;
    setLoadingStudents(true);
    fetch(`/api/students/promotions/preview?sourceSectionId=${selectedSourceSection}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setPreviewMeta(res.meta || null);
          const mapped: StudentDecisionState[] = res.data.map((item: any) => ({
            studentId: item.studentId,
            fullName: item.studentName,
            matricule: item.matricule || 'N/A',
            decision: item.decision || (item.recommendation === 'promote' ? 'promote' : item.recommendation === 'retain' ? 'repeat' : 'hold'),
            targetClassSectionId: item.recommendedTargetSectionId || null,
            averagePercentage: item.averagePercentage != null ? item.averagePercentage : undefined,
            grade20: item.grade20 != null ? item.grade20 : undefined,
            isBorderline: !!item.isBorderline,
            userStatus: item.currentStatus,
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
    if (!selectedTargetSession || studentsDecisions.length === 0) return;

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
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCapacityBreakdown(res.data.breakdown || []);
          setHasCapacityExceeded(res.data.hasCapacityExceeded || false);
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
    setStudentsDecisions((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
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
      })
    );
  };

  const handleTargetSectionChange = (studentId: string, targetClassSectionId: string) => {
    setStudentsDecisions((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, targetClassSectionId } : s))
    );
  };

  // Bulk Action 1: Re-apply Automatic Standard Threshold (≥ 10/20)
  const handleApplyAutoThreshold = () => {
    const thresholdPct = previewMeta?.passThreshold ?? 50;
    const isTerminal = previewMeta?.isTerminalClass ?? false;
    const defaultPromoteSec = previewMeta?.nextClassSections?.[0]?.id || null;
    const defaultRepeatSec = previewMeta?.sourceSection?.id || null;

    setStudentsDecisions((prev) =>
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
      })
    );
    toast.success('Seuil automatique (≥ 10/20) appliqué avec succès.');
  };

  // Bulk Action 2: Deliberation Repêchage (Promote students with GPA ≥ 9.50/20)
  const handleDeliberateRepêchage = () => {
    const defaultPromoteSec = previewMeta?.nextClassSections?.[0]?.id || null;
    const isTerminal = previewMeta?.isTerminalClass ?? false;
    let count = 0;

    setStudentsDecisions((prev) =>
      prev.map((s) => {
        const score = s.grade20 ?? (s.averagePercentage != null ? s.averagePercentage / 5 : null);
        if (score !== null && score >= 9.5 && score < 10 && s.decision !== 'promote') {
          count++;
          return {
            ...s,
            decision: isTerminal ? 'graduate' : 'promote',
            targetClassSectionId: isTerminal ? null : (s.targetClassSectionId || defaultPromoteSec),
            reason: 'Admis par délibération du conseil de classe (Repêchage ≥ 9.50/20)',
          };
        }
        return s;
      })
    );

    if (count > 0) {
      toast.success(`${count} élève(s) repêché(s) avec succès par le Conseil de Classe.`);
    } else {
      toast.info('Aucun élève en zone de repêchage (9.50 - 9.99/20) trouvé.');
    }
  };

  // Bulk Action 3: Balance Promoted Students across Target Sections (A, B, C)
  const handleBalanceTargetSections = () => {
    const nextSections = previewMeta?.nextClassSections || [];
    if (nextSections.length === 0) {
      toast.error('Aucune section cible disponible pour la classe supérieure.');
      return;
    }

    let nextSecIndex = 0;
    let count = 0;

    setStudentsDecisions((prev) =>
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
      })
    );

    toast.success(`${count} élèves promus répartis équitablement sur ${nextSections.length} sections (${nextSections.map(s => s.sectionName).join(', ')}).`);
  };

  // Commit promotion to backend
  const handleCommitPromotion = async () => {
    if (!selectedSourceSection || !selectedTargetSession || studentsDecisions.length === 0) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        sourceClassSectionId: selectedSourceSection,
        targetSessionYearId: selectedTargetSession,
        idempotencyKey: `prom-${selectedSourceSection}-${Date.now()}`,
        decisions: studentsDecisions.map((s) => ({
          studentId: s.studentId,
          decision: s.decision,
          targetClassSectionId: (s.decision === 'promote' || s.decision === 'repeat') ? (s.targetClassSectionId || undefined) : undefined,
          averagePercentage: s.averagePercentage,
          reason: s.reason || `Délibération du Conseil de Classe`,
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
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Erreur lors de la validation.' });
        toast.error(data.error?.message || 'Erreur lors de la validation.');
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de la validation.' });
      toast.error('Erreur réseau lors de la validation.');
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
        setMessage({ type: 'error', text: data.error?.message || 'Impossible d\'annuler ce lot.' });
        toast.error(data.error?.message || 'Impossible d\'annuler ce lot.');
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de l\'annulation.' });
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
    const borderline = studentsDecisions.filter(s => {
      const score = s.grade20 ?? (s.averagePercentage != null ? s.averagePercentage / 5 : null);
      return score !== null && score >= 9.0 && score < 10.0;
    }).length;
    const passRate = total > 0 ? Math.round((toPromote / total) * 100) : 0;

    return { total, toPromote, toRepeat, toHold, borderline, passRate };
  }, [studentsDecisions]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    if (reviewFilter === 'all') return studentsDecisions;
    if (reviewFilter === 'promote') return studentsDecisions.filter(s => s.decision === 'promote' || s.decision === 'graduate');
    if (reviewFilter === 'repeat') return studentsDecisions.filter(s => s.decision === 'repeat');
    if (reviewFilter === 'hold') return studentsDecisions.filter(s => s.decision === 'hold');
    if (reviewFilter === 'borderline') {
      return studentsDecisions.filter(s => {
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
    list.forEach(sec => {
      if (!groups[sec.className]) groups[sec.className] = [];
      groups[sec.className]!.push(sec);
    });
    return groups;
  }, [previewMeta, sectionsList]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              {t('promotionWizardTitle')}
            </h1>
            <Badge className="bg-[#EBF5FB] text-[#2487B8] border-none text-[11px] font-bold">
              Conseil de Classe & Délibérations
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Délibération automatisée avec seuil réglementaire (/20), repêchage assisté et validation des capacités d&apos;accueil.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="wizard" className="rounded-lg text-xs font-bold px-4">
            <Sparkles className="w-3.5 h-3.5 me-1.5" />
            {t('tabPromotionWizard')}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg text-xs font-bold px-4">
            <RotateCcw className="w-3.5 h-3.5 me-1.5" />
            {t('tabHistoryRevert')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="space-y-6 mt-4">
          {/* Progression Banner & Configuration */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-[#16212B]">{t('promotionConfigTitle')}</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Sélectionnez la section d&apos;origine. Le système détecte automatiquement le niveau supérieur et les sections cibles.
                  </CardDescription>
                </div>

                {/* Progression Route Indicator */}
                {previewMeta?.sourceSection && (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs">
                    <span className="font-bold text-[#16212B]">
                      {previewMeta.sourceSection.className} - {previewMeta.sourceSection.sectionName}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#2487B8]" />
                    <span className="font-bold text-[#2487B8]">
                      {previewMeta.isTerminalClass
                        ? '🎓 Baccalauréat / Alumni (Diplômés)'
                        : previewMeta.nextClassName
                        ? `${previewMeta.nextClassName} (Niveau Supérieur)`
                        : 'Classe Cible'}
                    </span>
                    <Badge variant="neutral" className="ms-2 text-[10px] font-bold">
                      Seuil : ≥ {previewMeta.passThresholdRaw ?? 10}/20
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">{t('sourceSectionLabel')}</label>
                <Select value={selectedSourceSection} onValueChange={setSelectedSourceSection}>
                  <SelectTrigger className="rounded-xl h-10 border-slate-200">
                    <SelectValue placeholder={t('chooseSectionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionsList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.className} - {s.sectionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">{t('targetSessionLabel')}</label>
                <Select value={selectedTargetSession} onValueChange={setSelectedTargetSession}>
                  <SelectTrigger className="rounded-xl h-10 border-slate-200">
                    <SelectValue placeholder={t('chooseTargetSessionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionYears.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.isDefault ? t('sessionActiveTag') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Conseil de Classe KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">Effectif de la Section</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{stats.total}</p>
                <p className="text-[11px] font-semibold text-slate-400">Élèves évalués</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">Admis au Niveau Supérieur</p>
                <p className="text-2xl font-extrabold text-emerald-600">{stats.toPromote}</p>
                <p className="text-[11px] font-bold text-emerald-600">Taux de réussite : {stats.passRate}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">Cas à Délibérer (Repêchage)</p>
                <p className="text-2xl font-extrabold text-amber-600">{stats.borderline}</p>
                <p className="text-[11px] font-semibold text-amber-600">Moyenne entre 9.00 et 9.99</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-500">Redoublements Décidés</p>
                <p className="text-2xl font-extrabold text-rose-600">{stats.toRepeat}</p>
                <p className="text-[11px] font-semibold text-rose-600">Maintien en {previewMeta?.sourceSection?.className || 'niveau'}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
            </Card>
          </div>

          {/* Live Capacity Check Banner */}
          {capacityBreakdown.length > 0 && (
            <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${hasCapacityExceeded ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{t('capacityCheckTitle')}</p>
                    <p className="text-xs text-slate-500">
                      {capacityBreakdown.map((b) => `${b.className} ${b.sectionName}: ${b.proposedStudentsCount} élèves (Places restantes: ${b.headroom != null ? b.headroom : '∞'})`).join(' | ')}
                    </p>
                  </div>
                </div>
                <Badge variant={hasCapacityExceeded ? 'danger' : 'success'} className="text-xs font-bold">
                  {hasCapacityExceeded ? t('badgeCapacityExceeded') : t('badgeCapacityValid')}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Student Decision Matrix & Deliberation Engine */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <CardTitle className="text-base font-bold text-[#16212B] flex items-center gap-2">
                  <span>{t('studentDecisionMatrixTitle')}</span>
                  <Badge variant="neutral" className="text-xs font-bold">
                    {studentsDecisions.length} élèves
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Examinez les notes, délibérez en conseil de classe et ajustez individuellement ou en lot.
                </CardDescription>
              </div>

              {/* One-Click Review & Action Tools */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleApplyAutoThreshold}
                  disabled={studentsDecisions.length === 0}
                  className="rounded-xl h-9 text-xs gap-1.5 border-slate-200 hover:bg-slate-50"
                  title="Appliquer le seuil automatique officiel (≥ 10/20)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#2487B8]" />
                  <span>Seuil Auto (≥ 10/20)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDeliberateRepêchage}
                  disabled={studentsDecisions.length === 0}
                  className="rounded-xl h-9 text-xs gap-1.5 border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 text-amber-800"
                  title="Repêcher les élèves ayant une moyenne entre 9.50 et 10.00/20"
                >
                  <Scale className="w-3.5 h-3.5 text-amber-600" />
                  <span>Repêcher (≥ 9.50)</span>
                </Button>

                {!previewMeta?.isTerminalClass && (
                  <Button
                    variant="outline"
                    onClick={handleBalanceTargetSections}
                    disabled={studentsDecisions.length === 0}
                    className="rounded-xl h-9 text-xs gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700"
                    title="Répartir équitablement les élèves promus entre les sections A, B, C de la classe cible"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-slate-600" />
                    <span>Équilibrer Sections (A, B, C)</span>
                  </Button>
                )}

                <Button
                  onClick={handleCommitPromotion}
                  disabled={submitting || studentsDecisions.length === 0 || hasCapacityExceeded}
                  className="rounded-xl h-9 text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 shadow-2xs"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{t('btnCommitPromotion')}</span>
                </Button>
              </div>
            </CardHeader>

            {/* Filter Pills Toolbar */}
            <div className="px-6 pt-4 pb-2 flex items-center gap-2 flex-wrap border-b border-slate-50">
              <span className="text-xs font-bold text-slate-400 me-1">Filtrer l&apos;examen :</span>
              <Button
                size="sm"
                variant={reviewFilter === 'all' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('all')}
                className={`h-8 rounded-full text-xs font-bold px-3 ${reviewFilter === 'all' ? 'bg-[#16212B] text-white' : 'text-slate-600'}`}
              >
                Tous ({studentsDecisions.length})
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'promote' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('promote')}
                className={`h-8 rounded-full text-xs font-bold px-3 ${reviewFilter === 'promote' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'}`}
              >
                Admis / Diplômés ({stats.toPromote})
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'borderline' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('borderline')}
                className={`h-8 rounded-full text-xs font-bold px-3 ${reviewFilter === 'borderline' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'}`}
              >
                À Délibérer (Repêchage) ({stats.borderline})
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'repeat' ? 'default' : 'ghost'}
                onClick={() => setReviewFilter('repeat')}
                className={`h-8 rounded-full text-xs font-bold px-3 ${reviewFilter === 'repeat' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'}`}
              >
                Redoublants ({stats.toRepeat})
              </Button>
              {stats.toHold > 0 && (
                <Button
                  size="sm"
                  variant={reviewFilter === 'hold' ? 'default' : 'ghost'}
                  onClick={() => setReviewFilter('hold')}
                  className={`h-8 rounded-full text-xs font-bold px-3 ${reviewFilter === 'hold' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  En attente ({stats.toHold})
                </Button>
              )}
            </div>

            <CardContent className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="text-xs font-bold text-slate-700 text-start w-28">{t('colMatricule')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colFullName')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start w-40">{t('colAverageScore')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start w-48">{t('colDecision')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colTargetSection')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-end w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStudents ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-slate-400 py-12">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#2487B8]" />
                          <span>{t('loadingStudents')}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-slate-400 py-12">
                        {t('noStudentsInSection')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((stu) => {
                      const score20 = stu.grade20 ?? (stu.averagePercentage != null ? Math.round((stu.averagePercentage / 5) * 100) / 100 : null);
                      const isPassing = score20 !== null && score20 >= (previewMeta?.passThresholdRaw ?? 10);
                      const isCandidate = score20 !== null && score20 >= 9.0 && score20 < 10.0;

                      return (
                        <TableRow key={stu.studentId} className="border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="text-xs font-mono font-semibold text-[#16212B] text-start">
                            {stu.matricule}
                          </TableCell>
                          <TableCell className="text-start">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-[#16212B] font-bold text-[11px] flex items-center justify-center shrink-0">
                                {stu.fullName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[#16212B] leading-snug">{stu.fullName}</p>
                                {stu.reason && (
                                  <p className="text-[10px] text-amber-700 font-medium">{stu.reason}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-start">
                            {score20 !== null ? (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                                    isPassing
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : isCandidate
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {score20.toFixed(2)} / 20
                                </Badge>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  ({stu.averagePercentage}%)
                                </span>
                              </div>
                            ) : (
                              <Badge variant="neutral" className="text-[11px] text-slate-400">
                                Non évalué
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-start">
                            <Select
                              value={stu.decision}
                              onValueChange={(val) => handleDecisionChange(stu.studentId, val as DecisionType)}
                            >
                              <SelectTrigger className="rounded-xl h-8 text-xs border-slate-200 w-44 font-semibold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="promote">
                                  <span className="text-emerald-700 font-bold">{decisionLabels.promote}</span>
                                </SelectItem>
                                <SelectItem value="repeat">
                                  <span className="text-rose-700 font-bold">{decisionLabels.repeat}</span>
                                </SelectItem>
                                <SelectItem value="graduate">
                                  <span className="text-blue-700 font-bold">{decisionLabels.graduate} (Alumni)</span>
                                </SelectItem>
                                <SelectItem value="transfer">{decisionLabels.transfer}</SelectItem>
                                <SelectItem value="withdraw">{decisionLabels.withdraw}</SelectItem>
                                <SelectItem value="hold">{decisionLabels.hold}</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-start">
                            {stu.decision === 'graduate' ? (
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold gap-1 py-1">
                                <GraduationCap className="w-3.5 h-3.5" />
                                <span>Alumni / Lauréat du Bac</span>
                              </Badge>
                            ) : (stu.decision === 'promote' || stu.decision === 'repeat') ? (
                              <Select
                                value={stu.targetClassSectionId || ''}
                                onValueChange={(val) => handleTargetSectionChange(stu.studentId, val)}
                              >
                                <SelectTrigger className="rounded-xl h-8 text-xs border-slate-200 w-52 font-medium">
                                  <SelectValue placeholder={t('chooseSectionPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(groupedSections).map(([className, secs]) => (
                                    <SelectGroup key={className}>
                                      <SelectLabel className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                                        {className}
                                      </SelectLabel>
                                      {secs.map((sec) => (
                                        <SelectItem key={sec.id} value={sec.id} className="text-xs">
                                          {sec.className} - Section {sec.sectionName}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-slate-400">— Non assigné</span>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            {isCandidate && stu.decision !== 'promote' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecisionChange(stu.studentId, 'promote')}
                                className="h-7 text-[11px] font-bold px-2 rounded-lg border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100"
                              >
                                Repêcher
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#16212B]">{t('historyBatchesTitle')}</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {t('historyBatchesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-xs text-slate-400 py-6 text-center">{t('loadingHistory')}</p>
              ) : historyBatches.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">{t('noHistoryBatches')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100">
                      <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colPromotionDate')}</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-start">{t('targetSessionLabel')}</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-start">{tCommon('status')}</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-end">{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyBatches.map((batch) => (
                      <TableRow key={batch.id} className="border-slate-100">
                        <TableCell className="text-xs text-slate-600 text-start">
                          {new Date(batch.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-[#16212B] text-start">
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
                              className="h-8 text-xs rounded-xl gap-1 text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
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
