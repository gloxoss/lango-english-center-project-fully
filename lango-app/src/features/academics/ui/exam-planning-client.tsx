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
  Calendar, Building2, Plus, Download, Search, Grid,
} from 'lucide-react';
import {
  ExamSession, MOCK_EXAMS,
} from '../data/exam-planning-config';

export function ExamPlanningClient({ locale: _locale }: { locale?: string } = {}) {
  const [exams, setExams] = useState<ExamSession[]>(MOCK_EXAMS);
  const [selectedExamId, setSelectedExamId] = useState<string>('1');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newExam, setNewExam] = useState({
    subject: '',
    className: '2BAC-A',
    date: '22 juin 2026',
    time: '08:00 - 10:00',
    room: 'Amphithéâtre Ibno Kholdoun',
    invigilatorName: 'M. Omar Alami',
    totalCandidates: '30',
  });

  const filteredExams = exams.filter(e => {
    const matchesSearch = e.subject.toLowerCase().includes(search.toLowerCase()) || e.room.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const selectedExam = exams.find(e => e.id === selectedExamId) ?? exams[0];

  const handleCreateExam = () => {
    if (!newExam.subject.trim()) return;
    const created: ExamSession = {
      id: `ex-${Date.now()}`,
      subject: newExam.subject.trim(),
      className: newExam.className,
      date: newExam.date,
      time: newExam.time,
      room: newExam.room,
      invigilators: [{ name: newExam.invigilatorName, avatar: newExam.invigilatorName.split(' ').map(n => n[0]).join('').slice(0, 2) }],
      totalCandidates: Number(newExam.totalCandidates) || 30,
      maxCapacity: 35,
      status: 'Scheduled',
      seatingGrid: [
        { desk: 'A-01', studentName: 'Élève Exemple 1', matricule: '2026-0301', isOccupied: true },
        { desk: 'A-02', studentName: 'Élève Exemple 2', matricule: '2026-0302', isOccupied: true },
      ],
    };
    setExams(prev => [created, ...prev]);
    setIsAddOpen(false);
    setNewExam({ subject: '', className: '2BAC-A', date: '22 juin 2026', time: '08:00 - 10:00', room: 'Amphithéâtre Ibno Kholdoun', invigilatorName: 'M. Omar Alami', totalCandidates: '30' });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Planification des Examens & Logistique des Épreuves</h1>
          <p className="text-xs text-slate-500 mt-1">Organisation des sessions d&apos;examens, affectation des surveillants et génération des plans de table.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Imprimer les plans de table</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Programmer une épreuve</span>
          </Button>
        </div>
      </div>

      {/* Top 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-500">Total Épreuves Programmées</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{exams.length} Sessions</p>
          <p className="text-[10px] text-slate-400">Période du 15 au 25 juin 2026</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Candidats Convoqués</p>
          <p className="text-2xl font-extrabold text-[#2487B8]">
            {exams.reduce((acc, e) => acc + e.totalCandidates, 0)} Élèves
          </p>
          <p className="text-[10px] text-slate-400">Répartis sur 4 amphis & labos</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">Surveillants Mobilisés</p>
          <p className="text-2xl font-extrabold text-[#17A673]">24 Enseignants</p>
          <p className="text-[10px] text-slate-400">Planning de garde validé</p>
        </Card>
      </div>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Exam Sessions List & Search Toolbar */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher par épreuve ou salle..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
              />
            </div>
            <div className="flex items-center gap-1">
              {[
                { id: 'all', label: 'Toutes' },
                { id: 'Scheduled', label: 'Programmées' },
                { id: 'In Progress', label: 'En cours' },
                { id: 'Completed', label: 'Terminées' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterStatus === f.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredExams.map(exam => {
              const isSelected = selectedExam?.id === exam.id;
              return (
                <Card
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`p-5 bg-white rounded-2xl border transition cursor-pointer space-y-3 ${
                    isSelected ? 'border-[#2487B8] bg-[#DCEBF4]/20 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#DCEBF4] text-[#1B6C93]">
                      {exam.className}
                    </span>
                    <span className="text-[10px] font-bold text-[#17A673] bg-[#DDF5EC] px-2.5 py-1 rounded-full">
                      ✔ {exam.status === 'Scheduled' ? 'Programmé' : exam.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-[#16212B]">{exam.subject}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#2487B8]" />
                      <span>{exam.date} • <strong className="text-[#2487B8]">{exam.time}</strong></span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" /> {exam.room}
                    </span>
                    <span className="font-extrabold text-[#16212B]">
                      {exam.totalCandidates} / {exam.maxCapacity} Candidats
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right 5 cols: Exam Session Seating Grid & Logistics Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {selectedExam && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold text-[#2487B8] uppercase tracking-wider">Fiche de Session d&apos;Examen</span>
                <h2 className="text-base font-extrabold text-[#16212B]">{selectedExam.subject}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedExam.className} • {selectedExam.date} ({selectedExam.time})</p>
              </div>

              {/* Room & Capacity info box */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">Local affecté</span>
                  <p className="font-extrabold text-[#16212B]">{selectedExam.room}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">Capacité retenue</span>
                  <p className="font-extrabold text-[#2487B8]">{selectedExam.totalCandidates} / {selectedExam.maxCapacity} places</p>
                </div>
              </div>

              {/* Invigilators 36px Avatars */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px]">Surveillants Désignés</h3>
                <div className="space-y-1.5">
                  {selectedExam.invigilators.map((inv, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-[10px]">
                        {inv.avatar}
                      </div>
                      <span className="font-bold text-[#16212B]">{inv.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Seating Plan Matrix */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-[#2487B8]" />
                    Aperçu Plan de Table ({selectedExam.seatingGrid.length} tables)
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedExam.seatingGrid.map((deskItem, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                        deskItem.isOccupied ? 'bg-white border-slate-200/80 shadow-2xs' : 'bg-slate-50 border-dashed border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-extrabold text-[#2487B8] text-[10px] bg-[#DCEBF4] px-1.5 py-0.5 rounded">
                          {deskItem.desk}
                        </span>
                        <span className={`text-[9px] font-bold ${deskItem.isOccupied ? 'text-[#17A673]' : 'text-slate-400'}`}>
                          {deskItem.isOccupied ? 'Occupé' : 'Libre'}
                        </span>
                      </div>
                      <p className="font-bold text-[#16212B] text-[11px] truncate">{deskItem.studentName}</p>
                      {deskItem.isOccupied && <p className="text-[9px] text-slate-400 font-mono">{deskItem.matricule}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button size="sm" className="w-full h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5">
                  <Download className="w-4 h-4" />
                  Imprimer feuille d&apos;émargement officielle
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Programmer une épreuve Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#2487B8]" />
              Programmer une nouvelle épreuve
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Intitulé de l&apos;épreuve *</label>
              <Input
                placeholder="Ex. Épreuve Blanche : Mathématiques"
                value={newExam.subject}
                onChange={e => setNewExam({ ...newExam, subject: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe / Section *</label>
                <Select value={newExam.className} onValueChange={val => setNewExam({ ...newExam, className: val })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2BAC-A">2BAC-A (Sciences Maths)</SelectItem>
                    <SelectItem value="2BAC-B">2BAC-B (Sciences Physiques)</SelectItem>
                    <SelectItem value="1BAC-A">1BAC-A (Lettres & Huma)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Date *</label>
                <Input
                  value={newExam.date}
                  onChange={e => setNewExam({ ...newExam, date: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Horaires *</label>
                <Input
                  value={newExam.time}
                  onChange={e => setNewExam({ ...newExam, time: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Local / Salle *</label>
                <Input
                  value={newExam.room}
                  onChange={e => setNewExam({ ...newExam, room: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Surveillant Principal *</label>
              <Input
                value={newExam.invigilatorName}
                onChange={e => setNewExam({ ...newExam, invigilatorName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateExam} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Valider la programmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
