'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, CheckCircle2, AlertCircle, HelpCircle, BookOpen } from 'lucide-react';

type QuestionOption = { id?: string; optionText: string; isCorrect: boolean };

type ApiQuestion = {
  id: string;
  questionText: string;
  marks: string;
  orderIndex: number;
  options: QuestionOption[];
};

type ApiExam = {
  id: string;
  title: string;
  totalMarks: string;
  durationMinutes: number;
  startsAt: string;
};

function QuestionForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: Partial<ApiQuestion>;
  onSubmit: (data: { questionText: string; marks: number; options: QuestionOption[] }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [questionText, setQuestionText] = useState(initial?.questionText ?? '');
  const [marks, setMarks] = useState(initial?.marks ?? '1');
  const [options, setOptions] = useState<QuestionOption[]>(
    initial?.options && initial.options.length > 0
      ? initial.options.map(o => ({ optionText: o.optionText, isCorrect: o.isCorrect }))
      : [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  function addOption() {
    setOptions(prev => [...prev, { optionText: '', isCorrect: false }]);
  }

  function removeOption(idx: number) {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, field: keyof QuestionOption, value: string | boolean) {
    setOptions(prev => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  }

  function markCorrect(idx: number) {
    setOptions(prev => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
  }

  function handleSubmit() {
    setFormError(null);
    if (!questionText.trim()) {
      setFormError('Le texte de la question est requis.');
      return;
    }
    const parsedMarks = parseFloat(marks);
    if (isNaN(parsedMarks) || parsedMarks <= 0) {
      setFormError('Les points doivent être un nombre positif.');
      return;
    }
    if (options.length > 0) {
      const emptyOption = options.find(o => !o.optionText.trim());
      if (emptyOption) {
        setFormError('Toutes les options doivent avoir un texte.');
        return;
      }
      if (!options.some(o => o.isCorrect)) {
        setFormError('Sélectionnez au moins une réponse correcte pour les QCM.');
        return;
      }
    }
    onSubmit({ questionText: questionText.trim(), marks: parsedMarks, options });
  }

  return (
    <div className="space-y-4 text-xs">
      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="space-y-1">
        <label className="font-bold text-slate-700 block">Question *</label>
        <textarea
          value={questionText}
          onChange={e => setQuestionText(e.target.value)}
          rows={3}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 resize-none focus:outline-none focus:border-[#2487B8]"
          placeholder="Saisissez le texte de la question..."
        />
      </div>

      <div className="space-y-1 max-w-[140px]">
        <label className="font-bold text-slate-700 block">Points *</label>
        <Input
          type="number"
          min="0.5"
          step="0.5"
          value={marks}
          onChange={e => setMarks(e.target.value)}
          className="h-9 text-xs rounded-xl"
        />
      </div>

      {/* MCQ Options */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-bold text-slate-700">Options (QCM — optionnel)</label>
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= 8}
            className="text-[10px] font-bold text-[#2487B8] hover:underline disabled:opacity-40"
          >
            + Ajouter une option
          </button>
        </div>
        {options.length === 0 && (
          <p className="text-[10px] text-slate-400 italic">
            Sans options → question à réponse ouverte. Avec options → QCM.
          </p>
        )}
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              type="button"
              title={opt.isCorrect ? 'Bonne réponse' : 'Marquer comme correcte'}
              onClick={() => markCorrect(idx)}
              className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                opt.isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-emerald-400'
              }`}
            >
              {opt.isCorrect && <CheckCircle2 className="w-3 h-3 text-white" />}
            </button>
            <Input
              value={opt.optionText}
              onChange={e => updateOption(idx, 'optionText', e.target.value)}
              placeholder={`Option ${idx + 1}`}
              className="h-8 text-xs flex-1 rounded-lg"
            />
            <button
              type="button"
              onClick={() => removeOption(idx)}
              className="text-slate-400 hover:text-rose-500 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <DialogFooter className="gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="rounded-full text-xs h-9">
          Annuler
        </Button>
        <Button variant="primary" disabled={saving} onClick={handleSubmit} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">
          {saving ? 'Enregistrement...' : (initial?.id ? 'Mettre à jour' : 'Ajouter la question')}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function QuestionBankView({ locale }: { locale: string }) {
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiQuestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedExam = exams.find(e => e.id === selectedExamId);

  useEffect(() => {
    setLoadingExams(true);
    fetch('/api/academics/online-exams')
      .then(r => r.json())
      .then((json) => { if (json.success) setExams(json.data); })
      .catch(err => console.error('Failed loading exams', err))
      .finally(() => setLoadingExams(false));
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    setError(null);
    fetch(`/api/academics/online-exams/${selectedExamId}/questions`)
      .then(r => r.json())
      .then((json) => {
        if (json.success) setQuestions(json.data);
        else setError(json.message ?? 'Erreur lors du chargement.');
      })
      .catch(err => { console.error(err); setError('Impossible de charger les questions.'); })
      .finally(() => setLoadingQuestions(false));
  }, [selectedExamId]);

  async function handleAddQuestion(data: { questionText: string; marks: number; options: QuestionOption[] }) {
    if (!selectedExamId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/academics/online-exams/${selectedExamId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? 'Impossible de créer la question.');
        return;
      }
      setQuestions(prev => [...prev, json.data]);
      setIsAddOpen(false);
    } catch (err) {
      console.error(err);
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditQuestion(data: { questionText: string; marks: number; options: QuestionOption[] }) {
    if (!selectedExamId || !editTarget) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/academics/online-exams/${selectedExamId}/questions/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? 'Impossible de modifier la question.');
        return;
      }
      setQuestions(prev => prev.map(q => q.id === editTarget.id ? json.data : q));
      setEditTarget(null);
    } catch (err) {
      console.error(err);
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!selectedExamId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/academics/online-exams/${selectedExamId}/questions/${deleteTarget}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? 'Impossible de supprimer la question.');
        return;
      }
      setQuestions(prev => prev.filter(q => q.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Connexion impossible.');
    } finally {
      setDeleting(false);
    }
  }

  const totalPoints = questions.reduce((sum, q) => sum + parseFloat(q.marks), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            Banque de questions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gérez les questions des examens en ligne par évaluation.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam list panel */}
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <BookOpen className="w-4 h-4 text-[#2487B8]" />
            <h3 className="text-xs font-bold text-[#16212B]">Examens en ligne</h3>
            <span className="ml-auto text-[10px] font-bold text-slate-400">{exams.length}</span>
          </div>
          {loadingExams && (
            <p className="text-[11px] text-slate-400 text-center py-4">Chargement...</p>
          )}
          {!loadingExams && exams.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <BookOpen className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-[11px] text-slate-400">Aucun examen en ligne.</p>
              <a
                href={`/${locale}/dashboard/academics/evaluations`}
                className="text-[10px] font-bold text-[#2487B8] hover:underline"
              >
                Créer un examen
              </a>
            </div>
          )}
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {exams.map(exam => (
              <button
                key={exam.id}
                onClick={() => setSelectedExamId(exam.id === selectedExamId ? null : exam.id)}
                className={`w-full text-left p-3 rounded-xl text-xs transition-all ${
                  selectedExamId === exam.id
                    ? 'bg-[#DCEBF4] border border-[#2487B8]/30 text-[#1B6C93]'
                    : 'bg-slate-50 hover:bg-slate-100 border border-transparent text-slate-700'
                }`}
              >
                <p className="font-bold truncate">{exam.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {exam.totalMarks} pts · {exam.durationMinutes} min
                </p>
              </button>
            ))}
          </div>
        </Card>

        {/* Questions panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedExamId && (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <HelpCircle className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Sélectionnez un examen</p>
              <p className="text-xs text-slate-300">pour voir et gérer ses questions.</p>
            </Card>
          )}

          {selectedExamId && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-[#16212B]">{selectedExam?.title}</h2>
                  <p className="text-[11px] text-slate-500">
                    {questions.length} question(s) · {totalPoints.toFixed(1)}/{selectedExam?.totalMarks} pts total
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="h-9 rounded-full px-4 gap-1.5 text-xs bg-[#0066FF] text-white"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle question
                </Button>
              </div>

              {loadingQuestions && (
                <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 text-center">
                  <p className="text-xs text-slate-400">Chargement des questions...</p>
                </Card>
              )}

              {!loadingQuestions && questions.length === 0 && (
                <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
                  <HelpCircle className="w-8 h-8 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">Aucune question pour cet examen.</p>
                  <p className="text-xs text-slate-300">Commencez par ajouter une question.</p>
                </Card>
              )}

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <Card key={q.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center text-[11px] font-extrabold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#16212B] leading-relaxed">{q.questionText}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[10px] font-bold text-[#2487B8] bg-[#DCEBF4] px-2 py-0.5 rounded-full">
                            {q.marks} pt{parseFloat(q.marks) > 1 ? 's' : ''}
                          </span>
                          {q.options.length > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              QCM · {q.options.length} options
                            </span>
                          )}
                          {q.options.length === 0 && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Réponse ouverte
                            </span>
                          )}
                        </div>
                        {q.options.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className={`flex items-center gap-2 text-[10px] px-2 py-1 rounded-lg ${opt.isCorrect ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.isCorrect ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                {opt.optionText}
                                {opt.isCorrect && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditTarget(q)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#DCEBF4] hover:text-[#1B6C93] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(q.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Question Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              Nouvelle question
            </DialogTitle>
          </DialogHeader>
          <QuestionForm
            onSubmit={handleAddQuestion}
            onCancel={() => setIsAddOpen(false)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              Modifier la question
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <QuestionForm
              initial={editTarget}
              onSubmit={handleEditQuestion}
              onCancel={() => setEditTarget(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              Supprimer la question
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 mt-2">
            Cette action est irréversible. La question et toutes ses options seront supprimées.
          </p>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-full text-xs h-9">
              Annuler
            </Button>
            <Button
              disabled={deleting}
              onClick={handleDeleteQuestion}
              className="rounded-full text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white border-0"
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
