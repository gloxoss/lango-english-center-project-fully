'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Clock, AlertTriangle, CheckCircle2, User, Building2,
  Copy, Printer, Plus, Sparkles, Layers, SlidersHorizontal,
  ChevronRight, Trash2, ArrowRight, BookOpen, ShieldCheck, Check,
  RefreshCw, Users, AlertCircle, Info, Edit3, Grid, Filter
} from 'lucide-react';
import { ScheduleClient } from './schedule-client';

type ClassSectionOption = { id: string; classId: string; className: string; sectionName: string };
type RefOption = { id: string; name: string };
type Slot = {
  id: string;
  classSectionId: string;
  classSubjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
  hasConflict?: boolean;
  conflictDetails?: string;
};

const DAYS = [
  { value: 'monday', label: 'Lundi' },
  { value: 'tuesday', label: 'Mardi' },
  { value: 'wednesday', label: 'Mercredi' },
  { value: 'thursday', label: 'Jeudi' },
  { value: 'friday', label: 'Vendredi' },
  { value: 'saturday', label: 'Samedi' },
];

const TIME_SLOTS = [
  '08:30 - 09:30',
  '09:30 - 10:30',
  '10:30 - 11:30',
  '11:30 - 12:30',
  '14:30 - 15:30',
  '15:30 - 16:30',
  '16:30 - 17:30',
  '17:30 - 18:30',
];

const DEFAULT_SUBJECTS = [
  { id: 'sub-math', name: 'Mathématiques', color: 'border-blue-500 bg-blue-50 text-blue-700', coef: 7 },
  { id: 'sub-pc', name: 'Physique-Chimie', color: 'border-indigo-500 bg-indigo-50 text-indigo-700', coef: 5 },
  { id: 'sub-svt', name: 'SVT', color: 'border-emerald-500 bg-emerald-50 text-emerald-700', coef: 5 },
  { id: 'sub-fr', name: 'Français', color: 'border-amber-500 bg-amber-50 text-amber-700', coef: 4 },
  { id: 'sub-ar', name: 'Arabe & Éducation Islamique', color: 'border-teal-500 bg-teal-50 text-teal-700', coef: 4 },
  { id: 'sub-en', name: 'Anglais', color: 'border-purple-500 bg-purple-50 text-purple-700', coef: 3 },
  { id: 'sub-philo', name: 'Philosophie', color: 'border-rose-500 bg-rose-50 text-rose-700', coef: 2 },
  { id: 'sub-eps', name: 'Éducation Physique (EPS)', color: 'border-cyan-500 bg-cyan-50 text-cyan-700', coef: 2 },
];

const DEFAULT_TEACHERS = [
  { id: 't-1', name: 'Pr. Mohammed El Amrani', subject: 'Mathématiques', maxHours: 21, assignedHours: 18 },
  { id: 't-2', name: 'Pr. Fatima Zahra Bennani', subject: 'Physique-Chimie', maxHours: 21, assignedHours: 16 },
  { id: 't-3', name: 'Pr. Rachid Tazi', subject: 'SVT', maxHours: 20, assignedHours: 14 },
  { id: 't-4', name: 'Pr. Chaimae Mansouri', subject: 'Français', maxHours: 21, assignedHours: 20 },
  { id: 't-5', name: 'Pr. Youssef Berrada', subject: 'Anglais', maxHours: 18, assignedHours: 12 },
];

const DEFAULT_ROOMS = [
  { id: 'r-101', name: 'Salle 101 (Sciences)', capacity: 32 },
  { id: 'r-102', name: 'Salle 102 (Standard)', capacity: 30 },
  { id: 'r-103', name: 'Salle 103 (Standard)', capacity: 30 },
  { id: 'r-lab', name: 'Laboratoire de Physique', capacity: 26 },
  { id: 'r-info', name: 'Salle Multimédia & Informatique', capacity: 28 },
  { id: 'r-gym', name: 'Terrain de Sport / Gymnase', capacity: 60 },
];

