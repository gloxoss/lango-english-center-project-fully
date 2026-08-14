'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, CheckSquare, Edit3, Clock, Users, BookOpen, MessageSquare, ChevronRight, TrendingUp, CheckCircle2
} from 'lucide-react';

const TEACHER_SCHEDULE = [
  { id: '1', time: '08:00 - 09:00', duration: '1h', subject: 'Mathématiques', class: '2BAC A', room: 'Salle 203', status: 'À venir' },
  { id: '2', time: '09:15 - 10:15', duration: '1h', subject: 'Mathématiques', class: '2BAC B', room: 'Salle 204', status: 'En cours' },
  { id: '3', time: '10:30 - 11:30', duration: '1h', subject: 'Mathématiques', class: '1BAC S1', room: 'Salle 203', status: 'À venir' },
  { id: '4', time: '12:00 - 13:00', duration: '1h', subject: 'Mathématiques', class: '1BAC S2', room: 'Salle 204', status: 'À venir' },
  { id: '5', time: '14:00 - 15:00', duration: '1h', subject: 'Mathématiques', class: '2BAC A', room: 'Salle 203', status: 'À venir' },
];

const TEACHER_CLASSES = [
  { name: '2BAC A', subject: 'Mathématiques', count: 34 },
  { name: '2BAC B', subject: 'Mathématiques', count: 32 },
  { name: '1BAC S1', subject: 'Mathématiques', count: 36 },
  { name: '1BAC S2', subject: 'Mathématiques', count: 35 },
];

const HOMEWORK_TO_GRADE = [
  { title: 'DS Fonctions numériques', class: '2BAC A', copiesCount: 22 },
  { title: 'DM Suites arithmétiques', class: '1BAC S1', copiesCount: 18 },
  { title: 'DS Probabilités', class: '2BAC B', copiesCount: 24 },
];

const SUBMITTED_COPIES = [
  { student: 'Yassine El Amrani', class: '2BAC A', hw: 'DS Fonctions numériques', time: '21/05 à 07:58', avatar: 'YE' },
  { student: 'Meryem Zahid', class: '1BAC S1', hw: 'DM Suites arithmétiques', time: '21/05 à 07:32', avatar: 'MZ' },
  { student: 'Omar Tahiri', class: '2BAC B', hw: 'DS Probabilités', time: '21/05 à 07:10', avatar: 'OT' },
];

const TEACHER_MESSAGES = [
  { from: 'Administration', title: 'Réunion pédagogique du 27 mai', snippet: 'Bonjour à tous les enseignants, une réunion pédagogique est...', time: 'Hier 15:42', unread: true },
  { from: 'Direction pédagogique', title: 'Programme des examens de fin d\'année', snippet: 'Veuillez trouver ci-joint le calendrier des examens de fin d\'année.', time: 'Hier 11:08', unread: true },
  { from: 'Administration', title: 'Fête de la jeunesse', snippet: 'Nous vous informons que l\'établissement sera fermé le lundi 26...', time: '19/05 16:30', unread: false },
];

const PERFORMANCE_STATS = [
  { class: '2BAC A', avg: '13,6/20', trend: '+1,2', pctAbove10: 62 },
  { class: '2BAC B', avg: '12,8/20', trend: '+0,8', pctAbove10: 56 },
  { class: '1BAC S1', avg: '14,2/20', trend: '+1,5', pctAbove10: 68 },
  { class: '1BAC S2', avg: '13,1/20', trend: '+0,9', pctAbove10: 59 },
];

