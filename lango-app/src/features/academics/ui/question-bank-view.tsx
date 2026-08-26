'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Copy,
  Library,
  Pencil,
  Sparkles,
  Layers,
  Wand2,
  FileCheck,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';
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

  const resetBankForm = () => setBankForm({ questionText: '', marks: '1', subjectId: '', cycle: '', difficulty: 'moyen', sectionLabel: '', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] });

  const handleSubmitBankItem = async () => {
    if (!bankForm.questionText.trim()) return;
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
        setError(json.error?.message || json.message || 'Échec de l\'enregistrement.');
        return;
      }
      setShowBankForm(false);
      setEditingBankItemId(null);
      resetBankForm();
      loadBankItems();
    } catch {
      setError('Connexion impossible.');
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
        setError(json.error?.message || json.message || 'Échec de l\'enregistrement de la question.');
        return;
      }
      setShowQuestionForm(false);
      setEditingQuestionId(null);
      setQuestionForm({ questionText: '', marks: '1', isQcm: false, options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }], sectionLabel: '', difficulty: 'moyen' });
      loadQuestions(selectedExamId);
    } catch {
      setError('Connexion impossible.');
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
    await fetch(`/api/academics/online-exams/${selectedExamId}/questions/${id}`, { method: 'DELETE' });
    loadQuestions(selectedExamId);
  };

  // Auto-compose exam by difficulty algorithm (§6.9)
  const handleAutoCompose = async () => {
    const targetExamId = composeTargetExamId || selectedExamId;
    if (!targetExamId) {
      setError('Veuillez sélectionner un examen de destination.');
      return;
    }
    setComposing(true);
    setError(null);

    try {
      // 1. Fetch available bank items
      const params = new URLSearchParams();
      if (composeSubjectId) params.set('subjectId', composeSubjectId);
      const res = await fetch(`/api/academics/question-bank?${params}`).then(r => r.json());
      const allItems: BankItem[] = res?.data ?? [];

      const easyItems = allItems.filter(i => (i.difficulty || 'facile') === 'facile');
      const mediumItems = allItems.filter(i => (i.difficulty || 'moyen') === 'moyen');
      const hardItems = allItems.filter(i => (i.difficulty || 'difficile') === 'difficile');

      const neededEasy = Number(countEasy) || 0;
      const neededMedium = Number(countMedium) || 0;
      const neededHard = Number(countHard) || 0;

      // Select random subset from each bucket
      const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

      const pickedEasy = shuffle(easyItems).slice(0, neededEasy);
      const pickedMedium = shuffle(mediumItems).slice(0, neededMedium);
      const pickedHard = shuffle(hardItems).slice(0, neededHard);

      const assembled = [...pickedEasy, ...pickedMedium, ...pickedHard];

      if (assembled.length === 0) {
        setError('Aucune question disponible dans la banque pour cette matière.');
        return;
      }

      // Copy each into target online exam
      let copiedCount = 0;
      for (const item of assembled) {
        await fetch(`/api/academics/question-bank/${item.id}/copy-into-exam`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onlineExamId: targetExamId }),
        });
        copiedCount++;
      }

      setAutoComposeOpen(false);
      setSuccessMsg(`Composition réussie : ${copiedCount} question(s) injectée(s) avec difficulté équilibrée.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      loadQuestions(targetExamId);
    } catch {
      setError('Échec de la composition automatique.');
    } finally {
      setComposing(false);
    }
  };

  // Generate N variants of the selected exam (§6.9b)
  const handleGenerateVariants = async () => {
    if (!selectedExamId) {
      setError('Veuillez sélectionner un examen source.');
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
        setError(json.error?.message || json.message || 'Échec de la génération des variantes.');
        return;
      }
      setVariantsOpen(false);
      setSuccessMsg(`${json.total} variante(s) générée(s) avec ordre des questions et des choix QCM mélangés.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      loadExams();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setGeneratingVariants(false);
    }
  };

  const canManage = can('grading.manage');
  const totalQuestionMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#0066FF]" />
            Banque de Questions &amp; Auto-Composition
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Référentiel de questions réutilisables, composition automatique d&apos;épreuves par difficulté et génération de variantes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setComposeTargetExamId(selectedExamId);
                setAutoComposeOpen(true);
              }}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-composer épreuve (§6.9)
            </Button>
          )}

          {canManage && tab === 'exam' && (
            <Button size="sm" variant="outline" onClick={() => setShowExamForm(v => !v)} className="h-9 text-xs rounded-xl border-slate-200 font-bold gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nouvel examen
            </Button>
          )}
          {canManage && tab === 'bank' && (
            <Button size="sm" variant="outline" onClick={() => { setEditingBankItemId(null); resetBankForm(); setShowBankForm(v => !v); }} className="h-9 text-xs rounded-xl border-slate-200 font-bold gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nouvelle question
            </Button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50 w-fit">
        {(['exam', 'bank'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-8 px-4 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${tab === t ? 'bg-[#0066FF] text-white shadow-2xs' : 'text-slate-500 hover:text-[#16212B]'}`}
          >
            {t === 'exam' ? <Clock className="w-3.5 h-3.5" /> : <Library className="w-3.5 h-3.5" />}
            {t === 'exam' ? 'Par Examen / Épreuve' : 'Banque Centrale Réutilisable'}
          </button>
        ))}
      </div>

      {tab === 'exam' && (
      <>
      {canManage && showExamForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1 sm:col-span-3">
              <label className="font-bold text-slate-600">Titre de l&apos;examen</label>
              <Input value={examForm.title} onChange={e => setExamForm({ ...examForm, title: e.target.value })} className="h-9 rounded-xl" placeholder="Ex: Devoir Surveillé N°1" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Classe + Matière</label>
              <select value={examForm.classSubjectId} onChange={e => setExamForm({ ...examForm, classSubjectId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3 bg-white">
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
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" disabled={saving} onClick={handleCreateExam} className="h-9 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold">
              {saving ? 'Enregistrement...' : 'Créer l\'examen'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowExamForm(false)} className="h-9 rounded-xl text-xs font-bold">
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
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
              <p className="text-sm font-bold text-slate-400">{exams.length === 0 ? 'Aucun examen créé.' : 'Sélectionnez un examen pour afficher et composer ses questions.'}</p>
            </Card>
          )
        : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <p className="text-xs font-bold text-slate-400">Questions Configurées</p>
                  <p className="text-xl font-extrabold text-[#16212B]">{questions.length}</p>
                </Card>
                <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <p className="text-xs font-bold text-slate-400">Points (Somme / Barème)</p>
                  <p className="text-xl font-extrabold text-[#0066FF]">{totalQuestionMarks} / {selectedExam?.totalMarks ?? '—'} pts</p>
                </Card>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => { setEditingQuestionId(null); setShowQuestionForm(v => !v); }} className="h-9 text-xs rounded-xl bg-[#0066FF] text-white font-bold gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter une question
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setVariantsOpen(true)} className="h-9 text-xs rounded-xl border-slate-200 font-bold gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Générer des variantes
                  </Button>
                </div>
              )}

              {canManage && showQuestionForm && (
                <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Texte de la question</label>
                    <textarea
                      value={questionForm.questionText}
                      onChange={e => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                      rows={2}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Points</label>
                      <Input type="number" value={questionForm.marks} onChange={e => setQuestionForm({ ...questionForm, marks: e.target.value })} className="h-9 w-24 rounded-xl" />
                    </div>
                    <label className="flex items-center gap-1.5 font-bold text-slate-600 mt-4 cursor-pointer">
                      <input type="checkbox" checked={questionForm.isQcm} onChange={e => setQuestionForm({ ...questionForm, isQcm: e.target.checked })} />
                      QCM (choix multiple)
                    </label>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Section</label>
                      <Input value={questionForm.sectionLabel} onChange={e => setQuestionForm({ ...questionForm, sectionLabel: e.target.value })} className="h-9 w-32 rounded-xl" placeholder="Ex. Partie A" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Difficulté</label>
                      <select value={questionForm.difficulty} onChange={e => setQuestionForm({ ...questionForm, difficulty: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3 bg-white">
                        {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
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
                            placeholder={`Choix ${i + 1}`}
                            className="h-9 rounded-xl text-xs flex-1"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, { optionText: '', isCorrect: false }] })}
                        className="text-[11px] font-bold text-[#0066FF] hover:underline"
                      >
                        + Ajouter un choix
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" disabled={saving} onClick={handleCreateQuestion} className="h-9 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold">
                      {saving ? 'Enregistrement...' : editingQuestionId ? 'Enregistrer' : 'Ajouter'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowQuestionForm(false); setEditingQuestionId(null); }} className="h-9 rounded-xl text-xs font-bold">
                      Annuler
                    </Button>
                  </div>
                </Card>
              )}

              <div className="space-y-2">
                {loadingQuestions && <p className="text-xs text-slate-400 text-center py-8">Chargement...</p>}
                {!loadingQuestions && questions.length === 0 && (
                  <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
                    <p className="text-xs text-slate-400">Aucune question pour cet examen. Utilisez l&apos;auto-composition pour en générer rapidement.</p>
                  </Card>
                )}
                {questions.map((q, i) => (
                  <Card key={q.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#16212B]">Q{i + 1}. {q.questionText}</p>
                        {(q.sectionLabel || q.difficulty) && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {q.sectionLabel && <Badge className="bg-[#DCEBF4] text-[#0066FF] border-none text-[10px] font-bold">{q.sectionLabel}</Badge>}
                            {q.difficulty && <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold">{DIFFICULTY_OPTIONS.find(d => d.value === q.difficulty)?.label || q.difficulty}</Badge>}
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
                        <Badge className="bg-[#DCEBF4] text-[#0066FF] border-none text-[10px] font-bold">{q.marks} pts</Badge>
                        {canManage && (
                          <>
                            <button onClick={() => handleEditQuestion(q)} className="p-1 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#0066FF]" title="Modifier">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteQuestion(q.id)} className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 className="w-3.5 h-3.5" />
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
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
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
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Texte de la question</label>
                <textarea
                  value={bankForm.questionText}
                  onChange={e => setBankForm({ ...bankForm, questionText: e.target.value })}
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none"
                  placeholder="Énoncé de la question..."
                />
              </div>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Points</label>
                  <Input type="number" value={bankForm.marks} onChange={e => setBankForm({ ...bankForm, marks: e.target.value })} className="h-9 w-24 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Matière</label>
                  <select value={bankForm.subjectId} onChange={e => setBankForm({ ...bankForm, subjectId: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3 bg-white">
                    <option value="">—</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Cycle</label>
                  <select value={bankForm.cycle} onChange={e => setBankForm({ ...bankForm, cycle: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3 bg-white">
                    <option value="">—</option>
                    {CYCLE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Difficulté</label>
                  <select value={bankForm.difficulty} onChange={e => setBankForm({ ...bankForm, difficulty: e.target.value })} className="h-9 rounded-xl border border-slate-200 px-3 bg-white">
                    {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Section</label>
                  <Input value={bankForm.sectionLabel} onChange={e => setBankForm({ ...bankForm, sectionLabel: e.target.value })} className="h-9 w-32 rounded-xl" placeholder="Ex. Partie A" />
                </div>
                <label className="flex items-center gap-1.5 font-bold text-slate-600 h-9 cursor-pointer">
                  <input type="checkbox" checked={bankForm.isQcm} onChange={e => setBankForm({ ...bankForm, isQcm: e.target.checked })} />
                  QCM
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
                        placeholder={`Choix ${i + 1}`}
                        className="h-9 rounded-xl text-xs flex-1"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBankForm({ ...bankForm, options: [...bankForm.options, { optionText: '', isCorrect: false }] })}
                    className="text-[11px] font-bold text-[#0066FF] hover:underline"
                  >
                    + Ajouter un choix
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" disabled={saving} onClick={handleSubmitBankItem} className="h-9 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold">
                  {saving ? 'Enregistrement...' : editingBankItemId ? 'Enregistrer' : 'Ajouter à la banque'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowBankForm(false); setEditingBankItemId(null); }} className="h-9 rounded-xl text-xs font-bold">
                  Annuler
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {bankItems.length === 0 && (
              <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
                <Library className="w-10 h-10 text-slate-200" />
                <p className="text-sm font-bold text-slate-400">Aucune question dans la banque.</p>
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
                      {item.difficulty && <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold">{DIFFICULTY_OPTIONS.find(d => d.value === item.difficulty)?.label || item.difficulty}</Badge>}
                      {item.sectionLabel && <Badge className="bg-[#DCEBF4] text-[#0066FF] border-none text-[10px] font-bold">{item.sectionLabel}</Badge>}
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
                    <Badge className="bg-[#DCEBF4] text-[#0066FF] border-none text-[10px] font-bold">{item.marks} pts</Badge>
                    {canManage && (
                      <>
                        <button onClick={() => handleEditBankItem(item)} className="p-1 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#0066FF]" title="Modifier">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setCopyTarget({ bankItemId: item.id, onlineExamId: '' })} className="p-1 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#0066FF]" title="Copier dans un examen">
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
                      className="h-8 flex-1 rounded-lg border border-slate-200 px-2 text-xs bg-white"
                    >
                      <option value="">Sélectionner un examen de destination...</option>
                      {exams.map(exam => <option key={exam.id} value={exam.id}>{examLabel(exam)}</option>)}
                    </select>
                    <Button size="sm" disabled={!copyTarget.onlineExamId} onClick={handleCopyIntoExam} className="h-8 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold">
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

      {/* AUTO-COMPOSE MODAL (§6.9) */}
      <Dialog open={autoComposeOpen} onOpenChange={setAutoComposeOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0066FF]" />
              Auto-Composition par Difficulté (§6.9)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              L&apos;assistant tire aléatoirement un ensemble équilibré de questions depuis la banque selon les quotas de difficulté définis.
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Matière</label>
              <select
                value={composeSubjectId}
                onChange={e => setComposeSubjectId(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="">Toutes les matières</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Examen de destination *</label>
              <select
                value={composeTargetExamId}
                onChange={e => setComposeTargetExamId(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="">Choisir un examen...</option>
                {exams.map(e => <option key={e.id} value={e.id}>{examLabel(e)}</option>)}
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <span className="font-bold text-slate-700 block">Répartition des questions par difficulté :</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="font-bold text-emerald-700 block mb-1">Faciles</label>
                  <Input type="number" min={0} value={countEasy} onChange={e => setCountEasy(e.target.value)} className="h-9 text-xs rounded-xl bg-white" />
                </div>
                <div>
                  <label className="font-bold text-blue-700 block mb-1">Moyennes</label>
                  <Input type="number" min={0} value={countMedium} onChange={e => setCountMedium(e.target.value)} className="h-9 text-xs rounded-xl bg-white" />
                </div>
                <div>
                  <label className="font-bold text-amber-700 block mb-1">Difficiles</label>
                  <Input type="number" min={0} value={countHard} onChange={e => setCountHard(e.target.value)} className="h-9 text-xs rounded-xl bg-white" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setAutoComposeOpen(false)} className="h-9 text-xs rounded-xl border-slate-200">
              Annuler
            </Button>
            <Button
              onClick={handleAutoCompose}
              disabled={composing || !composeTargetExamId}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5"
            >
              {composing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Générer et injecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GENERATE VARIANTS MODAL (§6.9b) */}
      <Dialog open={variantsOpen} onOpenChange={setVariantsOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0066FF]" />
              Générer des Variantes (§6.9b)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              Crée plusieurs variantes de l&apos;examen <strong>{selectedExam?.title ?? 'sélectionné'}</strong>. Chaque variante reprend les mêmes questions dans un ordre aléatoire, avec les choix QCM réordonnés.
            </p>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Nombre de variantes</label>
              <Input type="number" min={1} max={20} value={variantCount} onChange={e => setVariantCount(e.target.value)} className="h-9 text-xs rounded-xl" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setVariantsOpen(false)} className="h-9 text-xs rounded-xl border-slate-200">
              Annuler
            </Button>
            <Button
              onClick={handleGenerateVariants}
              disabled={generatingVariants || !selectedExamId}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5"
            >
              {generatingVariants ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
