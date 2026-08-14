'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Clock, CheckCircle2, Copy, Library } from 'lucide-react';
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
type BankItem = { id: string; questionText: string; marks: number; subjectId: string | null; subjectName: string | null; cycle: string | null; difficulty: string | null; sectionLabel: string | null; options: QuestionOption[] };

const DIFFICULTY_OPTIONS = [
  { value: 'facile', label: 'Facile' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'difficile', label: 'Difficile' },
];
const CYCLE_OPTIONS = [
  { value: 'maternelle', label: 'Maternelle' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
];

// Real per-exam questions (onlineExamQuestions) plus a real, reusable,
// exam-independent question bank (questionBankItems) with an independent-copy
// model - copying into an exam never lets later bank edits change an exam
// that already used it (future-implementation/dropped-features-rebuild).
export function QuestionBankView({ locale: _locale }: { locale?: string } = {}) {
  const { can } = usePermissions();
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
  const [questionForm, setQuestionForm] = useState({ questionText: '', marks: '1', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }], sectionLabel: '', difficulty: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Question bank state
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [bankFilter, setBankFilter] = useState({ subjectId: '', cycle: '', difficulty: '' });
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ questionText: '', marks: '1', subjectId: '', cycle: '', difficulty: '', sectionLabel: '', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] });
  const [copyTarget, setCopyTarget] = useState<{ bankItemId: string; onlineExamId: string } | null>(null);

  const loadBankItems = () => {
    const params = new URLSearchParams();
    if (bankFilter.subjectId) params.set('subjectId', bankFilter.subjectId);
    if (bankFilter.cycle) params.set('cycle', bankFilter.cycle);
    if (bankFilter.difficulty) params.set('difficulty', bankFilter.difficulty);
    fetch(`/api/academics/question-bank?${params}`).then(r => r.json()).then(j => j?.success && setBankItems(j.data)).catch(() => {});
  };

  useEffect(() => {
    if (tab === 'bank') {
      loadBankItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, bankFilter]);

  const handleCreateBankItem = async () => {
    if (!bankForm.questionText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const options = bankForm.isQcm ? bankForm.options.filter(o => o.optionText.trim()) : undefined;
      const res = await fetch('/api/academics/question-bank', {
        method: 'POST',
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
        setError(json.error?.message || json.message || 'Échec de la création.');
        return;
      }
      setShowBankForm(false);
      setBankForm({ questionText: '', marks: '1', subjectId: '', cycle: '', difficulty: '', sectionLabel: '', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] });
      loadBankItems();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankItem = async (id: string) => {
    await fetch(`/api/academics/question-bank?id=${id}`, { method: 'DELETE' });
    loadBankItems();
  };

  const handleCopyIntoExam = async () => {
    if (!copyTarget?.onlineExamId) return;
    await fetch(`/api/academics/question-bank/${copyTarget.bankItemId}/copy-into-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlineExamId: copyTarget.onlineExamId }),
    });
    setCopyTarget(null);
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
        setError(json.error?.message || json.message || 'Échec de la création de l\'examen.');
        return;
      }
      setShowExamForm(false);
      setExamForm({ classSubjectId: '', title: '', durationMinutes: '60', totalMarks: '20', startsAt: '', endsAt: '' });
      loadExams();
      setSelectedExamId(json.data.id);
    } catch {
      setError('Connexion impossible.');
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
      const res = await fetch(`/api/academics/online-exams/${selectedExamId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionForm.questionText.trim(),
          marks: Number(questionForm.marks),
          orderIndex: questions.length,
          options,
          sectionLabel: questionForm.sectionLabel || undefined,
          difficulty: questionForm.difficulty || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec de la création de la question.');
        return;
      }
      setShowQuestionForm(false);
      setQuestionForm({ questionText: '', marks: '1', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }], sectionLabel: '', difficulty: '' });
      loadQuestions(selectedExamId);
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    await fetch(`/api/academics/online-exams/${selectedExamId}/questions/${id}`, { method: 'DELETE' });
    loadQuestions(selectedExamId);
  };

  const canManage = can('grading.manage');
  const totalQuestionMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Banque de questions</h1>
          <p className="text-xs text-slate-500 mt-1">{exams.length} examen(s) réel(s), questions et QCM par examen.</p>
        </div>
        {canManage && tab === 'exam' && (
          <Button size="sm" onClick={() => setShowExamForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nouvel examen
          </Button>
        )}
        {canManage && tab === 'bank' && (
          <Button size="sm" onClick={() => setShowBankForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nouvelle question
          </Button>
        )}
      </div>

      <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50 w-fit">
        {(['exam', 'bank'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-8 px-4 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${tab === t ? 'bg-[#2487B8] text-white' : 'text-slate-500 hover:text-[#16212B]'}`}
          >
            {t === 'exam' ? <Clock className="w-3.5 h-3.5" /> : <Library className="w-3.5 h-3.5" />}
            {t === 'exam' ? 'Par examen' : 'Banque'}
          </button>
        ))}
      </div>

      {tab === 'exam' && (
      <>
      {canManage && showExamForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1 sm:col-span-3">
              <label className="font-bold text-slate-600">Titre</label>
              <Input value={examForm.title} onChange={e => setExamForm({ ...examForm, title: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Classe + Matière</label>
              <select value={examForm.classSubjectId} onChange={e => setExamForm({ ...examForm, classSubjectId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Sélectionner...</option>
                {classSubjects.map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {classes.find(c => c.id === cs.classId)?.name ?? cs.classId} · {subjects.find(s => s.id === cs.subjectId)?.name ?? cs.subjectId}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Durée (min)</label>
              <Input type="number" value={examForm.durationMinutes} onChange={e => setExamForm({ ...examForm, durationMinutes: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Total points</label>
              <Input type="number" value={examForm.totalMarks} onChange={e => setExamForm({ ...examForm, totalMarks: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Début</label>
              <Input type="datetime-local" value={examForm.startsAt} onChange={e => setExamForm({ ...examForm, startsAt: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Fin</label>
              <Input type="datetime-local" value={examForm.endsAt} onChange={e => setExamForm({ ...examForm, endsAt: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleCreateExam} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? 'Enregistrement...' : 'Créer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowExamForm(false)} className="h-9 rounded-xl text-xs font-bold">
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <select
          value={selectedExamId}
          onChange={e => setSelectedExamId(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B] w-full sm:w-96"
        >
          <option value="">Sélectionner un examen...</option>
          {exams.map(exam => <option key={exam.id} value={exam.id}>{examLabel(exam)}</option>)}
        </select>
      </Card>

      {!selectedExamId
        ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{exams.length === 0 ? 'Aucun examen créé.' : 'Sélectionnez un examen pour voir ses questions.'}</p>
            </Card>
          )
        : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <p className="text-xs font-bold text-slate-400">Questions</p>
                  <p className="text-xl font-extrabold text-[#16212B]">{questions.length}</p>
                </Card>
                <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <p className="text-xs font-bold text-slate-400">Points (questions / total examen)</p>
                  <p className="text-xl font-extrabold text-[#16212B]">{totalQuestionMarks} / {selectedExam?.totalMarks ?? '—'}</p>
                </Card>
              </div>

              {canManage && (
                <Button size="sm" onClick={() => setShowQuestionForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une question
                </Button>
              )}

              {canManage && showQuestionForm && (
                <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Texte de la question</label>
                    <textarea
                      value={questionForm.questionText}
                      onChange={e => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                      rows={2}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Points</label>
                      <Input type="number" value={questionForm.marks} onChange={e => setQuestionForm({ ...questionForm, marks: e.target.value })} className="h-9 w-24 rounded-xl" />
                    </div>
                    <label className="flex items-center gap-1.5 font-bold text-slate-600 mt-4">
                      <input type="checkbox" checked={questionForm.isQcm} onChange={e => setQuestionForm({ ...questionForm, isQcm: e.target.checked })} />
                      QCM (choix multiple)
                    </label>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Section (optionnel)</label>
                      <Input value={questionForm.sectionLabel} onChange={e => setQuestionForm({ ...questionForm, sectionLabel: e.target.value })} className="h-9 w-32 rounded-xl" placeholder="Ex. Partie A" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Difficulté</label>
                      <select value={questionForm.difficulty} onChange={e => setQuestionForm({ ...questionForm, difficulty: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3">
                        <option value="">—</option>
                        {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {questionForm.isQcm && (
                    <div className="space-y-2">
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
                            placeholder={`Choix ${i + 1}`}
                            className="h-9 rounded-xl text-xs flex-1"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, { optionText: '', isCorrect: false }] })}
                        className="text-[11px] font-bold text-[#2487B8] hover:underline"
                      >
                        + Ajouter un choix
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={saving} onClick={handleCreateQuestion} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
                      {saving ? 'Enregistrement...' : 'Ajouter'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowQuestionForm(false)} className="h-9 rounded-xl text-xs font-bold">
                      Annuler
                    </Button>
                  </div>
                </Card>
              )}

              <div className="space-y-2">
                {loadingQuestions && <p className="text-xs text-slate-400 text-center py-8">Chargement...</p>}
                {!loadingQuestions && questions.length === 0 && (
                  <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
                    <p className="text-xs text-slate-400">Aucune question pour cet examen.</p>
                  </Card>
                )}
                {questions.map((q, i) => (
                  <Card key={q.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#16212B]">Q{i + 1}. {q.questionText}</p>
                        {(q.sectionLabel || q.difficulty) && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {q.sectionLabel && <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px] font-bold">{q.sectionLabel}</Badge>}
                            {q.difficulty && <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold">{DIFFICULTY_OPTIONS.find(d => d.value === q.difficulty)?.label}</Badge>}
                          </div>
                        )}
                        {q.options.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {q.options.map(opt => (
                              <p key={opt.id} className={`text-[11px] flex items-center gap-1.5 ${opt.isCorrect ? 'text-[#17A673] font-bold' : 'text-slate-500'}`}>
                                {opt.isCorrect && <CheckCircle2 className="w-3 h-3" />}
                                {opt.optionText}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px] font-bold">{q.marks} pts</Badge>
                        {canManage && (
                          <button onClick={() => handleDeleteQuestion(q.id)} className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {tab === 'bank' && (
        <>
          <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
            <select value={bankFilter.subjectId} onChange={e => setBankFilter({ ...bankFilter, subjectId: e.target.value })} className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
              <option value="">Toutes matières</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={bankFilter.cycle} onChange={e => setBankFilter({ ...bankFilter, cycle: e.target.value })} className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
              <option value="">Tous cycles</option>
              {CYCLE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={bankFilter.difficulty} onChange={e => setBankFilter({ ...bankFilter, difficulty: e.target.value })} className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
              <option value="">Toutes difficultés</option>
              {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Card>

          {canManage && showBankForm && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Texte de la question</label>
                <textarea
                  value={bankForm.questionText}
                  onChange={e => setBankForm({ ...bankForm, questionText: e.target.value })}
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Points</label>
                  <Input type="number" value={bankForm.marks} onChange={e => setBankForm({ ...bankForm, marks: e.target.value })} className="h-9 w-24 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Matière</label>
                  <select value={bankForm.subjectId} onChange={e => setBankForm({ ...bankForm, subjectId: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3">
                    <option value="">—</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Cycle</label>
                  <select value={bankForm.cycle} onChange={e => setBankForm({ ...bankForm, cycle: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3">
                    <option value="">—</option>
                    {CYCLE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Difficulté</label>
                  <select value={bankForm.difficulty} onChange={e => setBankForm({ ...bankForm, difficulty: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3">
                    <option value="">—</option>
                    {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Section</label>
                  <Input value={bankForm.sectionLabel} onChange={e => setBankForm({ ...bankForm, sectionLabel: e.target.value })} className="h-9 w-32 rounded-xl" placeholder="Ex. Partie A" />
                </div>
                <label className="flex items-center gap-1.5 font-bold text-slate-600 h-9">
                  <input type="checkbox" checked={bankForm.isQcm} onChange={e => setBankForm({ ...bankForm, isQcm: e.target.checked })} />
                  QCM
                </label>
              </div>
              {bankForm.isQcm && (
                <div className="space-y-2">
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
                        placeholder={`Choix ${i + 1}`}
                        className="h-9 rounded-xl text-xs flex-1"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBankForm({ ...bankForm, options: [...bankForm.options, { optionText: '', isCorrect: false }] })}
                    className="text-[11px] font-bold text-[#2487B8] hover:underline"
                  >
                    + Ajouter un choix
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={saving} onClick={handleCreateBankItem} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
                  {saving ? 'Enregistrement...' : 'Ajouter'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowBankForm(false)} className="h-9 rounded-xl text-xs font-bold">
                  Annuler
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {bankItems.length === 0 && (
              <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
                <Library className="w-10 h-10 text-slate-200" />
                <p className="text-sm font-bold text-slate-400">Aucune question dans la banque</p>
              </Card>
            )}
            {bankItems.map(item => (
              <Card key={item.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#16212B]">{item.questionText}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {item.subjectName && <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">{item.subjectName}</Badge>}
                      {item.cycle && <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">{CYCLE_OPTIONS.find(c => c.value === item.cycle)?.label}</Badge>}
                      {item.difficulty && <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold">{DIFFICULTY_OPTIONS.find(d => d.value === item.difficulty)?.label}</Badge>}
                      {item.sectionLabel && <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px] font-bold">{item.sectionLabel}</Badge>}
                    </div>
                    {item.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.options.map(opt => (
                          <p key={opt.id} className={`text-[11px] flex items-center gap-1.5 ${opt.isCorrect ? 'text-[#17A673] font-bold' : 'text-slate-500'}`}>
                            {opt.isCorrect && <CheckCircle2 className="w-3 h-3" />}
                            {opt.optionText}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[10px] font-bold">{item.marks} pts</Badge>
                    {canManage && (
                      <>
                        <button onClick={() => setCopyTarget({ bankItemId: item.id, onlineExamId: '' })} className="p-1 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#1B6C93]" title="Copier dans un examen">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteBankItem(item.id)} className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {copyTarget?.bankItemId === item.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <select
                      value={copyTarget.onlineExamId}
                      onChange={e => setCopyTarget({ bankItemId: item.id, onlineExamId: e.target.value })}
                      className="h-8 flex-1 rounded-lg border border-slate-200 px-2 text-xs"
                    >
                      <option value="">Sélectionner un examen...</option>
                      {exams.map(exam => <option key={exam.id} value={exam.id}>{examLabel(exam)}</option>)}
                    </select>
                    <Button size="sm" disabled={!copyTarget.onlineExamId} onClick={handleCopyIntoExam} className="h-8 rounded-lg bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
                      Copier
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCopyTarget(null)} className="h-8 rounded-lg text-xs font-bold">
                      Annuler
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