export function TeacherPortalView({ locale: _locale, id: _id }: { locale?: string; id?: string }) {
  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Portail enseignant</h1>
          <p className="text-xs text-slate-500 mt-1">Vos classes, vos présences, vos devoirs et votre journée au même endroit.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
            <CheckSquare className="w-3.5 h-3.5" /> Marquer la présence
          </Button>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
            <BookOpen className="w-3.5 h-3.5" /> Publier un devoir
          </Button>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
            <Edit3 className="w-3.5 h-3.5" /> Saisir les notes
          </Button>
        </div>
      </div>

      {/* Grid Row 1: Today's Schedule (4 cols) + My Classes (4 cols) + Homework to Grade (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Today's Schedule */}
        <div className="xl:col-span-5 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Emploi du temps d&apos;aujourd&apos;hui</h2>
              <span className="text-[11px] font-bold text-slate-400">Mercredi 21 mai 2025</span>
            </div>

            <div className="space-y-2">
              {TEACHER_SCHEDULE.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${item.status === 'En cours' ? 'border-[#2487B8] bg-[#DCEBF4]/30' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                      {item.id}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#16212B]">{item.time}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">({item.duration})</span>
                      </div>
                      <p className="text-xs font-bold text-[#2487B8]">{item.subject} – <span className="text-[#16212B]">{item.class}</span></p>
                      <p className="text-[10px] text-slate-400 font-medium">{item.room}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] font-bold border-none ${item.status === 'En cours' ? 'bg-[#2487B8] text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir l&apos;emploi du temps complet →
            </button>
          </Card>
        </div>

        {/* My Classes */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Mes classes</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir toutes mes classes</button>
            </div>

            <div className="space-y-2">
              {TEACHER_CLASSES.map((cls) => (
                <div key={cls.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#DCEBF4] flex items-center justify-center text-[#1B6C93] font-bold text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-[#16212B]">{cls.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{cls.subject}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> {cls.count} élèves
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Homework to Grade */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Devoirs à corriger</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir tous les devoirs</button>
            </div>

            <div className="space-y-2">
              {HOMEWORK_TO_GRADE.map((hw, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#16212B]">{hw.title}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{hw.class}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-amber-700">{hw.copiesCount} copies</span>
                      <p className="text-[9px] font-bold text-amber-600">À corriger</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Accéder à tous les devoirs à corriger →
            </button>
          </Card>
        </div>
      </div>

      {/* Grid Row 2: Submitted Copies (4 cols) + Recent Messages (4 cols) + Performance Overview (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Dernières copies rendues */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Dernières copies rendues</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir toutes les copies</button>
            </div>

            <div className="space-y-2">
              {SUBMITTED_COPIES.map((copy, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#DDF5EC] text-[#17A673] font-extrabold text-xs flex items-center justify-center">
                      {copy.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#16212B]">{copy.student}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{copy.class} — {copy.hw}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-slate-400">Remis le</span>
                    <p className="text-[10px] font-bold text-slate-600">{copy.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir toutes les soumissions →
            </button>
          </Card>
        </div>

        {/* Messages récents */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Messages récents</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir tous les messages</button>
            </div>

            <div className="space-y-2">
              {TEACHER_MESSAGES.map((msg, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[#2487B8]">{msg.from}</span>
                    <span className="text-[10px] font-medium text-slate-400">{msg.time}</span>
                  </div>
                  <p className="text-xs font-bold text-[#16212B]">{msg.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{msg.snippet}</p>
                </div>
              ))}
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir tous les messages →
            </button>
          </Card>
        </div>

        {/* Aperçu des performances */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Aperçu des performances</h2>
              <select className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                <option>Ce trimestre</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Classe</th>
                    <th className="pb-2 text-center">Moyenne</th>
                    <th className="pb-2 text-center">Évolution</th>
                    <th className="pb-2 text-right">Élèves ≥ 10/20</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PERFORMANCE_STATS.map((perf) => (
                    <tr key={perf.class}>
                      <td className="py-2 font-bold text-[#16212B] text-[11px]">{perf.class}</td>
                      <td className="py-2 text-center font-extrabold text-slate-700 text-[11px]">{perf.avg}</td>
                      <td className="py-2 text-center font-bold text-[#17A673] text-[11px]">↑ {perf.trend}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-extrabold text-[#16212B] text-[11px]">{perf.pctAbove10}%</span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#2487B8] rounded-full" style={{ width: `${perf.pctAbove10}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir le détail des performances →
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const TeacherProfile360View = TeacherPortalView;
