'use client';

import type { TeacherDetail } from '../model/types';
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
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTeacherDetail } from '../data/directory-api';
import { TeacherStatusBadge } from './teacher-directory-table';

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR');
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

const MISSING_LABEL_KEYS: Record<string, string> = {
  contract: 'docContract',
  cin: 'docCin',
  diploma: 'docDiploma',
  employeeId: 'employeeIdLabel',
  hireDate: 'hireDate',
  specialization: 'specialty',
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  primary: 'role_primary',
  assistant: 'role_assistant',
  support: 'role_support',
  substitute: 'role_substitute',
};

export function TeacherAdminDetailView({ id, locale }: { id: string; locale: string }) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const [data, setData] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState<'contract' | 'cin' | 'diploma' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const result = await fetchTeacherDetail(id);
    if (result.ok) {
      setData(result.data);
      setNotFound(false);
    } else if (result.status === 404) {
      setNotFound(true);
    } else {
      setLoadError(true);
    }
    setLoading(false);
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || json?.message || t('errDocUpload'));
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
      <div className="mx-auto max-w-[1400px] space-y-6" aria-busy="true">
        <Skeleton className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="
          grid grid-cols-2 gap-4
          lg:grid-cols-4
        "
        >
          {[0, 1, 2, 3].map(i => (
            <Skeleton
              key={i}
              className="h-24 rounded-2xl bg-slate-200/70"
            />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl bg-slate-200/70" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-16 text-center">
        <p className="text-lg font-extrabold text-[#16212B]">{t('loadErrorTitle')}</p>
        <Button variant="outline" className="rounded-full" onClick={load}>{t('retry')}</Button>
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

  const initials = data.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const currentClasses = data.classAssignments.filter(item => item.isCurrent);
  const pastClasses = data.classAssignments.filter(item => !item.isCurrent);
  const currentSubjects = data.subjectAssignments.filter(item => item.isCurrent);
  const pastSubjects = data.subjectAssignments.filter(item => !item.isCurrent);

  const docLabels: Record<'contract' | 'cin' | 'diploma', string> = {
    contract: t('docContract'),
    cin: t('docCin'),
    diploma: t('docDiploma'),
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {error && (
        <div
          role="alert"
          className="
            rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs
            font-semibold text-rose-700
          "
        >
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href={`/${locale}/dashboard/teachers/manage`} aria-label={tCommon('back')}>
              <ArrowLeft className="
                size-4
                rtl:rotate-180
              "
              />
            </Link>
          </Button>
          <Avatar className="size-14">
            {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={data.name} /> : null}
            <AvatarFallback className="
              bg-slate-200 text-base font-bold text-slate-700
            "
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="
                text-2xl font-extrabold tracking-tight text-[#16212B]
              "
              >
                {data.name}
              </h1>
              <TeacherStatusBadge status={data.status} />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{data.specialization || t('teachingStaffFallback')}</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              {t('matriculeLabel', { id: data.employeeId || '—' })}
              {data.branchName ? ` · ${data.branchName}` : ''}
            </p>
          </div>
        </div>
        <Badge className="
          border-none bg-[#DCEBF4] px-2.5 py-1 text-[11px] text-[#1B6C93]
        "
        >
          <Clock className="me-1 inline size-3" />
          {data.weeklyScheduledHours === null ? t('noPlannedWorkload') : t('hoursPerWeek', { hours: data.weeklyScheduledHours })}
        </Badge>
      </div>

      {/* KPI strip (academic only — no salary KPI) */}
      <div className="
        grid grid-cols-2 gap-4
        lg:grid-cols-4
      "
      >
        {[
          { label: t('kpiClasses'), value: String(currentClasses.length), icon: Users, bg: 'bg-[#D1F5E8]', fg: 'text-[#17A673]' },
          { label: t('kpiSubjects'), value: String(currentSubjects.length), icon: BookOpen, bg: 'bg-[#DCEBF4]', fg: 'text-[#1B6C93]' },
          { label: t('kpiStudents'), value: String(currentClasses.reduce((sum, item) => sum + item.studentCount, 0)), icon: Users, bg: 'bg-[#FCF0DC]', fg: 'text-[#E8A33D]' },
          { label: t('colWorkload'), value: data.weeklyScheduledHours === null ? '—' : t('hoursPerWeek', { hours: data.weeklyScheduledHours }), icon: Clock, bg: 'bg-[#FCE4E2]', fg: 'text-[#E5544B]' },
        ].map(kpi => (
          <Card
            key={kpi.label}
            className="
              flex items-center justify-between rounded-2xl border
              border-slate-200/80 bg-white p-5 shadow-2xs
            "
          >
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-bold text-slate-500">{kpi.label}</p>
              <p className="truncate text-xl font-extrabold text-[#16212B]" title={kpi.value}>{kpi.value}</p>
            </div>
            <div className={`
              flex size-10 shrink-0 items-center justify-center rounded-full
              ${kpi.bg}
              ${kpi.fg}
            `}
            >
              <kpi.icon className="size-5" />
            </div>
          </Card>
        ))}
      </div>

      <div className="
        grid grid-cols-1 gap-6
        lg:grid-cols-3
      "
      >
        <div className="
          space-y-6
          lg:col-span-2
        "
        >
          <Card className="
            space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center gap-2">
              <IdCard className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('contactAndIdentity')}</h2>
            </div>
            <div className="
              grid grid-cols-1 gap-4
              sm:grid-cols-2
            "
            >
              <Field icon={Mail} label={t('email')} value={data.email} />
              <Field icon={Phone} label={t('phone')} value={data.phone} />
              {data.sensitiveHr && <Field icon={Fingerprint} label={t('cin')} value={data.sensitiveHr.nationalId} />}
              {data.sensitiveHr && <Field icon={Calendar} label={t('dateOfBirth')} value={formatDate(data.sensitiveHr.dateOfBirth, locale)} />}
              {data.sensitiveHr && <Field icon={MapPin} label={t('address')} value={data.sensitiveHr.address} />}
              {data.sensitiveHr && <Field icon={MapPin} label={t('city')} value={data.sensitiveHr.city} />}
              <Field icon={CalendarClock} label={t('lastLogin')} value={data.lastLogin ? new Date(data.lastLogin).toLocaleString(locale) : null} />
            </div>
            {!data.sensitiveHr && (
              <p className="
                flex items-center gap-1.5 border-t pt-3 text-[10px]
                text-slate-400
              "
              >
                <Lock className="size-3" />
                {' '}
                {t('hrSensitiveRestricted')}
              </p>
            )}
          </Card>

          <Card className="
            space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('employmentAndContract')}</h2>
            </div>
            <div className="
              grid grid-cols-1 gap-4
              sm:grid-cols-2
            "
            >
              <Field icon={Calendar} label={t('hireDate')} value={formatDate(data.hireDate, locale)} />
              <Field icon={ShieldCheck} label={t('qualification')} value={data.qualification} />
              <Field icon={BookOpen} label={t('cycle')} value={data.cycle} />
              <Field icon={Briefcase} label={t('contractType')} value={data.employment?.contractType?.toUpperCase() ?? '—'} />
              <Field icon={Briefcase} label={t('employmentType')} value={data.employment?.employmentType ? (t.has(`employmentTypes.${data.employment.employmentType}`) ? t(`employmentTypes.${data.employment.employmentType}`) : data.employment.employmentType) : '—'} />
              <Field icon={CalendarClock} label={t('contractStart')} value={formatDate(data.employment?.contractStartDate, locale)} />
              <Field icon={CalendarClock} label={t('contractEnd')} value={formatDate(data.employment?.contractEndDate, locale)} />
              <Field icon={Briefcase} label={t('employmentStatusLabel')} value={data.employment?.employmentStatus ?? '—'} />
            </div>
            {data.sensitiveHr
              ? (
                  <div className="
                    grid grid-cols-1 gap-4 border-t pt-4
                    sm:grid-cols-2
                  "
                  >
                    <Field icon={Banknote} label={t('salaryMad')} value={data.sensitiveHr.salary} />
                    <Field icon={ShieldCheck} label={t('cnss')} value={data.sensitiveHr.cnssNumber} />
                    <Field icon={ShieldCheck} label={t('amo')} value={data.sensitiveHr.amoNumber} />
                    <Field icon={CreditCard} label={t('bankRib')} value={data.sensitiveHr.bankRib} />
                  </div>
                )
              : (
                  <p className="
                    flex items-center gap-1.5 border-t pt-3 text-[10px]
                    text-slate-400
                  "
                  >
                    <Lock className="size-3" />
                    {' '}
                    {t('hrSensitiveRestricted')}
                  </p>
                )}
          </Card>

          <Card className="
            space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#0066FF]" />
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('classesAndSubjects')}</h2>
            </div>

            <div className="space-y-2">
              <p className="
                text-[11px] font-bold tracking-wide text-slate-400 uppercase
              "
              >
                {t('currentAssignments')}
              </p>
              {currentClasses.length > 0
                ? (
                    <div className="
                      grid grid-cols-1 gap-3
                      sm:grid-cols-2
                    "
                    >
                      {currentClasses.map(classItem => (
                        <div
                          key={classItem.id}
                          className="
                            flex items-center justify-between rounded-xl
                            bg-slate-50 px-3 py-2.5
                          "
                        >
                          <span className="text-xs font-bold text-[#16212B]">{classItem.label}</span>
                          <Badge className="
                            border-none bg-white px-2 py-0.5 text-[10px]
                            text-slate-600
                          "
                          >
                            {classItem.studentCount}
                            {' '}
                            {t('kpiStudents')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )
                : (
                    <p className="text-xs text-slate-400">{t('noClassAssigned')}</p>
                  )}
              <div className="flex flex-wrap gap-1.5">
                {currentSubjects.map(subject => (
                  <Badge
                    key={subject.id}
                    className="
                      border-none bg-slate-100 px-2 py-0.5 text-[10px]
                      text-slate-700
                    "
                  >
                    {subject.subjectName}
                    {' '}
                    ·
                    {subject.classLabel}
                  </Badge>
                ))}
                {currentSubjects.length === 0 && (
                  <span className="text-xs text-slate-400">
                    {t('noSubjectsRegistered')}
                  </span>
                )}
              </div>
            </div>

            {(pastClasses.length > 0 || pastSubjects.length > 0) && (
              <div className="space-y-2 border-t pt-3">
                <p className="
                  text-[11px] font-bold tracking-wide text-slate-400 uppercase
                "
                >
                  {t('historicalAssignments')}
                </p>
                <div className="space-y-1.5">
                  {pastClasses.map(classItem => (
                    <div
                      key={classItem.id}
                      className="
                        flex items-center justify-between rounded-lg
                        bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500
                      "
                    >
                      <span>
                        {classItem.label}
                        {' '}
                        ·
                        {' '}
                        {t(ROLE_LABEL_KEYS[classItem.role] ?? 'role_primary')}
                      </span>
                      <span>
                        {formatDate(classItem.startsOn, locale)}
                        {' '}
                        →
                        {' '}
                        {formatDate(classItem.endsOn, locale)}
                      </span>
                    </div>
                  ))}
                  {pastSubjects.map(subject => (
                    <div
                      key={subject.id}
                      className="
                        flex items-center justify-between rounded-lg
                        bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500
                      "
                    >
                      <span>
                        {subject.subjectName}
                        {' '}
                        ·
                        {' '}
                        {subject.classLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card className="
          h-fit space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        >
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#0066FF]" />
            <h2 className="text-sm font-extrabold text-[#16212B]">{t('complianceDocs')}</h2>
          </div>
          {!data.dossier.complete
            ? (
                <div className="flex flex-wrap gap-1">
                  {data.dossier.missingItems.map(item => (
                    <span
                      key={item}
                      className="
                        rounded-full bg-[#FCE4E2] px-2 py-0.5 text-[9px]
                        font-bold text-[#C43D34]
                      "
                    >
                      {t(MISSING_LABEL_KEYS[item] ?? 'dossierLabel')}
                    </span>
                  ))}
                </div>
              )
            : (
                <p className="
                  rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold
                  text-emerald-700
                "
                >
                  {t('dossierComplete')}
                </p>
              )}
          <div className="space-y-2.5">
            {(['contract', 'cin', 'diploma'] as const).map((type) => {
              const provided = data.documents[type];
              return (
                <div
                  key={type}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-[#16212B]">{docLabels[type]}</span>
                    </div>
                    {provided
                      ? (
                          <Badge className="
                            border-none bg-[#D1F5E8] px-1.5 py-0 text-[9px]
                            text-[#17A673]
                          "
                          >
                            {t('docProvided')}
                          </Badge>
                        )
                      : (
                          <Badge className="
                            border-none bg-[#FCE4E2] px-1.5 py-0 text-[9px]
                            text-[#E5544B]
                          "
                          >
                            {t('docMissing')}
                          </Badge>
                        )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <label className="
                      flex h-9 flex-1 cursor-pointer items-center justify-center
                      gap-1.5 rounded-full border border-slate-200 bg-white
                      text-[10px] font-bold text-slate-600
                      hover:bg-slate-50
                    "
                    >
                      {uploading === type
                        ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          )
                        : (
                            <Upload className="size-3.5" />
                          )}
                      {uploading === type ? t('docUploading') : provided ? t('docReplace') : t('docUpload')}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            uploadDoc(type, file);
                          }
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {provided && (
                      <a
                        href={`/api/teachers/documents?id=${id}&type=${type}`}
                        target="_blank"
                        rel="noreferrer"
                        className="
                          flex h-9 items-center justify-center gap-1
                          rounded-full bg-[#0066FF] px-3 text-[10px] font-bold
                          text-white
                          hover:bg-[#0052CC]
                        "
                      >
                        <Download className="size-3.5" />
                        {' '}
                        {t('docView')}
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
