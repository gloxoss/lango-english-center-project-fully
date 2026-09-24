/* eslint-disable next/no-img-element */
'use client';

import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  FileImage,
  FolderUp,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Star,
  Trash2,
  Users,
  UserX,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

type ApiStudentPhoto = {
  id: string;
  fullName: string;
  matricule?: string | null;
  nationalId?: string | null;
  photoUrl: string | null;
};

type BulkPreviewItem = {
  fileIndex: number;
  filename: string;
  detectedIdentifier: string;
  matchedStudent: {
    id: string;
    name: string;
    matricule: string | null;
    nationalId: string | null;
    hasExistingPhoto: boolean;
  } | null;
  matricule: string | null;
  matchMethod: 'uuid' | 'matricule' | 'massar' | 'name' | null;
  status:
    | 'READY'
    | 'EXISTING_PHOTO'
    | 'AMBIGUOUS'
    | 'DUPLICATE_FILE_FOR_STUDENT'
    | 'NO_MATCH'
    | 'INVALID_IMAGE'
    | 'TOO_LARGE';
  reason: string;
};

type BulkSummary = {
  total: number;
  ready: number;
  existing: number;
  ambiguous: number;
  duplicate: number;
  invalid: number;
  tooLarge: number;
  noMatch: number;
};

function Initials({ fullName }: { fullName: string }) {
  const letters = fullName
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="
      flex size-14 items-center justify-center rounded-full bg-[#DCEBF4]
      text-base font-extrabold text-[#0066FF] select-none
    "
    >
      {letters || 'EL'}
    </div>
  );
}

export function StudentPhotosView() {
  const t = useTranslations('Students');
  const { can } = usePermissions();
  const [students, setStudents] = useState<ApiStudentPhoto[]>([]);
  const [kpi, setKpi] = useState({ total: 0, withPhoto: 0, withoutPhoto: 0, missingFiles: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'with_photo' | 'without_photo'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetStudentIdRef = useRef<string | null>(null);

  // Bulk Upload Modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<'select' | 'preview' | 'report'>('select');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkPreviewItems, setBulkPreviewItems] = useState<BulkPreviewItem[]>([]);
  const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null);
  const [allowReplaceExisting, setAllowReplaceExisting] = useState(false);
  const [bulkCommitting, setBulkCommitting] = useState(false);
  const [bulkCommitResult, setBulkCommitResult] = useState<{
    committedCount: number;
    failedCount: number;
    committed: Array<{ filename: string; studentId: string; studentName: string }>;
    failed: Array<{ filename: string; reason: string }>;
  } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = can('students.update');

  // Gallery lightbox state
  type GalleryPhoto = { id: string; src: string; uploadedAt: string; isProfile: boolean };
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const loadGallery = useCallback(async (studentId: string) => {
    try {
      const res = await fetch(`/api/students/photos?gallery=${studentId}`);
      const json = await res.json();
      if (json.success) {
        setGallery(json.data);
        setActivePhotoId(null);
      }
    } catch (err) {
      console.error('Failed loading gallery', err);
    }
  }, []);

  useEffect(() => {
    if (viewingId) {
      loadGallery(viewingId);
    }
  }, [viewingId, loadGallery]);

  function openViewingModal(id: string) {
    setIsConfirmingDelete(false);
    setViewingId(id);
  }

  const loadStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (filter !== 'all') {
        params.set('filter', filter);
      }

      const res = await fetch(`/api/students/photos?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setStudents(json.data);
        if (json.kpi) {
          setKpi({ missingFiles: 0, ...json.kpi });
        }
      }
    } catch (err) {
      console.error('Failed loading student photos', err);
    }
  }, [searchTerm, filter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  async function handleSetProfile(photoId: string) {
    if (!viewingId) {
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/students/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: viewingId, photoId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || t('setProfileFailed'));
        return;
      }
      setSuccess(t('profileSetSuccess'));
      setTimeout(setSuccess, 3000, null);
      await loadGallery(viewingId);
      await loadStudents();
    } catch (err) {
      console.error('Set profile failed', err);
      setError(t('bulkNetworkError'));
    }
  }

  async function handleDeletePhoto(studentId: string) {
    if (!studentId) {
      return;
    }
    setError(null);
    setDeletingId(studentId);
    try {
      const res = await fetch(`/api/students/photos?id=${studentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || t('connectionError'));
        return;
      }
      setSuccess(t('photoDeletedSuccess'));
      setTimeout(setSuccess, 3000, null);
      setViewingId(null);
      setIsConfirmingDelete(false);
      await loadStudents();
    } catch (err) {
      console.error('Delete photo failed', err);
      setError(t('connectionError'));
    } finally {
      setDeletingId(null);
    }
  }

  function triggerUpload(studentId: string) {
    targetStudentIdRef.current = studentId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const studentId = targetStudentIdRef.current;
    if (!file || !studentId) {
      return;
    }

    setUploadingId(studentId);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append('studentId', studentId);
      formData.append('file', file);
      const res = await fetch('/api/students/photos', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || t('uploadFailed'));
        return;
      }
      setSuccess(t('photoSavedSuccess'));
      setTimeout(setSuccess, 4000, null);
      setFailedImages((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      await loadStudents();
      if (targetStudentIdRef.current) {
        await loadGallery(targetStudentIdRef.current);
      }
    } catch (err) {
      console.error('Photo upload failed', err);
      setError(t('connectionError'));
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const handleBulkFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBulkFiles(Array.from(e.target.files));
      setBulkStep('select');
      setBulkPreviewItems([]);
      setBulkSummary(null);
      setBulkCommitResult(null);
    }
  };

  const handleRunBulkPreview = async () => {
    if (bulkFiles.length === 0) {
      return;
    }
    setBulkPreviewLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('action', 'preview');
      for (const file of bulkFiles) {
        formData.append('files', file);
      }

      const res = await fetch('/api/students/photos', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBulkPreviewItems(json.data.items || []);
        setBulkSummary(json.data.summary || null);
        setBulkStep('preview');
      } else {
        setError(json.message || t('bulkUploadFailed'));
      }
    } catch {
      setError(t('bulkNetworkError'));
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const committableItems = bulkPreviewItems.filter((item) => {
    if (item.status === 'READY') {
      return true;
    }
    if (item.status === 'EXISTING_PHOTO' && allowReplaceExisting) {
      return true;
    }
    return false;
  });

  const handleCommitBulk = async () => {
    if (committableItems.length === 0) {
      return;
    }
    setBulkCommitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('action', 'commit');
      for (const file of bulkFiles) {
        formData.append('files', file);
      }

      const confirmations = committableItems.map(item => ({
        fileIndex: item.fileIndex,
        studentId: item.matchedStudent!.id,
      }));
      formData.append('confirmations', JSON.stringify(confirmations));

      const res = await fetch('/api/students/photos', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBulkCommitResult(json.data);
        setBulkStep('report');
        setSuccess(t('bulkCommittedCount', { count: json.data.committedCount }));
        setTimeout(setSuccess, 5000, null);
        await loadStudents();
      } else {
        setError(json.message || t('bulkUploadFailed'));
      }
    } catch {
      setError(t('bulkNetworkError'));
    } finally {
      setBulkCommitting(false);
    }
  };

  const viewingStudent = viewingId ? students.find(s => s.id === viewingId) ?? null : null;
  const activePhoto = gallery.find(p => p.id === activePhotoId) ?? gallery.find(p => p.isProfile) ?? gallery[0] ?? null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="
        flex flex-col justify-between gap-4 rounded-2xl border
        border-slate-200/80 bg-white p-6 shadow-2xs
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('photosTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('photosSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canEdit && (
            <Button
              onClick={() => {
                setBulkFiles([]);
                setBulkPreviewItems([]);
                setBulkSummary(null);
                setBulkCommitResult(null);
                setBulkStep('select');
                setBulkModalOpen(true);
              }}
              className="
                h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold text-white
                shadow-xs
                hover:bg-[#0052CC]
              "
            >
              <FolderUp className="size-4" />
              {t('bulkPhotoUpload')}
            </Button>
          )}

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <Button
              variant={view === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('grid')}
              className={`
                h-7 rounded-lg px-2.5 text-xs
                ${view === 'grid'
      ? ''
      : `text-slate-500`}
              `}
            >
              <LayoutGrid className="size-3.5" />
              {' '}
              {t('viewGrid')}
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={`
                h-7 rounded-lg px-2.5 text-xs
                ${view === 'list'
      ? ''
      : `text-slate-500`}
              `}
            >
              <List className="size-3.5" />
              {' '}
              {t('viewList')}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="
          flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50
          p-3.5 text-xs font-semibold text-rose-700
        "
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="
          flex items-center gap-2.5 rounded-xl border border-[#17A673]/30
          bg-[#DDF5EC] p-3.5 text-xs font-semibold text-[#17A673]
        "
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {kpi.missingFiles > 0 && (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {t('photosMissingFiles', { count: kpi.missingFiles })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="
        grid grid-cols-1 gap-4
        sm:grid-cols-3
      "
      >
        <Card
          onClick={() => setFilter('all')}
          className={`
            flex cursor-pointer items-center justify-between rounded-2xl border
            bg-white p-5 shadow-2xs transition-all
            hover:border-[#0066FF]/50
            ${filter === 'all'
      ? `border-[#0066FF] ring-2 ring-[#0066FF]/10`
      : `border-slate-200/80`}
          `}
        >
          <div>
            <p className="text-xs font-bold text-slate-400">{t('totalStudents')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{kpi.total}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#DCEBF4]
            font-bold text-[#0066FF]
          "
          >
            <Users className="size-5" />
          </div>
        </Card>

        <Card
          onClick={() => setFilter('with_photo')}
          className={`
            flex cursor-pointer items-center justify-between rounded-2xl border
            bg-white p-5 shadow-2xs transition-all
            hover:border-[#17A673]/50
            ${filter === 'with_photo'
      ? `border-[#17A673] ring-2 ring-[#17A673]/10`
      : `border-slate-200/80`}
          `}
        >
          <div>
            <p className="text-xs font-bold text-slate-400">{t('withPhoto')}</p>
            <p className="text-2xl font-extrabold text-[#17A673]">{kpi.withPhoto}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#DDF5EC]
            font-bold text-[#17A673]
          "
          >
            <Camera className="size-5" />
          </div>
        </Card>

        <Card
          onClick={() => setFilter('without_photo')}
          className={`
            flex cursor-pointer items-center justify-between rounded-2xl border
            bg-white p-5 shadow-2xs transition-all
            hover:border-amber-400/50
            ${filter === 'without_photo'
      ? `border-amber-500 ring-2 ring-amber-500/10`
      : `border-slate-200/80`}
          `}
        >
          <div>
            <p className="text-xs font-bold text-slate-400">{t('withoutPhoto')}</p>
            <p className="text-2xl font-extrabold text-amber-700">{kpi.withoutPhoto}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-amber-100
            font-bold text-amber-700
          "
          >
            <UserX className="size-5" />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="
        flex flex-col items-center justify-between gap-3
        sm:flex-row
      "
      >
        <div className="
          relative w-full
          sm:max-w-md
        "
        >
          <Search className="
            absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchPhotosPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 rounded-xl border-slate-200 bg-white pl-9 text-xs"
          />
        </div>

        <div className="
          flex items-center gap-1.5 self-start rounded-xl bg-slate-100 p-1
          sm:self-auto
        "
        >
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`
              rounded-lg px-3 py-1 text-xs font-bold transition-all
              ${filter === 'all'
      ? `bg-white text-[#16212B] shadow-2xs`
      : `
        text-slate-500
        hover:text-slate-800
      `}
            `}
          >
            {t('filterAll')}
            {' '}
            (
            {kpi.total}
            )
          </button>
          <button
            type="button"
            onClick={() => setFilter('with_photo')}
            className={`
              rounded-lg px-3 py-1 text-xs font-bold transition-all
              ${filter === 'with_photo'
      ? `bg-[#DDF5EC] text-[#17A673] shadow-2xs`
      : `
        text-slate-500
        hover:text-slate-800
      `}
            `}
          >
            {t('filterWithPhoto')}
            {' '}
            (
            {kpi.withPhoto}
            )
          </button>
          <button
            type="button"
            onClick={() => setFilter('without_photo')}
            className={`
              rounded-lg px-3 py-1 text-xs font-bold transition-all
              ${filter === 'without_photo'
      ? `bg-amber-100 text-amber-800 shadow-2xs`
      : `
        text-slate-500
        hover:text-slate-800
      `}
            `}
          >
            {t('filterWithoutPhoto')}
            {' '}
            (
            {kpi.withoutPhoto}
            )
          </button>
        </div>
      </div>

      {/* Grid vs List View */}
      {view === 'grid'
        ? (
            <div className="
              grid grid-cols-2 gap-3
              sm:grid-cols-3
              md:grid-cols-4
              lg:grid-cols-6
            "
            >
              {students.map((s) => {
                const hasPhoto = Boolean(s.photoUrl) && !failedImages.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openViewingModal(s.id)}
                    className="
                      group cursor-pointer overflow-hidden rounded-2xl border
                      border-slate-200/80 bg-white text-left shadow-2xs
                      transition-all
                      hover:shadow-md
                    "
                  >
                    <div className="
                      relative flex aspect-square items-center justify-center
                      overflow-hidden bg-slate-50
                    "
                    >
                      {hasPhoto
                        ? (
                            <img
                              src={`/api/students/photos?id=${s.id}`}
                              alt={s.fullName}
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(s.id));
                              }}
                              className="
                                size-full object-cover transition-transform
                                group-hover:scale-105
                              "
                            />
                          )
                        : (
                            <Initials fullName={s.fullName} />
                          )}
                      {uploadingId === s.id && (
                        <div className="
                          absolute inset-0 flex items-center justify-center
                          bg-white/80 text-[10px] font-bold text-[#0066FF]
                        "
                        >
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                          Enregistrement...
                        </div>
                      )}
                      <div className="absolute top-1.5 left-1.5">
                        <Badge
                          className={
                            hasPhoto
                              ? `
                                border-none bg-[#DDF5EC] px-1.5 text-[9px]
                                font-bold text-[#17A673]
                              `
                              : `
                                border-none bg-slate-100 px-1.5 text-[9px]
                                font-bold text-slate-500
                              `
                          }
                        >
                          {hasPhoto ? t('withPhoto') : t('noPhoto')}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-0.5 p-2.5">
                      <p className="
                        truncate text-[11px] font-bold text-[#16212B]
                      "
                      >
                        {s.fullName}
                      </p>
                      <p className="
                        truncate font-mono text-[10px] text-slate-400
                      "
                      >
                        {s.matricule || s.nationalId || s.id.slice(0, 8)}
                      </p>
                    </div>
                  </button>
                );
              })}
              {students.length === 0 && (
                <p className="
                  col-span-full py-8 text-center text-xs text-slate-400
                "
                >
                  {t('noStudentsFound')}
                </p>
              )}
            </div>
          )
        : (
            <div className="
              divide-y divide-slate-100 overflow-hidden rounded-2xl border
              border-slate-200/80 bg-white shadow-2xs
            "
            >
              {students.map((s) => {
                const hasPhoto = Boolean(s.photoUrl) && !failedImages.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openViewingModal(s.id)}
                    className="
                      flex w-full cursor-pointer items-center gap-3 px-4 py-2.5
                      text-left transition-colors
                      hover:bg-slate-50
                    "
                  >
                    <div className="
                      flex size-10 shrink-0 items-center justify-center
                      overflow-hidden rounded-lg bg-slate-50
                    "
                    >
                      {hasPhoto
                        ? (
                            <img
                              src={`/api/students/photos?id=${s.id}`}
                              alt={s.fullName}
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(s.id));
                              }}
                              className="size-full object-cover"
                            />
                          )
                        : (
                            <div className="
                              flex size-10 items-center justify-center
                              rounded-lg bg-[#DCEBF4] text-xs font-extrabold
                              text-[#0066FF]
                            "
                            >
                              {s.fullName
                                .split(' ')
                                .map(n => n[0])
                                .filter(Boolean)
                                .join('')
                                .slice(0, 2)
                                .toUpperCase() || 'EL'}
                            </div>
                          )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#16212B]">{s.fullName}</p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {s.matricule || s.nationalId || s.id.slice(0, 8)}
                      </p>
                    </div>
                    <Badge
                      className={
                        hasPhoto
                          ? `
                            border-none bg-[#DDF5EC] px-1.5 text-[9px] font-bold
                            text-[#17A673]
                          `
                          : `
                            border-none bg-slate-100 px-1.5 text-[9px] font-bold
                            text-slate-500
                          `
                      }
                    >
                      {hasPhoto ? t('withPhoto') : t('noPhoto')}
                    </Badge>
                  </button>
                );
              })}
              {students.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">{t('noStudentsFound')}</p>
              )}
            </div>
          )}

      {/* PHOTO DETAIL LIGHTBOX MODAL */}
      <Dialog
        open={viewingStudent != null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl">
          {viewingStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold text-[#16212B]">{viewingStudent.fullName}</DialogTitle>
                <DialogDescription className="text-xs">
                  {viewingStudent.matricule
                    ? `${t('matriculeLabel')} : ${viewingStudent.matricule}`
                    : viewingStudent.nationalId
                      ? `Massar : ${viewingStudent.nationalId}`
                      : t('studentLabel')}
                  {gallery.length > 0 ? ` · ${gallery.length} ${t('photosCountLabel')}` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="
                relative mx-auto flex aspect-square w-full max-w-sm items-center
                justify-center overflow-hidden rounded-2xl border
                border-slate-100 bg-slate-50
              "
              >
                {activePhoto && !failedImages.has(viewingStudent.id)
                  ? (
                      <img
                        src={activePhoto.src}
                        alt={viewingStudent.fullName}
                        onError={() => setFailedImages(prev => new Set(prev).add(viewingStudent.id))}
                        className="size-full object-contain"
                      />
                    )
                  : (
                      <div className="
                        flex size-28 items-center justify-center rounded-full
                        bg-[#DCEBF4] text-3xl font-extrabold text-[#0066FF]
                        select-none
                      "
                      >
                        {viewingStudent.fullName
                          .split(' ')
                          .map(n => n[0])
                          .filter(Boolean)
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'EL'}
                      </div>
                    )}
                {activePhoto?.isProfile && (
                  <Badge className="
                    absolute top-2 right-2 border-none bg-[#DDF5EC] px-1.5
                    text-[9px] font-bold text-[#17A673]
                  "
                  >
                    <Star className="mr-0.5 inline size-3" />
                    {' '}
                    {t('profileBadge')}
                  </Badge>
                )}
              </div>

              {gallery.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {gallery.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePhotoId(p.id)}
                      className={`
                        size-14 shrink-0 overflow-hidden rounded-lg border-2
                        transition-all
                        ${activePhoto?.id === p.id
                      ? `border-[#0066FF]`
                      : `
                        border-transparent
                        hover:border-slate-200
                      `}
                      `}
                    >
                      <img
                        src={p.src}
                        alt=""
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {canEdit && (
                <DialogFooter className="
                  flex flex-row items-center justify-between gap-2 pt-2
                "
                >
                  <div>
                    {viewingStudent.photoUrl && !isConfirmingDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === viewingStudent.id}
                        onClick={() => setIsConfirmingDelete(true)}
                        className="
                          h-9 gap-1.5 rounded-xl text-xs text-rose-600
                          hover:bg-rose-50 hover:text-rose-700
                        "
                      >
                        <Trash2 className="size-3.5" />
                        {t('deletePhotoBtn')}
                      </Button>
                    )}
                    {viewingStudent.photoUrl && isConfirmingDelete && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === viewingStudent.id}
                          onClick={() => handleDeletePhoto(viewingStudent.id)}
                          className="h-8 rounded-lg text-xs font-bold"
                        >
                          {deletingId === viewingStudent.id
                            ? (
                                <Loader2 className="size-3 animate-spin" />
                              )
                            : (
                                'Confirmer'
                              )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsConfirmingDelete(false)}
                          className="h-8 rounded-lg text-xs"
                        >
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploadingId === viewingStudent.id}
                      onClick={() => triggerUpload(viewingStudent.id)}
                      className="
                        h-9 gap-1.5 rounded-xl border-slate-200 text-xs
                      "
                    >
                      {uploadingId === viewingStudent.id
                        ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          )
                        : (
                            <Camera className="size-3.5" />
                          )}
                      {t('addPhoto')}
                    </Button>
                    {activePhoto && !activePhoto.isProfile && (
                      <Button
                        size="sm"
                        onClick={() => handleSetProfile(activePhoto.id)}
                        className="
                          h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold
                          text-white
                          hover:bg-[#0052CC]
                        "
                      >
                        <Star className="size-3.5" />
                        {' '}
                        {t('setAsProfile')}
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* BULK PHOTO UPLOAD MODAL WITH 2-PHASE RECONCILIATION */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="
          flex max-h-[90vh] max-w-3xl flex-col rounded-2xl
        "
        >
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-base font-extrabold text-[#16212B]
            "
            >
              <FolderUp className="size-5 text-[#0066FF]" />
              {t('bulkModalTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {bulkStep === 'preview' ? t('bulkPreviewDesc') : t('bulkModalDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto py-2 text-xs">
            {/* STAGE 1: FILE SELECTION */}
            {bulkStep === 'select' && (
              <>
                <ul className="
                  list-inside list-disc space-y-1 pl-2 text-[11px]
                  text-slate-500
                "
                >
                  <li>
                    <strong>{t('bulkMatchUuid')}</strong>
                    {' '}
                    : ex.
                    {' '}
                    <code className="
                      rounded-sm bg-slate-100 px-1 py-0.5 font-mono
                    "
                    >
                      c0000000-0000-4000-8000-000000000001.jpg
                    </code>
                  </li>
                  <li>
                    <strong>{t('bulkMatchMatricule')}</strong>
                    {' '}
                    : ex.
                    {' '}
                    <code className="
                      rounded-sm bg-slate-100 px-1 py-0.5 font-mono
                    "
                    >
                      STD-2026-0042.jpg
                    </code>
                  </li>
                  <li>
                    <strong>Massar</strong>
                    {' '}
                    : ex.
                    {' '}
                    <code className="
                      rounded-sm bg-slate-100 px-1 py-0.5 font-mono
                    "
                    >
                      R192837465.png
                    </code>
                  </li>
                  <li>
                    <strong>{t('bulkMatchName')}</strong>
                    {' '}
                    : ex.
                    {' '}
                    <code className="
                      rounded-sm bg-slate-100 px-1 py-0.5 font-mono
                    "
                    >
                      Salma_Benjelloun.jpg
                    </code>
                    {' '}
                    (uniquement
                    si nom unique)
                  </li>
                </ul>

                <div className="
                  rounded-2xl border-2 border-dashed border-slate-200
                  bg-slate-50/50 p-8 text-center transition-colors
                  hover:bg-slate-100/50
                "
                >
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleBulkFilesSelect}
                    className="hidden"
                  />
                  <FileImage className="mx-auto mb-2 size-12 text-[#0066FF]" />
                  <p className="text-sm font-bold text-[#16212B]">
                    {bulkFiles.length > 0
                      ? t('bulkFilesSelected', { count: bulkFiles.length })
                      : t('bulkClickSelect')}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{t('bulkAcceptedFormats')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="
                      mt-4 h-9 rounded-xl border-slate-200 bg-white text-xs
                      font-bold
                    "
                  >
                    {t('bulkBrowse')}
                  </Button>
                </div>
              </>
            )}

            {/* STAGE 2: RECONCILIATION PREVIEW TABLE */}
            {bulkStep === 'preview' && bulkSummary && (
              <div className="space-y-3">
                <div className="
                  flex flex-wrap items-center gap-2 rounded-xl border
                  border-slate-200/80 bg-slate-50 p-3 text-xs
                "
                >
                  <span className="font-bold text-slate-700">Rapprochement :</span>
                  {bulkSummary.ready > 0 && (
                    <Badge className="
                      border-none bg-emerald-100 font-bold text-emerald-800
                    "
                    >
                      {t('bulkSummaryReady', { count: bulkSummary.ready })}
                    </Badge>
                  )}
                  {bulkSummary.existing > 0 && (
                    <Badge className="
                      border-none bg-amber-100 font-bold text-amber-800
                    "
                    >
                      {t('bulkSummaryExisting', { count: bulkSummary.existing })}
                    </Badge>
                  )}
                  {bulkSummary.ambiguous > 0 && (
                    <Badge className="
                      border-none bg-orange-100 font-bold text-orange-800
                    "
                    >
                      {t('bulkSummaryAmbiguous', { count: bulkSummary.ambiguous })}
                    </Badge>
                  )}
                  {bulkSummary.duplicate > 0 && (
                    <Badge className="
                      border-none bg-purple-100 font-bold text-purple-800
                    "
                    >
                      {t('bulkSummaryDuplicate', { count: bulkSummary.duplicate })}
                    </Badge>
                  )}
                  {bulkSummary.invalid > 0 && (
                    <Badge className="
                      border-none bg-rose-100 font-bold text-rose-800
                    "
                    >
                      {t('bulkSummaryInvalid', { count: bulkSummary.invalid })}
                    </Badge>
                  )}
                  {bulkSummary.noMatch > 0 && (
                    <Badge className="
                      border-none bg-slate-200 font-bold text-slate-700
                    "
                    >
                      {t('bulkSummaryNoMatch', { count: bulkSummary.noMatch })}
                    </Badge>
                  )}
                </div>

                {bulkSummary.existing > 0 && (
                  <label className="
                    flex cursor-pointer items-center gap-2 rounded-xl border
                    border-amber-200 bg-amber-50/60 p-3
                  "
                  >
                    <input
                      type="checkbox"
                      checked={allowReplaceExisting}
                      onChange={e => setAllowReplaceExisting(e.target.checked)}
                      className="
                        rounded-sm border-amber-300 text-[#0066FF]
                        focus:ring-[#0066FF]
                      "
                    />
                    <span className="text-xs font-semibold text-amber-900">{t('bulkAllowReplace')}</span>
                  </label>
                )}

                <div className="
                  max-h-[350px] overflow-hidden overflow-y-auto rounded-xl
                  border border-slate-200
                "
                >
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="
                      sticky top-0 border-b border-slate-200 bg-slate-50
                      font-bold text-slate-600
                    "
                    >
                      <tr>
                        <th className="p-2.5">{t('bulkColFile')}</th>
                        <th className="p-2.5">{t('bulkColMatched')}</th>
                        <th className="p-2.5">{t('bulkColMethod')}</th>
                        <th className="p-2.5">{t('bulkColStatus')}</th>
                        <th className="p-2.5">{t('bulkColDetails')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkPreviewItems.map((item) => {
                        let statusBadge = (
                          <Badge className="
                            border-none bg-emerald-100 font-bold
                            text-emerald-800
                          "
                          >
                            {t('bulkStatusReady')}
                          </Badge>
                        );
                        if (item.status === 'EXISTING_PHOTO') {
                          statusBadge = (
                            <Badge className="
                              border-none bg-amber-100 font-bold text-amber-800
                            "
                            >
                              {t('bulkStatusExisting')}
                            </Badge>
                          );
                        } else if (item.status === 'AMBIGUOUS') {
                          statusBadge = (
                            <Badge className="
                              border-none bg-orange-100 font-bold
                              text-orange-800
                            "
                            >
                              {t('bulkStatusAmbiguous')}
                            </Badge>
                          );
                        } else if (item.status === 'DUPLICATE_FILE_FOR_STUDENT') {
                          statusBadge = (
                            <Badge className="
                              border-none bg-purple-100 font-bold
                              text-purple-800
                            "
                            >
                              {t('bulkStatusDuplicate')}
                            </Badge>
                          );
                        } else if (item.status === 'INVALID_IMAGE' || item.status === 'TOO_LARGE') {
                          statusBadge = (
                            <Badge className="
                              border-none bg-rose-100 font-bold text-rose-800
                            "
                            >
                              {t('bulkStatusInvalid')}
                            </Badge>
                          );
                        } else if (item.status === 'NO_MATCH') {
                          statusBadge = (
                            <Badge className="
                              border-none bg-slate-200 font-bold text-slate-700
                            "
                            >
                              {t('bulkStatusNoMatch')}
                            </Badge>
                          );
                        }

                        let methodText = '-';
                        if (item.matchMethod === 'uuid') {
                          methodText = t('bulkMethodUuid');
                        } else if (item.matchMethod === 'matricule') {
                          methodText = t('bulkMethodMatricule');
                        } else if (item.matchMethod === 'massar') {
                          methodText = t('bulkMethodMassar');
                        } else if (item.matchMethod === 'name') {
                          methodText = t('bulkMethodName');
                        }

                        return (
                          <tr
                            key={`${item.filename}-${item.fileIndex}`}
                            className="hover:bg-slate-50/60"
                          >
                            <td className="
                              max-w-[140px] truncate p-2.5 font-mono text-[11px]
                              text-slate-700
                            "
                            >
                              {item.filename}
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">
                              {item.matchedStudent
                                ? (
                                    <div>
                                      <div>{item.matchedStudent.name}</div>
                                      <div className="
                                        font-mono text-[10px] text-slate-400
                                      "
                                      >
                                        {item.matchedStudent.matricule || item.matchedStudent.nationalId}
                                      </div>
                                    </div>
                                  )
                                : (
                                    <span className="text-slate-400 italic">Non associé</span>
                                  )}
                            </td>
                            <td className="
                              p-2.5 text-[11px] font-semibold text-slate-600
                            "
                            >
                              {methodText}
                            </td>
                            <td className="p-2.5">{statusBadge}</td>
                            <td
                              className="
                                max-w-[200px] truncate p-2.5 text-[11px]
                                text-slate-500
                              "
                              title={item.reason}
                            >
                              {item.reason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STAGE 3: COMMIT REPORT */}
            {bulkStep === 'report' && bulkCommitResult && (
              <div className="
                space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4
                text-xs
              "
              >
                <div className="
                  flex items-center gap-2 text-sm font-extrabold
                  text-emerald-800
                "
                >
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <span>{t('bulkCommittedCount', { count: bulkCommitResult.committedCount })}</span>
                </div>
                {bulkCommitResult.committed.length > 0 && (
                  <div className="
                    space-y-1 rounded-lg border border-slate-200 bg-white p-3
                  "
                  >
                    <p className="text-xs font-bold text-slate-700">Photos appliquées :</p>
                    <ul className="
                      max-h-[150px] list-inside list-disc space-y-0.5
                      overflow-y-auto text-[11px] text-slate-600
                    "
                    >
                      {bulkCommitResult.committed.map(c => (
                        <li key={`${c.studentId}-${c.filename}`}>
                          <span className="font-mono text-slate-700">{c.filename}</span>
                          {' '}
                          →
                          {' '}
                          <strong>{c.studentName}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {bulkCommitResult.failed.length > 0 && (
                  <div className="
                    space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3
                    text-rose-800
                  "
                  >
                    <p className="text-xs font-bold">
                      {bulkCommitResult.failedCount}
                      {' '}
                      échec(s) :
                    </p>
                    <ul className="list-inside list-disc text-[11px]">
                      {bulkCommitResult.failed.map(f => (
                        <li key={`${f.filename}-${f.reason}`}>
                          {f.filename}
                          {' '}
                          :
                          {' '}
                          {f.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="
            flex items-center justify-between border-t border-slate-100 pt-3
          "
          >
            <div>
              {bulkStep === 'preview' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkStep('select')}
                  className="h-9 rounded-xl text-xs"
                >
                  ← Changer de fichiers
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkModalOpen(false)}
                className="h-9 rounded-xl border-slate-200 text-xs"
              >
                {t('bulkClose')}
              </Button>

              {bulkStep === 'select' && (
                <Button
                  size="sm"
                  onClick={handleRunBulkPreview}
                  disabled={bulkPreviewLoading || bulkFiles.length === 0}
                  className="
                    h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold
                    text-white
                    hover:bg-[#0052CC]
                  "
                >
                  {bulkPreviewLoading
                    ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      )
                    : (
                        <Search className="size-3.5" />
                      )}
                  {t('bulkBtnPreview')}
                  {' '}
                  (
                  {bulkFiles.length}
                  )
                </Button>
              )}

              {bulkStep === 'preview' && (
                <Button
                  size="sm"
                  onClick={handleCommitBulk}
                  disabled={bulkCommitting || committableItems.length === 0}
                  className="
                    h-9 gap-1.5 rounded-xl bg-[#0066FF] text-xs font-bold
                    text-white
                    hover:bg-[#0052CC]
                  "
                >
                  {bulkCommitting
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : (
                        <Check className="size-3.5" />
                      )}
                  {t('bulkBtnConfirm', { count: committableItems.length })}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
