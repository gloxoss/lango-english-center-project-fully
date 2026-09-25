'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  FolderOpen,
  Plus,
  Search,
  Grid as GridIcon,
  List as ListIcon,
  Download,
  Eye,
  CheckCircle2,
  Archive,
  ShieldCheck,
  FileText,
  UploadCloud,
} from 'lucide-react';

type AttachmentType = { id: string; name: string; code: string; studentVisible: boolean; downloadable: boolean; maxSizeBytes: number; isSystem: boolean };
type AssetTarget = { targetKind: string; targetRoleValue: string | null; targetRefId: string | null };
type AssetVersion = { id: string; versionNumber: number; scanStatus: string; byteSize: number; originalFilename: string; uploaderId: string; createdAt: string };
type Asset = {
  id: string;
  title: string;
  description: string | null;
  attachmentTypeId: string;
  ownerId: string;
  status: string;
  currentVersionId: string | null;
  createdAt: string;
  expiresAt?: string | null;
  versions?: AssetVersion[];
  targets?: AssetTarget[];
  tags?: string[];
  usageLinks?: { id: string; usageType: string; usageRefId: string }[];
};
type ClassSection = { id: string; sectionId: string; classId: string; className?: string | null; sectionName?: string | null };
type ClassSubject = { id: string; classId: string; subjectId: string; className?: string | null; subjectName?: string | null };

// Pickers showed raw UUIDs; the APIs already join the names in.
const sectionLabel = (s: ClassSection) => [s.className, s.sectionName].filter(Boolean).join(' ') || s.id;
const subjectLabel = (s: ClassSubject) => [s.subjectName, s.className].filter(Boolean).join(' · ') || s.id;
type StudentRow = { id: string; fullName: string; matricule: string };

// Labels live in ContentLibrary.targets.* and ContentLibrary.statuses.*.
const TARGET_KINDS = ['school', 'role', 'class_section', 'class_subject', 'user'] as const;

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'signal' | 'warning' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  ready: 'info',
  published: 'success',
  archived: 'neutral',
  infected: 'danger',
  scan_failed: 'danger',
};

