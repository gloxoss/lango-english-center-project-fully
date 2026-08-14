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
  BookOpen, Plus, Clock, Search, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { HomeworkItem, MOCK_HOMEWORK } from '../data/homework-config';

export function HomeworkClient({ locale }: { locale?: string } = {}) {
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(MOCK_HOMEWORK);
  const [activeTab, setActiveTab] = useState<'Active' | 'Closed' | 'All'>('Active');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newHw, setNewHw] = useState({
    title: '',
    subject: 'Mathématiques',
    className: '2BAC-A',
    teacher: 'M. Omar Alami',
    dueDate: '10 juin 2026 à 23:59',
    totalStudents: '30',
  });

  const filtered = homeworkList.filter(hw => {
    const matchesSearch = hw.title.toLowerCase().includes(search.toLowerCase()) || hw.subject.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' || hw.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleCreateHomework = () => {
    if (!newHw.title.trim()) return;
    const created: HomeworkItem = {
      id: `hw-${Date.now()}`,
      title: newHw.title.trim(),
      subject: newHw.subject,
      className: newHw.className,
      teacher: newHw.teacher,
      dueDate: newHw.dueDate,
      submittedCount: 0,
      totalStudents: Number(newHw.totalStudents) || 30,
      status: 'Active',
    };
    setHomeworkList(prev => [created, ...prev]);
    setIsAddModalOpen(false);
    setNewHw({ title: '', subject: 'Mathématiques', className: '2BAC-A', teacher: 'M. Omar Alami', dueDate: '10 juin 2026 à 23:59', totalStudents: '30' });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Hub Devoirs & Travaux à Rendre</h1>
          <p className="text-xs text-slate-500 mt-1">Création de devoirs, suivi des remises en ligne par classe et évaluation des devoirs.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau devoir / travail</span>
          </Button>
        </div>
      </div>

      {/* Top 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Devoirs Actifs en Cours</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{homeworkList.filter(h => h.status === 'Active').length} Devoirs</p>
          <p className="text-[10px] text-slate-400">Toutes classes confondues</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">Taux de Remise Moyen</p>
          <p className="text-2xl font-extrabold text-[#17A673]">86%</p>
          <p className="text-[10px] text-slate-400">Soumissions dans les délais</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-amber-200/60 bg-amber-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-amber-700">Devoirs À Évaluer (Correcteur)</p>
          <p className="text-2xl font-extrabold text-amber-900">42 Copies</p>
          <p className="text-[10px] text-amber-600">En attente de notation</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['Active', 'Closed', 'All'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                activeTab === tab ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'Active' ? 'Devoirs en cours' : tab === 'Closed' ? 'Devoirs clôturés' : 'Tous les devoirs'}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par titre ou matière..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </div>

      {/* Homework Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(hw => {
          const percent = Math.round((hw.submittedCount / hw.totalStudents) * 100);
          return (
            <Card key={hw.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#DCEBF4] text-[#1B6C93]">
                    {hw.subject}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{hw.className}</span>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-[#16212B] line-clamp-2">{hw.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    À rendre le : <strong className="text-slate-600">{hw.dueDate}</strong>
                  </p>
                </div>

                {/* Progress bar for submissions */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">Soumissions reçues:</span>
                    <strong className="text-[#2487B8]">{hw.submittedCount} / {hw.totalStudents} ({percent}%)</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#2487B8] h-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-bold">Par {hw.teacher}</span>
                <Link href={`/${locale || 'fr'}/dashboard/homework/submissions`}>
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-[#2487B8] hover:bg-[#DCEBF4]/40 gap-1">
                    <span>Consulter les remises</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Nouveau Devoir Modal Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2487B8]" />
              Créer un nouveau devoir / TP
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Titre du devoir *</label>
              <Input
                placeholder="Ex. DM n°5 : Calcul d'intégrales & probabilités"
                value={newHw.title}
                onChange={e => setNewHw({ ...newHw, title: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Matière *</label>
                <Select value={newHw.subject} onValueChange={val => setNewHw({ ...newHw, subject: val })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mathématiques">Mathématiques</SelectItem>
                    <SelectItem value="Physique-Chimie">Physique-Chimie</SelectItem>
                    <SelectItem value="Philosophie">Philosophie</SelectItem>
                    <SelectItem value="Français">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe ciblée *</label>
                <Select value={newHw.className} onValueChange={val => setNewHw({ ...newHw, className: val })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2BAC-A">2BAC-A</SelectItem>
                    <SelectItem value="2BAC-B">2BAC-B</SelectItem>
                    <SelectItem value="1BAC-A">1BAC-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date & heure de remise *</label>
                <Input
                  value={newHw.dueDate}
                  onChange={e => setNewHw({ ...newHw, dueDate: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Enseignant responsable</label>
                <Input
                  value={newHw.teacher}
                  onChange={e => setNewHw({ ...newHw, teacher: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateHomework} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Publier le devoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