// Initial mock schedule matrix for demonstration
const INITIAL_DEMO_SLOTS: Slot[] = [
  { id: 's-1', classSectionId: 'cs-1', classSubjectId: 'sub-math', subjectName: 'Mathématiques', teacherId: 't-1', teacherName: 'Pr. El Amrani', dayOfWeek: 'monday', startTime: '08:30', endTime: '10:30', roomLabel: 'Salle 101' },
  { id: 's-2', classSectionId: 'cs-1', classSubjectId: 'sub-fr', subjectName: 'Français', teacherId: 't-4', teacherName: 'Pr. Mansouri', dayOfWeek: 'monday', startTime: '10:30', endTime: '12:30', roomLabel: 'Salle 101' },
  { id: 's-3', classSectionId: 'cs-1', classSubjectId: 'sub-pc', subjectName: 'Physique-Chimie', teacherId: 't-2', teacherName: 'Pr. Bennani', dayOfWeek: 'monday', startTime: '14:30', endTime: '16:30', roomLabel: 'Laboratoire de Physique' },
  { id: 's-4', classSectionId: 'cs-1', classSubjectId: 'sub-en', subjectName: 'Anglais', teacherId: 't-5', teacherName: 'Pr. Berrada', dayOfWeek: 'tuesday', startTime: '08:30', endTime: '10:30', roomLabel: 'Salle 102' },
  { id: 's-5', classSectionId: 'cs-1', classSubjectId: 'sub-svt', subjectName: 'SVT', teacherId: 't-3', teacherName: 'Pr. Tazi', dayOfWeek: 'tuesday', startTime: '10:30', endTime: '12:30', roomLabel: 'Salle 101', hasConflict: true, conflictDetails: 'Conflit de salle : Salle 101 déjà occupée par 2ème Bac B' },
  { id: 's-6', classSectionId: 'cs-1', classSubjectId: 'sub-ar', subjectName: 'Arabe & Éduc. Islamique', teacherId: 't-6', teacherName: 'Pr. Alami', dayOfWeek: 'wednesday', startTime: '08:30', endTime: '10:30', roomLabel: 'Salle 101' },
  { id: 's-7', classSectionId: 'cs-1', classSubjectId: 'sub-math', subjectName: 'Mathématiques', teacherId: 't-1', teacherName: 'Pr. El Amrani', dayOfWeek: 'thursday', startTime: '08:30', endTime: '10:30', roomLabel: 'Salle 101' },
  { id: 's-8', classSectionId: 'cs-1', classSubjectId: 'sub-pc', subjectName: 'Physique-Chimie', teacherId: 't-2', teacherName: 'Pr. Bennani', dayOfWeek: 'friday', startTime: '08:30', endTime: '10:30', roomLabel: 'Laboratoire de Physique' },
  { id: 's-9', classSectionId: 'cs-1', classSubjectId: 'sub-eps', subjectName: 'EPS', teacherId: 't-7', teacherName: 'Coach Zaki', dayOfWeek: 'saturday', startTime: '08:30', endTime: '10:30', roomLabel: 'Terrain de Sport' },
];

