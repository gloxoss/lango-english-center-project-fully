'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Laptop,
  Plus,
  Clock,
  FileQuestion,
  Play,
  X,
  CheckCircle2,
  Loader2,
  Award,
  ArrowLeft,
} from 'lucide-react';

interface OnlineExam {
  id: string;
  classSubjectId: string;
  title: string;
  durationMinutes: number;
  totalMarks: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

interface ClassSubject {
  id: string;
  classId: string;
  subjectId: string;
  curriculumLabel?: string | null;
}

interface ExamOption {
  id: string;
  questionId: string;
  optionText: string;
  isCorrect: boolean;
}

interface ExamQuestion {
  id: string;
  onlineExamId: string;
  questionText: string;
  marks: string;
  orderIndex: number;
  options: ExamOption[];
  sectionLabel?: string | null;
  difficulty?: string | null;
}

interface AttemptResult {
  score?: string | null;
  status: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function classSubjectLabel(cs: ClassSubject | undefined) {
  if (!cs) return '';
  return cs.curriculumLabel || cs.id.slice(0, 8);
}

export default function OnlineExamsPage() {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');

  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [authoringExam, setAuthoringExam] = useState<OnlineExam | null>(null);
  const [takingExam, setTakingExam] = useState<OnlineExam | null>(null);

  // Create-exam form
  const [cTitle, setCTitle] = useState('');
  const [cClassSubjectId, setCClassSubjectId] = useState('');
  const [cDuration, setCDuration] = useState('30');
  const [cTotalMarks, setCTotalMarks] = useState('20');
  const [cStartsAt, setCStartsAt] = useState('');
  const [cEndsAt, setCEndsAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Question authoring
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [qText, setQText] = useState('');
  const [qMarks, setQMarks] = useState('1');
  const [qOptions, setQOptions] = useState<{ optionText: string; isCorrect: boolean }[]>([
    { optionText: '', isCorrect: false },
    { optionText: '', isCorrect: false },
  ]);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');

  // Take-exam view
  const [takeQuestions, setTakeQuestions] = useState<ExamQuestion[]>([]);
  const [loadingTake, setLoadingTake] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitError, setSubmitError] = useState('');

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/academics/online-exams');
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || t('loadingExams'));
      } else {
        setExams(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setError(t('loadingExams'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadClassSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/academics/class-subjects');
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setClassSubjects(json.data);
      }
    } catch {
      // Non-blocking: the create form just shows an empty dropdown.
    }
  }, []);

