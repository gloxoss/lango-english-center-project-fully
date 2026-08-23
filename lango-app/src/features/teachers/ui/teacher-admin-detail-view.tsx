'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarClock,
  Clock,
  CreditCard,
  Download,
  FileText,
  Fingerprint,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Employment = {
  contractType: string | null;
  employmentType: string | null;
  employmentStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  cnssNumber: string | null;
  amoNumber: string | null;
  bankRib: string | null;
};

type ClassDetail = { classSectionId: string; label: string; studentCount: number };

type TeacherDetail = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  subjects: string[];
  cycle: string;
  assignedClasses: string[];
  status: string;
  workloadHours: number;
  avatarUrl?: string;
  hireDate?: string;
  documents?: { contract?: boolean; cin?: boolean; diploma?: boolean };
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: string | null;
  salary?: string | null;
  qualification?: string | null;
  nationalId?: string | null;
  address?: string | null;
  city?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  lastLogin?: string | null;
  employment?: Employment | null;
  assignedClassDetails?: ClassDetail[];
};

const DOC_LABELS: Record<'contract' | 'cin' | 'diploma', string> = {
  contract: 'Contrat de travail',
  cin: 'CIN',
  diploma: 'Diplôme',
};

function formatMAD(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR');
}

function statusBadge(status: string) {
  if (status === 'Actif' || status === 'active') {
    return <Badge className="border-none bg-[#D1F5E8] px-2 py-0.5 text-[10px] text-[#17A673]">Actif</Badge>;
  }
  if (status === 'Congé' || status === 'leave') {
    return <Badge className="border-none bg-[#DCEBF4] px-2 py-0.5 text-[10px] text-[#1B6C93]">En congé</Badge>;
  }
  if (status === 'Incomplet') {
    return <Badge className="border-none bg-[#FCF0DC] px-2 py-0.5 text-[10px] text-[#E8A33D]">Incomplet</Badge>;
  }
  return <Badge className="border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{status || 'Inactif'}</Badge>;
}

function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400">{label}</p>
        <p className="truncate text-xs font-semibold text-[#16212B]">{value || '—'}</p>
      </div>
    </div>
  );
}

