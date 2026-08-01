'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentAttendanceHeatmap } from '@/features/students/ui/student-attendance-heatmap';
import {
  ArrowLeft,
  Clock,
  Wallet,
  Star,
  Smile,
  FileText,
  AlertCircle,
  Upload,
} from 'lucide-react';

type ApiStudentDocument = { documentType: string; uploaded: boolean; uploadedAt: string | null };

const DOCUMENT_LABELS: Record<string, string> = {
  photo: 'Photo d\'identité',
  birth_certificate: 'Acte de naissance',
  school_certificate: 'Certificat de scolarité',
  guardian_cni: 'CNI du tuteur',
  bulletin: 'Bulletins scolaires',
};

type ApiStudentDetail = {
  id: string;
  matricule: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  level: string | null;
  className: string | null;
  guardianName: string | null;
  phone: string | null;
  status: string;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  nationalId: string | null;
  photoUrl: string | null;
  createdAt: string;
  guardians: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; relationshipType: string }[];
  attendance: { last30Days: { date: string; status: string; lateMinutes: number | null }[]; rate: number | null };
  payments: { id: string; amount: number; paymentMethod: string; paymentDate: string }[];
  balanceDue: number;
};

function age(dateOfBirth: string | null): string {
  if (!dateOfBirth) {
    return '—';
  }
  const years = Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} ans`;
}

function formatMad(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`;
}

