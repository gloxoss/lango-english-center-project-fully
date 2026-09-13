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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  const [data, setData] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState<'contract' | 'cin' | 'diploma' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docLabels: Record<'contract' | 'cin' | 'diploma', string> = {
    contract: t('docContract'),
    cin: t('docCin'),
    diploma: t('docDiploma'),
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'Actif' || status === 'active') {
      return <Badge className="border-none bg-[#D1F5E8] px-2 py-0.5 text-[10px] text-[#17A673]">{tStatus('active')}</Badge>;
    }
    if (status === 'Congé' || status === 'leave') {
      return <Badge className="border-none bg-[#DCEBF4] px-2 py-0.5 text-[10px] text-[#1B6C93]">{t('statusOnLeave')}</Badge>;
    }
    if (status === 'Incomplet') {
      return <Badge className="border-none bg-[#FCF0DC] px-2 py-0.5 text-[10px] text-[#E8A33D]">{t('statusIncomplete')}</Badge>;
    }
    return <Badge className="border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{status === 'inactive' ? tStatus('inactive') : (status || t('statusInactive'))}</Badge>;
  };

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
      setError(t('errLoadTeacher'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
        throw new Error(json.message || t('errDocUpload'));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errDocUpload'));
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
        <p className="text-lg font-extrabold text-[#16212B]">{t('teacherNotFoundTitle')}</p>
        <p className="text-sm text-slate-500">{t('teacherNotFoundDesc')}</p>
        <Button asChild variant="outline" className="rounded-full">
          <Link href={`/${locale}/dashboard/teachers/manage`}>{t('backToDirectory')}</Link>
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
            <Link href={`/${locale}/dashboard/teachers/manage`} aria-label={tCommon('back')}>
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Avatar className="size-14">
            {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={data.name} /> : null}
            <AvatarFallback className="bg-slate-200 text-base font-bold text-slate-700">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{data.name}</h1>
              {renderStatusBadge(data.status)}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{data.specialization || t('teachingStaffFallback')}</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">{t('matriculeLabel', { id: data.employeeId || '—' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-none bg-[#DCEBF4] px-2.5 py-1 text-[11px] text-[#1B6C93]">
            <Clock className="me-1 inline size-3" /> {t('hoursPerWeek', { hours: data.workloadHours ?? 0 })}
          </Badge>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('kpiClasses'), value: data.assignedClassDetails?.length ?? data.assignedClasses.length, icon: Users, bg: 'bg-[#D1F5E8]', fg: 'text-[#17A673]' },
          { label: t('kpiSubjects'), value: data.subjects?.length ?? 0, icon: BookOpen, bg: 'bg-[#DCEBF4]', fg: 'text-[#1B6C93]' },
          { label: t('kpiStudents'), value: (data.assignedClassDetails ?? []).reduce((s, c) => s + c.studentCount, 0), icon: Users, bg: 'bg-[#FCF0DC]', fg: 'text-[#E8A33D]' },
          { label: t('kpiMonthlySalary'), value: formatMAD(data.salary), icon: Banknote, bg: 'bg-[#FCE4E2]', fg: 'text-[#E5544B]', mono: true },
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
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('contactAndIdentity')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field icon={Mail} label={t('email')} value={data.email} />
              <Field icon={Phone} label={t('phone')} value={data.phone} />
              <Field icon={MapPin} label={t('address')} value={data.address} />
              <Field icon={MapPin} label={t('city')} value={data.city} />
              <Field icon={Fingerprint} label={t('cin')} value={data.nationalId} />
              <Field icon={Calendar} label={t('dateOfBirth')} value={formatDate(data.dateOfBirth)} />
              <Field icon={User} label={t('gender')} value={data.gender ? (data.gender === 'female' ? t('genderFemale') : data.gender === 'male' ? t('genderMale') : t('genderOther')) : null} />
              <Field icon={CalendarClock} label={t('lastLogin')} value={data.lastLogin ? new Date(data.lastLogin).toLocaleString('fr-FR') : null} />
            </div>
          </Card>

          <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('employmentAndContract')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field icon={Calendar} label={t('hireDate')} value={formatDate(data.hireDate)} />
              <Field icon={ShieldCheck} label={t('qualification')} value={data.qualification} />
              <Field icon={BookOpen} label={t('cycle')} value={data.cycle} />
              <Field icon={Banknote} label={t('salary')} value={formatMAD(data.salary)} />
              <Field icon={Briefcase} label={t('contractType')} value={data.employment?.contractType?.toUpperCase() ?? '—'} />
              <Field icon={Briefcase} label={t('employmentType')} value={data.employment?.employmentType ?? '—'} />
              <Field icon={CalendarClock} label={t('contractStart')} value={formatDate(data.employment?.contractStartDate)} />
              <Field icon={CalendarClock} label={t('contractEnd')} value={formatDate(data.employment?.contractEndDate)} />
              <Field icon={ShieldCheck} label={t('cnss')} value={data.employment?.cnssNumber} />
              <Field icon={ShieldCheck} label={t('amo')} value={data.employment?.amoNumber} />
              <Field icon={CreditCard} label={t('bankRib')} value={data.employment?.bankRib} />
            </div>
          </Card>

          <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('classesAndSubjects')}</h2>
            </div>
            {(data.assignedClassDetails?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.assignedClassDetails!.map((c) => (
                  <div key={c.classSectionId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-bold text-[#16212B]">{c.label}</span>
                    <Badge className="border-none bg-white px-2 py-0.5 text-[10px] text-slate-600">{c.studentCount} {t('kpiStudents')}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{t('noClassAssigned')}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(data.subjects ?? []).map((s) => (
                <Badge key={s} className="border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{s}</Badge>
              ))}
              {!data.subjects?.length && <span className="text-xs text-slate-400">{t('noSubjectsRegistered')}</span>}
            </div>
          </Card>
        </div>

        {/* Right column: documents */}
        <Card className="h-fit space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#0066FF]" />
            <h2 className="text-sm font-extrabold text-[#16212B]">{t('complianceDocs')}</h2>
          </div>
          <p className="text-[10px] text-slate-400">{t('complianceDocsDesc')}</p>
          <div className="space-y-2.5">
            {(['contract', 'cin', 'diploma'] as const).map((type) => {
              const provided = data.documents?.[type] ?? false;
              return (
                <div key={type} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-[#16212B]">{docLabels[type]}</span>
                    </div>
                    {provided ? (
                      <Badge className="border-none bg-[#D1F5E8] px-1.5 py-0 text-[9px] text-[#17A673]">{t('docProvided')}</Badge>
                    ) : (
                      <Badge className="border-none bg-[#FCE4E2] px-1.5 py-0 text-[9px] text-[#E5544B]">{t('docMissing')}</Badge>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50">
                      {uploading === type ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      {uploading === type ? t('docUploading') : provided ? t('docReplace') : t('docUpload')}
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
                        <Download className="size-3.5" /> {t('docView')}
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
