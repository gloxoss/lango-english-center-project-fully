'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  BookOpen, Plus, Clock, Search, ArrowRight, Loader2, LibraryBig, FileWarning,
} from 'lucide-react';
import Link from 'next/link';

type TeacherHomework = {
  id: string;
  title: string;
  description: string | null;
  maximumScore: string | null;
  coefficient: string | null;
  status: string;
  createdAt: string;
  subjectName: string | null;
  className: string | null;
  instructions: string | null;
  closeAt: string | null;
  submittedCount: number;
  gradedCount: number;
};

type BankItem = {
  id: string;
  questionText: string;
  marks: string | null;
  subjectId: string | null;
  subjectName: string | null;
  difficulty: string | null;
};

function isClosed(hw: TeacherHomework): boolean {
  if (hw.status === 'closed' || hw.status === 'archived') return true;
  return !!hw.closeAt && new Date(hw.closeAt).getTime() < Date.now();
}

function formatDeadline(closeAt: string | null): string {
  if (!closeAt) return 'Sans date limite';
  const d = new Date(closeAt);
  return `À rendre le ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function HomeworkClient({ locale }: { locale?: string } = {}) {
  const [homeworkList, setHomeworkList] = useState<TeacherHomework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'Active' | 'Closed' | 'All'>('Active');
  const [search, setSearch] = useState('');

  // Bank questions (reusable across devoirs).
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [bankLoading, setBankLoading] = useState(true);

  // Create modal state.
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [maximumScore, setMaximumScore] = useState('20');
  const [closeAt, setCloseAt] = useState('');
  const [subjectId, setSubjectId] = useState<string>('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadHomework = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/academics/homework');
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message || 'Impossible de charger les devoirs.');
        setHomeworkList([]);
        return;
      }
      const items: TeacherHomework[] = Array.isArray(json.data)
        ? json.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description ?? null,
            maximumScore: item.maximumScore != null ? String(item.maximumScore) : null,
            coefficient: item.coefficient != null ? String(item.coefficient) : null,
            status: item.status ?? 'published',
            createdAt: item.createdAt ?? '',
            subjectName: item.subjectName ?? null,
            className: item.className ?? null,
            instructions: item.instructions ?? null,
            closeAt: item.closeAt ?? null,
            submittedCount: Number(item.submittedCount ?? 0),
            gradedCount: Number(item.gradedCount ?? 0),
          }))
        : [];
      setHomeworkList(items);
    } catch {
      setError('Impossible de charger les devoirs.');
      setHomeworkList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch('/api/academics/question-bank?pageSize=200');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setBankItems(json.data.map((item: any) => ({
          id: item.id,
          questionText: item.questionText,
          marks: item.marks != null ? String(item.marks) : null,
          subjectId: item.subjectId ?? null,
          subjectName: item.subjectName ?? null,
          difficulty: item.difficulty ?? null,
        })));
      }
    } catch {
      // Non-fatal: the bank is only needed inside the create modal.
    } finally {
      setBankLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomework();
    loadBank();
  }, [loadHomework, loadBank]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bankItems) {
      if (b.subjectId && b.subjectName && !map.has(b.subjectId)) map.set(b.subjectId, b.subjectName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bankItems]);

  const filteredBankItems = useMemo(() => {
    if (subjectId === 'all') return bankItems;
    return bankItems.filter(b => b.subjectId === subjectId);
  }, [bankItems, subjectId]);

  const selectedQuestions = useMemo(
    () => bankItems.filter(b => selectedQuestionIds.has(b.id)),
    [bankItems, selectedQuestionIds],
  );

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = homeworkList.filter(hw => {
    const matchesSearch = hw.title.toLowerCase().includes(search.toLowerCase())
      || (hw.subjectName ?? '').toLowerCase().includes(search.toLowerCase())
      || (hw.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' || (activeTab === 'Closed' ? isClosed(hw) : !isClosed(hw));
    return matchesSearch && matchesTab;
  });

  const activeCount = homeworkList.filter(hw => !isClosed(hw)).length;
  const submissionRate = homeworkList.length > 0
    ? Math.round((homeworkList.filter(hw => hw.submittedCount > 0).length / homeworkList.length) * 100)
    : 0;
  const pendingGrade = homeworkList.reduce((sum, hw) => sum + (hw.submittedCount - hw.gradedCount), 0);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setInstructions('');
    setMaximumScore('20');
    setCloseAt('');
    setSubjectId('all');
    setSelectedQuestionIds(new Set());
    setCreateError('');
  };

  const handleCreateHomework = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const parts: string[] = [];
      if (instructions.trim()) parts.push(instructions.trim());
      if (selectedQuestions.length > 0) {
        const bankLines = selectedQuestions.map((q, i) => `${i + 1}. ${q.questionText}${q.marks ? ` (${q.marks} pt${Number(q.marks) > 1 ? 's' : ''})` : ''}`);
        parts.push(`Questions tirées de la banque :\n${bankLines.join('\n')}`);
      }
      const fullInstructions = parts.length > 0 ? parts.join('\n\n') : undefined;

      const res = await fetch('/api/academics/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          instructions: fullInstructions,
          maximumScore: Number(maximumScore) || undefined,
          coefficient: 1,
          allowAttachments: true,
          maxAttachments: 3,
          lateSubmissionPolicy: 'accept_flag',
          closeAt: closeAt ? new Date(closeAt).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setCreateError(json?.error?.message || 'Échec de la création du devoir.');
        return;
      }

      setIsAddModalOpen(false);
      resetForm();
      await loadHomework();
    } catch {
      setCreateError('Échec de la création du devoir.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Hub Devoirs & Travaux à Rendre</h1>
          <p className="text-xs text-slate-500 mt-1">Création de devoirs, suivi des remises en ligne par classe et évaluation des devoirs.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau devoir / travail</span>
          </Button>
        </div>
      </div>

      {/* Top 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Devoirs Actifs en Cours</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{activeCount} Devoirs</p>
          <p className="text-[10px] text-slate-400">Toutes classes confondues</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">Devoirs avec Remise</p>
          <p className="text-2xl font-extrabold text-[#17A673]">{submissionRate}%</p>
          <p className="text-[10px] text-slate-400">Ayant reçu au moins une soumission</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-amber-200/60 bg-amber-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-amber-700">Copies À Évaluer (Correcteur)</p>
          <p className="text-2xl font-extrabold text-amber-900">{pendingGrade} Copies</p>
          <p className="text-[10px] text-amber-600">En attente de notation</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['Active', 'Closed', 'All'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                activeTab === tab ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'Active' ? 'Devoirs en cours' : tab === 'Closed' ? 'Devoirs clôturés' : 'Tous les devoirs'}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par titre ou matière..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </div>

      {/* Homework Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs font-semibold text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement des devoirs...
        </div>
      ) : error ? (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs text-center">
          <p className="text-xs text-red-600 font-semibold">{error}</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 rounded-2xl border border-slate-200 bg-white shadow-2xs text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2487B8] flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#16212B]">Aucun devoir trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Créez votre premier devoir — les élèves le verront et pourront le rendre depuis leur espace.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(hw => {
            const gradedPct = hw.submittedCount > 0 ? Math.round((hw.gradedCount / hw.submittedCount) * 100) : 0;
            return (
              <Card key={hw.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#DCEBF4] text-[#1B6C93] truncate">
                      {hw.subjectName ?? 'Sans matière'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{hw.className ?? 'Toutes classes'}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-[#16212B] line-clamp-2">{hw.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDeadline(hw.closeAt)}
                    </p>
                  </div>

                  {/* Submission progress (graded vs received) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-bold">Remises reçues:</span>
                      <strong className="text-[#2487B8]">{hw.submittedCount} remise(s)</strong>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#2487B8] h-full" style={{ width: `${gradedPct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {hw.gradedCount} corrigée(s) · Note sur {hw.maximumScore ?? 20}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-bold">{hw.coefficient ? `Coefficient ${hw.coefficient}` : 'Travail maison'}</span>
                  <Link href={`/${locale || 'fr'}/dashboard/homework/submissions`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-[#2487B8] hover:bg-[#DCEBF4]/40 gap-1">
                      <span>Consulter les remises</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Nouveau Devoir Modal Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => { setIsAddModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2487B8]" />
              Créer un nouveau devoir / TP
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre du devoir *</label>
              <Input
                placeholder="Ex. DM n°5 : Calcul d'intégrales & probabilités"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Objectif pédagogique</label>
              <Input
                placeholder="Ex. Réviser les intégrales et les probabilités"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Note Max</label>
                <Input
                  type="number"
                  min="1"
                  value={maximumScore}
                  onChange={e => setMaximumScore(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date limite de remise</label>
                <Input
                  type="date"
                  value={closeAt}
                  onChange={e => setCloseAt(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Consignes & Directives</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Écrivez les consignes claires pour les élèves..."
                rows={3}
                className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
              />
            </div>

            {/* Question bank picker */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <LibraryBig className="w-4 h-4 text-[#2487B8]" />
                  Banque de questions
                </label>
                {selectedQuestions.length > 0 && (
                  <span className="text-[10px] font-bold text-[#1B6C93] bg-[#DCEBF4] px-2 py-0.5 rounded-full">
                    {selectedQuestions.length} sélectionnée(s)
                  </span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1 text-[11px]">Filtrer par matière</label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les matières</SelectItem>
                    {subjectOptions.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {bankLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Chargement de la banque...
                </div>
              ) : filteredBankItems.length === 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold py-2">
                  <FileWarning className="w-3.5 h-3.5" />
                  Aucune question dans la banque pour cette matière.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {filteredBankItems.map(q => (
                    <label
                      key={q.id}
                      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                        selectedQuestionIds.has(q.id) ? 'bg-white border-[#2487B8]' : 'bg-white border-slate-200 hover:border-[#2487B8]/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedQuestionIds.has(q.id)}
                        onCheckedChange={() => toggleQuestion(q.id)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 text-[11px] leading-snug text-slate-700 font-medium">{q.questionText}</span>
                      {q.marks && <span className="text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">{q.marks} pt</span>}
                    </label>
                  ))}
                </div>
              )}

              {selectedQuestions.length > 0 && (
                <p className="text-[10px] text-[#1B6C93] font-semibold">
                  Les questions sélectionnées seront insérées numérotées dans les consignes du devoir.
                </p>
              )}
            </div>

            {createError && (
              <p className="text-xs text-red-600 font-semibold">{createError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button
              onClick={handleCreateHomework}
              disabled={creating || !title.trim()}
              className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              {creating ? 'Publication...' : 'Publier le devoir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
