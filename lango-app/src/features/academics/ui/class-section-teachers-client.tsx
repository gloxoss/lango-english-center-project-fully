'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Download, Search, Calendar, Users, Edit,
} from 'lucide-react';
import {
  TeacherWorkloadItem, MOCK_TEACHERS, TIMETABLE_DAYS,
} from '../data/class-section-teachers-config';

export function ClassSectionTeachersClient({ locale: _locale }: { locale?: string } = {}) {
  const [teachers, setTeachers] = useState<TeacherWorkloadItem[]>(MOCK_TEACHERS);
  const [selectedTeacherId, setSelectedTeacherId] = useState('t1');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignment, setAssignment] = useState({
    teacherId: 't1',
    className: '2BAC-A',
    subject: 'Mathématiques',
    weeklyHours: '4',
    day: 'Lundi',
    slot: '08h-10h',
  });

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.specialty.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const activeTeacher = teachers.find(t => t.id === selectedTeacherId) ?? teachers[0];

  const handleAssignTeacher = () => {
    const hoursNum = Number(assignment.weeklyHours) || 2;
    setTeachers(prev => prev.map(t => {
      if (t.id === assignment.teacherId) {
        const newHours = t.weeklyHours + hoursNum;
        const newStatus = newHours > t.maxHours ? 'overload' : newHours >= 18 ? 'balanced' : 'underload';
        return {
          ...t,
          weeklyHours: newHours,
          status: newStatus,
          timetablePreview: [
            ...t.timetablePreview,
            {
              day: assignment.day,
              hours: assignment.slot,
              className: assignment.className,
              subject: assignment.subject,
              room: 'Salle Nouveaux',
            },
          ],
        };
      }
      return t;
    }));
    setIsAssignOpen(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Affectation des Enseignants & Charge Horaires</h1>
          <p className="text-xs text-slate-500 mt-1">Supervisez la répartition des heures, détectez les surcharges (&gt;26h) et ajustez les emplois du temps.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter l&apos;état des charges</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAssignOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Affecter un enseignant</span>
          </Button>
        </div>
      </div>

      {/* Top 3 Analytics Cards Suite */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-500">Total Enseignants Actifs</p>
          <p className="text-2xl font-extrabold text-[#16212B]">42</p>
          <p className="text-[10px] text-slate-400">Corps professoral 2026-2027</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-rose-200/60 bg-rose-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#E5544B]">Enseignants en Surcharge (&gt;26h)</p>
          <p className="text-2xl font-extrabold text-[#E5544B]">
            {teachers.filter(t => t.status === 'overload').length}
          </p>
          <p className="text-[10px] text-rose-600 font-bold">Action corrective recommandée</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Disponibilité Globale</p>
          <p className="text-2xl font-extrabold text-[#2487B8]">84h libres</p>
          <p className="text-[10px] text-slate-400">Capacité résiduelle disponible</p>
        </Card>
      </div>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Teachers List with 36px Avatars */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Workload Filter Toolbar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filtrer par nom ou matière..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'overload', label: '🔴 Surcharge' },
                { id: 'balanced', label: '🟢 Équilibré' },
                { id: 'underload', label: '🔵 Sous-charge' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    filterStatus === f.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredTeachers.map(t => {
              const isSelected = t.id === selectedTeacherId;
              const pct = Math.round((t.weeklyHours / t.maxHours) * 100);
              return (
                <Card
                  key={t.id}
                  onClick={() => setSelectedTeacherId(t.id)}
                  className={`p-4 bg-white rounded-2xl border transition cursor-pointer space-y-3 ${
                    isSelected ? 'border-[#2487B8] bg-[#DCEBF4]/20 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* 36px Circular Avatar */}
                      <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs shrink-0">
                        {t.avatar}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-[#16212B]">{t.name}</h3>
                        <p className="text-[10px] text-slate-400">{t.specialty} • {t.assignedClassesCount} classes assignées</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      t.status === 'overload' ? 'bg-[#FCE4E2] text-[#E5544B]' :
                      t.status === 'balanced' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#DCEBF4] text-[#1B6C93]'
                    }`}>
                      {t.status === 'overload' ? '🔴 Surcharge >26h' : t.status === 'balanced' ? '🟢 Équilibré (18-26h)' : '🔵 Sous-charge <18h'}
                    </span>
                  </div>

                  {/* 26h Workload Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>Volume horaire: {t.weeklyHours}h / {t.maxHours}h max</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          t.weeklyHours > t.maxHours ? 'bg-[#E5544B]' : 'bg-[#2487B8]'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right 5 cols: 5-Day Weekly Timetable Matrix Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {activeTeacher && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-sm">
                    {activeTeacher.avatar}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeTeacher.name}</h2>
                    <p className="text-xs text-slate-400">{activeTeacher.specialty} • {activeTeacher.phone}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-slate-200">
                  <Edit className="w-3.5 h-3.5 text-slate-600" /> Rebalancer
                </Button>
              </div>

              {/* 5-Day Weekly Timetable Grid Matrix */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#2487B8]" />
                  Emploi du temps Hebdomadaire
                </h3>

                <div className="space-y-2">
                  {TIMETABLE_DAYS.map(day => {
                    const daySlots = activeTeacher.timetablePreview.filter(s => s.day === day);
                    return (
                      <div key={day} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1.5">
                        <span className="text-[11px] font-extrabold text-[#16212B] block">{day}</span>
                        {daySlots.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">Aucun cours ce jour-là.</p>
                        ) : (
                          <div className="space-y-1">
                            {daySlots.map((slot, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 text-xs">
                                <div>
                                  <span className="font-bold text-[#16212B]">{slot.hours}</span>
                                  <span className="text-[10px] text-slate-400 ml-2">{slot.room}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                    {slot.subject}
                                  </span>
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#DCEBF4] text-[#1B6C93]">
                                    {slot.className}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Affectation Modal Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#2487B8]" />
              Affecter un Enseignant à une Classe
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Enseignant *</label>
              <Select value={assignment.teacherId} onValueChange={val => setAssignment({ ...assignment, teacherId: val })}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.weeklyHours}h / {t.maxHours}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe *</label>
                <Select value={assignment.className} onValueChange={val => setAssignment({ ...assignment, className: val })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2BAC-A">2BAC-A</SelectItem>
                    <SelectItem value="2BAC-B">2BAC-B</SelectItem>
                    <SelectItem value="1BAC-A">1BAC-A</SelectItem>
                    <SelectItem value="3AC-A">3AC-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Matière *</label>
                <Input
                  value={assignment.subject}
                  onChange={e => setAssignment({ ...assignment, subject: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Volume (h) *</label>
                <Input
                  type="number"
                  value={assignment.weeklyHours}
                  onChange={e => setAssignment({ ...assignment, weeklyHours: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Jour *</label>
                <Select value={assignment.day} onValueChange={val => setAssignment({ ...assignment, day: val })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMETABLE_DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Créneau *</label>
                <Input
                  value={assignment.slot}
                  onChange={e => setAssignment({ ...assignment, slot: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAssignOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleAssignTeacher} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Valider l&apos;affectation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