export function StudentProfile360View({ id, locale }: { id: string; locale: string }) {
  const [student, setStudent] = useState<ApiStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ApiStudentDocument[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetType = useRef<string | null>(null);

  useEffect(() => {
    async function loadStudent() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/students?id=${id}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || 'Élève introuvable.');
          return;
        }
        setStudent(json.data);
      } catch (err) {
        console.error('Failed loading student detail', err);
        setError('Connexion impossible. Vérifiez votre réseau.');
      } finally {
        setLoading(false);
      }
    }
    loadStudent();
  }, [id]);

  async function loadDocuments() {
    try {
      const res = await fetch(`/api/students/documents?studentId=${id}`);
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data);
      }
    } catch (err) {
      console.error('Failed loading student documents', err);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [id]);

  function triggerUpload(documentType: string) {
    uploadTargetType.current = documentType;
    fileInputRef.current?.click();
  }

  async function handleDocumentFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const documentType = uploadTargetType.current;
    if (!file || !documentType) {
      return;
    }
    setUploadingType(documentType);
    try {
      const formData = new FormData();
      formData.append('studentId', id);
      formData.append('documentType', documentType);
      formData.append('file', file);
      const res = await fetch('/api/students/documents', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success) {
        await loadDocuments();
      }
    } catch (err) {
      console.error('Document upload failed', err);
    } finally {
      setUploadingType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (loading) {
    return <div className="max-w-[1600px] mx-auto text-sm text-slate-500">Chargement...</div>;
  }

  if (error || !student) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4">
        <Link href={`/${locale}/dashboard/students`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#2487B8]">
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;annuaire</span>
        </Link>
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error ?? 'Élève introuvable.'}</span>
        </div>
      </div>
    );
  }

  const initials = student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Back Link */}
      <Link href={`/${locale}/dashboard/students`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#2487B8]">
        <ArrowLeft className="w-4 h-4" />
        <span>Fiche élève</span>
      </Link>

      {/* Main Student Card Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-2xl border-4 border-white shadow-md overflow-hidden">
              {student.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded file, not a build-time asset
                <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-[#16212B]">{student.fullName}</h1>
                <span className="inline-flex items-center gap-1 bg-[#DCEBF4] text-[#1B6C93] text-xs font-bold px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2487B8]"></span>
                  {student.status}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500">{student.className ?? student.level ?? 'Non classé'}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span><strong className="text-slate-700">Matricule:</strong> {student.matricule ?? '—'}</span>
                <span><strong className="text-slate-700">Tuteur légal:</strong> {student.guardianName ?? '—'}</span>
                <span><strong className="text-slate-700">Téléphone:</strong> {student.phone ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Taux de présence (30j)</p>
            <p className="text-2xl font-extrabold text-[#16212B] mt-1">{student.attendance.rate !== null ? `${student.attendance.rate}%` : '—'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Solde dû</p>
            <p className="text-2xl font-extrabold text-[#16212B] mt-1">{formatMad(student.balanceDue)}</p>
            <p className="text-[11px] font-bold text-[#2487B8] mt-0.5">{student.balanceDue === 0 ? 'À jour' : 'Solde à régler'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Moyenne générale</p>
            <p className="text-lg font-extrabold text-slate-400 mt-1">Non disponible</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Star className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">Comportement</p>
            <p className="text-lg font-extrabold text-slate-400 mt-1">Non disponible</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Smile className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations Personnelles */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#16212B]">Informations personnelles</h3>
          <div className="space-y-3 text-xs">
            <div>
              <p className="text-slate-400 text-[11px]">Date de naissance</p>
              <p className="font-semibold text-slate-700">{student.dateOfBirth ? `${new Date(student.dateOfBirth).toLocaleDateString('fr-FR')} (${age(student.dateOfBirth)})` : '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Genre</p>
              <p className="font-semibold text-slate-700">{student.gender ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Adresse</p>
              <p className="font-semibold text-slate-700">{student.address ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Téléphone</p>
              <p className="font-mono font-semibold text-slate-700">{student.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Email</p>
              <p className="font-semibold text-slate-700">{student.email}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Date d&apos;inscription</p>
              <p className="font-semibold text-slate-700">{new Date(student.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        </Card>

        {/* Tuteurs */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#16212B]">Parents & tuteurs</h3>
          <div className="space-y-3 text-xs">
            {student.guardians.length === 0 && <p className="text-slate-400">Aucun tuteur lié.</p>}
            {student.guardians.map(g => (
              <div key={g.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-[#16212B]">{g.firstName} {g.lastName}</p>
                <p className="text-[10px] text-slate-400">{g.relationshipType}</p>
                <p className="text-[11px] text-slate-600 mt-1">{g.phone ?? '—'}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Présence - 30 derniers jours */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#16212B]">Présence — 30 derniers jours</h3>
          <div className="space-y-1.5 text-xs max-h-[220px] overflow-y-auto">
            {student.attendance.last30Days.length === 0 && <p className="text-slate-400">Aucune présence enregistrée.</p>}
            {student.attendance.last30Days.map(a => (
              <div key={a.date} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-none">
                <span className="text-slate-600">{new Date(`${a.date}T00:00:00`).toLocaleDateString('fr-FR')}</span>
                <Badge className={
                  a.status === 'present' ? 'bg-[#DCEBF4] text-[#1B6C93] text-[10px]'
                    : a.status === 'excused' ? 'bg-purple-100 text-purple-800 text-[10px]'
                      : a.status === 'late' ? 'bg-[#FCF0DC] text-[#E8A33D] text-[10px]'
                        : 'bg-[#FCE4E2] text-[#E5544B] text-[10px]'
                }
                >
                  {a.status === 'present'
                    ? 'Présent'
                    : a.status === 'excused'
                      ? 'Excusé'
                      : a.status === 'late'
                        ? `Retard${a.lateMinutes ? ` (${a.lateMinutes} min)` : ''}`
                        : 'Absent'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Paiements Récents */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#16212B]">Paiements récents</h3>
          <div className="space-y-3 text-xs">
            {student.payments.length === 0 && <p className="text-slate-400">Aucun paiement enregistré.</p>}
            {student.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400">{new Date(p.paymentDate).toLocaleDateString('fr-FR')}</p>
                <p className="font-bold text-[#16212B]">{formatMad(p.amount)}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Heatmap de présence mensuelle */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs lg:col-span-3">
          <h3 className="text-sm font-bold text-[#16212B] mb-4">Historique de présence</h3>
          <StudentAttendanceHeatmap studentId={student.id} />
        </Card>

        {/* Notes - not yet available */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#16212B]">Notes récentes</h3>
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <FileText className="w-6 h-6 text-slate-300" />
            <p className="text-[11px] text-slate-400">Le module de notation n&apos;est pas encore disponible.</p>
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-[#16212B]">Documents</h3>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleDocumentFileChange} className="hidden" />
          {documents.map(doc => (
            <div key={doc.documentType} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[11px] font-bold text-[#16212B]">{DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}</p>
              </div>
              {doc.uploaded ? (
                <Badge className="bg-[#D1F5E8] text-[#17A673] text-[10px]">Fourni</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerUpload(doc.documentType)}
                  disabled={uploadingType === doc.documentType}
                  className="h-7 gap-1 rounded-lg px-2.5 text-[10px]"
                >
                  <Upload className="w-3 h-3" />
                  {uploadingType === doc.documentType ? 'Envoi...' : 'Téléverser'}
                </Button>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
