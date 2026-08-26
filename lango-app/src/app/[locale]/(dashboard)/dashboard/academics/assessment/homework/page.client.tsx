'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  Search,
  Filter,
  Award,
  ArrowRight,
  X,
  FileCheck,
  Loader2,
} from 'lucide-react';

interface HomeworkSubmission {
  id: string;
  attemptNumber: number;
  score?: string;
  status: string;
  isLate: boolean;
  responseText?: string;
  feedbackText?: string;
  submittedAt?: string;
}

interface HomeworkItem {
  id: string;
  title: string;
  description?: string;
  maximumScore?: string;
  status: string;
  instructions?: string;
  closeAt?: string;
  submission?: HomeworkSubmission | null;
  linkedResources?: Array<{ id: string; title?: string }>;
  submittedCount?: number;
  gradedCount?: number;
}

interface HomeworkAttempt {
  id: string;
  attemptNumber: number;
  studentId: string;
  studentName: string;
  matricule: string | null;
  responseText?: string | null;
  submittedAt?: string | null;
  isLate: boolean;
  status: string;
  score?: string | null;
  feedbackText?: string | null;
}

interface TeacherBankItem {
  id: string;
  tenantId: string;
  createdById: string;
  title: string;
  content?: string | null;
  attachmentUrl?: string | null;
  tags?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');

  // Modals & Drawers State
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Teacher Correction Inbox State
  const [correctionHw, setCorrectionHw] = useState<HomeworkItem | null>(null);
  const [attempts, setAttempts] = useState<HomeworkAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<HomeworkAttempt | null>(null);

