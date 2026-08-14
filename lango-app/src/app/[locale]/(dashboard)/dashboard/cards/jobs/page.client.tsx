'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Layers,
  Plus,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface Job {
  id: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  status: 'queued' | 'processing' | 'partially_completed' | 'completed' | 'failed' | 'cancelled';
  totalCount: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface JobItem {
  id: string;
  subjectId: string;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string | null;
}

interface Student {
  id: string;
  fullName: string;
  matricule?: string | null;
}

interface Template {
  id: string;
  name: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  status: string;
}

const TYPE_LABELS: Record<string, string> = {
  student_id: 'Carte d\'étudiant',
  employee_id: 'Carte d\'employé',
  admit_card: 'Convocation d\'examen',
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'info' | 'success' | 'danger' | 'warning' | 'signal' }> = {
  queued: { label: 'En file', variant: 'info' },
  processing: { label: 'En cours', variant: 'signal' },
  partially_completed: { label: 'Partiel', variant: 'warning' },
  completed: { label: 'Terminé', variant: 'success' },
  failed: { label: 'Échec', variant: 'danger' },
  cancelled: { label: 'Annulé', variant: 'neutral' },
};

const ITEM_STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' }> = {
  pending: { label: 'En attente', variant: 'neutral' },
  success: { label: 'Réussi', variant: 'success' },
  failed: { label: 'Échec', variant: 'danger' },
};

const SUBJECT_TYPE_BY_TEMPLATE: Record<string, string> = {
  student_id: 'student',
  employee_id: 'employee',
  admit_card: 'exam_candidate',
};

