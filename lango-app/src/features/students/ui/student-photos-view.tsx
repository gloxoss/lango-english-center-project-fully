'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Camera,
  Users,
  UserX,
  Search,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  List,
  Upload,
  Sparkles,
  Layers,
  FileImage,
  Loader2,
  FolderUp,
  Star,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type ApiStudentPhoto = {
  id: string;
  fullName: string;
  matricule?: string | null;
  photoUrl: string | null;
};

function Initials({ fullName }: { fullName: string }) {
  return (
    <div className="w-14 h-14 rounded-full bg-[#DCEBF4] text-[#0066FF] flex items-center justify-center text-base font-extrabold">
      {fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
    </div>
  );
}

export function StudentPhotosView() {
  const { can } = usePermissions();
  const [students, setStudents] = useState<ApiStudentPhoto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetStudentId = useRef<string | null>(null);

  // Bulk Upload Modal state (§2.7)
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    matchedCount: number;
    unmatchedCount: number;
    matched: Array<{ filename: string; studentName: string }>;
    unmatched: string[];
  } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = can('students.update');

  // Gallery lightbox state (Part 2, item 2): a student holds several photos;
  // user.photoUrl stays the single "profile" photo.
  type GalleryPhoto = { id: string; src: string; uploadedAt: string; isProfile: boolean };
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  async function loadGallery(studentId: string) {
    setGalleryLoading(true);
    try {
      const res = await fetch(`/api/students/photos?gallery=${studentId}`);
      const json = await res.json();
      if (json.success) {
        setGallery(json.data);
        setActivePhotoId(null);
      }
    } catch (err) {
      console.error('Failed loading gallery', err);
    } finally {
      setGalleryLoading(false);
    }
  }

  useEffect(() => {
    if (viewingId) loadGallery(viewingId);
  }, [viewingId]);

  async function handleSetProfile(photoId: string) {
    if (!viewingId) return;
    setError(null);
    try {
      const res = await fetch('/api/students/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: viewingId, photoId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Impossible de définir la photo de profil.');
        return;
      }
      setSuccess('Photo de profil définie.');
      setTimeout(() => setSuccess(null), 3000);
      await loadGallery(viewingId);
      await loadStudents();
    } catch (err) {
      console.error('Set profile failed', err);
      setError('Erreur réseau.');
    }
  }

  async function loadStudents() {
    try {
      const res = await fetch('/api/students/photos');
      const json = await res.json();
      if (json.success) {
        setStudents(json.data);
      }
    } catch (err) {
      console.error('Failed loading student photos', err);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  function triggerUpload(studentId: string) {
    targetStudentId.current = studentId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const studentId = targetStudentId.current;
    if (!file || !studentId) return;

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
        setError(json.message || 'Échec du téléversement.');
        return;
      }
      setSuccess('Photo enregistrée avec succès.');
      setTimeout(() => setSuccess(null), 4000);
      await loadStudents();
      if (targetStudentId.current) await loadGallery(targetStudentId.current);
    } catch (err) {
      console.error('Photo upload failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Handle bulk file selection (§2.7)
  const handleBulkFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setBulkFiles(Array.from(e.target.files));
      setBulkResult(null);
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (bulkFiles.length === 0) return;
    setBulkUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (const file of bulkFiles) {
        formData.append('files', file);
      }

      const res = await fetch('/api/students/photos', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBulkResult(json.data);
        setSuccess(`${json.data.matchedCount} photo(s) mise(s) à jour avec succès.`);
        setTimeout(() => setSuccess(null), 5000);
        await loadStudents();
      } else {
        setError(json.error?.message || json.message || 'Échec du téléversement groupé.');
      }
    } catch {
      setError('Erreur réseau lors du téléversement groupé.');
    } finally {
      setBulkUploading(false);
    }
  };

  const filtered = students.filter(s =>
    s.fullName.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
    (s.matricule && s.matricule.toLowerCase().includes(searchTerm.trim().toLowerCase()))
  );
  const withPhoto = students.filter(s => s.photoUrl).length;
  const withoutPhoto = students.length - withPhoto;
  const viewingStudent = viewingId ? students.find(s => s.id === viewingId) ?? null : null;
  const activePhoto = gallery.find(p => p.id === activePhotoId) ?? gallery.find(p => p.isProfile) ?? gallery[0] ?? null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} className="hidden" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Galerie Photo des Élèves</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion du trombinoscope et téléversement groupé automatique par matricule (ex : ETU-2025-0042.jpg).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canEdit && (
            <Button
              onClick={() => {
                setBulkFiles([]);
                setBulkResult(null);
                setBulkModalOpen(true);
              }}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
            >
              <FolderUp className="w-4 h-4" />
              Téléversement groupé (§2.7)
            </Button>
          )}

          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <Button
              variant={view === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('grid')}
              className={`h-7 px-2.5 text-xs rounded-lg ${view === 'grid' ? '' : 'text-slate-500'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grille
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={`h-7 px-2.5 text-xs rounded-lg ${view === 'list' ? '' : 'text-slate-500'}`}
            >
              <List className="w-3.5 h-3.5" /> Liste
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-[#DDF5EC] border border-[#17A673]/30 rounded-xl flex items-center gap-2.5 text-[#17A673] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400">Total Élèves</p><p className="text-2xl font-extrabold text-[#16212B]">{students.length}</p></div>
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#0066FF] flex items-center justify-center font-bold"><Users className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400">Avec Photo</p><p className="text-2xl font-extrabold text-[#17A673]">{withPhoto}</p></div>
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center font-bold"><Camera className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400">Sans Photo</p><p className="text-2xl font-extrabold text-amber-700">{withoutPhoto}</p></div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold"><UserX className="w-5 h-5" /></div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Rechercher par nom ou matricule..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-white border-slate-200" />
      </div>

      {/* Grid vs List View */}
      {view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setViewingId(s.id)}
              className="text-left bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden transition-all hover:shadow-md cursor-pointer group"
            >
              <div className="aspect-square bg-slate-50 relative flex items-center justify-center overflow-hidden">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/students/photos?id=${s.id}`} alt={s.fullName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <Initials fullName={s.fullName} />
                )}
                {uploadingId === s.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-[10px] font-bold text-[#0066FF]">Envoi...</div>
                )}
                <div className="absolute top-1.5 left-1.5">
                  <Badge className={s.photoUrl ? 'bg-[#DDF5EC] text-[#17A673] text-[9px] px-1.5 border-none font-bold' : 'bg-slate-100 text-slate-500 text-[9px] px-1.5 border-none font-bold'}>
                    {s.photoUrl ? 'Photo' : 'Aucune'}
                  </Badge>
                </div>
              </div>
              <div className="p-2.5 space-y-0.5">
                <p className="text-[11px] font-bold text-[#16212B] truncate">{s.fullName}</p>
                {s.matricule && <p className="text-[10px] font-mono text-slate-400 truncate">{s.matricule}</p>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-slate-400 col-span-full text-center py-8">Aucun élève trouvé.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setViewingId(s.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/students/photos?id=${s.id}`} alt={s.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#DCEBF4] text-[#0066FF] flex items-center justify-center text-xs font-extrabold">
                    {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#16212B] truncate">{s.fullName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{s.matricule ?? s.id.slice(0, 8)}</p>
              </div>
              <Badge className={s.photoUrl ? 'bg-[#DDF5EC] text-[#17A673] text-[9px] px-1.5 border-none font-bold' : 'bg-slate-100 text-slate-500 text-[9px] px-1.5 border-none font-bold'}>
                {s.photoUrl ? 'Photo' : 'Aucune'}
              </Badge>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-8">Aucun élève trouvé.</p>}
        </div>
      )}

      {/* PHOTO GALLERY LIGHTBOX */}
      <Dialog open={viewingStudent != null} onOpenChange={(open) => { if (!open) setViewingId(null); }}>
        <DialogContent className="max-w-lg rounded-2xl">
          {viewingStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold text-[#16212B]">{viewingStudent.fullName}</DialogTitle>
                <DialogDescription className="text-xs">
                  {viewingStudent.matricule ? `Matricule : ${viewingStudent.matricule}` : 'Élève'}
                  {gallery.length > 0 ? ` · ${gallery.length} photo(s)` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="aspect-square w-full max-w-sm mx-auto bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-100 relative">
                {activePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activePhoto.src} alt={viewingStudent.fullName} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-[#DCEBF4] text-[#0066FF] flex items-center justify-center text-3xl font-extrabold">
                    {viewingStudent.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                {activePhoto?.isProfile && (
                  <Badge className="absolute top-2 right-2 bg-[#DDF5EC] text-[#17A673] text-[9px] px-1.5 border-none font-bold">
                    <Star className="w-3 h-3 mr-0.5 inline" /> Profil
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
                      className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${activePhoto?.id === p.id ? 'border-[#0066FF]' : 'border-transparent hover:border-slate-200'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {canEdit && (
                <DialogFooter className="pt-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingId === viewingStudent.id}
                    onClick={() => triggerUpload(viewingStudent.id)}
                    className="gap-1.5 h-9 text-xs rounded-xl border-slate-200"
                  >
                    {uploadingId === viewingStudent.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    Ajouter une photo
                  </Button>
                  {activePhoto && !activePhoto.isProfile && (
                    <Button
                      size="sm"
                      onClick={() => handleSetProfile(activePhoto.id)}
                      className="gap-1.5 h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold"
                    >
                      <Star className="w-3.5 h-3.5" /> Définir comme profil
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* BULK PHOTO UPLOAD MODAL (§2.7) */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <FolderUp className="w-5 h-5 text-[#0066FF]" />
              Téléversement Groupé de Photos Élèves
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              Sélectionnez un dossier ou un ensemble d&apos;images. L&apos;assistant associera automatiquement chaque fichier à l&apos;élève correspondant en comparant le nom du fichier avec :
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 pl-2 text-[11px]">
              <li><strong>Le matricule</strong> : ex. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">ETU-2025-0042.jpg</code></li>
              <li><strong>Le nom complet</strong> : ex. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Yasmine_Benjelloun.png</code></li>
              <li><strong>L&apos;identifiant UUID</strong> : ex. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.jpg</code></li>
            </ul>

            <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png"
                onChange={handleBulkFilesSelect}
                className="hidden"
              />
              <FileImage className="w-10 h-10 text-[#0066FF] mx-auto mb-2" />
              <p className="font-bold text-[#16212B]">
                {bulkFiles.length > 0
                  ? `${bulkFiles.length} fichier(s) sélectionné(s)`
                  : 'Cliquez pour sélectionner les photos'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Formats acceptés : JPG, PNG (5 Mo max par photo)</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bulkFileInputRef.current?.click()}
                className="mt-3 h-8 text-xs rounded-xl border-slate-200 bg-white font-bold"
              >
                Parcourir les fichiers
              </Button>
            </div>

            {bulkResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-emerald-700">{bulkResult.matchedCount} photo(s) associées</span>
                  {bulkResult.unmatchedCount > 0 && (
                    <span className="text-amber-700">{bulkResult.unmatchedCount} non associée(s)</span>
                  )}
                </div>
                {bulkResult.unmatched.length > 0 && (
                  <p className="text-[10px] text-slate-500 truncate">
                    Non reconnus : {bulkResult.unmatched.slice(0, 5).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setBulkModalOpen(false)} className="h-9 text-xs rounded-xl border-slate-200">
              Fermer
            </Button>
            <Button
              onClick={handleBulkUploadSubmit}
              disabled={bulkUploading || bulkFiles.length === 0}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
            >
              {bulkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Lancer l&apos;association ({bulkFiles.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
