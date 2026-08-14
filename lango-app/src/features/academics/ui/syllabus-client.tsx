'use client';

import { useState } from 'react';
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
  BookOpen, FileText, Download, Upload, Plus, Search, Video,
} from 'lucide-react';
import { Resource, Chapter, MOCK_CHAPTERS } from '../data/syllabus-config';

export function SyllabusClient({ locale: _locale }: { locale?: string } = {}) {
  const [selectedSubject, setSelectedSubject] = useState('Mathématiques - 2BAC-A');
  const [chapters, setChapters] = useState<Chapter[]>(MOCK_CHAPTERS);
  const [search, setSearch] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');

  // Modals state
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [isUploadResourceOpen, setIsUploadResourceOpen] = useState(false);

  const [newChapter, setNewChapter] = useState({
    title: '',
    hoursAllocated: '12',
    status: 'Upcoming' as Chapter['status'],
  });

  const [newResource, setNewResource] = useState({
    chapterId: '1',
    name: '',
    type: 'pdf' as Resource['type'],
    size: '1.5 MB',
  });

  const filteredChapters = chapters.map(c => ({
    ...c,
    resources: c.resources.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase());
      const matchesType = resourceTypeFilter === 'all' || r.type === resourceTypeFilter;
      return matchesSearch && matchesType;
    }),
  })).filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.resources.length > 0 || search === '');

  const completedCount = chapters.filter(c => c.status === 'Completed').length;
  const progressPct = Math.round((completedCount / chapters.length) * 100);

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
    setChapters(prev => [...prev, created]);
    setIsAddChapterOpen(false);
    setNewChapter({ title: '', hoursAllocated: '12', status: 'Upcoming' });
  };

  const handleAddResource = () => {
    if (!newResource.name.trim()) return;
    const res: Resource = {
      id: `r-${Date.now()}`,
      name: newResource.name.trim(),
      type: newResource.type,
      size: newResource.size,
    };
    setChapters(prev => prev.map(c => c.id === newResource.chapterId ? { ...c, resources: [...c.resources, res] } : c));
    setIsUploadResourceOpen(false);
    setNewResource({ chapterId: '1', name: '', type: 'pdf', size: '1.5 MB' });
  };

  const handleStatusChange = (chapterId: string, status: Chapter['status']) => {
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status } : c));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Progression Pédagogique & Ressources de Cours</h1>
          <p className="text-xs text-slate-500 mt-1">Gestion du programme scolaire par chapitre, ressources téléchargeables et supports pédagogiques.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUploadResourceOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Déposer une ressource</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddChapterOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un chapitre</span>
          </Button>
        </div>
      </div>

      {/* Subject Filter & Top Progress Bar */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">Matière / Programme:</span>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-extrabold bg-white text-[#16212B]"
            >
              <option value="Mathématiques - 2BAC-A">Mathématiques - 2BAC-A</option>
              <option value="Physique-Chimie - 2BAC-B">Physique-Chimie - 2BAC-B</option>
              <option value="Français - 1BAC-A">Français - 1BAC-A</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500 font-bold">Avancement Annuel:</span>
            <div className="w-48 bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#2487B8] h-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <strong className="text-[#2487B8]">{progressPct}% complété ({completedCount}/{chapters.length} chapitres)</strong>
          </div>
        </div>
      </Card>

      {/* Search & Resource Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Filtrer chapitre ou document..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'pdf', label: '📄 PDFs' },
            { id: 'video', label: '🎥 Vidéos' },
            { id: 'link', label: '🔗 Liens' },
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
                  <p className="text-[10px] text-slate-400">Volume horaire: {chap.hoursAllocated}h d&apos;enseignement • {chap.resources.length} fichiers joints</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select value={chap.status} onValueChange={val => handleStatusChange(chap.id, val as Chapter['status'])}>
                  <SelectTrigger className="h-8 text-xs font-bold rounded-xl w-32 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed">Terminé ✔</SelectItem>
                    <SelectItem value="In Progress">En Cours ⏳</SelectItem>
                    <SelectItem value="Upcoming">À Venir 📅</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resources list */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Fichiers & Supports d&apos;Apprentissage ({chap.resources.length})</p>
              {chap.resources.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune ressource jointe pour ce chapitre.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {chap.resources.map((res, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        {res.type === 'video' ? <Video className="w-4 h-4 text-purple-600 shrink-0" /> : <FileText className="w-4 h-4 text-[#2487B8] shrink-0" />}
                        <span className="truncate font-semibold text-[#16212B]">{res.name}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-[#2487B8]">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
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
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2487B8]" />
              Ajouter un chapitre au programme
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre du chapitre *</label>
              <Input
                placeholder="Ex. Chapitre 4 : Calcul Intégral"
                value={newChapter.title}
                onChange={e => setNewChapter({ ...newChapter, title: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Volume horaire (h) *</label>
                <Input
                  type="number"
                  value={newChapter.hoursAllocated}
                  onChange={e => setNewChapter({ ...newChapter, hoursAllocated: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Statut initial *</label>
                <Select value={newChapter.status} onValueChange={val => setNewChapter({ ...newChapter, status: val as Chapter['status'] })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Upcoming">À Venir</SelectItem>
                    <SelectItem value="In Progress">En Cours</SelectItem>
                    <SelectItem value="Completed">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddChapterOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateChapter} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Créer le chapitre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Déposer une Ressource Modal Dialog */}
      <Dialog open={isUploadResourceOpen} onOpenChange={setIsUploadResourceOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#2487B8]" />
              Déposer un support pédagogique
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Chapitre cible *</label>
              <Select value={newResource.chapterId} onValueChange={val => setNewResource({ ...newResource, chapterId: val })}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      Chapitre {c.number}: {c.title.slice(0, 35)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du fichier *</label>
              <Input
                placeholder="Ex. Fiche_TP_Integrales.pdf"
                value={newResource.name}
                onChange={e => setNewResource({ ...newResource, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Type de document *</label>
                <Select value={newResource.type} onValueChange={val => setNewResource({ ...newResource, type: val as Resource['type'] })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">Document PDF</SelectItem>
                    <SelectItem value="video">Vidéo d&apos;explication</SelectItem>
                    <SelectItem value="link">Lien externe / Drive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Taille estimée</label>
                <Input
                  value={newResource.size}
                  onChange={e => setNewResource({ ...newResource, size: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsUploadResourceOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleAddResource} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Ajouter le fichier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