  const loadQuestions = useCallback(async (examId: string) => {
    setLoadingQuestions(true);
    setQuestionError('');
    try {
      const res = await fetch(`/api/academics/online-exams/${examId}/questions`);
      const json = await res.json();
      if (!res.ok) {
        setQuestionError(json?.error?.message || tCommon('error'));
        setQuestions([]);
      } else {
        setQuestions(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setQuestionError(tCommon('error'));
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, [t, tCommon]);

  useEffect(() => {
    loadExams();
    loadClassSubjects();
  }, [loadExams, loadClassSubjects]);

  const openAuthoring = (exam: OnlineExam) => {
    setAuthoringExam(exam);
    setQuestions([]);
    loadQuestions(exam.id);
  };

  const openTake = async (exam: OnlineExam) => {
    setTakingExam(exam);
    setTakeQuestions([]);
    setAnswers({});
    setResult(null);
    setSubmitError('');
    setLoadingTake(true);
    try {
      const res = await fetch(`/api/academics/online-exams/${exam.id}/questions`);
      const json = await res.json();
      setTakeQuestions(res.ok && Array.isArray(json.data) ? json.data : []);
    } catch {
      setTakeQuestions([]);
    } finally {
      setLoadingTake(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle || !cClassSubjectId || !cStartsAt || !cEndsAt) {
      setCreateError(t('examCreateFieldsRequired'));
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/academics/online-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSubjectId: cClassSubjectId,
          title: cTitle,
          durationMinutes: Number(cDuration),
          totalMarks: Number(cTotalMarks),
          startsAt: new Date(cStartsAt).toISOString(),
          endsAt: new Date(cEndsAt).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json?.error?.message || tCommon('error'));
        return;
      }
      setShowCreate(false);
      setCTitle('');
      setCClassSubjectId('');
      setCDuration('30');
      setCTotalMarks('20');
      setCStartsAt('');
      setCEndsAt('');
      await loadExams();
    } catch {
      setCreateError(tCommon('error'));
    } finally {
      setCreating(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authoringExam) return;
    const filledOptions = qOptions.filter((o) => o.optionText.trim().length > 0);
    if (!qText.trim()) {
      setQuestionError(t('questionTextRequired'));
      return;
    }
    if (filledOptions.length < 2) {
      setQuestionError(t('atLeastTwoOptions'));
      return;
    }
    if (!filledOptions.some((o) => o.isCorrect)) {
      setQuestionError(t('designateCorrectOption'));
      return;
    }
    setAddingQuestion(true);
    setQuestionError('');
    try {
      const res = await fetch(`/api/academics/online-exams/${authoringExam.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: qText.trim(),
          marks: Number(qMarks),
          options: filledOptions,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setQuestionError(json?.error?.message || tCommon('error'));
        return;
      }
      setQText('');
      setQMarks('1');
      setQOptions([
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
      ]);
      await loadQuestions(authoringExam.id);
    } catch {
      setQuestionError(tCommon('error'));
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleSubmitAttempt = async () => {
    if (!takingExam) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        examId: takingExam.id,
        answers: takeQuestions
          .filter((q) => answers[q.id])
          .map((q) => ({ questionId: q.id, selectedOptionId: answers[q.id] })),
      };
      const res = await fetch('/api/academics/online-exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json?.error?.message || tCommon('error'));
        return;
      }
      setResult(json.data || null);
    } catch {
      setSubmitError(tCommon('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const totalQuestions = questions.length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              {t('onlineExamsTitle')}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('onlineExamsSubtitle')}
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setShowCreate(true);
            setCreateError('');
          }}
          className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl shadow-2xs gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createExamBtn')}</span>
        </Button>
      </div>

      {/* KPI cards (real counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('publishedExamsKpi')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{exams.length}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{t('realTenantList')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <FileQuestion className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('classSubjectsKpi')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{classSubjects.length}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{t('availableForExamsDesc')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('questionsCountKpi')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{totalQuestions}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{authoringExam ? authoringExam.title : t('selectExamHint')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Exams list */}
      {authoringExam ? (
        <AuthoringView
          exam={authoringExam}
          questions={questions}
          loading={loadingQuestions}
          error={questionError}
          qText={qText}
          setQText={setQText}
          qMarks={qMarks}
          setQMarks={setQMarks}
          qOptions={qOptions}
          setQOptions={setQOptions}
          adding={addingQuestion}
          onAdd={handleAddQuestion}
          onBack={() => setAuthoringExam(null)}
        />
      ) : takingExam ? (
        <TakeView
          exam={takingExam}
          questions={takeQuestions}
          loading={loadingTake}
          answers={answers}
          setAnswers={setAnswers}
          submitting={submitting}
          result={result}
          error={submitError}
          onSubmit={handleSubmitAttempt}
          onBack={() => setTakingExam(null)}
        />
      ) : (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">{t('examsListTitle')}</h2>
            <Button
              variant="ghost"
              onClick={loadExams}
              disabled={loading}
              className="text-xs font-bold text-[#2487B8] gap-1.5 cursor-pointer"
            >
              <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {tCommon('refresh')}
            </Button>
          </div>

          {error && <p className="text-xs text-red-600 font-semibold mb-3">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs font-semibold text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('loadingExams')}
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2487B8] flex items-center justify-center mx-auto">
                <FileQuestion className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-[#16212B]">{t('noExamsTitle')}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t('noExamsDesc')}
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {t('createExamBtn')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => {
                const cs = classSubjects.find((c) => c.id === exam.classSubjectId);
                return (
                  <Card key={exam.id} className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-[#2487B8]/40 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 bg-blue-50 text-[#2487B8] text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100">
                          {classSubjectLabel(cs) || t('typeOnlineExam')}
                        </span>
                        <Badge variant="info" className="font-bold text-[10px]">
                          QCM
                        </Badge>
                      </div>
                      <h3 className="text-base font-extrabold text-[#16212B] tracking-tight leading-snug text-start">{exam.title}</h3>
                      <div className="space-y-1 text-xs text-slate-600 font-medium text-start">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#2487B8]" />
                          {t('examDurationAndPoints', { duration: exam.durationMinutes, points: exam.totalMarks })}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(exam.startsAt)} → {formatDate(exam.endsAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAuthoring(exam)}
                        className="rounded-xl border-slate-200 text-[#2487B8] font-bold text-xs gap-1.5 flex-1 cursor-pointer"
                      >
                        <FileQuestion className="w-3.5 h-3.5" />
                        {t('questionsActionBtn')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openTake(exam)}
                        className="rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs shadow-2xs gap-1.5 flex-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {t('takeExamActionBtn')}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Create exam modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-[#16212B]">{t('modalCreateExamTitle')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">{t('examTitleLabel')}</label>
                <Input
                  type="text"
                  required
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  placeholder={t('examTitlePlaceholder')}
                  className="mt-1 text-xs rounded-xl text-start"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t('classSubjectLabel')}</label>
                <select
                  value={cClassSubjectId}
                  onChange={(e) => setCClassSubjectId(e.target.value)}
                  className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium text-start bg-white"
                >
                  <option value="">{t('selectSubjectOption')}</option>
                  {classSubjects.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {classSubjectLabel(cs)}
                    </option>
                  ))}
                </select>
                {classSubjects.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">
                    {t('noClassSubjectsConfigured')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t('durationMinutesLabel')}</label>
                  <Input
                    type="number"
                    min={1}
                    value={cDuration}
                    onChange={(e) => setCDuration(e.target.value)}
                    className="mt-1 text-xs rounded-xl text-start"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">{t('maxScoreLabelOnline')}</label>
                  <Input
                    type="number"
                    min={1}
                    value={cTotalMarks}
                    onChange={(e) => setCTotalMarks(e.target.value)}
                    className="mt-1 text-xs rounded-xl text-start"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t('startsAtLabel')}</label>
                  <Input
                    type="datetime-local"
                    value={cStartsAt}
                    onChange={(e) => setCStartsAt(e.target.value)}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">{t('endsAtLabel')}</label>
                  <Input
                    type="datetime-local"
                    value={cEndsAt}
                    onChange={(e) => setCEndsAt(e.target.value)}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
              </div>

              {createError && <p className="text-xs text-red-600 font-semibold">{createError}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="text-xs rounded-xl cursor-pointer">
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs cursor-pointer"
                >
                  {creating ? t('creatingExam') : t('publishExamBtn')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthoringView(props: {
  exam: OnlineExam;
  questions: ExamQuestion[];
  loading: boolean;
  error: string;
  qText: string;
  setQText: (v: string) => void;
  qMarks: string;
  setQMarks: (v: string) => void;
  qOptions: { optionText: string; isCorrect: boolean }[];
  setQOptions: (v: { optionText: string; isCorrect: boolean }[]) => void;
  adding: boolean;
  onAdd: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');

  const {
    exam, questions, loading, error,
    qText, setQText, qMarks, setQMarks, qOptions, setQOptions, adding, onAdd, onBack,
  } = props;

  const setOptionText = (idx: number, text: string) => {
    setQOptions(qOptions.map((o, i) => (i === idx ? { ...o, optionText: text } : o)));
  };
  const setOptionCorrect = (idx: number) => {
    setQOptions(qOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };
  const addOption = () => setQOptions([...qOptions, { optionText: '', isCorrect: false }]);
  const removeOption = (idx: number) => setQOptions(qOptions.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-xs font-bold text-[#2487B8] hover:underline mb-1 cursor-pointer flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{t('backToExamsList')}</span>
          </button>
          <h2 className="text-lg font-extrabold text-[#16212B]">{t('examQuestionsHeading', { title: exam.title })}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-1 space-y-4">
          <h2 className="text-base font-extrabold text-[#16212B]">{t('addQuestionTitle')}</h2>
          <form onSubmit={onAdd} className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700">{t('questionTextLabel')}</label>
              <textarea
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                rows={3}
                placeholder={t('questionTextPlaceholder')}
                className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8] text-start"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">{t('pointsLabel')}</label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={qMarks}
                onChange={(e) => setQMarks(e.target.value)}
                className="mt-1 text-xs rounded-xl text-start"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">{t('optionsRadioHint')}</label>
              {qOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={opt.isCorrect}
                    onChange={() => setOptionCorrect(idx)}
                    className="shrink-0"
                  />
                  <Input
                    type="text"
                    value={opt.optionText}
                    onChange={(e) => setOptionText(idx, e.target.value)}
                    placeholder={t('optionNumberPlaceholder', { number: idx + 1 })}
                    className="text-xs rounded-xl text-start"
                  />
                  {qOptions.length > 2 && (
                    <button type="button" onClick={() => removeOption(idx)} className="text-slate-400 hover:text-red-500 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {qOptions.length < 8 && (
                <button type="button" onClick={addOption} className="text-xs font-bold text-[#2487B8] hover:underline cursor-pointer">
                  {t('addOptionBtn')}
                </button>
              )}
            </div>

            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

            <Button
              type="submit"
              disabled={adding}
              className="w-full bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 cursor-pointer"
            >
              {adding ? t('addingQuestionText') : t('addQuestionSubmitBtn')}
            </Button>
          </form>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-2 space-y-4">
          <h2 className="text-base font-extrabold text-[#16212B]">{t('questionsCountHeading', { count: questions.length })}</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs font-semibold text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {tCommon('loading')}
            </div>
          ) : questions.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">{t('noQuestionsYetInExam')}</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="text-[10px]">Q{i + 1}</Badge>
                    <span className="text-xs font-bold text-slate-500">{q.marks} pt(s)</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#16212B] mt-1.5 text-start">{q.questionText}</h4>
                  <div className="mt-2 space-y-1">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2 text-[11px]">
                        {opt.isCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 inline-block" />
                        )}
                        <span className={opt.isCorrect ? 'font-bold text-emerald-700' : 'text-slate-600'}>{opt.optionText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TakeView(props: {
  exam: OnlineExam;
  questions: ExamQuestion[];
  loading: boolean;
  answers: Record<string, string>;
  setAnswers: (v: Record<string, string>) => void;
  submitting: boolean;
  result: AttemptResult | null;
  error: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');

  const { exam, questions, loading, answers, setAnswers, submitting, result, error, onSubmit, onBack } = props;

  if (result) {
    return (
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-extrabold text-[#16212B]">{t('examSubmittedAndGradedTitle')}</h2>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm mx-auto space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">{t('obtainedScoreLabel')}</span>
          <div className="text-2xl font-extrabold text-[#2487B8]">{result.score ?? '—'} / {exam.totalMarks}</div>
          <Badge variant={result.status === 'graded' ? 'success' : 'warning'} className="font-bold text-[10px]">
            {result.status}
          </Badge>
        </div>
        <Button variant="ghost" onClick={onBack} className="text-xs font-bold text-[#2487B8] gap-1.5 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          <span>{t('backToExamsList')}</span>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-xs font-bold text-[#2487B8] hover:underline mb-1 cursor-pointer flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{t('backToExamsList')}</span>
          </button>
          <h2 className="text-lg font-extrabold text-[#16212B]">{exam.title}</h2>
          <p className="text-xs text-slate-500">{t('examDurationAndPoints', { duration: exam.durationMinutes, points: exam.totalMarks })}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs font-semibold text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {tCommon('loading')}
        </div>
      ) : questions.length === 0 ? (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs text-center text-xs text-slate-500">
          {t('noQuestionsYetInExam')}
        </Card>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {questions.map((q, i) => (
            <Card key={q.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <h3 className="text-sm font-extrabold text-[#16212B] text-start">
                {i + 1}. {q.questionText}
              </h3>
              <div className="space-y-2 pt-3">
                {q.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAnswers({ ...answers, [q.id]: opt.id })}
                    className={`w-full text-start p-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      answers[q.id] === opt.id
                        ? 'border-[#2487B8] bg-blue-50/80 text-[#2487B8]'
                        : 'border-slate-200 bg-white hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <span>{opt.optionText}</span>
                    <span className={`w-3.5 h-3.5 rounded-full border ${answers[q.id] === opt.id ? 'bg-[#2487B8] border-[#2487B8]' : 'border-slate-300'}`} />
                  </button>
                ))}
              </div>
            </Card>
          ))}

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? t('submittingExam') : t('submitExamBtn')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