export default function CardsJobsPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [customSubjectIds, setCustomSubjectIds] = useState('');
  const [creating, setCreating] = useState(false);

  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<JobItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = () => fetch('/api/cards/jobs')
    .then(r => r.json())
    .then(j => { if (j.success) setJobs(j.data); });

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openCreate = async () => {
    setIsCreateOpen(true);
    setSelectedTemplateId('');
    setPublishedVersionId(null);
    setSelectedSubjectIds([]);
    setCustomSubjectIds('');
    setStudentSearch('');
    const res = await fetch('/api/cards/templates').then(r => r.json());
    if (res.success) {
      const published = res.data.filter((t: Template) => t.status === 'published' || t.status === 'draft');
      setTemplates(published);
    }
  };

  const selectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPublishedVersionId(null);
    setSelectedSubjectIds([]);
    const res = await fetch(`/api/cards/templates/${templateId}/versions`).then(r => r.json());
    if (res.success) {
      const publishedVersion = res.data.find((v: any) => v.publishedById);
      setPublishedVersionId(publishedVersion ? publishedVersion.id : null);
      const subjectType = SUBJECT_TYPE_BY_TEMPLATE[
        templates.find(t => t.id === templateId)?.type ?? ''
      ];
      if (subjectType === 'student') {
        const sRes = await fetch('/api/students?page=1&pageSize=100').then(r => r.json());
        if (sRes.success) setStudents(sRes.data);
      }
    }
  };

  const selectedType = templates.find(t => t.id === selectedTemplateId)?.type ?? 'student_id';
  const subjectType = SUBJECT_TYPE_BY_TEMPLATE[selectedType];

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return students.filter(s => (s.fullName?.toLowerCase().includes(q) ?? false) || (s.matricule?.toLowerCase().includes(q) ?? false));
  }, [students, studentSearch]);

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const finalSubjectIds = subjectType === 'student'
    ? selectedSubjectIds
    : customSubjectIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

  const handleCreate = async () => {
    if (!publishedVersionId || finalSubjectIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cards/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateVersionId: publishedVersionId,
          subjectType,
          subjectIds: finalSubjectIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateOpen(false);
        await load();
      } else {
        alert(data.message || 'Erreur lors de la création du lot');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleProcess = async (jobId: string) => {
    setProcessingId(jobId);
    try {
      const res = await fetch(`/api/cards/jobs/${jobId}/process`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) alert(data.message || 'Erreur lors du traitement');
      await load();
      if (detailJobId === jobId) openDetail(jobId);
    } finally {
      setProcessingId(null);
    }
  };

  const openDetail = async (jobId: string) => {
    setDetailJobId(jobId);
    setDetailLoading(true);
    setDetailItems([]);
    try {
      const res = await fetch(`/api/cards/jobs/${jobId}`).then(r => r.json());
      if (res.success) setDetailItems(res.data.items);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalJobs = jobs.length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const inProgressCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing' || j.status === 'partially_completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Émissions en lot</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Générez des cartes pour plusieurs bénéficiaires en une seule opération.</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
        >
          <Plus className="w-4 h-4" /><span>Nouveau Lot</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Lots</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{totalJobs}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terminés</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{completedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En cours</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{inProgressCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En échec</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{failedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Jobs table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher un lot..." className="pl-9 h-9 text-xs rounded-xl" />
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={() => load()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Type</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Total</th>
                <th className="p-3">Réussis</th>
                <th className="p-3">Échecs</th>
                <th className="p-3">Créé le</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Aucun lot pour le moment.</td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 pl-4 font-semibold text-slate-700">{TYPE_LABELS[job.type] || job.type}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[job.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[job.status]?.label || job.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-600">{job.totalCount}</td>
                    <td className="p-3 text-emerald-600 font-semibold">{job.successCount}</td>
                    <td className="p-3 text-rose-600 font-semibold">{job.errorCount}</td>
                    <td className="p-3 text-slate-500">{new Date(job.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3 pr-4 text-right space-x-1.5">
                      {(job.status === 'queued' || job.status === 'processing' || job.status === 'partially_completed' || job.status === 'failed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                          onClick={() => handleProcess(job.id)}
                          disabled={processingId === job.id}
                        >
                          {processingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                          Traiter
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                        onClick={() => openDetail(job.id)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />Détail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create job dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Nouveau lot d'émission</DialogTitle>
            <DialogDescription>Sélectionnez un modèle publié et les bénéficiaires.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Modèle</Label>
              <Select value={selectedTemplateId} onValueChange={selectTemplate}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choisir un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} — {TYPE_LABELS[t.type] || t.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && !publishedVersionId && (
                <p className="text-[11px] font-semibold text-amber-600">
                  Ce modèle n'a pas de version publiée. Publiez-le depuis l'éditeur avant de l'émettre.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Type de sujet</Label>
              <Input value={subjectType} readOnly className="h-9 text-xs bg-slate-50" />
            </div>

            {subjectType === 'student' ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">
                  Élèves ({selectedSubjectIds.length} sélectionné{selectedSubjectIds.length > 1 ? 's' : ''})
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Rechercher par nom ou matricule..."
                    className="pl-9 h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="border border-slate-100 rounded-xl max-h-52 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center">Aucun élève trouvé.</p>
                  ) : (
                    filteredStudents.map(s => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(s.id)}
                          onChange={() => toggleSubject(s.id)}
                          className="w-4 h-4 accent-[#2487B8]"
                        />
                        <span className="text-xs font-medium text-slate-700">{s.fullName}</span>
                        {s.matricule && <span className="text-[10px] text-slate-400 ml-auto">{s.matricule}</span>}
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">
                  {subjectType === 'employee' ? 'Identifiants employés' : 'Identifiants places d\'examen'}
                </Label>
                <textarea
                  value={customSubjectIds}
                  onChange={e => setCustomSubjectIds(e.target.value)}
                  placeholder="Un identifiant par ligne"
                  rows={4}
                  className="w-full h-24 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
                />
                {finalSubjectIds.length > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500">{finalSubjectIds.length} identifiant(s) saisi(s)</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">Annuler</Button>
            <Button
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer"
              onClick={handleCreate}
              disabled={creating || !publishedVersionId || finalSubjectIds.length === 0}
            >
              {creating ? 'Création...' : 'Créer le lot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job detail dialog */}
      <Dialog open={detailJobId !== null} onOpenChange={(open) => { if (!open) setDetailJobId(null); }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Détail du lot</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto pr-1">
            {detailLoading ? (
              <p className="text-xs text-slate-400 text-center py-8">Chargement...</p>
            ) : detailItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Aucun élément.</p>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-2.5 pl-3">Sujet</th>
                      <th className="p-2.5">Statut</th>
                      <th className="p-2.5">Erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map(item => (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0">
                        <td className="p-2.5 pl-3 font-mono text-[11px] text-slate-600">{item.subjectId}</td>
                        <td className="p-2.5">
                          <Badge variant={ITEM_STATUS_BADGE[item.status]?.variant || 'neutral'}>
                            {ITEM_STATUS_BADGE[item.status]?.label || item.status}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-rose-600 text-[11px]">{item.errorMessage || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailJobId(null)} className="text-xs h-9 cursor-pointer">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
