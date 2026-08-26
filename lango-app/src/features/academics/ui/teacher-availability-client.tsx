'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Teacher = { id: string; name: string };
type Slot = { id: string; teacherId: string; dayOfWeek: string; startTime: string; endTime: string };
const DAYS = [['monday','Lundi'],['tuesday','Mardi'],['wednesday','Mercredi'],['thursday','Jeudi'],['friday','Vendredi'],['saturday','Samedi'],['sunday','Dimanche']];

export function TeacherAvailabilityClient() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ teacherId: '', dayOfWeek: 'monday', startTime: '08:00', endTime: '17:00' });
  const load = () => fetch('/api/academics/teacher-availability').then(r => r.json()).then(j => j.success && setSlots(j.data));
  useEffect(() => { fetch('/api/teachers?pageSize=200').then(r => r.json()).then(j => { if (j.success) { setTeachers(j.data); setForm(f => ({ ...f, teacherId: f.teacherId || j.data[0]?.id || '' })); } }); load(); }, []);
  const add = async () => { const payload = form.teacherId ? form : { dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime }; const r = await fetch('/api/academics/teacher-availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (r.ok) load(); };
  const remove = async (id: string) => { await fetch(`/api/academics/teacher-availability?id=${id}`, { method: 'DELETE' }); load(); };
  return <div className="mx-auto max-w-5xl space-y-6"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Disponibilités des enseignants</h1><p className="mt-1 text-xs text-slate-500">Ces plages alimentent les suggestions lors de la création d’une classe.</p></div>
    <Card className="grid gap-3 rounded-2xl border-slate-200 p-5 sm:grid-cols-5">
      <select value={form.teacherId} onChange={e => setForm({...form, teacherId:e.target.value})} className="h-9 rounded-xl border px-3 text-xs"><option value="">Mes disponibilités</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <select value={form.dayOfWeek} onChange={e => setForm({...form, dayOfWeek:e.target.value})} className="h-9 rounded-xl border px-3 text-xs">{DAYS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime:e.target.value})} className="h-9 rounded-xl border px-3 text-xs" />
      <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime:e.target.value})} className="h-9 rounded-xl border px-3 text-xs" />
      <Button onClick={add} className="bg-[#2487B8] hover:bg-[#1B6C93]">Ajouter</Button>
    </Card>
    <Card className="divide-y rounded-2xl border-slate-200">{slots.map(s => <div key={s.id} className="flex items-center gap-3 p-4 text-xs"><strong>{teachers.find(t=>t.id===s.teacherId)?.name ?? s.teacherId}</strong><span className="text-slate-500">{DAYS.find(d=>d[0]===s.dayOfWeek)?.[1]} · {s.startTime}–{s.endTime}</span><button onClick={()=>remove(s.id)} className="ml-auto font-bold text-[#E5544B]">Supprimer</button></div>)}{slots.length===0 && <p className="p-6 text-center text-xs text-slate-400">Aucune disponibilité configurée.</p>}</Card>
  </div>;
}