export default function ContentLibraryPage() {
  const c = useTranslations('ContentLibrary');
  const locale = useLocale();
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const statusLabel = (s: string) => (c.has(`statuses.${s}`) ? c(`statuses.${s}` as 'statuses.draft') : s);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [types, setTypes] = useState<AttachmentType[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [attachmentTypeId, setAttachmentTypeId] = useState('');
  const [targetKind, setTargetKind] = useState('school');
  const [targetRoleValue, setTargetRoleValue] = useState('teacher');
  const [targetRefId, setTargetRefId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResultStatus, setUploadResultStatus] = useState('');

  const [inspecting, setInspecting] = useState<Asset | null>(null);
  const [editingInspector, setEditingInspector] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', tags: '', expiresAt: '', targetKind: 'school', targetRoleValue: 'teacher', targetRefId: '' });

  const loadAssets = () => fetch('/api/content/assets').then(r => r.json()).then((j) => { if (j.success) setAssets(j.data); });
  const loadTypes = () => fetch('/api/content/attachment-types').then(r => r.json()).then((j) => { if (j.success) setTypes(j.data); });
  const loadSections = () => fetch('/api/academics/class-sections').then(r => r.json()).then((j) => { if (j.success) setSections(j.data); }).catch(() => {});
  const loadSubjects = () => fetch('/api/academics/class-subjects').then(r => r.json()).then((j) => { if (j.success) setSubjects(j.data); }).catch(() => {});
  const loadStudents = () => fetch('/api/students?pageSize=100').then(r => r.json()).then((j) => { if (j.success) setStudents(j.data.map((s: any) => ({ id: s.id, fullName: s.fullName, matricule: s.matricule }))); }).catch(() => {});

  useEffect(() => {
    Promise.all([loadAssets(), loadTypes(), loadSections(), loadSubjects(), loadStudents()]).finally(() => setLoading(false));
  }, []);

  const openInspector = async (asset: Asset) => {
    const res = await fetch(`/api/content/assets/${asset.id}`);
    const json = await res.json();
    if (json.success) {
      setInspecting(json.data);
      const target = json.data.targets?.[0];
      setEditForm({ title: json.data.title, description: json.data.description || '', tags: (json.data.tags || []).join(', '), expiresAt: json.data.expiresAt ? json.data.expiresAt.slice(0, 16) : '', targetKind: target?.targetKind || 'school', targetRoleValue: target?.targetRoleValue || 'teacher', targetRefId: target?.targetRefId || '' });
      setEditingInspector(false);
    }
  };

  const handlePublish = async (id: string) => {
    const res = await fetch(`/api/content/assets/${id}/publish`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      await loadAssets();
      if (inspecting?.id === id) openInspector({ id } as Asset);
    } else {
      alert(json.error?.message || c('publishError'));
    }
  };

  const handleArchive = async (id: string) => {
    const res = await fetch(`/api/content/assets/${id}/archive`, { method: 'POST' });
    if (res.ok) {
      await loadAssets();
      setInspecting(null);
    }
  };

  const resetCreateForm = () => {
    setTitle(''); setDescription(''); setTags(''); setExpiresAt(''); setAttachmentTypeId(''); setTargetKind('school');
    setTargetRoleValue('teacher'); setTargetRefId(''); setFile(null); setUploadProgress(0);
    setUploadError(''); setUploadResultStatus('');
  };

  const handleCreate = () => {
    if (!title.trim() || !attachmentTypeId || !file) {
      setUploadError(c('requiredFields'));
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadProgress(0);

    const targets = targetKind === 'school'
      ? [{ targetKind: 'school' }]
      : targetKind === 'role'
        ? [{ targetKind: 'role', targetRoleValue }]
        : targetRefId
          ? [{ targetKind, targetRefId }]
          : [];

    const formData = new FormData();
    formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());
    formData.append('attachmentTypeId', attachmentTypeId);
    formData.append('targets', JSON.stringify(targets));
    formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));
    if (expiresAt) formData.append('expiresAt', new Date(expiresAt).toISOString());
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/content/assets');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.success) {
          setUploadResultStatus(json.data.status);
          loadAssets();
          setTimeout(() => { setCreateOpen(false); resetCreateForm(); }, 1200);
        } else {
          setUploadError(json.error?.message || c('uploadError'));
        }
      } catch {
        setUploadError(c('serverError'));
      }
    };
    xhr.onerror = () => { setUploading(false); setUploadError(c('uploadNetworkError')); };
    xhr.send(formData);
  };

  const handleInspectorSave = async () => {
    if (!inspecting || !editForm.title.trim()) return;
    const targets = editForm.targetKind === 'school' ? [{ targetKind: 'school' }] : editForm.targetKind === 'role' ? [{ targetKind: 'role', targetRoleValue: editForm.targetRoleValue }] : editForm.targetRefId ? [{ targetKind: editForm.targetKind, targetRefId: editForm.targetRefId }] : [];
    const res = await fetch(`/api/content/assets/${inspecting.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editForm.title.trim(), description: editForm.description.trim() || null, tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean), targets, expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null }) });
    const json = await res.json();
    if (json.success) { await loadAssets(); await openInspector(inspecting); } else alert(json.error?.message || c('editError'));
  };

  const filtered = assets.filter(a => a.title.toLowerCase().includes(search.toLowerCase()));
  const publishedCount = assets.filter(a => a.status === 'published').length;
  const draftCount = assets.filter(a => a.status === 'draft' || a.status === 'ready').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{c('title')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {c('subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" />
          <span>{c('newResource')}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{c('statPublished')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{publishedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{c('statDrafts')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{draftCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{c('statTypes')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{types.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={c('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setViewMode('table')} aria-label={c('tableView')} title={c('tableView')} className={`p-2 rounded-lg cursor-pointer ${viewMode === 'table' ? 'bg-white shadow-2xs text-[#0066FF]' : 'text-slate-500'}`}>
              <ListIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('grid')} aria-label={c('gridView')} title={c('gridView')} className={`p-2 rounded-lg cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-2xs text-[#0066FF]' : 'text-slate-500'}`}>
              <GridIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 text-center py-8">{c('loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">{c('empty')}</p>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2 pr-4">{c('colTitle')}</th>
                  <th className="py-2 pr-4">{c('colStatus')}</th>
                  <th className="py-2 pr-4">{c('colVersions')}</th>
                  <th className="py-2 pr-4">{c('colCreated')}</th>
                  <th className="py-2 pr-4">{c('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 pr-4 font-semibold text-[#16212B]">{a.title}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={STATUS_VARIANT[a.status] || 'neutral'} className="text-[10px] font-bold">
                        {statusLabel(a.status)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{a.currentVersionId ? 'v' + (a.versions?.length || 1) : '—'}</td>
                    <td className="py-3 pr-4 text-slate-500">{new Date(a.createdAt).toLocaleDateString(intlLocale)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openInspector(a)} className="text-slate-500 hover:text-[#0066FF] cursor-pointer" title={c('details')} aria-label={c('details')}>
                          <Eye className="w-4 h-4" />
                        </button>
                        {a.status === 'published' && (
                          <a href={`/api/content/assets/${a.id}/download`} className="text-slate-500 hover:text-emerald-600 cursor-pointer" title={c('download')} aria-label={c('download')}>
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filtered.map(a => (
              <Card key={a.id} onClick={() => openInspector(a)} className="p-4 rounded-xl border border-slate-200 hover:border-[#0066FF]/40 cursor-pointer space-y-2">
                <FileText className="w-6 h-6 text-[#0066FF]" />
                <p className="text-xs font-bold text-[#16212B] truncate">{a.title}</p>
                <Badge variant={STATUS_VARIANT[a.status] || 'neutral'} className="text-[10px] font-bold">
                  {statusLabel(a.status)}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{c('createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">{c('fieldTitle')}</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">{c('fieldDescription')}</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 text-xs rounded-xl" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-700">{c('fieldTags')}</label><Input value={tags} onChange={e => setTags(e.target.value)} placeholder={c('tagsPlaceholder')} className="mt-1 h-9 rounded-xl text-xs" /></div><div><label className="text-xs font-bold text-slate-700">{c('visibleUntil')}</label><Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="mt-1 h-9 rounded-xl text-xs" /></div></div>
            <div>
              <label className="text-xs font-bold text-slate-700">{c('attachmentType')}</label>
              <Select value={attachmentTypeId} onValueChange={setAttachmentTypeId}>
                <SelectTrigger className="mt-1 text-xs rounded-xl h-9"><SelectValue placeholder={c('chooseType')} /></SelectTrigger>
                <SelectContent>
                  {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">{c('audience')}</label>
              <Select value={targetKind} onValueChange={setTargetKind}>
                <SelectTrigger className="mt-1 text-xs rounded-xl h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_KINDS.map(k => <SelectItem key={k} value={k}>{c(`targets.${k}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {targetKind === 'role' && (
              <Select value={targetRoleValue} onValueChange={setTargetRoleValue}>
                <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">{c('roleTeachers')}</SelectItem>
                  <SelectItem value="student">{c('roleStudents')}</SelectItem>
                  <SelectItem value="parent">{c('roleParents')}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {targetKind === 'class_section' && (
              <Select value={targetRefId} onValueChange={setTargetRefId}>
                <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue placeholder={c('chooseSection')} /></SelectTrigger>
                <SelectContent>
                  {sections.map(s => <SelectItem key={s.id} value={s.id}>{sectionLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {targetKind === 'class_subject' && (
              <Select value={targetRefId} onValueChange={setTargetRefId}>
                <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue placeholder={c('chooseSubject')} /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{subjectLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {targetKind === 'user' && (
              <Select value={targetRefId} onValueChange={setTargetRefId}>
                <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue placeholder={c('chooseStudent')} /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.matricule})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><UploadCloud className="w-3.5 h-3.5" /> {c('file')}</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 text-xs w-full" />
            </div>
            {uploading && (
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-[#0066FF] h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            {uploadResultStatus && <p className="text-xs font-bold text-emerald-600">{c('statusLine', { status: statusLabel(uploadResultStatus) })}</p>}
            {uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={uploading} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl cursor-pointer">
              {uploading ? c('uploading', { percent: uploadProgress }) : c('createAndUpload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspector */}
      <Dialog open={!!inspecting} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-w-xl">
          {inspecting && (
            <>
              <DialogHeader>
                <DialogTitle>{inspecting.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-xs">
                {editingInspector ? <div className="space-y-3"><Input value={editForm.title} onChange={e => setEditForm({...editForm,title:e.target.value})} /><Textarea value={editForm.description} onChange={e => setEditForm({...editForm,description:e.target.value})} rows={3} /><div className="grid grid-cols-2 gap-3"><Input value={editForm.tags} onChange={e => setEditForm({...editForm,tags:e.target.value})} placeholder={c('tagsCommaPlaceholder')} /><Input type="datetime-local" value={editForm.expiresAt} onChange={e => setEditForm({...editForm,expiresAt:e.target.value})} /></div><Select value={editForm.targetKind} onValueChange={v=>setEditForm({...editForm,targetKind:v,targetRefId:''})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TARGET_KINDS.map(k=><SelectItem key={k} value={k}>{c(`targets.${k}`)}</SelectItem>)}</SelectContent></Select>{editForm.targetKind==='role'&&<Select value={editForm.targetRoleValue} onValueChange={v=>setEditForm({...editForm,targetRoleValue:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teacher">{c('roleTeachers')}</SelectItem><SelectItem value="student">{c('roleStudents')}</SelectItem><SelectItem value="parent">{c('roleParents')}</SelectItem></SelectContent></Select>}{editForm.targetKind==='class_section'&&<Select value={editForm.targetRefId} onValueChange={v=>setEditForm({...editForm,targetRefId:v})}><SelectTrigger><SelectValue placeholder={c('chooseSection')} /></SelectTrigger><SelectContent>{sections.map(s=><SelectItem key={s.id} value={s.id}>{sectionLabel(s)}</SelectItem>)}</SelectContent></Select>}{editForm.targetKind==='class_subject'&&<Select value={editForm.targetRefId} onValueChange={v=>setEditForm({...editForm,targetRefId:v})}><SelectTrigger><SelectValue placeholder={c('chooseSubject')} /></SelectTrigger><SelectContent>{subjects.map(s=><SelectItem key={s.id} value={s.id}>{subjectLabel(s)}</SelectItem>)}</SelectContent></Select>}{editForm.targetKind==='user'&&<Select value={editForm.targetRefId} onValueChange={v=>setEditForm({...editForm,targetRefId:v})}><SelectTrigger><SelectValue placeholder={c('chooseStudent')} /></SelectTrigger><SelectContent>{students.map(s=><SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select>}</div> : <p className="text-slate-500">{inspecting.description || c('noDescription')}</p>}
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[inspecting.status] || 'neutral'}>{statusLabel(inspecting.status)}</Badge>
                  {(inspecting.tags || []).map(t => <Badge key={t} variant="neutral">{t}</Badge>)}
                </div>
                <div>
                  <p className="font-bold text-slate-700 mb-1">{c('colVersions')}</p>
                  {(inspecting.versions || []).map(v => (
                    <div key={v.id} className="flex items-center justify-between border-b border-slate-50 py-1.5">
                      <span>v{v.versionNumber} — {v.originalFilename}</span>
                      <Badge variant={v.scanStatus === 'clean' ? 'success' : 'danger'} className="text-[10px]">{c.has(`scan.${v.scanStatus}`) ? c(`scan.${v.scanStatus}` as 'scan.clean') : v.scanStatus}</Badge>
                    </div>
                  ))}
                </div>
                {(inspecting.usageLinks || []).length > 0 && (
                  <div>
                    <p className="font-bold text-slate-700 mb-1">{c('reusedIn')}</p>
                    <p className="text-slate-500">{c('homeworkCount', { count: inspecting.usageLinks!.length })}</p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                {editingInspector ? <><Button variant="outline" onClick={()=>setEditingInspector(false)}>{c('cancel')}</Button><Button onClick={handleInspectorSave} className="bg-[#0066FF] text-white">{c('save')}</Button></> : <Button variant="outline" onClick={()=>setEditingInspector(true)}>{c('edit')}</Button>}
                {inspecting.status === 'ready' && (
                  <Button onClick={() => handlePublish(inspecting.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer">
                    {c('publish')}
                  </Button>
                )}
                {inspecting.status === 'published' && (
                  <Button onClick={() => handleArchive(inspecting.id)} variant="secondary" className="text-xs font-bold rounded-xl gap-1.5 cursor-pointer">
                    <Archive className="w-3.5 h-3.5" /> {c('archive')}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
