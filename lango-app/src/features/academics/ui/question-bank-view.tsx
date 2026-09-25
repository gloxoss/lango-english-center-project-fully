'use client';

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Layers,
  Library,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

type ClassSubjectOption = { id: string; classId: string; subjectId: string };
type RefOption = { id: string; name: string };
type Exam = {
  id: string;
  classSubjectId: string;
  title: string;
  durationMinutes: number;
  totalMarks: string;
  startsAt: string;
  endsAt: string;
};
type QuestionOption = { id?: string; optionText: string; isCorrect: boolean };
type Question = { id: string; questionText: string; marks: string; orderIndex: number; options: QuestionOption[]; sectionLabel: string | null; difficulty: string | null };
type BankItem = {
  id: string;
  questionText: string;
  marks: number;
  subjectId: string | null;
  subjectName: string | null;
  cycle: string | null;
  difficulty: string | null;
  sectionLabel: string | null;
  options: QuestionOption[];
};

export function QuestionBankView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();

  const difficultyOptions = useMemo(() => [
    { value: 'facile', label: t('diffEasy') },
    { value: 'moyen', label: t('diffMedium') },
    { value: 'difficile', label: t('diffHard') },
  ], [t]);

  const cycleOptions = useMemo(() => [
    { value: 'maternelle', label: t('cycleMaternelle') },
    { value: 'primaire', label: t('cyclePrimaire') },
    { value: 'college', label: t('cycleCollege') },
    { value: 'lycee', label: t('cycleLycee') },
  ], [t]);

  const getDifficultyLabel = (diff: string | null) => {
    if (!diff) {
      return '';
    }
    if (diff === 'facile') {
      return t('diffEasy');
    }
    if (diff === 'moyen') {
      return t('diffMedium');
    }
    if (diff === 'difficile') {
      return t('diffHard');
    }
    return diff;
  };

  const getCycleLabel = (c: string | null) => {
    if (!c) {
      return '';
    }
    if (c === 'maternelle') {
      return t('cycleMaternelle');
    }
    if (c === 'primaire') {
      return t('cyclePrimaire');
    }
    if (c === 'college') {
      return t('cycleCollege');
    }
    if (c === 'lycee') {
      return t('cycleLycee');
    }
    return c;
  };

  const [tab, setTab] = useState<'exam' | 'bank'>('exam');
  const [exams, setExams] = useState<Exam[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectOption[]>([]);
  const [classes, setClasses] = useState<RefOption[]>([]);
  const [subjects, setSubjects] = useState<RefOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [showExamForm, setShowExamForm] = useState(false);
  const [examForm, setExamForm] = useState({ classSubjectId: '', title: '', durationMinutes: '60', totalMarks: '20', startsAt: '', endsAt: '' });
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionForm, setQuestionForm] = useState({ questionText: '', marks: '1', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }], sectionLabel: '', difficulty: 'moyen' });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Question bank state
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [bankFilter, setBankFilter] = useState({ subjectId: '', cycle: '', difficulty: '' });
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ questionText: '', marks: '1', subjectId: '', cycle: '', difficulty: 'moyen', sectionLabel: '', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] });
  const [editingBankItemId, setEditingBankItemId] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<{ bankItemId: string; onlineExamId: string } | null>(null);

  // Auto-compose by difficulty modal state (§6.9)
  const [autoComposeOpen, setAutoComposeOpen] = useState(false);
  const [composeSubjectId, setComposeSubjectId] = useState('');
  const [countEasy, setCountEasy] = useState('3');
  const [countMedium, setCountMedium] = useState('4');
  const [countHard, setCountHard] = useState('2');
  const [composeTargetExamId, setComposeTargetExamId] = useState('');
  const [composing, setComposing] = useState(false);

  // Generate N variants state (§6.9b)
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variantCount, setVariantCount] = useState('2');
  const [generatingVariants, setGeneratingVariants] = useState(false);

  const loadBankItems = () => {
    const params = new URLSearchParams();
    if (bankFilter.subjectId) {
      params.set('subjectId', bankFilter.subjectId);
    }
    if (bankFilter.cycle) {
      params.set('cycle', bankFilter.cycle);
    }
    if (bankFilter.difficulty) {
      params.set('difficulty', bankFilter.difficulty);
    }
    fetch(`/api/academics/question-bank?${params}`).then(r => r.json()).then(j => j?.success && setBankItems(j.data)).catch(() => {});
  };

  useEffect(() => {
    if (tab === 'bank') {
      loadBankItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, bankFilter]);

  const resetBankForm = () => setBankForm({ questionText: '', marks: '1', subjectId: '', cycle: '', difficulty: 'moyen', sectionLabel: '', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] });

  const handleSubmitBankItem = async () => {
    if (!bankForm.questionText.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const options = bankForm.isQcm ? bankForm.options.filter(o => o.optionText.trim()) : undefined;
      const res = await fetch(editingBankItemId ? `/api/academics/question-bank?id=${editingBankItemId}` : '/api/academics/question-bank', {
        method: editingBankItemId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: bankForm.questionText.trim(),
          marks: Number(bankForm.marks),
          subjectId: bankForm.subjectId || undefined,
          cycle: bankForm.cycle || undefined,
          difficulty: bankForm.difficulty || undefined,
          sectionLabel: bankForm.sectionLabel || undefined,
          options,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || t('slotCreateFailed'));
        return;
      }
      setShowBankForm(false);
      setEditingBankItemId(null);
      resetBankForm();
      loadBankItems();
    } catch {
      setError(t('networkError'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditBankItem = (item: BankItem) => {
    setEditingBankItemId(item.id);
    setBankForm({
      questionText: item.questionText,
      marks: String(item.marks),
      subjectId: item.subjectId ?? '',
      cycle: item.cycle ?? '',
      difficulty: item.difficulty ?? 'moyen',
      sectionLabel: item.sectionLabel ?? '',
      isQcm: item.options.length > 0,
      options: item.options.length > 0 ? item.options : [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }],
    });
    setShowBankForm(true);
  };

  const deleteAndReport = async (url: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(tCommon('confirmDeleteGeneric'))) {
      return false;
    }
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        toast.error(json?.error?.message || json?.message || tCommon('error'));
      }
    } catch {
      toast.error(tCommon('networkError'));
    }
    return true;
  };

  const handleDeleteBankItem = async (id: string) => {
    if (await deleteAndReport(`/api/academics/question-bank?id=${id}`)) {
      loadBankItems();
    }
  };

  const handleCopyIntoExam = async () => {
    if (!copyTarget?.onlineExamId) {
      return;
    }
    const res = await fetch(`/api/academics/question-bank/${copyTarget.bankItemId}/copy-into-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlineExamId: copyTarget.onlineExamId }),
    }).catch(() => null);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      toast.error(json?.error?.message || tCommon('error'));
      return;
    }
    setCopyTarget(null);
    if (copyTarget.onlineExamId === selectedExamId) {
      loadQuestions(selectedExamId);
    }
  };

  const loadExams = () => {
    fetch('/api/academics/online-exams')
      .then(r => r.json())
      .then(j => j?.success && setExams(j.data))
      .catch(() => {});
  };

  useEffect(() => {
    loadExams();
    fetch('/api/academics/class-subjects?pageSize=200').then(r => r.json()).then(j => j?.success && setClassSubjects(j.data));
    fetch('/api/academics/classes?pageSize=200').then(r => r.json()).then(j => j?.success && setClasses(j.data));
    fetch('/api/academics/subjects?pageSize=200').then(r => r.json()).then(j => j?.success && setSubjects(j.data));
  }, []);

  const loadQuestions = (examId: string) => {
    if (!examId) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    fetch(`/api/academics/online-exams/${examId}/questions`)
      .then(r => r.json())
      .then(j => j?.success && setQuestions(j.data))
      .catch(() => {})
      .finally(() => setLoadingQuestions(false));
  };

  useEffect(() => {
    loadQuestions(selectedExamId);
  }, [selectedExamId]);

  const examLabel = (exam: Exam) => {
    const cs = classSubjects.find(c => c.id === exam.classSubjectId);
    const className = cs ? classes.find(c => c.id === cs.classId)?.name : null;
    const subjectName = cs ? subjects.find(s => s.id === cs.subjectId)?.name : null;
    return `${exam.title}${className && subjectName ? ` — ${className} · ${subjectName}` : ''}`;
  };

  const handleCreateExam = async () => {
    if (!examForm.classSubjectId || !examForm.title.trim() || !examForm.startsAt || !examForm.endsAt) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/academics/online-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSubjectId: examForm.classSubjectId,
          title: examForm.title.trim(),
          durationMinutes: Number(examForm.durationMinutes),
          totalMarks: Number(examForm.totalMarks),
          startsAt: examForm.startsAt,
          endsAt: examForm.endsAt,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || t('slotCreateFailed'));
        return;
      }
      setShowExamForm(false);
      setExamForm({ classSubjectId: '', title: '', durationMinutes: '60', totalMarks: '20', startsAt: '', endsAt: '' });
      loadExams();
      setSelectedExamId(json.data.id);
    } catch {
      setError(t('networkError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (!selectedExamId || !questionForm.questionText.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const options = questionForm.isQcm ? questionForm.options.filter(o => o.optionText.trim()) : undefined;
      const res = await fetch(editingQuestionId
        ? `/api/academics/online-exams/${selectedExamId}/questions/${editingQuestionId}`
        : `/api/academics/online-exams/${selectedExamId}/questions`, {
        method: editingQuestionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionForm.questionText.trim(),
          marks: Number(questionForm.marks),
          ...(editingQuestionId ? {} : { orderIndex: questions.length }),
          options,
          sectionLabel: questionForm.sectionLabel || undefined,
          difficulty: questionForm.difficulty || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || t('slotCreateFailed'));
        return;
      }
      setShowQuestionForm(false);
      setEditingQuestionId(null);
      setQuestionForm({ questionText: '', marks: '1', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }], sectionLabel: '', difficulty: 'moyen' });
      loadQuestions(selectedExamId);
    } catch {
      setError(t('networkError'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQuestionForm({
      questionText: q.questionText,
      marks: String(q.marks),
      isQcm: q.options.length > 0,
      options: q.options.length > 0 ? q.options : [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }],
      sectionLabel: q.sectionLabel ?? '',
      difficulty: q.difficulty ?? 'moyen',
    });
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (await deleteAndReport(`/api/academics/online-exams/${selectedExamId}/questions/${id}`)) {
      loadQuestions(selectedExamId);
    }
  };

  // Auto-compose exam by difficulty algorithm (§6.9)
  const handleAutoCompose = async () => {
    const targetExamId = composeTargetExamId || selectedExamId;
    if (!targetExamId) {
      setError(t('selectTargetExamPrompt'));
      return;
    }
    setComposing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (composeSubjectId) {
        params.set('subjectId', composeSubjectId);
      }
      const res = await fetch(`/api/academics/question-bank?${params}`).then(r => r.json());
      const allItems: BankItem[] = res?.data ?? [];

      const easyItems = allItems.filter(i => (i.difficulty || 'facile') === 'facile');
      const mediumItems = allItems.filter(i => (i.difficulty || 'moyen') === 'moyen');
      const hardItems = allItems.filter(i => (i.difficulty || 'difficile') === 'difficile');

      const neededEasy = Number(countEasy) || 0;
      const neededMedium = Number(countMedium) || 0;
      const neededHard = Number(countHard) || 0;

      const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

      const pickedEasy = shuffle(easyItems).slice(0, neededEasy);
      const pickedMedium = shuffle(mediumItems).slice(0, neededMedium);
      const pickedHard = shuffle(hardItems).slice(0, neededHard);

      const assembled = [...pickedEasy, ...pickedMedium, ...pickedHard];

      if (assembled.length === 0) {
        setError(t('noQuestionsInBank'));
        return;
      }

      let copiedCount = 0;
      for (const item of assembled) {
        // Counted every attempt as copied, so the success line could claim
        // questions the exam never received.
        const res = await fetch(`/api/academics/question-bank/${item.id}/copy-into-exam`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onlineExamId: targetExamId }),
        }).catch(() => null);
        if (res?.ok) {
          copiedCount++;
        }
      }

      setAutoComposeOpen(false);
      setSuccessMsg(`Composition réussie : ${copiedCount} question(s) injectée(s).`);
      setTimeout(setSuccessMsg, 5000, null);
      loadQuestions(targetExamId);
    } catch {
      setError(t('networkError'));
    } finally {
      setComposing(false);
    }
  };

  // Generate N variants of the selected exam (§6.9b)
  const handleGenerateVariants = async () => {
    if (!selectedExamId) {
      setError(t('selectExamPrompt'));
      return;
    }
    setGeneratingVariants(true);
    setError(null);
    try {
      const res = await fetch(`/api/academics/online-exams/${selectedExamId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: Number(variantCount) || 1 }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || t('slotCreateFailed'));
        return;
      }
      setVariantsOpen(false);
      setSuccessMsg(`${json.total} variante(s) générée(s).`);
      setTimeout(setSuccessMsg, 5000, null);
      loadExams();
    } catch {
      setError(t('networkError'));
    } finally {
      setGeneratingVariants(false);
    }
  };

  const canManage = can('grading.manage');
  const totalQuestionMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12 text-start">
      {/* Header */}
      <div className="
        flex flex-col justify-between gap-4 rounded-2xl border
        border-slate-200/80 bg-white p-6 shadow-2xs
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="
            flex items-center gap-2.5 text-2xl font-extrabold tracking-tight
            text-[#16212B]
          "
          >
            <BookOpen className="size-6 text-[#0066FF]" />
            {t('questionBankTitle')}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('questionBankSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setComposeTargetExamId(selectedExamId);
                setAutoComposeOpen(true);
              }}
              className="
                h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold text-white
                shadow-xs
                hover:bg-[#0052CC]
              "
            >
              <Sparkles className="size-3.5" />
              {t('btnAutoCompose')}
            </Button>
          )}

          {canManage && tab === 'exam' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowExamForm(v => !v)}
              className="
                h-9 gap-1.5 rounded-xl border-slate-200 text-xs font-bold
              "
            >
              <Plus className="size-3.5" />
              {t('btnNewExam')}
            </Button>
          )}
          {canManage && tab === 'bank' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingBankItemId(null); resetBankForm(); setShowBankForm(v => !v);
              }}
              className="
                h-9 gap-1.5 rounded-xl border-slate-200 text-xs font-bold
              "
            >
              <Plus className="size-3.5" />
              {t('btnNewQuestion')}
            </Button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="
          animate-in fade-in flex items-center gap-2 rounded-xl border
          border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold
          text-emerald-800
        "
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="
          animate-in fade-in flex items-center gap-2 rounded-xl border
          border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700
        "
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="
        flex w-fit items-center rounded-xl border border-slate-200 bg-slate-50
        p-0.5
      "
      >
        {(['exam', 'bank'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`
              flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-4
              text-xs font-bold transition-colors
              ${tab === tabKey
            ? `bg-[#0066FF] text-white shadow-2xs`
            : `
              text-slate-500
              hover:text-[#16212B]
            `}
            `}
          >
            {tabKey === 'exam'
              ? <Clock className="size-3.5" />
              : (
                  <Library className="size-3.5" />
                )}
            {tabKey === 'exam' ? t('tabExam') : t('tabBank')}
          </button>
        ))}
      </div>

      {tab === 'exam' && (
        <>
          {canManage && showExamForm && (
            <Card className="
              space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
              shadow-2xs
            "
            >
              <div className="
                grid grid-cols-1 gap-3 text-xs
                sm:grid-cols-3
              "
              >
                <div className="
                  space-y-1
                  sm:col-span-3
                "
                >
                  <label className="font-bold text-slate-600">{t('examTitleLabel')}</label>
                  <Input
                    value={examForm.title}
                    onChange={e => setExamForm({ ...examForm, title: e.target.value })}
                    className="h-9 rounded-xl"
                    placeholder={t('examTitlePlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('classSubjectLabel')}</label>
                  <select
                    value={examForm.classSubjectId}
                    onChange={e => setExamForm({ ...examForm, classSubjectId: e.target.value })}
                    className="
                      h-9 w-full rounded-xl border border-slate-200 bg-white
                      px-3
                    "
                  >
                    <option value="">
                      {tCommon('filter')}
                      ...
                    </option>
                    {classSubjects.map(cs => (
                      <option key={cs.id} value={cs.id}>
                        {classes.find(c => c.id === cs.classId)?.name ?? cs.classId}
                        {' '}
                        ·
                        {subjects.find(s => s.id === cs.subjectId)?.name ?? cs.subjectId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('durationMinutesLabel')}</label>
                  <Input
                    type="number"
                    value={examForm.durationMinutes}
                    onChange={e => setExamForm({ ...examForm, durationMinutes: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('totalMarksLabel')}</label>
                  <Input
                    type="number"
                    value={examForm.totalMarks}
                    onChange={e => setExamForm({ ...examForm, totalMarks: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('startsAtLabel')}</label>
                  <Input
                    type="datetime-local"
                    value={examForm.startsAt}
                    onChange={e => setExamForm({ ...examForm, startsAt: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('endsAtLabel')}</label>
                  <Input
                    type="datetime-local"
                    value={examForm.endsAt}
                    onChange={e => setExamForm({ ...examForm, endsAt: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={handleCreateExam}
                  className="
                    h-9 rounded-xl bg-[#0066FF] text-xs font-bold text-white
                    hover:bg-[#0052CC]
                  "
                >
                  {saving ? t('saving') : t('btnCreateExam')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowExamForm(false)}
                  className="h-9 rounded-xl text-xs font-bold"
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </Card>
          )}

          <Card className="
            rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
          "
          >
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="
                h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                text-xs font-bold text-[#16212B]
                sm:w-96
              "
            >
              <option value="">{t('selectExamPrompt')}</option>
              {exams.map(exam => <option key={exam.id} value={exam.id}>{examLabel(exam)}</option>)}
            </select>
          </Card>

          {!selectedExamId
            ? (
                <Card className="
                  flex flex-col items-center justify-center gap-3 rounded-2xl
                  border border-slate-200/80 bg-white p-12 text-center
                  shadow-2xs
                "
                >
                  <Clock className="size-10 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">{exams.length === 0 ? t('noExamCreated') : t('selectExamToDisplay')}</p>
                </Card>
              )
            : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="
                      rounded-2xl border border-slate-200/80 bg-white p-4
                      shadow-2xs
                    "
                    >
                      <p className="text-xs font-bold text-slate-400">{t('configuredQuestionsCard')}</p>
                      <p className="text-xl font-extrabold text-[#16212B]">{questions.length}</p>
                    </Card>
                    <Card className="
                      rounded-2xl border border-slate-200/80 bg-white p-4
                      shadow-2xs
                    "
                    >
                      <p className="text-xs font-bold text-slate-400">{t('marksSumCard')}</p>
                      <p className="text-xl font-extrabold text-[#0066FF]">
                        {totalQuestionMarks}
                        {' '}
                        /
                        {' '}
                        {selectedExam?.totalMarks ?? '—'}
                        {' '}
                        pts
                      </p>
                    </Card>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingQuestionId(null); setShowQuestionForm(v => !v);
                        }}
                        className="
                          h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold
                          text-white
                        "
                      >
                        <Plus className="size-3.5" />
                        {t('btnAddQuestion')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVariantsOpen(true)}
                        className="
                          h-9 gap-1.5 rounded-xl border-slate-200 text-xs
                          font-bold
                        "
                      >
                        <Layers className="size-3.5" />
                        {t('btnGenerateVariants')}
                      </Button>
                    </div>
                  )}

                  {canManage && showQuestionForm && (
                    <Card className="
                      space-y-3 rounded-2xl border border-slate-200/80 bg-white
                      p-5 shadow-2xs
                    "
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">{t('questionTextLabel')}</label>
                        <textarea
                          value={questionForm.questionText}
                          onChange={e => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                          rows={2}
                          className="
                            w-full resize-none rounded-xl border
                            border-slate-200 px-3 py-2 text-xs
                          "
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">{t('marksLabel')}</label>
                          <Input
                            type="number"
                            value={questionForm.marks}
                            onChange={e => setQuestionForm({ ...questionForm, marks: e.target.value })}
                            className="h-9 w-24 rounded-xl"
                          />
                        </div>
                        <label className="
                          mt-4 flex cursor-pointer items-center gap-1.5
                          font-bold text-slate-600
                        "
                        >
                          <input type="checkbox" checked={questionForm.isQcm} onChange={e => setQuestionForm({ ...questionForm, isQcm: e.target.checked })} />
                          {t('qcmLabel')}
                        </label>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">{t('sectionLabel')}</label>
                          <Input
                            value={questionForm.sectionLabel}
                            onChange={e => setQuestionForm({ ...questionForm, sectionLabel: e.target.value })}
                            className="h-9 w-32 rounded-xl"
                            placeholder={t('sectionPlaceholder')}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">{t('difficultyLabel')}</label>
                          <select
                            value={questionForm.difficulty}
                            onChange={e => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                            className="
                              h-9 rounded-xl border border-slate-200 bg-white
                              px-3
                            "
                          >
                            {difficultyOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </select>
                        </div>
                      </div>
                      {questionForm.isQcm && (
                        <div className="space-y-2 pt-2">
                          {questionForm.options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="correct-option"
                                checked={opt.isCorrect}
                                onChange={() => setQuestionForm({ ...questionForm, options: questionForm.options.map((o, oi) => ({ ...o, isCorrect: oi === i })) })}
                              />
                              <Input
                                value={opt.optionText}
                                onChange={e => setQuestionForm({ ...questionForm, options: questionForm.options.map((o, oi) => (oi === i ? { ...o, optionText: e.target.value } : o)) })}
                                placeholder={t('choicePlaceholder', { index: i + 1 })}
                                className="h-9 flex-1 rounded-xl text-xs"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, { optionText: '', isCorrect: false }] })}
                            className="
                              text-[11px] font-bold text-[#0066FF]
                              hover:underline
                            "
                          >
                            {t('btnAddChoice')}
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={handleCreateQuestion}
                          className="
                            h-9 rounded-xl bg-[#0066FF] text-xs font-bold
                            text-white
                            hover:bg-[#0052CC]
                          "
                        >
                          {saving ? t('saving') : editingQuestionId ? tCommon('save') : tCommon('add')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowQuestionForm(false); setEditingQuestionId(null);
                          }}
                          className="h-9 rounded-xl text-xs font-bold"
                        >
                          {tCommon('cancel')}
                        </Button>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-2">
                    {loadingQuestions && (
                      <p className="py-8 text-center text-xs text-slate-400">
                        {tCommon('loading')}
                        ...
                      </p>
                    )}
                    {!loadingQuestions && questions.length === 0 && (
                      <Card className="
                        rounded-2xl border border-slate-200/80 bg-white p-8
                        text-center shadow-2xs
                      "
                      >
                        <p className="text-xs text-slate-400">{t('noQuestionsInExam')}</p>
                      </Card>
                    )}
                    {questions.map((q, i) => (
                      <Card
                        key={q.id}
                        className="
                          rounded-2xl border border-slate-200/80 bg-white p-4
                          shadow-2xs
                        "
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#16212B]">
                              Q
                              {i + 1}
                              .
                              {q.questionText}
                            </p>
                            {(q.sectionLabel || q.difficulty) && (
                              <div className="mt-1 flex items-center gap-1.5">
                                {q.sectionLabel && (
                                  <Badge className="
                                    border-none bg-[#DCEBF4] text-[10px]
                                    font-bold text-[#0066FF]
                                  "
                                  >
                                    {q.sectionLabel}
                                  </Badge>
                                )}
                                {q.difficulty && (
                                  <Badge className="
                                    border-none bg-amber-50 text-[10px]
                                    font-bold text-amber-700
                                  "
                                  >
                                    {getDifficultyLabel(q.difficulty)}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {q.options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {q.options.map(opt => (
                                  <p
                                    key={opt.id}
                                    className={`
                                      flex items-center gap-1.5 text-[11px]
                                      ${opt.isCorrect
                                    ? `font-bold text-[#17A673]`
                                    : `text-slate-500`}
                                    `}
                                  >
                                    {opt.isCorrect && (
                                      <CheckCircle2 className="size-3" />
                                    )}
                                    {opt.optionText}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge className="
                              border-none bg-[#DCEBF4] text-[10px] font-bold
                              text-[#0066FF]
                            "
                            >
                              {q.marks}
                              {' '}
                              pts
                            </Badge>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => handleEditQuestion(q)}
                                  className="
                                    rounded-lg p-1 text-slate-400
                                    hover:bg-[#DCEBF4] hover:text-[#0066FF]
                                  "
                                  title={tCommon('edit')}
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="
                                    rounded-lg p-1 text-slate-400
                                    hover:bg-rose-50 hover:text-rose-600
                                  "
                                  title={tCommon('delete')}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
        </>
      )}

      {/* TAB 2: CENTRAL QUESTION BANK */}
      {tab === 'bank' && (
        <>
          <Card className="
            flex flex-wrap items-center gap-3 rounded-2xl border
            border-slate-200/80 bg-white p-4 shadow-2xs
          "
          >
            <select
              value={bankFilter.subjectId}
              onChange={e => setBankFilter({ ...bankFilter, subjectId: e.target.value })}
              className="
                h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs
                font-bold text-[#16212B]
              "
            >
              <option value="">{t('allSubjectsFilter')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={bankFilter.cycle}
              onChange={e => setBankFilter({ ...bankFilter, cycle: e.target.value })}
              className="
                h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs
                font-bold text-[#16212B]
              "
            >
              <option value="">{t('allCyclesFilter')}</option>
              {cycleOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={bankFilter.difficulty}
              onChange={e => setBankFilter({ ...bankFilter, difficulty: e.target.value })}
              className="
                h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs
                font-bold text-[#16212B]
              "
            >
              <option value="">{t('allDifficultiesFilter')}</option>
              {difficultyOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Card>

          {canManage && showBankForm && (
            <Card className="
              space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
              shadow-2xs
            "
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">{t('questionTextLabel')}</label>
                <textarea
                  value={bankForm.questionText}
                  onChange={e => setBankForm({ ...bankForm, questionText: e.target.value })}
                  rows={2}
                  className="
                    w-full resize-none rounded-xl border border-slate-200 px-3
                    py-2 text-xs
                  "
                  placeholder={t('questionStatementPlaceholder')}
                />
              </div>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('marksLabel')}</label>
                  <Input
                    type="number"
                    value={bankForm.marks}
                    onChange={e => setBankForm({ ...bankForm, marks: e.target.value })}
                    className="h-9 w-24 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('subject')}</label>
                  <select
                    value={bankForm.subjectId}
                    onChange={e => setBankForm({ ...bankForm, subjectId: e.target.value })}
                    className="
                      h-9 rounded-xl border border-slate-200 bg-white px-3
                    "
                  >
                    <option value="">—</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('allCyclesFilter')}</label>
                  <select
                    value={bankForm.cycle}
                    onChange={e => setBankForm({ ...bankForm, cycle: e.target.value })}
                    className="
                      h-9 rounded-xl border border-slate-200 bg-white px-3
                    "
                  >
                    <option value="">—</option>
                    {cycleOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('difficultyLabel')}</label>
                  <select
                    value={bankForm.difficulty}
                    onChange={e => setBankForm({ ...bankForm, difficulty: e.target.value })}
                    className="
                      h-9 rounded-xl border border-slate-200 bg-white px-3
                    "
                  >
                    {difficultyOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{t('sectionLabel')}</label>
                  <Input
                    value={bankForm.sectionLabel}
                    onChange={e => setBankForm({ ...bankForm, sectionLabel: e.target.value })}
                    className="h-9 w-32 rounded-xl"
                    placeholder={t('sectionPlaceholder')}
                  />
                </div>
                <label className="
                  flex h-9 cursor-pointer items-center gap-1.5 font-bold
                  text-slate-600
                "
                >
                  <input type="checkbox" checked={bankForm.isQcm} onChange={e => setBankForm({ ...bankForm, isQcm: e.target.checked })} />
                  {t('qcmLabel')}
                </label>
              </div>
              {bankForm.isQcm && (
                <div className="space-y-2 pt-2">
                  {bankForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bank-correct-option"
                        checked={opt.isCorrect}
                        onChange={() => setBankForm({ ...bankForm, options: bankForm.options.map((o, oi) => ({ ...o, isCorrect: oi === i })) })}
                      />
                      <Input
                        value={opt.optionText}
                        onChange={e => setBankForm({ ...bankForm, options: bankForm.options.map((o, oi) => (oi === i ? { ...o, optionText: e.target.value } : o)) })}
                        placeholder={t('choicePlaceholder', { index: i + 1 })}
                        className="h-9 flex-1 rounded-xl text-xs"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBankForm({ ...bankForm, options: [...bankForm.options, { optionText: '', isCorrect: false }] })}
                    className="
                      text-[11px] font-bold text-[#0066FF]
                      hover:underline
                    "
                  >
                    {t('btnAddChoice')}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={handleSubmitBankItem}
                  className="
                    h-9 rounded-xl bg-[#0066FF] text-xs font-bold text-white
                    hover:bg-[#0052CC]
                  "
                >
                  {saving ? t('saving') : editingBankItemId ? tCommon('save') : t('btnSaveToBank')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowBankForm(false); setEditingBankItemId(null);
                  }}
                  className="h-9 rounded-xl text-xs font-bold"
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {bankItems.length === 0 && (
              <Card className="
                flex flex-col items-center justify-center gap-3 rounded-2xl
                border border-slate-200/80 bg-white p-12 text-center shadow-2xs
              "
              >
                <Library className="size-10 text-slate-200" />
                <p className="text-sm font-bold text-slate-400">{t('noQuestionsInBank')}</p>
              </Card>
            )}
            {bankItems.map(item => (
              <Card
                key={item.id}
                className="
                  rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
                "
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#16212B]">{item.questionText}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.subjectName && (
                        <Badge className="
                          border-none bg-slate-100 text-[10px] font-bold
                          text-slate-600
                        "
                        >
                          {item.subjectName}
                        </Badge>
                      )}
                      {item.cycle && (
                        <Badge className="
                          border-none bg-slate-100 text-[10px] font-bold
                          text-slate-600
                        "
                        >
                          {getCycleLabel(item.cycle)}
                        </Badge>
                      )}
                      {item.difficulty && (
                        <Badge className="
                          border-none bg-amber-50 text-[10px] font-bold
                          text-amber-700
                        "
                        >
                          {getDifficultyLabel(item.difficulty)}
                        </Badge>
                      )}
                      {item.sectionLabel && (
                        <Badge className="
                          border-none bg-[#DCEBF4] text-[10px] font-bold
                          text-[#0066FF]
                        "
                        >
                          {item.sectionLabel}
                        </Badge>
                      )}
                    </div>
                    {item.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.options.map(opt => (
                          <p
                            key={opt.id}
                            className={`
                              flex items-center gap-1.5 text-[11px]
                              ${opt.isCorrect
                            ? `font-bold text-[#17A673]`
                            : `text-slate-500`}
                            `}
                          >
                            {opt.isCorrect && <CheckCircle2 className="size-3" />}
                            {opt.optionText}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className="
                      border-none bg-[#DCEBF4] text-[10px] font-bold
                      text-[#0066FF]
                    "
                    >
                      {item.marks}
                      {' '}
                      pts
                    </Badge>
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleEditBankItem(item)}
                          className="
                            rounded-lg p-1 text-slate-400
                            hover:bg-[#DCEBF4] hover:text-[#0066FF]
                          "
                          title={tCommon('edit')}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setCopyTarget({ bankItemId: item.id, onlineExamId: '' })}
                          className="
                            rounded-lg p-1 text-slate-400
                            hover:bg-[#DCEBF4] hover:text-[#0066FF]
                          "
                          title={t('copyIntoExamTooltip')}
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBankItem(item.id)}
                          className="
                            rounded-lg p-1 text-slate-400
                            hover:bg-rose-50 hover:text-rose-600
                          "
                          title={tCommon('delete')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {copyTarget?.bankItemId === item.id && (
                  <div className="
                    mt-3 flex items-center gap-2 border-t border-slate-100 pt-3
                  "
                  >
                    <select
                      value={copyTarget.onlineExamId}
                      onChange={e => setCopyTarget({ bankItemId: item.id, onlineExamId: e.target.value })}
                      className="
                        h-8 flex-1 rounded-lg border border-slate-200 bg-white
                        px-2 text-xs
                      "
                    >
                      <option value="">{t('selectTargetExamPrompt')}</option>
                      {exams.map(exam => <option key={exam.id} value={exam.id}>{examLabel(exam)}</option>)}
                    </select>
                    <Button
                      size="sm"
                      disabled={!copyTarget.onlineExamId}
                      onClick={handleCopyIntoExam}
                      className="
                        h-8 rounded-lg bg-[#0066FF] text-xs font-bold text-white
                        hover:bg-[#0052CC]
                      "
                    >
                      {t('btnCopy')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCopyTarget(null)}
                      className="h-8 rounded-lg text-xs font-bold"
                    >
                      {tCommon('cancel')}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* AUTO-COMPOSE MODAL (§6.9) */}
      <Dialog open={autoComposeOpen} onOpenChange={setAutoComposeOpen}>
        <DialogContent className="max-w-md rounded-2xl text-start">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-base font-extrabold text-[#16212B]
            "
            >
              <Sparkles className="size-4 text-[#0066FF]" />
              {t('autoComposeModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              {t('autoComposeModalDesc')}
            </p>

            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('subject')}</label>
              <select
                value={composeSubjectId}
                onChange={e => setComposeSubjectId(e.target.value)}
                className="
                  h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                  text-xs font-medium
                "
              >
                <option value="">{t('allSubjectsFilter')}</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('targetExamLabel')}</label>
              <select
                value={composeTargetExamId}
                onChange={e => setComposeTargetExamId(e.target.value)}
                className="
                  h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                  text-xs font-medium
                "
              >
                <option value="">{t('chooseExamPrompt')}</option>
                {exams.map(e => <option key={e.id} value={e.id}>{examLabel(e)}</option>)}
              </select>
            </div>

            <div className="
              space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5
            "
            >
              <span className="block font-bold text-slate-700">{t('difficultyDistributionLabel')}</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="mb-1 block font-bold text-emerald-700">{t('countEasyLabel')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={countEasy}
                    onChange={e => setCountEasy(e.target.value)}
                    className="h-9 rounded-xl bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-blue-700">{t('countMediumLabel')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={countMedium}
                    onChange={e => setCountMedium(e.target.value)}
                    className="h-9 rounded-xl bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-amber-700">{t('countHardLabel')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={countHard}
                    onChange={e => setCountHard(e.target.value)}
                    className="h-9 rounded-xl bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setAutoComposeOpen(false)}
              className="h-9 rounded-xl border-slate-200 text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleAutoCompose}
              disabled={composing || !composeTargetExamId}
              className="
                h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold text-white
                hover:bg-[#0052CC]
              "
            >
              {composing
                ? <Loader2 className="size-3.5 animate-spin" />
                : (
                    <Wand2 className="size-3.5" />
                  )}
              {t('btnGenerateAndInject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GENERATE VARIANTS MODAL (§6.9b) */}
      <Dialog open={variantsOpen} onOpenChange={setVariantsOpen}>
        <DialogContent className="max-w-md rounded-2xl text-start">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-base font-extrabold text-[#16212B]
            "
            >
              <Layers className="size-4 text-[#0066FF]" />
              {t('variantsModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              {t('variantDesc')}
            </p>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">{t('variantCountLabel')}</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={variantCount}
                onChange={e => setVariantCount(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setVariantsOpen(false)}
              className="h-9 rounded-xl border-slate-200 text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleGenerateVariants}
              disabled={generatingVariants || !selectedExamId}
              className="
                h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold text-white
                hover:bg-[#0052CC]
              "
            >
              {generatingVariants
                ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  )
                : (
                    <Wand2 className="size-3.5" />
                  )}
              {t('btnGenerate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
