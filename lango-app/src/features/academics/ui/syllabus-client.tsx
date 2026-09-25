'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  BookOpen, FileText, Download, Upload, Plus, Search, Video, Sparkles,
  Save, Trash2, CheckCircle2, Clock, AlertCircle, RefreshCw,
} from 'lucide-react';
import type { Resource, Chapter } from '../data/syllabus-config';

type ClassSubjectOption = {
  id: string;
  className: string;
  subjectName: string;
  curriculumLabel?: string | null;
};

// Default Moroccan curriculum outline for 1-click syllabus initialization. A new
// syllabus starts with every chapter Upcoming and no files: the template used to
// mark chapters Completed/In Progress and attach PDFs that did not exist.
function getDefaultCurriculumForSubject(subjectName: string): Chapter[] {
  const norm = subjectName.toLowerCase();
  if (norm.includes('math')) {
    return [
      { id: `c-${Date.now()}-1`, number: 1, title: 'Limites et Continuité des Fonctions Numériques', status: 'Upcoming', hoursAllocated: 12, resources: [] },
      { id: `c-${Date.now()}-2`, number: 2, title: 'Dérivabilité et Étude des Fonctions Logarithmes', status: 'Upcoming', hoursAllocated: 16, resources: [] },
      { id: `c-${Date.now()}-3`, number: 3, title: 'Suites Numériques & Raisonnement par Récurrence', status: 'Upcoming', hoursAllocated: 14, resources: [] },
      { id: `c-${Date.now()}-4`, number: 4, title: 'Fonctions Exponentielles et Primitives', status: 'Upcoming', hoursAllocated: 16, resources: [] },
      { id: `c-${Date.now()}-5`, number: 5, title: 'Calcul Intégral et Équations Différentielles', status: 'Upcoming', hoursAllocated: 18, resources: [] },
    ];
  }
  if (norm.includes('phys') || norm.includes('chim')) {
    return [
      { id: `c-${Date.now()}-1`, number: 1, title: 'Ondes Mécaniques Progressives et Périodiques', status: 'Upcoming', hoursAllocated: 10, resources: [] },
      { id: `c-${Date.now()}-2`, number: 2, title: 'Décroissance Radioactive et Réactions Nucléaires', status: 'Upcoming', hoursAllocated: 12, resources: [] },
      { id: `c-${Date.now()}-3`, number: 3, title: 'Circuits Électriques : Dipôles RC, RL et RLC', status: 'Upcoming', hoursAllocated: 16, resources: [] },
      { id: `c-${Date.now()}-4`, number: 4, title: 'Transformations Chimiques Rapides et Lentes', status: 'Upcoming', hoursAllocated: 14, resources: [] },
    ];
  }
  if (norm.includes('anglais') || norm.includes('english')) {
    return [
      { id: `c-${Date.now()}-1`, number: 1, title: 'Unit 1: Cultural Heritage & Globalization', status: 'Upcoming', hoursAllocated: 10, resources: [] },
      { id: `c-${Date.now()}-2`, number: 2, title: 'Unit 2: Education & Future Careers', status: 'Upcoming', hoursAllocated: 12, resources: [] },
      { id: `c-${Date.now()}-3`, number: 3, title: 'Unit 3: Science, Technology and Society', status: 'Upcoming', hoursAllocated: 14, resources: [] },
    ];
  }
  if (norm.includes('franç') || norm.includes('litt')) {
    return [
      { id: `c-${Date.now()}-1`, number: 1, title: 'Le Réalisme et le Naturalisme au XIXe Siècle', status: 'Upcoming', hoursAllocated: 12, resources: [] },
      { id: `c-${Date.now()}-2`, number: 2, title: 'La Poésie Moderne et Symboliste', status: 'Upcoming', hoursAllocated: 10, resources: [] },
      { id: `c-${Date.now()}-3`, number: 3, title: 'Le Théâtre Classique et la Tragédie', status: 'Upcoming', hoursAllocated: 14, resources: [] },
    ];
  }
  return [
    { id: `c-${Date.now()}-1`, number: 1, title: 'Module 1 : Notions Fondamentales et Diagnostic', status: 'Upcoming', hoursAllocated: 10, resources: [] },
    { id: `c-${Date.now()}-2`, number: 2, title: 'Module 2 : Approfondissement et Travaux Dirigés', status: 'Upcoming', hoursAllocated: 14, resources: [] },
    { id: `c-${Date.now()}-3`, number: 3, title: 'Module 3 : Synthèse, Projets et Préparation aux Évaluations', status: 'Upcoming', hoursAllocated: 12, resources: [] },
  ];
}

