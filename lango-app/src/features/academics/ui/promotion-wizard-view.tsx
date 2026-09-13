'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, RotateCcw, ShieldCheck, Sparkles, Send, Loader2 } from 'lucide-react';

interface ClassSection {
  id: string;
  className: string;
  sectionName: string;
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
  targetClassSectionId: string;
  averagePercentage?: number;
  reason?: string;
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

export function PromotionWizardView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');

  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');
  const [sectionsList, setSectionsList] = useState<ClassSection[]>([]);
  const [sessionYears, setSessionYears] = useState<SessionYear[]>([]);

  const [selectedSourceSection, setSelectedSourceSection] = useState<string>('');
  const [selectedTargetSession, setSelectedTargetSession] = useState<string>('');
  const [selectedDefaultTargetSection, setSelectedDefaultTargetSection] = useState<string>('');

  const [studentsDecisions, setStudentsDecisions] = useState<StudentDecisionState[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [capacityBreakdown, setCapacityBreakdown] = useState<CapacityBreakdown[]>([]);
  const [hasCapacityExceeded, setHasCapacityExceeded] = useState(false);
  const [_checkingCapacity, setCheckingCapacity] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passThresholdPct, setPassThresholdPct] = useState<number | null>(null);

  // History state
  const [historyBatches, setHistoryBatches] = useState<PromotionBatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

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
        }));
        setSectionsList(flattened);
        const firstSection = flattened[0];
        const secondSection = flattened[1];
        if (firstSection) {
          setSelectedSourceSection(firstSection.id);
          setSelectedDefaultTargetSection(secondSection ? secondSection.id : firstSection.id);
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

  // Fetch real grade-based student recommendations when source section changes
  useEffect(() => {
    if (!selectedSourceSection) return;
    setLoadingStudents(true);
    fetch(`/api/students/promotions/preview?sourceSectionId=${selectedSourceSection}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped: StudentDecisionState[] = res.data.map((item: any) => ({
            studentId: item.studentId,
            fullName: item.studentName,
            matricule: item.matricule || 'N/A',
            decision: item.recommendation === 'promote' ? 'promote' : item.recommendation === 'retain' ? 'repeat' : 'hold',
            targetClassSectionId: selectedDefaultTargetSection,
            averagePercentage: item.averagePercentage != null ? item.averagePercentage : undefined,
          }));
          setStudentsDecisions(mapped);
          if (typeof res.meta?.passThreshold === 'number') {
            setPassThresholdPct(res.meta.passThreshold);
          }
        } else {
          setStudentsDecisions([]);
        }
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedSourceSection, selectedDefaultTargetSection]);

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
      prev.map((s) => (s.studentId === studentId ? { ...s, decision } : s))
    );
  };

  const handleTargetSectionChange = (studentId: string, targetClassSectionId: string) => {
    setStudentsDecisions((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, targetClassSectionId } : s))
    );
  };

  const handleSelectEligible = () => {
    if (passThresholdPct == null) return;
    setStudentsDecisions((prev) =>
      prev.map((s) => ({
        ...s,
        decision:
          s.averagePercentage == null ? 'hold' : s.averagePercentage >= passThresholdPct ? 'promote' : 'repeat',
      }))
    );
  };

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
          targetClassSectionId: s.decision === 'promote' || s.decision === 'repeat' ? s.targetClassSectionId : undefined,
          averagePercentage: s.averagePercentage,
          reason: `Promotion annuelle`,
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
        setStudentsDecisions([]);
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Erreur lors de la validation.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de la validation.' });
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
        await loadHistory();
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Impossible d\'annuler ce lot.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de l\'annulation.' });
    } finally {
      setRevertingId(null);
    }
  };

  const decisionLabels: Record<DecisionType, string> = {
    promote: t('decisionPromote'),
    repeat: t('decisionRepeat'),
    graduate: t('decisionGraduate'),
    transfer: t('decisionTransfer'),
    withdraw: t('decisionWithdraw'),
    hold: t('decisionHold'),
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-start">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            {t('promotionWizardTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('promotionWizardSubtitle')}
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
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#16212B]">{t('promotionConfigTitle')}</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {t('promotionConfigDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      {capacityBreakdown.map((b) => `${b.className} ${b.sectionName}: ${b.proposedStudentsCount} (Restant: ${b.headroom != null ? b.headroom : '∞'})`).join(' | ')}
                    </p>
                  </div>
                </div>
                <Badge variant={hasCapacityExceeded ? 'danger' : 'success'} className="text-xs">
                  {hasCapacityExceeded ? t('badgeCapacityExceeded') : t('badgeCapacityValid')}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Student Decision Matrix */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#16212B]">{t('studentDecisionMatrixTitle')}</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {t('studentDecisionMatrixDesc')}
                  {passThresholdPct != null && (
                    <span className="text-slate-400">{t('passThresholdNote', { threshold: passThresholdPct })}</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSelectEligible}
                  disabled={passThresholdPct == null || studentsDecisions.length === 0}
                  className="rounded-xl h-9 text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('btnSelectEligible')}
                </Button>
                <Button
                  onClick={handleCommitPromotion}
                  disabled={submitting || studentsDecisions.length === 0 || hasCapacityExceeded}
                  className="rounded-xl h-9 text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {t('btnCommitPromotion')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100">
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colMatricule')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colFullName')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colAverageScore')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colDecision')}</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-start">{t('colTargetSection')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStudents ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-8">
                        {t('loadingStudents')}
                      </TableCell>
                    </TableRow>
                  ) : studentsDecisions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-8">
                        {t('noStudentsInSection')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    studentsDecisions.map((stu) => (
                      <TableRow key={stu.studentId} className="border-slate-100">
                        <TableCell className="text-xs font-semibold text-[#16212B] text-start">{stu.matricule}</TableCell>
                        <TableCell className="text-xs font-semibold text-[#16212B] text-start">{stu.fullName}</TableCell>
                        <TableCell className="text-xs text-slate-600 text-start">
                          <Badge variant="neutral" className="text-xs font-bold">
                            {stu.averagePercentage}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <Select
                            value={stu.decision}
                            onValueChange={(val) => handleDecisionChange(stu.studentId, val as DecisionType)}
                          >
                            <SelectTrigger className="rounded-xl h-8 text-xs border-slate-200 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="promote">{decisionLabels.promote}</SelectItem>
                              <SelectItem value="repeat">{decisionLabels.repeat}</SelectItem>
                              <SelectItem value="graduate">{decisionLabels.graduate}</SelectItem>
                              <SelectItem value="transfer">{decisionLabels.transfer}</SelectItem>
                              <SelectItem value="withdraw">{decisionLabels.withdraw}</SelectItem>
                              <SelectItem value="hold">{decisionLabels.hold}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-start">
                          {(stu.decision === 'promote' || stu.decision === 'repeat') ? (
                            <Select
                              value={stu.targetClassSectionId}
                              onValueChange={(val) => handleTargetSectionChange(stu.studentId, val)}
                            >
                              <SelectTrigger className="rounded-xl h-8 text-xs border-slate-200 w-48">
                                <SelectValue placeholder={t('chooseSectionPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {sectionsList.map((sec) => (
                                  <SelectItem key={sec.id} value={sec.id}>
                                    {sec.className} - {sec.sectionName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
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
