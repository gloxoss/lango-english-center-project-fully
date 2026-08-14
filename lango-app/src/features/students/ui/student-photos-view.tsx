'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, Users, UserX, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type ApiStudentPhoto = { id: string; fullName: string; photoUrl: string | null };

export function StudentPhotosView() {
  const { can } = usePermissions();
  const [students, setStudents] = useState<ApiStudentPhoto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetStudentId = useRef<string | null>(null);

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
        setError(json.message || 'Échec du téléversement.');
        return;
      }
      setSuccess('Photo enregistrée avec succès.');
      await loadStudents();
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

  const filtered = students.filter(s => s.fullName.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const withPhoto = students.filter(s => s.photoUrl).length;
  const withoutPhoto = students.length - withPhoto;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} className="hidden" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Photos des élèves</h1>
          <p className="text-xs text-slate-500 mt-1">
            {can('students.update')
              ? 'Cliquez sur un élève pour téléverser sa photo de profil (JPG/PNG, 5 Mo max).'
              : 'Consultation seule.'}
          </p>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400">Total élèves</p><p className="text-2xl font-extrabold text-[#16212B]">{students.length}</p></div>
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-bold"><Users className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400">Avec photo</p><p className="text-2xl font-extrabold text-[#17A673]">{withPhoto}</p></div>
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center font-bold"><Camera className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400">Sans photo</p><p className="text-2xl font-extrabold text-amber-700">{withoutPhoto}</p></div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold"><UserX className="w-5 h-5" /></div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Rechercher un élève..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-white border-slate-200" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filtered.map(s => (
          <button
            key={s.id}
            type="button"
            disabled={!can('students.update')}
            onClick={() => triggerUpload(s.id)}
            className="text-left bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden transition-all enabled:hover:shadow-md disabled:cursor-default"
          >
            <div className="aspect-square bg-slate-50 relative flex items-center justify-center">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded file
                <img src={`/api/students/photos?id=${s.id}`} alt={s.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center text-base font-extrabold">
                  {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
              {uploadingId === s.id && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-[10px] font-bold text-[#2487B8]">Envoi...</div>
              )}
              <div className="absolute top-1.5 left-1.5">
                <Badge className={s.photoUrl ? 'bg-[#DDF5EC] text-[#17A673] text-[9px] px-1.5 border-none font-bold' : 'bg-slate-100 text-slate-500 text-[9px] px-1.5 border-none font-bold'}>
                  {s.photoUrl ? 'Photo' : 'Aucune'}
                </Badge>
              </div>
            </div>
            <div className="p-2.5">
              <p className="text-[11px] font-bold text-[#16212B] truncate">{s.fullName}</p>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-xs text-slate-400 col-span-full text-center py-8">Aucun élève trouvé.</p>}
      </div>
    </div>
  );
}

