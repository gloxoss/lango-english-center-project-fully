'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Teacher = { id: string; name: string };
type Slot = { id: string; teacherId: string; dayOfWeek: string; startTime: string; endTime: string };

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function TeacherAvailabilityClient() {
  const t = useTranslations('Academics');
  const tc = useTranslations('Common');

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ teacherId: '', dayOfWeek: 'monday', startTime: '08:00', endTime: '17:00' });

  const getDayLabel = (day: string) => {
    switch (day.toLowerCase()) {
      case 'monday': return t('dayMonday');
      case 'tuesday': return t('dayTuesday');
      case 'wednesday': return t('dayWednesday');
      case 'thursday': return t('dayThursday');
      case 'friday': return t('dayFriday');
      case 'saturday': return t('daySaturday');
      case 'sunday': return t('daySunday');
      default: return day;
    }
  };

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/academics/teacher-availability');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('loadAvailabilitiesError'));
      }
      setSlots(json.data as Slot[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadAvailabilitiesError'));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/teachers?pageSize=200');
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) {
            setTeachers(json.data as Teacher[]);
          }
        }
      } catch {
        // Offline or blocked: fall through to self-service mode.
      }

      await loadSlots();
      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [loadSlots]);

  const canChooseTeacher = teachers.length > 0;

  const add = async () => {
    if (saving) {
      return;
    }

    if (form.startTime >= form.endTime) {
      setError(t('endTimeAfterStartTime'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = form.teacherId
        ? form
        : { dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime };

      const res = await fetch('/api/academics/teacher-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('addAvailabilityError'));
      }

      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('addAvailabilityError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);

    try {
      const res = await fetch(`/api/academics/teacher-availability?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(t('deleteAvailabilityError'));
      }
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteAvailabilityError'));
    }
  };

  const teacherName = (id: string) => teachers.find(t => t.id === id)?.name ?? t('myAvailabilities');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B]">{t('teacherAvailabilityTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {t('teacherAvailabilitySubtitle')}
        </p>
      </div>

      {error && (
        <div className="
          flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4
          py-3 text-xs font-bold text-red-700
        "
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="
        grid gap-3 rounded-2xl border-slate-200 p-5
        sm:grid-cols-5
      "
      >
        {canChooseTeacher
          ? (
              <select
                value={form.teacherId}
                aria-label={t('selectTeacherLabel')}
                onChange={e => setForm({ ...form, teacherId: e.target.value })}
                className="h-9 rounded-xl border px-3 text-xs"
              >
                <option value="">{t('myAvailabilities')}</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )
          : (
              <div className="
                flex h-9 items-center rounded-xl bg-slate-50 px-3 text-xs
                font-bold text-slate-500
              "
              >
                {t('myAvailabilities')}
              </div>
            )}

        <select
          value={form.dayOfWeek}
          aria-label={t('selectDayLabel')}
          onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}
          className="h-9 rounded-xl border px-3 text-xs"
        >
          {DAYS.map(day => <option key={day} value={day}>{getDayLabel(day)}</option>)}
        </select>

        <input
          type="time"
          aria-label={t('startTimeLabel')}
          value={form.startTime}
          onChange={e => setForm({ ...form, startTime: e.target.value })}
          className="h-9 rounded-xl border px-3 text-xs"
        />
        <input
          type="time"
          aria-label={t('endTimeLabel')}
          value={form.endTime}
          onChange={e => setForm({ ...form, endTime: e.target.value })}
          className="h-9 rounded-xl border px-3 text-xs"
        />

        <Button onClick={() => void add()} disabled={saving} className="gap-2 bg-[#2487B8] hover:bg-[#1B6C93]">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {tc('add')}
        </Button>
      </Card>

      <Card className="divide-y rounded-2xl border-slate-200">
        {loading && (
          <p className="flex items-center justify-center gap-2 p-6 text-xs text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            {tc('loading')}
          </p>
        )}

        {!loading && slots.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-4 text-xs">
            <strong>{teacherName(s.teacherId)}</strong>
            <span className="text-slate-500">
              {getDayLabel(s.dayOfWeek)} · {s.startTime}–{s.endTime}
            </span>
            <button
              type="button"
              onClick={() => void remove(s.id)}
              className="ms-auto font-bold text-[#E5544B]"
            >
              {tc('delete')}
            </button>
          </div>
        ))}

        {!loading && slots.length === 0 && (
          <p className="p-6 text-center text-xs text-slate-400">{t('noAvailabilityConfigured')}</p>
        )}
      </Card>
    </div>
  );
}