export function SyllabusClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');

  const [classSubjects, setClassSubjects] = useState<ClassSubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [search, setSearch] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Modals state
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [isUploadResourceOpen, setIsUploadResourceOpen] = useState(false);

  const [newChapter, setNewChapter] = useState({
    title: '',
    hoursAllocated: '12',
    status: 'Upcoming' as Chapter['status'],
  });

  const [newResource, setNewResource] = useState({
    chapterId: '',
    name: '',
    type: 'pdf' as Resource['type'],
    url: '',
  });

  // Load real subjects from API
  useEffect(() => {
    async function loadRealSubjects() {
      setLoadingSubjects(true);
      try {
        const res = await fetch('/api/academics/class-subjects?pageSize=100');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const list: ClassSubjectOption[] = json.data.map((r: any) => ({
            id: r.id,
            className: r.className || 'Classe',
            subjectName: r.subjectName || 'Matière',
            curriculumLabel: r.curriculumLabel,
          }));
          setClassSubjects(list);
          setSelectedSubjectId(list[0]?.id ?? '');
        }
      } catch (err) {
        console.error('Failed to load class subjects', err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadRealSubjects();
  }, []);

  // Load syllabus for selected subject
  const loadSyllabus = useCallback(async (classSubjectId: string) => {
    if (!classSubjectId) return;
    setLoadingChapters(true);
    try {
      const res = await fetch(`/api/academics/syllabus?classSubjectId=${classSubjectId}`);
      const json = await res.json();
      if (json.success && json.data?.chapters) {
        setChapters(json.data.chapters);
        setLastSaved(json.data.updatedAt ? new Date(json.data.updatedAt).toLocaleTimeString() : null);
      } else {
        setChapters([]);
      }
    } catch (err) {
      console.error('Failed to load syllabus', err);
      setChapters([]);
    } finally {
      setLoadingChapters(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      loadSyllabus(selectedSubjectId);
    }
  }, [selectedSubjectId, loadSyllabus]);

  const selectedOffering = classSubjects.find(cs => cs.id === selectedSubjectId);

  // Save changes to DB
  const handleSaveSyllabus = async (chaptersToSave = chapters) => {
    if (!selectedSubjectId) return;
    startTransition(async () => {
      try {
        const res = await fetch('/api/academics/syllabus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classSubjectId: selectedSubjectId,
            chapters: chaptersToSave,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setSaveSuccess(true);
          setLastSaved(new Date().toLocaleTimeString());
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } catch (err) {
        console.error('Failed to save syllabus', err);
      }
    });
  };

  const handleInitializeCurriculum = () => {
    if (!selectedOffering) return;
    const defaultChapters = getDefaultCurriculumForSubject(selectedOffering.subjectName);
    setChapters(defaultChapters);
    handleSaveSyllabus(defaultChapters);
  };

  const filteredChapters = chapters.map(c => ({
    ...c,
    resources: (c.resources || []).filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase());
      const matchesType = resourceTypeFilter === 'all' || r.type === resourceTypeFilter;
      return matchesSearch && matchesType;
    }),
  })).filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.resources.length > 0 || search === '');

  const completedCount = chapters.filter(c => c.status === 'Completed').length;
  const progressPct = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;

  const handleCreateChapter = () => {
    if (!newChapter.title.trim()) return;
    const created: Chapter = {
      id: `c-${Date.now()}`,
      number: chapters.length + 1,
      title: newChapter.title.trim(),
      status: newChapter.status,
      hoursAllocated: Number(newChapter.hoursAllocated) || 10,
      resources: [],
    };
    const updated = [...chapters, created];
    setChapters(updated);
    setIsAddChapterOpen(false);
    setNewChapter({ title: '', hoursAllocated: '12', status: 'Upcoming' });
    handleSaveSyllabus(updated);
  };

  const handleDeleteChapter = (chapterId: string) => {
    const updated = chapters
      .filter(c => c.id !== chapterId)
      .map((c, idx) => ({ ...c, number: idx + 1 }));
    setChapters(updated);
    handleSaveSyllabus(updated);
  };

  const handleAddResource = () => {
    // No file storage behind this dialog: a resource is a link to where the file
    // lives (drive, video, website), so it always opens something real.
    const url = newResource.url.trim();
    if (!newResource.name.trim() || !newResource.chapterId || !/^https?:\/\/\S+$/i.test(url)) return;
    const res: Resource = {
      id: `r-${Date.now()}`,
      name: newResource.name.trim(),
      type: newResource.type,
      url,
    };
    const updated = chapters.map(c => c.id === newResource.chapterId ? { ...c, resources: [...(c.resources || []), res] } : c);
    setChapters(updated);
    setIsUploadResourceOpen(false);
    setNewResource({ chapterId: '', name: '', type: 'pdf', url: '' });
    handleSaveSyllabus(updated);
  };

  const handleDeleteResource = (chapterId: string, resourceId: string) => {
    const updated = chapters.map(c => c.id === chapterId ? { ...c, resources: c.resources.filter(r => r.id !== resourceId) } : c);
    setChapters(updated);
    handleSaveSyllabus(updated);
  };

  const handleStatusChange = (chapterId: string, status: Chapter['status']) => {
    const updated = chapters.map(c => c.id === chapterId ? { ...c, status } : c);
    setChapters(updated);
    handleSaveSyllabus(updated);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('syllabusTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('syllabusSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastSaved && (
            <span className="text-[11px] font-semibold text-slate-400 me-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Enregistré à {lastSaved}
            </span>
          )}
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enregistré
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || chapters.length === 0}
            onClick={() => setIsUploadResourceOpen(true)}
            className="h-10 rounded-xl px-3 gap-2 border-slate-200 text-xs font-bold"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>{t('btnUploadResource')}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddChapterOpen(true)}
            className="h-10 rounded-xl px-3 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('btnAddChapter')}</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => handleSaveSyllabus()}
            className="h-10 rounded-xl px-3 gap-2 bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-2xs"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? 'Enregistrement...' : 'Enregistrer'}</span>
          </Button>
        </div>
      </div>

      {/* Subject Filter & Real DB Classes */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500">{t('subjectProgramLabel')}</span>
            {loadingSubjects ? (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Chargement des matières réelles...
              </span>
            ) : classSubjects.length === 0 ? (
              <span className="text-xs text-rose-500 font-semibold">Aucune matière de classe trouvée.</span>
            ) : (
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-extrabold bg-white text-[#16212B] min-w-[280px]"
              >
                {classSubjects.map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {cs.subjectName} — {cs.className} {cs.curriculumLabel ? `(${cs.curriculumLabel})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500 font-bold">{t('annualProgressLabel')}</span>
            <div className="w-44 bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#2487B8] h-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
            <strong className="text-[#2487B8]">
              {progressPct}% complété ({completedCount}/{chapters.length} chapitres)
            </strong>
          </div>
        </div>
      </Card>

      {/* Empty State when no chapters exist */}
      {!loadingChapters && chapters.length === 0 && (
        <Card className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#16212B]">Aucun chapitre configuré pour cette matière</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Vous pouvez initialiser le programme officiel type en 1 clic ou créer vos chapitres manuellement.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              onClick={handleInitializeCurriculum}
              className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Initialiser le Programme Type</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAddChapterOpen(true)}
              className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold text-slate-700"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un Chapitre</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Search & Resource Filter Toolbar */}
      {chapters.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('searchChapterPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: tCommon('all') },
              { id: 'pdf', label: t('filterPdfs') },
              { id: 'video', label: t('filterVideos') },
              { id: 'link', label: t('filterLinks') },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setResourceTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  resourceTypeFilter === f.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chapters Breakdown */}
      <div className="space-y-4">
        {filteredChapters.map(chap => (
          <Card key={chap.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                  chap.status === 'Completed' ? 'bg-[#DDF5EC] text-[#17A673]' :
                  chap.status === 'In Progress' ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'bg-slate-100 text-slate-500'
                }`}>
                  {chap.number}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#16212B]">{chap.title}</h3>
                  <p className="text-[10px] text-slate-400">
                    Volume horaire: {chap.hoursAllocated}h d&apos;enseignement • {chap.resources.length} fichiers joints
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select value={chap.status} onValueChange={val => handleStatusChange(chap.id, val as Chapter['status'])}>
                  <SelectTrigger className="h-8 text-xs font-bold rounded-xl w-32 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed">{t('statusCompleted')}</SelectItem>
                    <SelectItem value="In Progress">{t('statusInProgress')}</SelectItem>
                    <SelectItem value="Upcoming">{t('statusUpcoming')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteChapter(chap.id)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  title="Supprimer le chapitre"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Resources list */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Supports d&apos;apprentissage ({chap.resources.length})
                </p>
                <button
                  onClick={() => {
                    setNewResource(prev => ({ ...prev, chapterId: chap.id }));
                    setIsUploadResourceOpen(true);
                  }}
                  className="text-[10px] font-bold text-[#2487B8] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Ajouter un document
                </button>
              </div>

              {chap.resources.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun document joint à ce chapitre.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {chap.resources.map((res) => (
                    <div key={res.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center gap-2 truncate">
                        {res.type === 'video' ? (
                          <Video className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#2487B8] shrink-0" />
                        )}
                        <span className="truncate font-semibold text-[#16212B]">{res.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {res.url && (
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-[#2487B8]">
                            <a href={res.url} target="_blank" rel="noopener noreferrer" download aria-label={res.name}>
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteResource(chap.id, res.id)}
                          className="h-7 w-7 p-0 text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Ajouter un Chapitre Modal Dialog */}
      <Dialog open={isAddChapterOpen} onOpenChange={setIsAddChapterOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 text-start">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2487B8]" />
              {t('addChapterModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('chapterTitleLabel')}</label>
              <Input
                placeholder={t('chapterTitlePlaceholder')}
                value={newChapter.title}
                onChange={e => setNewChapter({ ...newChapter, title: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('chapterHoursLabel')}</label>
                <Input
                  type="number"
                  value={newChapter.hoursAllocated}
                  onChange={e => setNewChapter({ ...newChapter, hoursAllocated: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('initialStatusLabel')}</label>
                <Select value={newChapter.status} onValueChange={val => setNewChapter({ ...newChapter, status: val as Chapter['status'] })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Upcoming">{t('statusUpcoming')}</SelectItem>
                    <SelectItem value="In Progress">{t('statusInProgress')}</SelectItem>
                    <SelectItem value="Completed">{t('statusCompleted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddChapterOpen(false)} className="rounded-xl text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreateChapter} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              {t('btnCreateChapter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Déposer une Ressource Modal Dialog */}
      <Dialog open={isUploadResourceOpen} onOpenChange={setIsUploadResourceOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 text-start">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#2487B8]" />
              {t('uploadResourceModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('targetChapterLabel')}</label>
              <Select value={newResource.chapterId} onValueChange={val => setNewResource({ ...newResource, chapterId: val })}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder={t('selectChapterPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {t('targetChapterOption', { number: c.number, title: c.title.slice(0, 35) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('fileNameLabel')}</label>
              <Input
                placeholder={t('fileNamePlaceholder')}
                value={newResource.name}
                onChange={e => setNewResource({ ...newResource, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('docTypeLabel')}</label>
                <Select value={newResource.type} onValueChange={val => setNewResource({ ...newResource, type: val as Resource['type'] })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">{t('docTypePdf')}</SelectItem>
                    <SelectItem value="video">{t('docTypeVideo')}</SelectItem>
                    <SelectItem value="link">{t('docTypeLink')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('resourceUrlLabel')}</label>
                <Input
                  type="url"
                  required
                  placeholder="https://"
                  value={newResource.url}
                  onChange={e => setNewResource({ ...newResource, url: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsUploadResourceOpen(false)} className="rounded-xl text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleAddResource} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              {t('btnAddFile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
