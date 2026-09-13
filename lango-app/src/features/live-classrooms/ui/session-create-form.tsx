'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CalendarPlus, Video, AlertTriangle, CircleCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createSession, errorMessage } from '../data/api';

type Option = { id: string; name: string };
type SectionOption = { id: string; classId: string; className: string; sectionName: string };
type SubjectOption = { id: string; classId: string; subjectName: string };

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

const FIELD = 'w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start';
const LABEL = 'text-[11px] font-bold text-slate-500 block mb-1 text-start';

export function SessionCreateForm(props: {
  locale: string;
  profiles: Option[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  teachers: Option[];
  defaultTeacherId: string | null;
  isTeacher: boolean;
}) {
  const t = useTranslations('LiveClassrooms');
  const tCommon = useTranslations('Common');
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startDefault = toLocalInput(nextHour());
  const endDefault = toLocalInput(new Date(nextHour().getTime() + 60 * 60 * 1000));

  const [providerProfileId, setProviderProfileId] = useState('');
  const [classSectionId, setClassSectionId] = useState('');
  const [classSubjectId, setClassSubjectId] = useState('');
  const [teacherUserId, setTeacherUserId] = useState(props.defaultTeacherId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [scheduledStart, setScheduledStart] = useState(startDefault);
  const [scheduledEnd, setScheduledEnd] = useState(endDefault);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [chat, setChat] = useState(true);
  const [screenShare, setScreenShare] = useState(true);
  const [guestPolicy, setGuestPolicy] = useState<'allow' | 'deny'>('deny');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [createAsDraft, setCreateAsDraft] = useState(false);
  const [adminOverrideReason, setAdminOverrideReason] = useState('');

  const selectedSection = useMemo(
    () => props.sections.find(s => s.id === classSectionId) ?? null,
    [classSectionId, props.sections],
  );
  const sectionSubjects = useMemo(
    () => props.subjects.filter(s => s.classId === selectedSection?.classId),
    [props.subjects, selectedSection],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        providerProfileId,
        classSectionId,
        classSubjectId,
        teacherUserId,
        title: title.trim(),
        description: description.trim() || null,
        objectives: objectives.trim() || null,
        scheduledStart: new Date(scheduledStart).toISOString(),
        scheduledEnd: new Date(scheduledEnd).toISOString(),
        policy: {
          recordingEnabled,
          waitingRoom,
          chat,
          screenShare,
          guestPolicy,
          maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        },
        createAsDraft,
      };
      if (adminOverrideReason.trim()) body.adminOverrideReason = adminOverrideReason.trim();
      const session = await createSession(body) as { id: string };
      setNotice(t('sessionCreatedNotice'));
      router.push(`/${props.locale}/dashboard/academics/live-class/${session.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 cursor-pointer">
      <span className="text-[11px] font-bold text-slate-600">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#2487B8] w-4 h-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2" />
    </label>
  );

  return (
    <div className="max-w-[1000px] mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${props.locale}/dashboard/academics/live-class`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#2487B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" /> {t('backToSessions')}
        </Link>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
          <Video className="w-6 h-6 text-[#2487B8]" /> {t('newLiveClassTitle')}
        </h1>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2">
          <CircleCheck className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-4 space-y-4">
          <h2 className="text-xs font-extrabold text-[#16212B] text-start">{t('sectionCourseScope')}</h2>
          <div>
            <label className={LABEL}>{t('titleLabel')}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={255} placeholder={t('titlePlaceholder')}
              className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{t('descriptionLabel')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={4000} placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start" />
          </div>
          <div>
            <label className={LABEL}>{t('objectivesLabel')}</label>
            <textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={2} maxLength={4000} placeholder={t('objectivesPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-4 space-y-4">
          <h2 className="text-xs font-extrabold text-[#16212B] text-start">{t('sectionAcademicScope')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t('providerProfileLabel')}</label>
              <select value={providerProfileId} onChange={e => setProviderProfileId(e.target.value)} required className={FIELD}>
                <option value="">{t('chooseProfileOption')}</option>
                {props.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>{t('classSectionLabel')}</label>
              <select value={classSectionId} onChange={e => { setClassSectionId(e.target.value); setClassSubjectId(''); }} required className={FIELD}>
                <option value="">{t('chooseClassOption')}</option>
                {props.sections.map(s => (
                  <option key={s.id} value={s.id}>{`${s.className} ${s.sectionName}`.trim()}</option>
                ))}
              </select>
              {props.sections.length === 0 && <p className="text-[10px] font-semibold text-amber-600 mt-1 text-start">{t('noSectionsAvailable')}</p>}
            </div>
            <div>
              <label className={LABEL}>{t('subjectLabel')}</label>
              <select value={classSubjectId} onChange={e => setClassSubjectId(e.target.value)} required className={FIELD}>
                <option value="">{t('chooseSubjectOption')}</option>
                {sectionSubjects.map(s => <option key={s.id} value={s.id}>{s.subjectName}</option>)}
              </select>
              {selectedSection && sectionSubjects.length === 0 && (
                <p className="text-[10px] font-semibold text-amber-600 mt-1 text-start">{t('noSubjectsAssigned')}</p>
              )}
            </div>
            <div>
              <label className={LABEL}>{t('teacherLabel')}</label>
              <select value={teacherUserId} onChange={e => setTeacherUserId(e.target.value)} required disabled={props.isTeacher} className={`${FIELD} disabled:bg-slate-50 disabled:text-slate-400`}>
                {props.teachers.map(tOption => <option key={tOption.id} value={tOption.id}>{tOption.name}</option>)}
              </select>
              {props.isTeacher && <p className="text-[10px] font-semibold text-slate-400 mt-1 text-start">{t('autoHostTeacherNote')}</p>}
            </div>
          </div>
          {!props.isTeacher && (
            <div>
              <label className={LABEL}>{t('adminOverrideLabel')}</label>
              <input value={adminOverrideReason} onChange={e => setAdminOverrideReason(e.target.value)} maxLength={1000} placeholder={t('adminOverridePlaceholder')}
                className={FIELD} />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-4 space-y-4">
          <h2 className="text-xs font-extrabold text-[#16212B] text-start">{t('sectionScheduling')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t('startLabel')}</label>
              <input type="datetime-local" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} required className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>{t('endLabel')}</label>
              <input type="datetime-local" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} required className={FIELD} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-4 space-y-3">
          <h2 className="text-xs font-extrabold text-[#16212B] text-start">{t('sectionPolicy')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle label={t('recordingAllowed')} checked={recordingEnabled} onChange={setRecordingEnabled} />
            <Toggle label={t('waitingRoomEnabled')} checked={waitingRoom} onChange={setWaitingRoom} />
            <Toggle label={t('chatEnabled')} checked={chat} onChange={setChat} />
            <Toggle label={t('screenShareEnabled')} checked={screenShare} onChange={setScreenShare} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t('guestAccessLabel')}</label>
              <select value={guestPolicy} onChange={e => setGuestPolicy(e.target.value as 'allow' | 'deny')} className={FIELD}>
                <option value="deny">{t('guestDeny')}</option>
                <option value="allow">{t('guestAllow')}</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>{t('maxParticipantsLabel')}</label>
              <input type="number" min={1} max={1000} value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} className={FIELD} />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={createAsDraft} onChange={e => setCreateAsDraft(e.target.checked)} className="accent-[#2487B8] w-4 h-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2" />
            <span className="text-[11px] font-bold text-slate-600">{t('createAsDraftLabel')}</span>
          </label>
          <button type="submit" disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2487B8] px-5 text-xs font-bold text-white hover:bg-[#1B6C93] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            {busy ? t('creatingSession') : t('submitCreateBtn')}
          </button>
        </div>
      </form>
    </div>
  );
}
