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
  Clock, AlertTriangle, Download, Plus, Send, Building2, User,
} from 'lucide-react';
import { SlotItem, MOCK_SLOTS, DAYS } from '../data/schedule-config';

import { SchedulePublishBar } from './schedule-publish-bar';

export function ScheduleClient({ locale: _locale }: { locale?: string } = {}) {
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [selectedClass, setSelectedClass] = useState('2BAC-A');
  const [slots, setSlots] = useState<SlotItem[]>(MOCK_SLOTS);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('1');
  const [isPublished, setIsPublished] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string>('');

  // Modals State
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day: 'Lundi' as SlotItem['day'],
    time: '14:00 - 16:00',
    subject: 'Mathématiques',
    teacher: 'M. Omar Alami',
    room: 'Salle 104',
  });

  const activeSlot = slots.find(s => s.id === selectedSlotId) ?? slots[0];

  const handleAddSlot = () => {
    if (!newSlot.subject.trim()) return;
    const created: SlotItem = {
      id: `slot-${Date.now()}`,
      day: newSlot.day,
      time: newSlot.time,
      subject: newSlot.subject,
      teacher: newSlot.teacher,
      teacherAvatar: newSlot.teacher.split(' ').map(n => n[0]).join('').slice(0, 2),
      room: newSlot.room,
      className: selectedClass,
    };
    setSlots(prev => [...prev, created]);
    setIsAddSlotOpen(false);
  };

  const handleResolveConflict = () => {
    setSlots(prev => prev.map(s => s.hasConflict ? { ...s, hasConflict: false, room: 'Salle 204 (Libérée)' } : s));
    setIsConflictOpen(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Versioning & Publish Bar */}
      <SchedulePublishBar
        onVersionChange={(versionId, status) => {
          setCurrentVersionId(versionId);
          setIsPublished(status === 'published');
        }}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Emplois du Temps & Planning Hebdomadaire</h1>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isPublished ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#FCF0DC] text-[#E8A33D]'}`}>
              {isPublished ? '✔ Publié Officiel' : '📝 Brouillon de travail'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Conception interactive des plannings de cours, gestion des salles et publication officielle.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter PDF / CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsPublished(!isPublished)}
            className={`h-10 rounded-xl px-4 gap-2 text-xs font-bold transition ${
              isPublished ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-[#2487B8] hover:bg-[#1B6C93] text-white shadow-2xs'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{isPublished ? 'Dépublier l\'emploi du temps' : 'Publier aux élèves & tuteurs'}</span>
          </Button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {[
            { id: 'class', label: 'Vue par Classe', icon: Building2 },
            { id: 'teacher', label: 'Vue par Enseignant', icon: User },
            { id: 'room', label: 'Vue par Salle', icon: Clock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as typeof viewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                viewMode === tab.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-56 h-10 rounded-xl text-xs font-extrabold border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2BAC-A">2BAC-A (Sciences Maths)</SelectItem>
              <SelectItem value="2BAC-B">2BAC-B (Sciences Physiques)</SelectItem>
              <SelectItem value="1BAC-A">1BAC-A (Lettres & Huma)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => setIsAddSlotOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Créneau</span>
          </Button>
        </div>
      </div>

      {/* Conflict Warning Banner */}
      {slots.some(s => s.hasConflict) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>1 Conflit d&apos;emploi du temps détecté:</strong> M. John Smith est également attribué à la classe 1BAC-A sur le même créneau.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setIsConflictOpen(true)}
            className="h-8 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
          >
            Résoudre le conflit
          </Button>
        </div>
      )}

      {/* Main 5-Day Interactive Timetable Grid Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS.map(day => {
          const daySlots = slots.filter(s => s.day === day);
          return (
            <Card key={day} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider">{day}</h3>
                <span className="text-[10px] text-slate-400 font-bold">{daySlots.length} cours</span>
              </div>

              <div className="space-y-3">
                {daySlots.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic p-3 text-center">Aucun cours planifié</p>
                ) : (
                  daySlots.map(slot => {
                    const isSelected = slot.id === selectedSlotId;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`p-3 rounded-2xl border text-xs space-y-2 transition cursor-pointer ${
                          slot.hasConflict
                            ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-2xs'
                            : isSelected
                            ? 'bg-[#DCEBF4]/40 border-[#2487B8] shadow-xs'
                            : 'bg-slate-50 border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span className="flex items-center gap-1 text-[#2487B8]">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.time}
                          </span>
                          {slot.hasConflict && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-200 text-rose-800">
                              Conflit
                            </span>
                          )}
                        </div>

                        <p className="font-extrabold text-[#16212B] text-xs">{slot.subject}</p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <span className="w-5 h-5 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-[8px]">
                              {slot.teacherAvatar}
                            </span>
                            <span>{slot.teacher}</span>
                          </div>
                          <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200/60">
                            {slot.room}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Active Slot Details Inspector */}
      {activeSlot && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xs">
                {activeSlot.teacherAvatar}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#16212B]">
                  Créneau sélectionné: {activeSlot.subject} ({activeSlot.day} {activeSlot.time})
                </h3>
                <p className="text-xs text-slate-400">Classe: {activeSlot.className} • Enseignant: {activeSlot.teacher} • Salle: {activeSlot.room}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-slate-200">
                Modifier le créneau
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      <Dialog open={isAddSlotOpen} onOpenChange={setIsAddSlotOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#2487B8]" />
              Ajouter un créneau à {selectedClass}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Jour *</label>
                <Select value={newSlot.day} onValueChange={val => setNewSlot({ ...newSlot, day: val as SlotItem['day'] })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Horaires *</label>
                <Input
                  value={newSlot.time}
                  onChange={e => setNewSlot({ ...newSlot, time: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Matière *</label>
              <Input
                placeholder="Ex. Physique-Chimie"
                value={newSlot.subject}
                onChange={e => setNewSlot({ ...newSlot, subject: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Enseignant *</label>
                <Input
                  value={newSlot.teacher}
                  onChange={e => setNewSlot({ ...newSlot, teacher: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Salle *</label>
                <Input
                  value={newSlot.room}
                  onChange={e => setNewSlot({ ...newSlot, room: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddSlotOpen(false)} className="rounded-xl text-xs h-9">Annuler</Button>
            <Button onClick={handleAddSlot} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">Ajouter au planning</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConflictOpen} onOpenChange={setIsConflictOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Résolution de conflit d&apos;emploi du temps
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 my-2">M. John Smith est actuellement assigné à deux cours simultanés le Mardi de 10:15 à 12:15.</p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 my-2">
            <p className="font-bold text-[#16212B]">Option recommandée :</p>
            <p className="text-slate-500">Déplacer le cours d&apos;Anglais en 2BAC-A vers la <strong>Salle 204 (Libre)</strong> avec décalage à 14:00.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsConflictOpen(false)} className="rounded-xl text-xs h-9">Annuler</Button>
            <Button onClick={handleResolveConflict} className="rounded-xl text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold">Appliquer la solution</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
