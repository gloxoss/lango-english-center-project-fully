'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, AlertCircle, Clock } from 'lucide-react';

type ApiClassSection = { id: string; classId: string; className: string; sectionName: string };
type ApiSubject = { id: string; name: string };
type ApiClassSubject = { id: string; classId: string; subjectId: string };
type ApiTeacher = { id: string; name: string };
type ApiSlot = {
  id: string;
  classSectionId: string;
  classSubjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
  subjectName: string;
  teacherName: string;
};

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
];

export function ScheduleInteractiveView() {
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ApiClassSubject[]>([]);
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', teacherId: '', dayOfWeek: 'monday', startTime: '08:00', endTime: '09:00', roomLabel: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()),
      fetch('/api/academics/subjects?pageSize=200').then(r => r.json()),
      fetch('/api/academics/class-subjects?pageSize=500').then(r => r.json()),
      fetch('/api/teachers?pageSize=200').then(r => r.json()),
    ]).then(([csJson, subjJson, classSubjJson, teachJson]) => {
      if (csJson.success) setClassSections(csJson.data);
      if (subjJson.success) setSubjects(subjJson.data);
      if (classSubjJson.success) setClassSubjects(classSubjJson.data);
      if (teachJson.success) setTeachers(teachJson.data.map((t: any) => ({ id: t.id, name: t.name })));
    }).catch(err => console.error('Failed loading schedule pickers', err));
  }, []);

  async function loadSlots() {
    if (!selectedClassSectionId) {
      setSlots([]);
      return;
    }
    try {
      const res = await fetch(`/api/academics/timetable-slots?classSectionId=${selectedClassSectionId}`);
      const json = await res.json();
      if (json.success) {
        setSlots(json.data);
      }
    } catch (err) {
      console.error('Failed loading schedule slots', err);
    }
  }

  useEffect(() => {
    loadSlots();
  }, [selectedClassSectionId]);

  const selectedClassSection = classSections.find(c => c.id === selectedClassSectionId) ?? null;
  const availableSubjects = useMemo(() => {
    if (!selectedClassSection) return [];
    const subjectIds = new Set(classSubjects.filter(cs => cs.classId === selectedClassSection.classId).map(cs => cs.subjectId));
    return subjects.filter(s => subjectIds.has(s.id));
  }, [selectedClassSection, classSubjects, subjects]);

  const slotsByDay = new Map<string, ApiSlot[]>();
  for (const slot of slots) {
    const list = slotsByDay.get(slot.dayOfWeek) ?? [];
    list.push(slot);
    slotsByDay.set(slot.dayOfWeek, list);
  }
  for (const list of slotsByDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  async function handleAddSlot() {
    if (!selectedClassSection || !form.subjectId || !form.teacherId) {
      setError('Sélectionnez une matière et un enseignant.');
      return;
    }
    const classSubjectId = classSubjects.find(cs => cs.classId === selectedClassSection.classId && cs.subjectId === form.subjectId)?.id;
    if (!classSubjectId) {
      setError('Cette matière n\'est pas assignée à cette classe.');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/academics/timetable-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSectionId: selectedClassSectionId,
          classSubjectId,
          teacherId: form.teacherId,
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          roomLabel: form.roomLabel || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Échec de l\'ajout du créneau.');
        return;
      }
      setIsAddOpen(false);
      setForm({ subjectId: '', teacherId: '', dayOfWeek: 'monday', startTime: '08:00', endTime: '09:00', roomLabel: '' });
      await loadSlots();
    } catch (err) {
      console.error('Add slot failed', err);
      setError('Connexion impossible.');
    }
  }

  async function handleDeleteSlot(id: string) {
    try {
      await fetch(`/api/academics/timetable-slots?id=${id}`, { method: 'DELETE' });
      await loadSlots();
    } catch (err) {
      console.error('Delete slot failed', err);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Emploi du temps</h1>
          <p className="text-xs text-slate-500 mt-1">Construisez l&apos;emploi du temps hebdomadaire réel d&apos;une classe.</p>
        </div>
        <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
          <SelectTrigger className="w-[220px] h-9 text-xs rounded-xl"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
          <SelectContent>
            {classSections.map(cs => (
              <SelectItem key={cs.id} value={cs.id}>{cs.className} {cs.sectionName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!selectedClassSectionId && <p className="text-xs text-slate-400 py-8 text-center">Sélectionnez une classe pour voir ou construire son emploi du temps.</p>}

      {selectedClassSectionId && (
        <>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)} className="gap-2 h-9 text-xs rounded-xl px-4 bg-[#0066FF]">
              <Plus className="w-3.5 h-3.5" /> Ajouter un créneau
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {DAYS.map(day => (
              <Card key={day.key} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <h3 className="text-xs font-extrabold text-[#16212B] pb-2 border-b border-slate-100">{day.label}</h3>
                {(slotsByDay.get(day.key) ?? []).map(slot => (
                  <div key={slot.id} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#16212B]">{slot.subjectName}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{slot.startTime} - {slot.endTime} • {slot.teacherName}{slot.roomLabel ? ` • ${slot.roomLabel}` : ''}</p>
                    </div>
                    <button onClick={() => handleDeleteSlot(slot.id)} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(slotsByDay.get(day.key) ?? []).length === 0 && <p className="text-[11px] text-slate-300 py-2">Aucun cours</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Nouveau créneau</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Matière *</label>
              <Select value={form.subjectId} onValueChange={v => setForm({ ...form, subjectId: v })}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {availableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Enseignant *</label>
              <Select value={form.teacherId} onValueChange={v => setForm({ ...form, teacherId: v })}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Jour *</label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm({ ...form, dayOfWeek: v })}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Début *</label>
                <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="h-9 text-xs rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Fin *</label>
                <Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="h-9 text-xs rounded-xl" />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Salle</label>
              <Input value={form.roomLabel} onChange={e => setForm({ ...form, roomLabel: e.target.value })} placeholder="Ex. Salle 201" className="h-9 text-xs rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleAddSlot} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