export function TeacherAdminDetailView({ id, locale }: { id: string; locale: string }) {
  const [data, setData] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState<'contract' | 'cin' | 'diploma' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teachers?id=${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setNotFound(true);
      }
    } catch {
      setError('Impossible de charger la fiche enseignant.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadDoc(type: 'contract' | 'cin' | 'diploma', file: File) {
    setUploading(type);
    setError(null);
    try {
      const form = new FormData();
      form.append('teacherId', id);
      form.append('type', type);
      form.append('file', file);
      const res = await fetch('/api/teachers/documents', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Échec de l\'envoi.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l\'envoi.');
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-16 text-center">
        <p className="text-lg font-extrabold text-[#16212B]">Enseignant introuvable</p>
        <p className="text-sm text-slate-500">Cette fiche n&apos;existe pas ou n&apos;appartient pas à cet établissement.</p>
        <Button asChild variant="outline" className="rounded-full">
          <Link href={`/${locale}/dashboard/teachers/manage`}>Retour à l&apos;annuaire</Link>
        </Button>
      </div>
    );
  }

  const initials = data.name.split(' ').map((n) => n[0]).join('').slice(0, 2);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href={`/${locale}/dashboard/teachers/manage`} aria-label="Retour">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Avatar className="size-14">
            {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={data.name} /> : null}
            <AvatarFallback className="bg-slate-200 text-base font-bold text-slate-700">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{data.name}</h1>
              {statusBadge(data.status)}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{data.specialization || 'Personnel pédagogique'}</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">Matricule : {data.employeeId || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-none bg-[#DCEBF4] px-2.5 py-1 text-[11px] text-[#1B6C93]">
            <Clock className="mr-1 inline size-3" /> {data.workloadHours ?? 0}h / semaine
          </Badge>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Classes', value: data.assignedClassDetails?.length ?? data.assignedClasses.length, icon: Users, color: 'text-emerald-600', bg: 'bg-[#D1F5E8]', fg: 'text-[#17A673]' },
          { label: 'Matières', value: data.subjects?.length ?? 0, icon: BookOpen, color: 'text-blue-600', bg: 'bg-[#DCEBF4]', fg: 'text-[#1B6C93]' },
          { label: 'Élèves', value: (data.assignedClassDetails ?? []).reduce((s, c) => s + c.studentCount, 0), icon: Users, color: 'text-amber-600', bg: 'bg-[#FCF0DC]', fg: 'text-[#E8A33D]' },
          { label: 'Salaire mensuel', value: formatMAD(data.salary), icon: Banknote, color: 'text-rose-600', bg: 'bg-[#FCE4E2]', fg: 'text-[#E5544B]', mono: true },
        ].map((kpi, i) => (
          <Card key={i} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-500">{kpi.label}</p>
              <p className={`text-xl font-extrabold text-[#16212B] ${kpi.mono ? 'text-base' : ''}`}>{kpi.value}</p>
            </div>
            <div className={`flex size-10 items-center justify-center rounded-full ${kpi.bg} ${kpi.fg}`}>
              <kpi.icon className="size-5" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: contact + employment */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-2">
              <IdCard className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">Contact & identité</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field icon={Mail} label="Email" value={data.email} />
              <Field icon={Phone} label="Téléphone" value={data.phone} />
              <Field icon={MapPin} label="Adresse" value={data.address} />
              <Field icon={MapPin} label="Ville" value={data.city} />
              <Field icon={Fingerprint} label="CIN" value={data.nationalId} />
              <Field icon={Calendar} label="Date de naissance" value={formatDate(data.dateOfBirth)} />
              <Field icon={User} label="Genre" value={data.gender ? (data.gender === 'female' ? 'Femme' : data.gender === 'male' ? 'Homme' : 'Autre') : null} />
              <Field icon={CalendarClock} label="Dernière connexion" value={data.lastLogin ? new Date(data.lastLogin).toLocaleString('fr-FR') : null} />
            </div>
          </Card>

          <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">Emploi & contrat</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field icon={Calendar} label="Date d'embauche" value={formatDate(data.hireDate)} />
              <Field icon={ShieldCheck} label="Qualification" value={data.qualification} />
              <Field icon={BookOpen} label="Cycle" value={data.cycle} />
              <Field icon={Banknote} label="Salaire" value={formatMAD(data.salary)} />
              <Field icon={Briefcase} label="Type de contrat" value={data.employment?.contractType?.toUpperCase() ?? '—'} />
              <Field icon={Briefcase} label="Type d'emploi" value={data.employment?.employmentType ?? '—'} />
              <Field icon={CalendarClock} label="Début de contrat" value={formatDate(data.employment?.contractStartDate)} />
              <Field icon={CalendarClock} label="Fin de contrat" value={formatDate(data.employment?.contractEndDate)} />
              <Field icon={ShieldCheck} label="CNSS" value={data.employment?.cnssNumber} />
              <Field icon={ShieldCheck} label="AMO" value={data.employment?.amoNumber} />
              <Field icon={CreditCard} label="RIB" value={data.employment?.bankRib} />
            </div>
          </Card>

          <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">Classes & matières</h2>
            </div>
            {(data.assignedClassDetails?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.assignedClassDetails!.map((c) => (
                  <div key={c.classSectionId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-bold text-[#16212B]">{c.label}</span>
                    <Badge className="border-none bg-white px-2 py-0.5 text-[10px] text-slate-600">{c.studentCount} élèves</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Aucune affectation de classe enregistrée.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(data.subjects ?? []).map((s) => (
                <Badge key={s} className="border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{s}</Badge>
              ))}
              {!data.subjects?.length && <span className="text-xs text-slate-400">Aucune matière enregistrée.</span>}
            </div>
          </Card>
        </div>

        {/* Right column: documents */}
        <Card className="h-fit space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#0066FF]" />
            <h2 className="text-sm font-extrabold text-[#16212B]">Documents de conformité</h2>
          </div>
          <p className="text-[10px] text-slate-400">Contrat de travail, CIN et diplôme — téléverser et consulter les pièces.</p>
          <div className="space-y-2.5">
            {(['contract', 'cin', 'diploma'] as const).map((type) => {
              const provided = data.documents?.[type] ?? false;
              return (
                <div key={type} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-[#16212B]">{DOC_LABELS[type]}</span>
                    </div>
                    {provided ? (
                      <Badge className="border-none bg-[#D1F5E8] px-1.5 py-0 text-[9px] text-[#17A673]">Fourni</Badge>
                    ) : (
                      <Badge className="border-none bg-[#FCE4E2] px-1.5 py-0 text-[9px] text-[#E5544B]">Manquant</Badge>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50">
                      {uploading === type ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      {uploading === type ? 'Envoi…' : provided ? 'Remplacer' : 'Téléverser'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadDoc(type, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {provided && (
                      <a
                        href={`/api/teachers/documents?id=${id}&type=${type}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 items-center justify-center gap-1 rounded-full bg-[#0066FF] px-3 text-[10px] font-bold text-white hover:bg-[#0052CC]"
                      >
                        <Download className="size-3.5" /> Voir
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
