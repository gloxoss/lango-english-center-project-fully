'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { CalendarDays, Clock, DoorOpen } from 'lucide-react';

type Teacher = { id: string; name: string };

type Slot = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
};

export function TeacherScheduleView({ locale: _locale, isTeacher }: { locale: string; isTeacher: boolean }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isTeacher) {
      return;
    }
    fetch('/api/teachers?pageSize=200')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setTeachers(json.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
        }
      })
      .catch(() => {});
  }, [isTeacher]);

  useEffect(() => {
    if (!isTeacher && !teacherId) {
      setSlots([]);
      return;
    }
    setLoading(true);
    const url = isTeacher ? '/api/academics/timetable-slots' : `/api/academics/timetable-slots?teacherId=${teacherId}`;
    fetch(url)
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setSlots(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isTeacher, teacherId]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const day of DAY_ORDER) {
      map.set(day, []);
    }
    for (const slot of slots) {
      map.get(slot.dayOfWeek)?.push(slot);
    }
    for (const day of DAY_ORDER) {
      map.get(day)?.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots]);

  const totalHours = useMemo(() => {
    return slots.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return sum + ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60;
    }, 0);
  }, [slots]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Emploi du temps enseignant</h1>
          <p className="text-xs text-slate-500 mt-1">
            {isTeacher ? 'Votre emploi du temps publié.' : 'Projection en lecture seule de l\'emploi du temps publié pour l\'enseignant sélectionné.'}
          </p>
        </div>
        {!isTeacher && (
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger className="w-full sm:w-64 h-9 rounded-xl bg-white border-slate-200 text-xs">
              <SelectValue placeholder="Sélectionnez un enseignant" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {(isTeacher || teacherId) && !loading && (
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs inline-flex items-center gap-2 text-xs">
          <Clock className="w-4 h-4 text-[#2487B8]" />
          <span className="font-bold text-[#16212B]">{totalHours}h</span>
          <span className="text-slate-500">de cours par semaine, {slots.length} créneau(x)</span>
        </Card>
      )}

      {!isTeacher && !teacherId && (
        <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-2">
          <CalendarDays className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">Sélectionnez un enseignant pour afficher son emploi du temps.</p>
        </Card>
      )}

      {(isTeacher || teacherId) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAY_ORDER.map((day) => {
            const daySlots = byDay.get(day) ?? [];
            return (
              <Card key={day} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <h3 className="text-xs font-extrabold text-[#16212B]">{DAY_LABELS[day]}</h3>
                {daySlots.length === 0 && <p className="text-[11px] text-slate-400">Aucun cours</p>}
                {daySlots.map(slot => (
                  <div key={slot.id} className="p-2.5 bg-slate-50 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#2487B8]">{slot.startTime} - {slot.endTime}</span>
                      {slot.roomLabel && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <DoorOpen className="w-3 h-3" />
                          {slot.roomLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#16212B]">{slot.subjectName}</p>
                    <p className="text-[10px] text-slate-500">{slot.className} {slot.sectionName}</p>
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