export function SchedulePlayground({ locale = 'fr' }: { locale?: string }) {
  const [activeTab, setActiveTab] = useState<'standard' | 'variation-a' | 'variation-b' | 'variation-c'>('variation-a');

  // Live and mock data states
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('cs-1');
  const [slots, setSlots] = useState<Slot[]>(INITIAL_DEMO_SLOTS);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('t-1');
  const [selectedRoomLabel, setSelectedRoomLabel] = useState<string>('Salle 101');

  // Quick Slot Form state
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [newDay, setNewDay] = useState('monday');
  const [newTimeStart, setNewTimeStart] = useState('08:30');
  const [newTimeEnd, setNewTimeEnd] = useState('10:30');
  const [newSubjectId, setNewSubjectId] = useState('sub-math');
  const [newTeacherId, setNewTeacherId] = useState('t-1');
  const [newRoom, setNewRoom] = useState('Salle 101');

  // Replication Modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/academics/class-sections?pageSize=200')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          setClassSections(j.data);
          setSelectedSectionId(j.data[0].id);
        } else {
          setClassSections([
            { id: 'cs-1', classId: 'c-1', className: '1ère Année Bac Sciences Ex', sectionName: 'Groupe A' },
            { id: 'cs-2', classId: 'c-1', className: '1ère Année Bac Sciences Ex', sectionName: 'Groupe B' },
            { id: 'cs-3', classId: 'c-2', className: '2ème Année Bac Sciences Maths', sectionName: 'Groupe A' },
            { id: 'cs-4', classId: 'c-3', className: 'Tronc Commun Scientifique', sectionName: 'Groupe 1' },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddSlot = () => {
    const subjectObj = DEFAULT_SUBJECTS.find(s => s.id === newSubjectId);
    const teacherObj = DEFAULT_TEACHERS.find(t => t.id === newTeacherId);

    const newSlot: Slot = {
      id: `slot-${Date.now()}`,
      classSectionId: selectedSectionId,
      classSubjectId: newSubjectId,
      subjectName: subjectObj?.name || 'Matière',
      teacherId: newTeacherId,
      teacherName: teacherObj?.name || 'Enseignant',
      dayOfWeek: newDay,
      startTime: newTimeStart,
      endTime: newTimeEnd,
      roomLabel: newRoom,
      hasConflict: false,
    };

    setSlots(prev => [...prev, newSlot]);
    setShowQuickForm(false);
  };

  const handleDeleteSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
  };

  const activeConflicts = useMemo(() => {
    return slots.filter(s => s.hasConflict);
  }, [slots]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Playground Header & Variation Switcher Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0EA5C4]/15 text-[#0EA5C4] border border-[#0EA5C4]/30">
                <Sparkles className="w-3.5 h-3.5" /> Design Exploration (Bucket 5 - §6.10)
              </span>
              <span className="text-xs font-semibold text-slate-400">Interactif · 3 Variations</span>
            </div>
            <h1 className="text-xl font-bold text-[#16212B] mt-1.5 tracking-tight">
              Générateur & Constructeur d&apos;Emplois du Temps
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparez les 3 approches de planification : Grille Globale, Inspecteur Enseignant/Salle, et Grille Compacte Marocaine.
            </p>
          </div>

          {/* Interactive Variation Tabs */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('variation-a')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-a'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Var. A : Grille & Détecteur de Conflits</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-b')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-b'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Var. B : Inspecteur Enseignants / Salles</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-c')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-c'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Var. C : Grille Marocaine & Duplication</span>
            </button>
            <button
              onClick={() => setActiveTab('standard')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'standard'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Vue Standard</span>
            </button>
          </div>
        </div>
      </div>

      {/* VARIATION A: WHOLE-SCHOOL WEEKLY MATRIX WITH CONFLICT DETECTOR */}
      {activeTab === 'variation-a' && (
        <div className="space-y-6">
          {/* Top Filter and Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classe sélectionnée</label>
                <select
                  value={selectedSectionId}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  className="h-8 text-xs font-bold text-[#16212B] bg-slate-50 border border-slate-200 rounded-lg px-2"
                >
                  {classSections.map(cs => (
                    <option key={cs.id} value={cs.id}>{cs.className} ({cs.sectionName})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {activeConflicts.length > 0 && (
                <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-xs px-2.5 py-1 gap-1.5 font-bold animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {activeConflicts.length} Conflit Détecté
                </Badge>
              )}

              <Button
                onClick={() => setShowQuickForm(true)}
                className="h-9 px-3.5 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Ajouter un Créneau
              </Button>
            </div>
          </div>

          {/* Conflict Banner if present */}
          {activeConflicts.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between text-xs text-rose-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Alerte de collision d&apos;emploi du temps</h4>
                  <p className="text-rose-700 mt-0.5">
                    {activeConflicts[0]!.conflictDetails}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSlots(prev => prev.map(s => s.id === activeConflicts[0]!.id ? { ...s, roomLabel: 'Salle 104 (Libre)', hasConflict: false } : s));
                }}
                className="h-8 text-xs font-bold border-rose-300 text-rose-700 bg-white hover:bg-rose-100"
              >
                Résoudre automatiquement (Changer de salle)
              </Button>
            </div>
          )}

          {/* Weekly Timetable Grid */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200">
                  <th className="p-3.5 text-left font-bold text-slate-500 w-28 border-r border-slate-200">Jour</th>
                  <th className="p-3.5 text-center font-bold text-slate-700 border-r border-slate-200">08:30 - 10:30</th>
                  <th className="p-3.5 text-center font-bold text-slate-700 border-r border-slate-200">10:30 - 12:30</th>
                  <th className="p-3.5 text-center font-bold text-slate-400 bg-slate-100/50 w-20 border-r border-slate-200">Pause</th>
                  <th className="p-3.5 text-center font-bold text-slate-700 border-r border-slate-200">14:30 - 16:30</th>
                  <th className="p-3.5 text-center font-bold text-slate-700">16:30 - 18:30</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DAYS.map(day => {
                  const daySlots = slots.filter(s => s.dayOfWeek === day.value);
                  const morning1 = daySlots.find(s => s.startTime === '08:30');
                  const morning2 = daySlots.find(s => s.startTime === '10:30');
                  const afternoon1 = daySlots.find(s => s.startTime === '14:30');
                  const afternoon2 = daySlots.find(s => s.startTime === '16:30');

                  const renderSlotCell = (slot?: Slot) => {
                    if (!slot) {
                      return (
                        <div className="h-24 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-[#2487B8]/40 hover:text-[#2487B8] cursor-pointer transition-all">
                          <Plus className="w-4 h-4" />
                        </div>
                      );
                    }

                    const subjectInfo = DEFAULT_SUBJECTS.find(s => s.id === slot.classSubjectId);

                    return (
                      <div className={`h-24 p-2.5 rounded-xl border relative flex flex-col justify-between transition-all group ${
                        slot.hasConflict
                          ? 'border-rose-500 bg-rose-50/80 text-rose-900 ring-2 ring-rose-300'
                          : subjectInfo?.color || 'border-slate-200 bg-slate-50 text-slate-800'
                      }`}>
                        <div>
                          <div className="flex items-start justify-between">
                            <span className="font-bold text-xs truncate block">{slot.subjectName}</span>
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[10px] opacity-80 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" /> {slot.teacherName}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[9px] pt-1 border-t border-current/10">
                          <span className="flex items-center gap-1 font-mono font-semibold">
                            <Building2 className="w-2.5 h-2.5" /> {slot.roomLabel || 'Salle non assignée'}
                          </span>
                          {slot.hasConflict && (
                            <span className="text-[9px] font-bold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-300">
                              Conflit
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <tr key={day.value} className="hover:bg-slate-50/50">
                      <td className="p-3.5 font-bold text-slate-700 border-r border-slate-200 bg-slate-50/40">
                        {day.label}
                      </td>
                      <td className="p-2 border-r border-slate-200">{renderSlotCell(morning1)}</td>
                      <td className="p-2 border-r border-slate-200">{renderSlotCell(morning2)}</td>
                      <td className="p-2 text-center text-[10px] text-slate-400 bg-slate-100/30 border-r border-slate-200">
                        Déjeuner
                      </td>
                      <td className="p-2 border-r border-slate-200">{renderSlotCell(afternoon1)}</td>
                      <td className="p-2">{renderSlotCell(afternoon2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Add Slot Modal */}
          {showQuickForm && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <Card className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-[#16212B]">Ajouter un Créneau de Cours</h3>
                  <button onClick={() => setShowQuickForm(false)} className="text-slate-400 hover:text-slate-700 text-sm">✕</button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Matière</label>
                    <select
                      value={newSubjectId}
                      onChange={e => setNewSubjectId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                    >
                      {DEFAULT_SUBJECTS.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Coef. {s.coef})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Enseignant</label>
                    <select
                      value={newTeacherId}
                      onChange={e => setNewTeacherId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                    >
                      {DEFAULT_TEACHERS.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.assignedHours}h/{t.maxHours}h)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Jour</label>
                      <select
                        value={newDay}
                        onChange={e => setNewDay(e.target.value)}
                        className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                      >
                        {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Salle</label>
                      <select
                        value={newRoom}
                        onChange={e => setNewRoom(e.target.value)}
                        className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                      >
                        {DEFAULT_ROOMS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Début</label>
                      <Input value={newTimeStart} onChange={e => setNewTimeStart(e.target.value)} className="h-9 text-xs rounded-xl" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Fin</label>
                      <Input value={newTimeEnd} onChange={e => setNewTimeEnd(e.target.value)} className="h-9 text-xs rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => setShowQuickForm(false)} className="text-xs rounded-xl">
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleAddSlot} className="text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
                    Enregistrer le Créneau
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* VARIATION B: TEACHER & ROOM SCHEDULE INSPECTOR */}
      {activeTab === 'variation-b' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Teacher / Room Selector & Workload Meter */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-[#16212B] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#2487B8]" /> Charge Enseignants
                  </h3>
                  <Badge variant="neutral" className="text-[10px]">Temps Réel</Badge>
                </div>

                <div className="space-y-2.5">
                  {DEFAULT_TEACHERS.map(t => {
                    const isSelected = selectedTeacherId === t.id;
                    const percent = Math.round((t.assignedHours / t.maxHours) * 100);

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTeacherId(t.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-[#16212B]">{t.name}</p>
                            <p className="text-[10px] text-slate-500">{t.subject}</p>
                          </div>
                          <span className="font-bold font-mono text-slate-700">{t.assignedHours}h / {t.maxHours}h</span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${percent > 90 ? 'bg-amber-500' : 'bg-[#2487B8]'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Right Column: Teacher Timeline & Weekly Gaps */}
            <div className="lg:col-span-8 space-y-4">
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-[#16212B]">
                      Planning Hebdomadaire : {DEFAULT_TEACHERS.find(t => t.id === selectedTeacherId)?.name}
                    </h3>
                    <p className="text-xs text-slate-500">Matière : {DEFAULT_TEACHERS.find(t => t.id === selectedTeacherId)?.subject}</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-xs">
                    Disponibilité OK
                  </Badge>
                </div>

                <div className="space-y-3">
                  {DAYS.slice(0, 5).map(d => {
                    const teacherSlots = slots.filter(s => s.teacherId === selectedTeacherId && s.dayOfWeek === d.value);

                    return (
                      <div key={d.value} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-700 w-24">{d.label}</span>

                        <div className="flex-1 flex gap-2 flex-wrap items-center">
                          {teacherSlots.length > 0 ? (
                            teacherSlots.map(s => (
                              <div key={s.id} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs flex items-center gap-2">
                                <span className="font-bold text-[#2487B8]">{s.startTime} - {s.endTime}</span>
                                <span className="text-slate-600 font-semibold">{s.subjectName}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{s.roomLabel}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">Aucun cours assigné — Libre pour surveillance ou soutien</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* VARIATION C: COMPACT MOROCCAN GRID & BATCH DUPLICATION */}
      {activeTab === 'variation-c' && (
        <div className="space-y-6">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">
                  Emploi du Temps Officiel Marocain — Format Compact d&apos;Établissement
                </h3>
                <p className="text-xs text-slate-500">
                  Prêt pour l&apos;impression A4 et la réplication en masse vers les autres groupes de niveau.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCloneModal(true)}
                  className="h-8 text-xs font-semibold border-slate-200 gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-[#2487B8]" />
                  Dupliquer vers d&apos;autres groupes
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="h-8 text-xs font-bold bg-[#16212B] hover:bg-slate-800 text-white gap-1.5 rounded-xl"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer / Exporter PDF
                </Button>
              </div>
            </div>

            {/* Moroccan Compact Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-[#16212B] text-white p-3 flex justify-between items-center">
                <span className="font-bold uppercase tracking-wider">Groupe Scolaire Atlas — Année Scolaire 2025-2026</span>
                <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-[10px]">1ère Année Bac Sciences Ex - Groupe A</span>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="p-2.5 text-left font-bold border-r border-slate-200 w-24">Séance</th>
                    <th className="p-2.5 text-center font-bold border-r border-slate-200">Lundi</th>
                    <th className="p-2.5 text-center font-bold border-r border-slate-200">Mardi</th>
                    <th className="p-2.5 text-center font-bold border-r border-slate-200">Mercredi</th>
                    <th className="p-2.5 text-center font-bold border-r border-slate-200">Jeudi</th>
                    <th className="p-2.5 text-center font-bold border-r border-slate-200">Vendredi</th>
                    <th className="p-2.5 text-center font-bold">Samedi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-white">
                    <td className="p-2.5 font-bold text-slate-600 bg-slate-50 border-r border-slate-200">08:30 - 10:30</td>
                    <td className="p-2 text-center border-r border-slate-200">Maths (Pr. El Amrani)</td>
                    <td className="p-2 text-center border-r border-slate-200">Anglais (Pr. Berrada)</td>
                    <td className="p-2 text-center border-r border-slate-200">Arabe (Pr. Alami)</td>
                    <td className="p-2 text-center border-r border-slate-200">Maths (Pr. El Amrani)</td>
                    <td className="p-2 text-center border-r border-slate-200">Physique (Pr. Bennani)</td>
                    <td className="p-2 text-center">EPS (Coach Zaki)</td>
                  </tr>
                  <tr className="bg-slate-50/40">
                    <td className="p-2.5 font-bold text-slate-600 bg-slate-50 border-r border-slate-200">10:30 - 12:30</td>
                    <td className="p-2 text-center border-r border-slate-200">Français (Pr. Mansouri)</td>
                    <td className="p-2 text-center border-r border-slate-200">SVT (Pr. Tazi)</td>
                    <td className="p-2 text-center border-r border-slate-200">Philo (Pr. Idrissi)</td>
                    <td className="p-2 text-center border-r border-slate-200">Français (Pr. Mansouri)</td>
                    <td className="p-2 text-center border-r border-slate-200">SVT (Pr. Tazi)</td>
                    <td className="p-2 text-center text-slate-400 italic">Libre</td>
                  </tr>
                  <tr className="bg-slate-100/70 text-slate-400 text-center text-[10px]">
                    <td colSpan={7} className="py-1">Pause Déjeuner & Prière (12:30 - 14:30)</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-2.5 font-bold text-slate-600 bg-slate-50 border-r border-slate-200">14:30 - 16:30</td>
                    <td className="p-2 text-center border-r border-slate-200">Physique (Pr. Bennani)</td>
                    <td className="p-2 text-center border-r border-slate-200">Hist-Géo (Pr. Kadiri)</td>
                    <td className="p-2 text-center border-r border-slate-200 text-slate-400 italic">Après-midi libre</td>
                    <td className="p-2 text-center border-r border-slate-200">Maths (Pr. El Amrani)</td>
                    <td className="p-2 text-center border-r border-slate-200">Anglais (Pr. Berrada)</td>
                    <td className="p-2 text-center text-slate-400 italic">Week-end</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Batch Replication Modal */}
          {showCloneModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <Card className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-[#16212B]">Duplication en Masse de la Grille</h3>
                  <button onClick={() => setShowCloneModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <p className="text-xs text-slate-600">
                  Sélectionnez les groupes cibles pour dupliquer l&apos;emploi du temps de <strong>1ère Bac - Groupe A</strong> en ajustant automatiquement les enseignants disponibles :
                </p>

                <div className="space-y-2 text-xs">
                  {classSections.filter(cs => cs.id !== 'cs-1').map(cs => (
                    <label key={cs.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4 text-[#2487B8] rounded" />
                      <span className="font-bold text-[#16212B]">{cs.className} - {cs.sectionName}</span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => setShowCloneModal(false)} className="text-xs rounded-xl">
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setCloneSuccess(true);
                      setTimeout(() => { setCloneSuccess(false); setShowCloneModal(false); }, 1000);
                    }}
                    className="text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
                  >
                    {cloneSuccess ? 'Duplication Réussie !' : 'Confirmer la Duplication'}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* STANDARD BASELINE VIEW */}
      {activeTab === 'standard' && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <ScheduleClient locale={locale} />
        </div>
      )}
    </div>
  );
}
