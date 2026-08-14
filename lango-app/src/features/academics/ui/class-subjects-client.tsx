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
  BookOpen, AlertTriangle, Plus, Download, Building2, Search,
} from 'lucide-react';
import {
  SubjectAssignmentItem, MOCK_ASSIGNMENTS,
} from '../data/class-subjects-config';

export function ClassSubjectsClient({ locale: _locale }: { locale?: string } = {}) {
  const [selectedClass, setSelectedClass] = useState('2BAC-A');
  const [assignments, setAssignments] = useState<SubjectAssignmentItem[]>(MOCK_ASSIGNMENTS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({
    subjectName: '',
    code: '',
    coefficient: '3',
    weeklyHours: '3',
    teacherName: 'M. Omar Alami',
    roomName: 'Salle 104',
    type: 'compulsory' as 'compulsory' | 'elective',
  });

  const filteredAssignments = assignments.filter(item => {
    const matchesSearch = item.subjectName.toLowerCase().includes(search.toLowerCase()) || item.teacherName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalHours = assignments.reduce((acc, i) => acc + (i.status !== 'unassigned' ? i.weeklyHours : 0), 0);
  const totalCoeff = assignments.reduce((acc, i) => acc + i.coefficient, 0);

  const handleAddSubject = () => {
    if (!newSubject.subjectName.trim()) return;
    const created: SubjectAssignmentItem = {
      id: `s-${Date.now()}`,
      subjectName: newSubject.subjectName.trim(),
      code: newSubject.code.trim() || `SUB-${Date.now()}`,
      coefficient: Number(newSubject.coefficient) || 2,
      weeklyHours: Number(newSubject.weeklyHours) || 2,
      teacherName: newSubject.teacherName,
      teacherAvatar: newSubject.teacherName.split(' ').map(n => n[0]).join('').slice(0, 2),
      roomName: newSubject.roomName,
      type: newSubject.type,
      status: 'assigned',
    };
    setAssignments(prev => [...prev, created]);
    setIsAddOpen(false);
    setNewSubject({ subjectName: '', code: '', coefficient: '3', weeklyHours: '3', teacherName: 'M. Omar Alami', roomName: 'Salle 104', type: 'compulsory' });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Affectation des Matières par Classe</h1>
          <p className="text-xs text-slate-500 mt-1">Définissez la grille horaire, coefficients, enseignants référents et salles pour chaque classe.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter la grille</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Affecter une matière</span>
          </Button>
        </div>
      </div>

      {/* Class Selector Bar */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Classe sélectionnée:</span>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-64 h-10 rounded-xl text-xs font-extrabold border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2BAC-A">2BAC-A (Sciences Maths)</SelectItem>
                <SelectItem value="2BAC-B">2BAC-B (Sciences Physiques)</SelectItem>
                <SelectItem value="1BAC-A">1BAC-A (Lettres & Huma)</SelectItem>
                <SelectItem value="3AC-A">3AC-A (Collège)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <span className="text-slate-500">Volume Horaire:</span>
              <strong className="text-[#2487B8]">{totalHours}h / 30h max</strong>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <span className="text-slate-500">Total Coeff:</span>
              <strong className="text-[#16212B]">{totalCoeff}</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Assigned Subjects List & Search Toolbar */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-[#16212B]">
                Grille des matières ({filteredAssignments.length})
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Filtrer matière..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-36 h-9 rounded-xl text-xs bg-slate-50 border-none">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="assigned">Complet</SelectItem>
                    <SelectItem value="conflict">En Conflit</SelectItem>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredAssignments.map(item => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    item.status === 'conflict'
                      ? 'bg-rose-50/50 border-rose-200'
                      : item.status === 'unassigned'
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-bold">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-[#16212B]">{item.subjectName}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {item.code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Coeff: <strong>{item.coefficient}</strong> • Volume: <strong>{item.weeklyHours}h / semaine</strong> • {item.type === 'compulsory' ? 'Obligatoire' : 'Optionnel'}
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      item.status === 'assigned' ? 'bg-[#DDF5EC] text-[#17A673]' :
                      item.status === 'conflict' ? 'bg-[#FCE4E2] text-[#E5544B]' : 'bg-[#FCF0DC] text-[#E8A33D]'
                    }`}>
                      {item.status === 'assigned' ? '✔ Assigné' : item.status === 'conflict' ? '⚠ Conflit' : '❓ Non assigné'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-[10px]">
                        {item.teacherAvatar}
                      </div>
                      <span className="font-semibold text-slate-700">{item.teacherName}</span>
                    </div>
                    <span className="flex items-center gap-1 font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {item.roomName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right 5 cols: Alerts & Missing Teacher Action Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px]">
              Alertes & Postes Enseignants à pourvoir
            </h3>

            {/* Conflict Alert */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 space-y-2 text-xs text-rose-900">
              <div className="flex items-center gap-2 font-extrabold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>1 Conflit d&apos;enseignant à résoudre</span>
              </div>
              <p className="text-xs text-rose-700">
                <strong>Anglais renforcé (M. John Smith)</strong> est en chevauchement avec la classe 1BAC-A sur le créneau Mardi 10h-12h.
              </p>
              <Button size="sm" className="h-8 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white mt-1">
                Résoudre le conflit
              </Button>
            </div>

            {/* Unassigned Subject Callout */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2 text-xs text-amber-900">
              <div className="flex items-center justify-between font-extrabold text-amber-900">
                <span>Philosophie (2h/semaine)</span>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                  Poste vacant
                </span>
              </div>
              <p className="text-xs text-amber-800">
                Aucun professeur de philosophie n&apos;est attribué à la classe 2BAC-A pour l&apos;année 2026-2027.
              </p>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-xl border-amber-300 bg-white text-amber-900 mt-1">
                Attribuer un professeur
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Affecter une Matière Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2487B8]" />
              Affecter une Matière à {selectedClass}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Matière *</label>
              <Input
                placeholder="Ex. Histoire-Géographie"
                value={newSubject.subjectName}
                onChange={e => setNewSubject({ ...newSubject, subjectName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Code *</label>
                <Input
                  placeholder="HIST-2BAC"
                  value={newSubject.code}
                  onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Coeff *</label>
                <Input
                  type="number"
                  value={newSubject.coefficient}
                  onChange={e => setNewSubject({ ...newSubject, coefficient: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Volume (h) *</label>
                <Input
                  type="number"
                  value={newSubject.weeklyHours}
                  onChange={e => setNewSubject({ ...newSubject, weeklyHours: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Enseignant référent *</label>
                <Input
                  value={newSubject.teacherName}
                  onChange={e => setNewSubject({ ...newSubject, teacherName: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Salle *</label>
                <Input
                  value={newSubject.roomName}
                  onChange={e => setNewSubject({ ...newSubject, roomName: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Type d&apos;enseignement</label>
              <Select value={newSubject.type} onValueChange={val => setNewSubject({ ...newSubject, type: val as 'compulsory' | 'elective' })}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compulsory">Obligatoire (Socle commun)</SelectItem>
                  <SelectItem value="elective">Optionnel / Choisis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleAddSubject} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Valider l&apos;affectation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
