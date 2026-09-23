'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Save, Scale, Trash2, CheckCircle2, AlertCircle, Loader2, BookOpen, Layers,
} from 'lucide-react';
import {
  EvaluationRule, DEFAULT_EVALUATION_RULES,
} from '../data/assessment-policies-config';
import { getMoroccanMention, MOROCCAN_MENTION_BANDS } from '@/libs/grading/moroccan-grade-engine';

type StreamItem = {
  id: string;
  name: string;
  code: string | null;
  cycle: string | null;
  cycleLabel: string | null;
};

type SubjectCoefficient = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  coefficient: number;
  isCore: boolean;
};

type AvailableSubject = {
  id: string;
  name: string;
  code: string | null;
};

export function AssessmentPoliciesClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');

  const [activeTab, setActiveTab] = useState<'weights' | 'coefficients'>('weights');

  // Classes & Periods
  const [classes, setClasses] = useState<{ id: string; name: string; periodType: 'semester' | 'trimester' | 'month' }[]>([]);
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('1');
  const [cycle, setCycle] = useState('Secondaire Qualifiant (BAC)');

  // Evaluation Rules & Thresholds — seeded with the national template, then
  // replaced by the stored server policy once GET /api/academics/grading-policies
  // answers. Nothing here is presented as saved before a 2xx round-trip.
  const [rules, setRules] = useState<EvaluationRule[]>(DEFAULT_EVALUATION_RULES);
  const [passingScore, setPassingScore] = useState<number>(10);
  const [eliminatoryScore, setEliminatoryScore] = useState<number>(5);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  // Stream Coefficients State
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [coefficients, setCoefficients] = useState<SubjectCoefficient[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [loadingCoeffs, setLoadingCoeffs] = useState(false);

  // Status & Feedback
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test Score for Moroccan grade simulator
  const [testScore, setTestScore] = useState<number>(14.5);

  // Modal State for custom rule
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', weight: '10', description: '' });

  // Modal State for adding subject coefficient
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newCoeffSubjectId, setNewCoeffSubjectId] = useState('');
  const [newCoeffValue, setNewCoeffValue] = useState('2');
  const [newCoeffIsCore, setNewCoeffIsCore] = useState(false);

  const totalWeight = rules.reduce((acc, curr) => acc + curr.weight, 0);
  const totalCoeffSum = useMemo(() => {
    return Math.round(coefficients.reduce((acc, c) => acc + Number(c.coefficient || 0), 0) * 100) / 100;
  }, [coefficients]);

  // Reference data + stored policy (audit 2026-09-22 P0-3: the policy is read
  // from the server, never localStorage, and any failed fetch surfaces an
  // error with a retry instead of silently rendering empty lists).
  const loadReferenceData = useCallback(async () => {
    setReferenceError(null);
    const failures: string[] = [];
    const [classesRes, streamsRes, subjectsRes, policyRes] = await Promise.allSettled([
      fetch('/api/academics/classes?pageSize=200').then(r => r.json()),
      fetch('/api/academics/streams?pageSize=100').then(r => r.json()),
      fetch('/api/academics/subjects?pageSize=200').then(r => r.json()),
      fetch('/api/academics/grading-policies').then(r => r.json()),
    ]);

    if (classesRes.status === 'fulfilled') {
      const j = classesRes.value;
      if (j?.success && Array.isArray(j.data)) {
        setClasses(j.data);
        setClassId(prev => prev || j.data[0]?.id || '');
      } else {
        failures.push('classes');
      }
    } else {
      failures.push('classes');
    }

    if (streamsRes.status === 'fulfilled') {
      const j = streamsRes.value;
      if (j?.success && Array.isArray(j.data)) {
        setStreams(j.data);
        setSelectedStreamId(prev => prev || j.data[0]?.id || '');
      } else {
        failures.push('filières');
      }
    } else {
      failures.push('filières');
    }

    if (subjectsRes.status === 'fulfilled') {
      const j = subjectsRes.value;
      if (j?.success && Array.isArray(j.data)) {
        setAvailableSubjects(j.data);
        setNewCoeffSubjectId(prev => prev || j.data[0]?.id || '');
      } else {
        failures.push('matières');
      }
    } else {
      failures.push('matières');
    }

    if (policyRes.status === 'fulfilled' && policyRes.value?.success && policyRes.value?.data) {
      const policy = policyRes.value.data;
      if (Array.isArray(policy.rules) && policy.rules.length > 0) {
        setRules(policy.rules.map((r: any, i: number) => ({
          id: r.id ?? `srv-${i}`,
          name: r.name,
          weight: Number(r.weight) || 0,
          description: r.description ?? '',
        })));
      }
      setPassingScore(Number(policy.passingScore) || 10);
      setEliminatoryScore(Number(policy.eliminatoryScore) || 5);
      setPolicyError(null);
    } else {
      const message = policyRes.status === 'fulfilled'
        ? policyRes.value?.error?.message
        : null;
      setPolicyError(message ?? 'Impossible de charger le barème enregistré.');
    }

    setReferenceError(failures.length > 0
      ? `Chargement incomplet : ${failures.join(', ')}.`
      : null);
    setPolicyLoading(false);
  }, []);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  // Load Coefficients when selectedStreamId changes
  const loadStreamCoefficients = useCallback(async (streamId: string) => {
    if (!streamId) return;
    setLoadingCoeffs(true);
    try {
      const res = await fetch(`/api/academics/streams/coefficients?streamId=${streamId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCoefficients(json.data.coefficients || []);
      }
    } catch (err) {
      console.error('Failed loading stream coefficients:', err);
    } finally {
      setLoadingCoeffs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStreamId) {
      void loadStreamCoefficients(selectedStreamId);
    }
  }, [selectedStreamId, loadStreamCoefficients]);

  const periodType = classes.find(c => c.id === classId)?.periodType ?? 'semester';
  const periodCount = periodType === 'semester' ? 2 : periodType === 'trimester' ? 3 : 12;

  const handleRuleWeightChange = (id: string, newWeight: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, weight: Math.max(0, newWeight) } : r));
  };

  const handleAddRule = () => {
    if (!newRule.name.trim()) return;
    const created: EvaluationRule = {
      id: `r-${Date.now()}`,
      name: newRule.name.trim(),
      weight: Number(newRule.weight) || 10,
      description: newRule.description.trim() || t('ruleDescDefault'),
    };
    setRules(prev => [...prev, created]);
    setIsAddOpen(false);
    setNewRule({ name: '', weight: '10', description: '' });
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleSavePolicy = async () => {
    if (totalWeight !== 100) {
      setFeedback({
        type: 'error',
        message: `La pondération totale doit être égale à 100% (actuellement ${totalWeight}%).`,
      });
      return;
    }
    if (eliminatoryScore >= passingScore) {
      setFeedback({
        type: 'error',
        message: 'La note éliminatoire doit être inférieure au seuil d\'admission.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      // Persisted to the tenant settings registry server-side (audit
      // 2026-09-22 P0-3) — the same academic.passThreshold the promotions
      // engine and report cards read. Success is only ever claimed after a 2xx.
      const res = await fetch('/api/academics/grading-policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passingScore,
          eliminatoryScore,
          rules: rules.map(r => ({
            name: r.name,
            weight: Number(r.weight) || 0,
            ...(r.description ? { description: r.description } : {}),
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Erreur lors de l\'enregistrement du barème.');
      }

      setPolicyError(null);
      setFeedback({
        type: 'success',
        message: 'Barème et seuils d\'admission enregistrés avec succès sur le serveur.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Impossible d\'enregistrer le barème sur le serveur.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCoefficients = async () => {
    if (!selectedStreamId) return;
    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        streamId: selectedStreamId,
        coefficients: coefficients.map(c => ({
          subjectId: c.subjectId,
          coefficient: Number(c.coefficient) || 1,
          isCore: Boolean(c.isCore),
        })),
      };

      const res = await fetch('/api/academics/streams/coefficients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || json?.message || 'Erreur lors de l\'enregistrement des coefficients.');
      }

      setFeedback({
        type: 'success',
        message: `Coefficients nationaux (${json.data.count} matières, total coeff ${json.data.totalWeight}) enregistrés avec succès.`,
      });
      await loadStreamCoefficients(selectedStreamId);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Impossible d\'enregistrer les coefficients.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCoefficientChange = (subjectId: string, newCoeff: number) => {
    setCoefficients(prev => prev.map(c => c.subjectId === subjectId ? { ...c, coefficient: Math.max(0.25, newCoeff) } : c));
  };

  const handleToggleCore = (subjectId: string) => {
    setCoefficients(prev => prev.map(c => c.subjectId === subjectId ? { ...c, isCore: !c.isCore } : c));
  };

  const handleDeleteCoefficient = (subjectId: string) => {
    setCoefficients(prev => prev.filter(c => c.subjectId !== subjectId));
  };

  const handleAddSubjectCoefficient = () => {
    const existing = coefficients.find(c => c.subjectId === newCoeffSubjectId);
    if (existing) {
      setFeedback({ type: 'error', message: 'Cette matière figure déjà dans la liste des coefficients.' });
      setIsAddSubjectOpen(false);
      return;
    }

    const sub = availableSubjects.find(s => s.id === newCoeffSubjectId);
    if (!sub) return;

    setCoefficients(prev => [
      ...prev,
      {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        coefficient: Number(newCoeffValue) || 2,
        isCore: newCoeffIsCore,
      },
    ]);
    setIsAddSubjectOpen(false);
  };

  const simulatedMention = getMoroccanMention(testScore);
  const simulatedStatus = testScore >= passingScore ? 'Admis' : 'Ajourné';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Feedback Alerts */}
      {policyLoading && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#2487B8] shrink-0" />
          <span>Chargement du barème enregistré...</span>
        </div>
      )}
      {(policyError || referenceError) && !policyLoading && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{[policyError, referenceError].filter(Boolean).join(' ')}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadReferenceData()}
            className="h-7 rounded-lg text-[11px] font-bold border-amber-300 bg-white"
          >
            Réessayer
          </Button>
        </div>
      )}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold hover:opacity-75">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('policiesTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('policiesSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'weights' ? (
            <Button
              size="sm"
              onClick={() => void handleSavePolicy()}
              disabled={saving || policyLoading}
              className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{t('savePolicy')}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSaveCoefficients}
              disabled={saving || !selectedStreamId}
              className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Enregistrer les coefficients</span>
            </Button>
          )}
        </div>
      </div>

      {/* Top Filter & View Mode Bar */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Dual Tab Buttons */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('weights')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'weights'
                  ? 'bg-white text-[#16212B] shadow-xs'
                  : 'text-slate-600 hover:text-[#16212B]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#2487B8]" />
              <span>Pondérations & Seuils /20</span>
            </button>
            <button
              onClick={() => setActiveTab('coefficients')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'coefficients'
                  ? 'bg-white text-[#16212B] shadow-xs'
                  : 'text-slate-600 hover:text-[#16212B]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#2487B8]" />
              <span>Coefficients par Filière</span>
            </button>
          </div>

          {/* Right Status Badge */}
          {activeTab === 'weights' ? (
            <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${
              totalWeight === 100 ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#FCE4E2] text-[#E5544B]'
            }`}>
              <Scale className="w-4 h-4" />
              <span>{t('globalWeighting', { total: totalWeight })} {totalWeight === 100 ? t('weightValid') : t('weightInvalid')}</span>
            </div>
          ) : (
            <div className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#DCEBF4] text-[#1B6C93] flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Total Coefficients = {totalCoeffSum}</span>
            </div>
          )}
        </div>

        {/* Honest scope notice: the pass mark and eliminatory mark drive report
            cards; the weighting table is stored school-wide but not yet used in
            the average (assessments carry no CC/exam category to weight by). */}
        {activeTab === 'weights' && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Seuil d&apos;admission et note éliminatoire : appliqués aux bulletins. Pondérations : enregistrées pour l&apos;établissement, pas encore appliquées au calcul des moyennes.
          </p>
        )}

        {/* Dynamic Selectors Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {activeTab === 'weights' ? (
            <>
              <span className="font-bold text-slate-500">{t('cycleConcerned')}</span>
              <select
                value={cycle}
                onChange={e => setCycle(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 font-extrabold bg-white text-[#16212B]"
              >
                <option value="Secondaire Qualifiant (BAC)">{t('cycleBac')}</option>
                <option value="Collège">{t('cycleCollege')}</option>
                <option value="Primaire">{t('cyclePrimary')}</option>
              </select>

              <select
                value={classId}
                onChange={e => { setClassId(e.target.value); setPeriod('1'); }}
                className="h-9 px-3 rounded-xl border border-slate-200 font-extrabold bg-white text-[#16212B]"
              >
                <option value="">{t('selectClassOption')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 font-extrabold bg-white text-[#16212B]"
              >
                {Array.from({ length: periodCount }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {periodType === 'month' ? t('monthNumber', { num: i + 1 }) : periodType === 'trimester' ? t('trimesterNumber', { num: i + 1 }) : t('semesterNumber', { num: i + 1 })}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className="font-bold text-slate-500">Filière / Branche Marocaine :</span>
              <select
                value={selectedStreamId}
                onChange={e => setSelectedStreamId(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 font-extrabold bg-white text-[#16212B]"
              >
                {streams.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''} - {s.cycleLabel || s.cycle || 'Secondaire'}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddSubjectOpen(true)}
                className="h-9 rounded-xl text-xs font-bold border-slate-200 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#2487B8]" />
                <span>Ajouter une matière au barème</span>
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          {activeTab === 'weights' ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#16212B]">{t('weightDistributionTitle')}</h2>
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-xl border-slate-200 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#2487B8]" />
                  <span>{t('addRule')}</span>
                </Button>
              </div>

              <div className="space-y-3">
                {rules.map(rule => (
                  <Card key={rule.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-extrabold text-[#16212B]">{rule.name}</h3>
                      <p className="text-xs text-slate-400">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={rule.weight}
                          onChange={e => handleRuleWeightChange(rule.id, Number(e.target.value))}
                          className="w-16 h-9 text-xs font-extrabold text-center rounded-xl"
                        />
                        <span className="text-xs font-extrabold text-[#2487B8]">%</span>
                      </div>
                      <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-rose-600 transition cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Passing Thresholds Card */}
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px]">{t('passingThresholdsTitle')}</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">{t('minPassingScore')}</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.25"
                        value={passingScore}
                        onChange={e => setPassingScore(Number(e.target.value))}
                        className="h-9 text-xs rounded-xl font-bold text-[#17A673]"
                      />
                      <span className="text-slate-500 font-bold">/20</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">{t('eliminatoryScore')}</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.25"
                        value={eliminatoryScore}
                        onChange={e => setEliminatoryScore(Number(e.target.value))}
                        className="h-9 text-xs rounded-xl font-bold text-rose-600"
                      />
                      <span className="text-slate-500 font-bold">/20</span>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-[#16212B]">Coefficients par Matière</h2>
                  <p className="text-[11px] text-slate-400">Pondérations appliquées dans le calcul de la Moyenne Générale du bulletin.</p>
                </div>
              </div>

              {loadingCoeffs ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2487B8] mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Chargement des coefficients de la filière...</p>
                </div>
              ) : coefficients.length === 0 ? (
                <Card className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Aucun coefficient configuré pour cette filière</p>
                  <p className="text-[11px] text-slate-400">Ajoutez des matières pour initialiser le barème officiel.</p>
                  <Button
                    size="sm"
                    onClick={() => setIsAddSubjectOpen(true)}
                    className="h-8 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold"
                  >
                    Ajouter une matière
                  </Button>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {coefficients.map(coeff => (
                    <Card
                      key={coeff.subjectId}
                      className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-[#16212B]">{coeff.subjectName}</h3>
                          {coeff.subjectCode && (
                            <Badge variant="neutral" className="text-[10px] font-mono px-1.5 py-0">
                              {coeff.subjectCode}
                            </Badge>
                          )}
                          {coeff.isCore && (
                            <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-[9px] font-bold">
                              Matière Principale
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {coeff.isCore ? 'Comptabilisée avec coefficient fort pour l\'orientation' : 'Matière complémentaire'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={coeff.isCore}
                            onChange={() => handleToggleCore(coeff.subjectId)}
                            className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8]"
                          />
                          <span>Base</span>
                        </label>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400 font-bold">Coeff:</span>
                          <Input
                            type="number"
                            step="0.5"
                            min="0.25"
                            value={coeff.coefficient}
                            onChange={e => handleCoefficientChange(coeff.subjectId, Number(e.target.value))}
                            className="w-16 h-9 text-xs font-extrabold text-center rounded-xl"
                          />
                        </div>

                        <button
                          onClick={() => handleDeleteCoefficient(coeff.subjectId)}
                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right 5 cols: Official Scales & Live Simulator */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-sm font-extrabold text-[#16212B]">{t('gradeScalesTitle')}</h2>
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="space-y-2">
              {MOROCCAN_MENTION_BANDS.map((band) => {
                const isPassing = band.minScore >= 10;
                const isTop = band.mention === 'Très Bien';
                const rowClass = band.mention === 'Insuffisant'
                  ? 'bg-[#FCE4E2] text-[#E5544B] border-rose-200'
                  : isTop
                    ? 'bg-emerald-50 text-[#17A673] border-emerald-200'
                    : isPassing
                      ? 'bg-[#DCEBF4] text-[#1B6C93] border-blue-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200';
                return (
                  <div key={band.mention} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${rowClass}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm w-8">{getMoroccanMention(band.minScore).slice(0, 1)}</span>
                      <span className="font-bold">{band.mention}</span>
                    </div>
                    <span className="font-mono font-extrabold">{band.minScore} - {band.maxScore} /20</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Live Moroccan Grade & Mention Simulator */}
          <Card className="p-5 bg-gradient-to-br from-blue-50/50 to-white rounded-2xl border border-blue-200/60 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#2487B8] uppercase tracking-wider">Simulateur de Mention Officielle</span>
              <Badge className="bg-[#DDF5EC] text-[#17A673] font-bold text-[10px]">Norme Marocaine /20</Badge>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Moyenne Générale Simulée :</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={testScore}
                  onChange={e => setTestScore(Math.min(20, Math.max(0, Number(e.target.value))))}
                  className="h-10 text-base font-extrabold rounded-xl w-28 text-center text-[#2487B8]"
                />
                <span className="text-sm font-extrabold text-slate-400">/ 20</span>
                <div className="ms-auto text-end">
                  <span className="text-[10px] text-slate-400 font-bold block">Mention attribuée</span>
                  <span className="text-sm font-extrabold text-[#16212B]">{simulatedMention}</span>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between text-xs border-t border-blue-100">
                <span className="text-slate-500 font-medium">Décision du conseil :</span>
                <span className={`font-extrabold px-2 py-0.5 rounded-full ${
                  simulatedStatus === 'Admis' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-rose-100 text-rose-700'
                }`}>
                  {simulatedStatus} (Seuil admis : {passingScore}/20)
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Ajouter une Règle Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#2487B8]" />
              {t('addWeightRuleTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('ruleNameLabel')}</label>
              <Input
                placeholder={t('ruleNamePlaceholder')}
                value={newRule.name}
                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('ruleWeightLabel')}</label>
              <Input
                type="number"
                placeholder="10"
                value={newRule.weight}
                onChange={e => setNewRule({ ...newRule, weight: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('ruleDescLabel')}</label>
              <Input
                placeholder={t('ruleDescPlaceholder')}
                value={newRule.description}
                onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleAddRule} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              {t('addRuleAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajouter une Matière au barème Modal Dialog */}
      <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2487B8]" />
              <span>Ajouter une matière au barème</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Matière de l'établissement</label>
              <select
                value={newCoeffSubjectId}
                onChange={e => setNewCoeffSubjectId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
              >
                {availableSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Coefficient national</label>
              <Input
                type="number"
                step="0.5"
                min="0.25"
                placeholder="Ex. 7"
                value={newCoeffValue}
                onChange={e => setNewCoeffValue(e.target.value)}
                className="h-9 text-xs rounded-xl font-bold"
              />
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCoeffIsCore}
                  onChange={e => setNewCoeffIsCore(e.target.checked)}
                  className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8]"
                />
                <span className="font-bold text-slate-700">Matière principale (isCore)</span>
              </label>
              <p className="text-[10px] text-slate-400 ms-6 mt-0.5">
                Marque la matière comme déterminante pour la série du Baccalauréat.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddSubjectOpen(false)} className="rounded-xl text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleAddSubjectCoefficient}
              className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              Ajouter au barème
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