  // Teacher Question Bank State (picker inside "Créer un Devoir")
  const [bankItems, setBankItems] = useState<TeacherBankItem[]>([]);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankSaving, setBankSaving] = useState(false);
  const [bankNewTitle, setBankNewTitle] = useState('');
  const [bankNewContent, setBankNewContent] = useState('');
  const [bankNewTags, setBankNewTags] = useState('');

  // New Homework Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newMaxScore, setNewMaxScore] = useState('20');
  const [newCloseAt, setNewCloseAt] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Teacher Correction Drawer State
  const [gradeScore, setGradeScore] = useState('16');
  const [feedback, setFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  const loadHomeworks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/academics/homework');
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || 'Impossible de charger les devoirs.');
        setHomeworks([]);
      } else if (json.success && Array.isArray(json.data)) {
        const apiItems: HomeworkItem[] = json.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          instructions: item.instructions || item.description || '',
          maximumScore: item.maximumScore != null ? String(item.maximumScore) : '20',
          status: item.status || 'published',
          closeAt: item.closeAt || null,
          submission: item.submission
            ? {
                id: item.submission.id,
                attemptNumber: item.submission.attemptNumber || 1,
                score: item.submission.score != null ? String(item.submission.score) : undefined,
                status: item.submission.status || 'submitted',
                isLate: item.submission.isLate || false,
                responseText: item.submission.responseText || '',
                feedbackText: item.submission.feedbackText || '',
                submittedAt: item.submission.submittedAt || '',
              }
            : null,
          linkedResources: Array.isArray(item.linkedResources) ? item.linkedResources : [],
          submittedCount: item.submittedCount ?? 0,
          gradedCount: item.gradedCount ?? 0,
        }));
        setHomeworks(apiItems);
      } else {
        setHomeworks([]);
      }
    } catch {
      setError('Impossible de charger les devoirs.');
      setHomeworks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeworks();
  }, [loadHomeworks]);

  // Create Homework Handler
  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    setSubmittingCreate(true);

    try {
      const res = await fetch('/api/academics/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          instructions: newInstructions || undefined,
          maximumScore: Number(newMaxScore) || undefined,
          closeAt: newCloseAt ? new Date(newCloseAt).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message || 'Échec de la création du devoir.');
        return;
      }

      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewInstructions('');
      setNewMaxScore('20');
      setNewCloseAt('');
      await loadHomeworks();
    } catch {
      setError('Échec de la création du devoir.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Teacher Question Bank handlers
  const loadBank = async () => {
    setBankLoading(true);
    try {
      const res = await fetch('/api/academics/teacher-question-bank');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setBankItems(json.data);
      }
    } catch {
      // bank is a convenience aid — swallow transient failures
    } finally {
      setBankLoading(false);
    }
  };

  const handleAddToBank = async () => {
    if (!bankNewTitle.trim()) return;
    setBankSaving(true);
    try {
      const res = await fetch('/api/academics/teacher-question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bankNewTitle.trim(),
          content: bankNewContent.trim() || undefined,
          tags: bankNewTags.trim()
            ? bankNewTags.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined,
        }),
      });
      if (res.ok) {
        setBankNewTitle('');
        setBankNewContent('');
        setBankNewTags('');
        await loadBank();
      }
    } catch {
      // swallow — bank is a convenience aid
    } finally {
      setBankSaving(false);
    }
  };

  const handleDeleteBankItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/academics/teacher-question-bank/${itemId}`, { method: 'DELETE' });
      if (res.ok) setBankItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // swallow — bank is a convenience aid
    }
  };

  const useBankItem = (item: TeacherBankItem) => {
    setNewTitle(item.title);
    setNewInstructions(item.content || '');
  };

  const filteredBankItems = bankItems.filter(
    (i) =>
      i.title.toLowerCase().includes(bankSearch.toLowerCase()) ||
      (i.content || '').toLowerCase().includes(bankSearch.toLowerCase()),
  );

  // Open the correction inbox for a homework and load its attempt roster.
  const openCorrection = async (hw: HomeworkItem) => {
    setCorrectionHw(hw);
    setAttempts([]);
    setSelectedAttempt(null);
    setAttemptsLoading(true);
    try {
      const res = await fetch(`/api/academics/homework/${hw.id}/attempts`);
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        const list: HomeworkAttempt[] = json.data;
        setAttempts(list);
        setSelectedAttempt(list[0] ?? null);
        setGradeScore(list[0]?.score || '16');
        setFeedback(list[0]?.feedbackText || '');
      }
    } catch {
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  };

  // Teacher Grade Attempt Handler
  const handleGradeSubmit = async () => {
    if (!selectedAttempt) return;
    setGrading(true);

    try {
      const res = await fetch(`/api/academics/homework/${selectedAttempt.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: Number(gradeScore),
          feedbackText: feedback || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message || 'Échec de l\'enregistrement de la note.');
        return;
      }

      const updated: HomeworkAttempt = {
        ...selectedAttempt,
        score: String(gradeScore),
        status: 'graded',
        feedbackText: feedback || undefined,
      };
      setAttempts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelectedAttempt(updated);
      setFeedback('');
      await loadHomeworks();
    } catch {
      setError('Échec de l\'enregistrement de la note.');
    } finally {
      setGrading(false);
    }
  };

  const totalSubmitted = homeworks.reduce((sum, h) => sum + (h.submittedCount ?? 0), 0);
  const totalGraded = homeworks.reduce((sum, h) => sum + (h.gradedCount ?? 0), 0);
  const pendingCorrection = totalSubmitted - totalGraded;
  const correctionRate = totalSubmitted > 0 ? Math.round((totalGraded / totalSubmitted) * 100) : 0;

  const filteredHomeworks = homeworks.filter((hw) => {
    const matchesSearch =
      hw.title.toLowerCase().includes(search.toLowerCase()) ||
      (hw.description && hw.description.toLowerCase().includes(search.toLowerCase()));

    const submitted = hw.submittedCount ?? 0;
    const graded = hw.gradedCount ?? 0;
    if (activeTab === 'pending') return matchesSearch && submitted === 0;
    if (activeTab === 'submitted') return matchesSearch && submitted > graded;
    if (activeTab === 'graded') return matchesSearch && submitted > 0 && graded >= submitted;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Devoirs &amp; Évaluations Continues
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Création, consignes et correction des devoirs — données réelles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Grand Livre Sync Enregistré</span>
          </Badge>
          <Button
            onClick={() => {
              setShowCreateModal(true);
              loadBank();
            }}
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl shadow-2xs gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Créer un Devoir</span>
          </Button>
        </div>
      </div>

      {/* Stat Summary Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Devoirs</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{homeworks.length}</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Liste réelle du tenant</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Attente de Correction</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{pendingCorrection}</h3>
            <p className="text-[11px] text-amber-600 font-semibold mt-1">Rendus à corriger</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Devoirs Corrigés</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{totalGraded}</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Notes enregistrées au registre</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taux de Correction</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{correctionRate}%</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{totalGraded}/{totalSubmitted} copies corrigées</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher par titre ou consigne..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white h-10 font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
          {(['all', 'pending', 'submitted', 'graded'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#2487B8] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab === 'all'
                ? 'Tous les devoirs'
                : tab === 'pending'
                ? 'Non remis'
                : tab === 'submitted'
                ? 'En attente correction'
                : 'Corrigés'}
            </button>
          ))}
        </div>
      </div>

      {/* Homework Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs font-semibold text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement des devoirs...
        </div>
      ) : error ? (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs text-center">
          <p className="text-xs text-red-600 font-semibold">{error}</p>
        </Card>
      ) : filteredHomeworks.length === 0 ? (
        <Card className="p-10 rounded-2xl border border-slate-200 bg-white shadow-2xs text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2487B8] flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#16212B]">Aucun devoir pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Créez votre premier devoir, les élèves le verront et pourront le rendre depuis leur espace.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHomeworks.map((hw) => {
            const hasSubmissions = (hw.submittedCount ?? 0) > 0;
            const allGraded = hasSubmissions && (hw.gradedCount ?? 0) >= (hw.submittedCount ?? 0);

            return (
              <Card
                key={hw.id}
                className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-[#2487B8]/40 transition-all duration-200 group"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 bg-blue-50 text-[#2487B8] text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100">
                      Devoir
                    </span>

                    {hasSubmissions ? (
                      allGraded ? (
                        <Badge variant="success" className="font-bold text-[11px] px-2.5 py-0.5">
                          {hw.gradedCount} corrigé(s)
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="font-bold text-[11px] px-2.5 py-0.5">
                          {hw.submittedCount} rendu(s) · {hw.gradedCount} corrigé(s)
                        </Badge>
                      )
                    ) : (
                      <Badge variant="warning" className="font-bold text-[11px] px-2.5 py-0.5">
                        Non remis
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-[#16212B] tracking-tight group-hover:text-[#2487B8] transition-colors leading-snug">
                      {hw.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 font-medium leading-relaxed line-clamp-2">
                      {hw.instructions || hw.description}
                    </p>
                  </div>

                  {hw.linkedResources && hw.linkedResources.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-[#2487B8]" />
                      {hw.linkedResources.length} document(s) joint(s)
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#2487B8]" />
                    {hw.closeAt ? new Date(hw.closeAt).toLocaleDateString('fr-FR') : 'Sans date limite'}
                  </span>

                  {hasSubmissions && (
                    <Button
                      size="sm"
                      onClick={() => openCorrection(hw)}
                      className="rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs shadow-2xs gap-1.5 px-4"
                    >
                      <span>Corriger</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Teacher Create Homework */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-[#16212B]">Créer un Devoir / Exercice</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHomework} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Titre du Devoir</label>
                <Input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Devoir de Vocabulaire - Unit 5 Essay"
                  className="mt-1 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Objectif du Devoir</label>
                <Input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Objectif pédagogique principal..."
                  className="mt-1 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Consignes &amp; Directives</label>
                <textarea
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Écrivez les consignes claires pour les élèves..."
                  rows={3}
                  className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Note Max (/20)</label>
                  <Input
                    type="number"
                    value={newMaxScore}
                    onChange={(e) => setNewMaxScore(e.target.value)}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Date Limite de Rendu</label>
                  <Input
                    type="date"
                    value={newCloseAt}
                    onChange={(e) => setNewCloseAt(e.target.value)}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setBankOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#2487B8]" />
                    Banque de questions
                  </span>
                  <span className="text-slate-400 text-[10px]">{bankOpen ? 'Masquer' : 'Afficher'}</span>
                </button>

                {bankOpen && (
                  <div className="border-t border-slate-200 p-3 space-y-2.5 bg-slate-50/40">
                    <Input
                      type="text"
                      placeholder="Rechercher dans la banque..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      className="text-xs rounded-lg"
                    />

                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {bankLoading ? (
                        <p className="text-[11px] font-semibold text-slate-400 py-2">Chargement...</p>
                      ) : filteredBankItems.length === 0 ? (
                        <p className="text-[11px] font-semibold text-slate-400 py-2">Aucune question enregistrée.</p>
                      ) : (
                        filteredBankItems.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                              {item.content ? <p className="text-[11px] text-slate-500 line-clamp-1">{item.content}</p> : null}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => useBankItem(item)} className="text-[10px] font-bold text-[#2487B8] hover:underline cursor-pointer">Utiliser</button>
                              <button type="button" onClick={() => handleDeleteBankItem(item.id)} className="p-0.5 text-slate-300 hover:text-red-500 cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ajouter à la banque</p>
                      <Input
                        type="text"
                        placeholder="Titre de la question"
                        value={bankNewTitle}
                        onChange={(e) => setBankNewTitle(e.target.value)}
                        className="text-xs rounded-lg"
                      />
                      <textarea
                        value={bankNewContent}
                        onChange={(e) => setBankNewContent(e.target.value)}
                        placeholder="Énoncé / consigne..."
                        rows={2}
                        className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="Tags (séparés par des virgules)"
                          value={bankNewTags}
                          onChange={(e) => setBankNewTags(e.target.value)}
                          className="text-xs rounded-lg flex-1"
                        />
                        <Button type="button" size="sm" onClick={handleAddToBank} disabled={bankSaving} className="rounded-lg text-xs shrink-0">
                          {bankSaving ? 'Ajout...' : 'Ajouter'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submittingCreate}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs"
                >
                  {submittingCreate ? 'Création...' : 'Publier le Devoir'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction Inbox: left roster + fixed reading/grading panel */}
      {correctionHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl border border-slate-200 shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Left: roster */}
            <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/50">
              <div className="p-4 border-b border-slate-200 bg-white">
                <Badge variant="info" className="text-[10px] font-bold uppercase">
                  Boîte de correction
                </Badge>
                <h2 className="text-base font-extrabold text-[#16212B] mt-1 leading-snug">{correctionHw.title}</h2>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{attempts.length} rendu(s)</p>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {attemptsLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-xs font-semibold text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement...
                  </div>
                ) : attempts.length === 0 ? (
                  <div className="p-6 text-center text-xs font-semibold text-slate-400">
                    {"Aucun élève n'a encore rendu ce devoir."}
                  </div>
                ) : (
                  attempts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedAttempt(a);
                        setGradeScore(a.score || '16');
                        setFeedback(a.feedbackText || '');
                      }}
                      className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all cursor-pointer ${
                        selectedAttempt?.id === a.id
                          ? 'bg-[#2487B8] text-white border-[#2487B8] shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-[#2487B8]/40 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate">{a.studentName}</span>
                        <span className="shrink-0">
                          {a.status === 'graded' ? (
                            <Badge variant="success" className="text-[10px] font-bold px-1.5 py-0">Corrigé</Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px] font-bold px-1.5 py-0">À corriger</Badge>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`text-[10px] font-semibold ${selectedAttempt?.id === a.id ? 'text-white/80' : 'text-slate-400'}`}>
                          {a.matricule || '—'} · tentative n°{a.attemptNumber}
                        </span>
                        <span className={`text-[10px] font-bold ${selectedAttempt?.id === a.id ? 'text-white/90' : a.isLate ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {a.status === 'graded' ? `${a.score} pts` : a.isLate ? 'En retard' : 'À temps'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: reading + grading panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedAttempt ? (
                <>
                  <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#16212B]">{selectedAttempt.studentName}</h3>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {selectedAttempt.matricule || 'Sans matricule'} · tentative n°{selectedAttempt.attemptNumber}
                        {selectedAttempt.submittedAt ? ` · ${new Date(selectedAttempt.submittedAt).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                    <button onClick={() => setCorrectionHw(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase">{"Texte remis par l'élève:"}</label>
                      <p className="text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60 font-mono whitespace-pre-wrap">
                        {selectedAttempt.responseText || 'Aucun texte fourni.'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">
                          Note Attribuée (sur {correctionHw.maximumScore})
                        </label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max={correctionHw.maximumScore}
                          value={gradeScore}
                          onChange={(e) => setGradeScore(e.target.value)}
                          className="mt-1 text-xs rounded-xl font-bold text-[#2487B8] h-10 text-base"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">Commentaires &amp; Correction du Professeur</label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Saisissez vos remarques pédagogiques, corrections de syntaxe et conseils..."
                          rows={4}
                          className="mt-1 w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                    <Button variant="ghost" onClick={() => setCorrectionHw(null)} className="text-xs rounded-xl">
                      Fermer
                    </Button>
                    <Button
                      onClick={handleGradeSubmit}
                      disabled={grading}
                      className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>{grading ? 'Enregistrement...' : 'Enregistrer & Valider la Note'}</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <FileText className="w-8 h-8" />
                  <p className="text-xs font-semibold">{"Sélectionnez un élève pour corriger sa copie."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
