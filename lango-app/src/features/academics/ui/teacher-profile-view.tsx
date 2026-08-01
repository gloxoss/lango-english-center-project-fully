'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  BookOpen,
  AlertCircle,
  Camera,
} from 'lucide-react';

type ApiTeacherDetail = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  subjects: string[];
  cycle: string;
  status: string;
  workloadHours: number;
  hireDate?: string;
  avatarUrl?: string;
  documents: { contract?: boolean; cin?: boolean; diploma?: boolean };
  createdAt: string;
  assignedClassDetails: { classSectionId: string; label: string; studentCount: number }[];
};

export function TeacherProfile360View({ id, locale }: { id: string; locale: string }) {
  const [teacher, setTeacher] = useState<ApiTeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teachers?id=${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Enseignant introuvable.');
        return;
      }
      setTeacher(json.data);
    } catch (err) {
      console.error('Failed loading teacher detail', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('teacherId', id);
      formData.append('file', file);
      const res = await fetch('/api/teachers/photo', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success) {
        await load();
      }
    } catch (err) {
      console.error('Teacher photo upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (loading) {
    return <div className="max-w-[1600px] mx-auto text-sm text-slate-500">Chargement...</div>;
  }

  if (error || !teacher) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4">
        <Link href={`/${locale}/dashboard/teachers/manage`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#2487B8]">
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </Link>
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error ?? 'Enseignant introuvable.'}</span>
        </div>
      </div>
    );
  }

  const initials = teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const totalStudents = teacher.assignedClassDetails.reduce((sum, c) => sum + c.studentCount, 0);
  const docs: { key: keyof ApiTeacherDetail['documents']; label: string }[] = [
    { key: 'diploma', label: 'Diplôme' },
    { key: 'contract', label: 'Contrat de travail' },
    { key: 'cin', label: 'CIN' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/dashboard/teachers/manage`}>
          <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#2487B8]">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Fiche enseignant</h1>
      </div>

      {/* Teacher Profile Banner Card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handlePhotoChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Changer la photo"
              className="relative w-20 h-20 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-2xl shrink-0 overflow-hidden group"
            >
              {teacher.avatarUrl
                ? (
                    // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded file, not a build-time asset
                    <img src={teacher.avatarUrl} alt={teacher.name} className="w-full h-full object-cover" />
                  )
                : initials}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </span>
              {uploading && <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-[9px] font-bold text-slate-600">Envoi...</span>}
            </button>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold text-[#16212B]">{teacher.name}</h2>
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] hover:bg-[#DCEBF4]">{teacher.status}</Badge>
              </div>
              {teacher.specialization && (
                <p className="text-xs font-bold text-[#2487B8] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{teacher.specialization}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium pt-1">
                <span>Matricule: <strong className="text-slate-700 font-mono">{teacher.employeeId || '—'}</strong></span>
                {teacher.cycle && <span>Cycle: <strong className="text-slate-700">{teacher.cycle}</strong></span>}
                <span>Tél: <strong className="text-slate-700 font-mono">{teacher.phone || '—'}</strong></span>
                <span>Email: <strong className="text-slate-700">{teacher.email}</strong></span>
              </div>
              {teacher.subjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {teacher.subjects.map(s => (
                    <span key={s} className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stat Indicators */}
          <div className="grid grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto">
            <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
              <p className="text-[10px] text-slate-400 font-bold">Classes assignées</p>
              <p className="text-xl font-extrabold text-[#16212B]">{teacher.assignedClassDetails.length}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
              <p className="text-[10px] text-slate-400 font-bold">Élèves au total</p>
              <p className="text-xl font-extrabold text-[#16212B]">{totalStudents}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
              <p className="text-[10px] text-slate-400 font-bold">Heures hebdo</p>
              <p className="text-xl font-extrabold text-[#16212B]">{teacher.workloadHours ? `${teacher.workloadHours}h` : '—'}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Classes */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#16212B]">Classes assignées</h3>
            {teacher.assignedClassDetails.length === 0 && <p className="text-xs text-slate-400">Aucune classe assignée.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teacher.assignedClassDetails.map(cls => (
                <div key={cls.classSectionId} className="p-3.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#16212B] text-xs">{cls.label}</p>
                    <p className="text-[10px] text-slate-400">{cls.studentCount} élève(s)</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Rail: Personal Info & Documents */}
        <div className="space-y-6">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#16212B]">Informations</h3>
            <div className="space-y-2">
              <div>
                <p className="text-slate-400 text-[11px]">Date d&apos;embauche</p>
                <p className="font-semibold text-slate-700">{teacher.hireDate ? new Date(teacher.hireDate).toLocaleDateString('fr-FR') : '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Date d&apos;enregistrement</p>
                <p className="font-semibold text-slate-700">{new Date(teacher.createdAt).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#16212B]">Statut des documents</h3>
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.key} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <p className="font-bold text-[#16212B]">{d.label}</p>
                  {teacher.documents?.[d.key] ? (
                    <Badge className="bg-[#DCEBF4] text-[#1B6C93] gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" /><span>Fourni</span></Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500 gap-1 text-[10px]"><XCircle className="w-3 h-3" /><span>Manquant</span></Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
