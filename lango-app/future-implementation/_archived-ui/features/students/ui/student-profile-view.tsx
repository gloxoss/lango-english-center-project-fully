'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Calendar, CheckCircle2, Clock, FileText, Award, TrendingUp, AlertCircle, ChevronRight, MessageSquare
} from 'lucide-react';

const STUDENT_COURSES_TODAY = [
  { time: '08:00 - 09:00', subject: 'Mathématiques', teacher: 'M. El Amrani', room: 'Salle 201', icon: '📐' },
  { time: '09:00 - 10:00', subject: 'Physique-Chimie', teacher: 'Mme Bennis', room: 'Salle 205', icon: '🧪' },
  { time: '10:20 - 11:20', subject: 'Français', teacher: 'M. Haddad', room: 'Salle 103', icon: '📖' },
  { time: '11:20 - 12:20', subject: 'Anglais', teacher: 'Mme Zahraoui', room: 'Salle 106', icon: '🌐' },
  { time: '14:30 - 15:30', subject: 'Sciences de la vie et de la terre', teacher: 'M. Touil', room: 'Salle 204', icon: '🍃' },
  { time: '15:30 - 16:30', subject: 'Informatique', teacher: 'M. Rguig', room: 'Salle Info 1', icon: '💻' },
];

const PENDING_HOMEWORK = [
  { tag: 'Maths', tagColor: 'bg-emerald-100 text-emerald-700', title: 'Exercices sur les suites numériques', due: 'À rendre le 23 mai 2025 à 23:59', daysLeft: '2 jours', urgencyColor: 'bg-rose-100 text-rose-700' },
  { tag: 'Physique', tagColor: 'bg-[#DCEBF4] text-[#1B6C93]', title: 'TP : Étude d\'un circuit électrique', due: 'À rendre le 24 mai 2025 à 23:59', daysLeft: '3 jours', urgencyColor: 'bg-amber-100 text-amber-700' },
  { tag: 'Français', tagColor: 'bg-purple-100 text-purple-700', title: 'Dissertation : Le roman réaliste', due: 'À rendre le 26 mai 2025 à 23:59', daysLeft: '5 jours', urgencyColor: 'bg-amber-100 text-amber-700' },
];

const RECENT_GRADES = [
  { subject: 'Mathématiques', date: '16 mai 2025', grade: '15,5/20', color: 'text-[#17A673]' },
  { subject: 'Physique-Chimie', date: '15 mai 2025', grade: '13,0/20', color: 'text-amber-600' },
  { subject: 'Français', date: '14 mai 2025', grade: '14,0/20', color: 'text-[#17A673]' },
  { subject: 'Anglais', date: '12 mai 2025', grade: '16,5/20', color: 'text-[#17A673]' },
  { subject: 'SVT', date: '10 mai 2025', grade: '17,0/20', color: 'text-[#17A673]' },
];

const SUBJECT_PROGRESS = [
  { subject: 'Maths', grade: 15.2 },
  { subject: 'Physique', grade: 13.1 },
  { subject: 'Français', grade: 14.0 },
  { subject: 'Anglais', grade: 16.5 },
  { subject: 'SVT', grade: 17.0 },
  { subject: 'Info', grade: 15.8 },
];

const ANNOUNCEMENTS = [
  { title: 'Examen régional - 1BAC', date: 'Du 02 au 06 juin 2025', desc: 'Préparez-vous bien et révisez régulièrement.' },
  { title: 'Réunion parents-professeurs', date: 'Samedi 24 mai 2025 à 10h00', desc: 'Votre présence est importante.' },
];

const TEACHER_COMMENTS = [
  { teacher: 'M. El Amrani', subject: 'Mathématiques', text: 'Bon travail dans l\'ensemble. Continue à t\'entraîner sur les exercices d\'application.', date: '16 mai 2025', initials: 'MA' },
  { teacher: 'Mme Bennis', subject: 'Physique-Chimie', text: 'Participation en classe satisfaisante. Continue ainsi !', date: '15 mai 2025', initials: 'MB' },
];

export function StudentPortalView({ locale: _locale, id: _id }: { locale?: string; id?: string }) {
  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Top Banner */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#2487B8] text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-md">
              YE
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#16212B] tracking-tight">Bonjour Youssef 👋</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Reste concentré, chaque effort te rapproche de tes objectifs !</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cours aujourd&apos;hui</span>
              <span className="text-lg font-extrabold text-[#16212B]">6</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Devoirs à rendre</span>
              <span className="text-lg font-extrabold text-[#16212B]">3</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Moyenne générale</span>
              <span className="text-lg font-extrabold text-[#2487B8]">14,6 <span className="text-xs font-normal text-slate-500">/20</span></span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Rang de classe</span>
              <span className="text-lg font-extrabold text-[#17A673]">8 <span className="text-xs font-normal text-slate-500">/32</span></span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Grid: Left (8 cols) & Right (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Row 1: Prochains cours (6 cols) & Devoirs à rendre bientôt (6 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Prochains cours aujourd&apos;hui</h2>
                <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir l&apos;emploi du temps</button>
              </div>

              <div className="space-y-2">
                {STUDENT_COURSES_TODAY.map((c, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs hover:bg-slate-100/80 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">{c.icon}</span>
                      <div>
                        <p className="font-bold text-[#16212B] text-[11px]">{c.subject}</p>
                        <p className="text-[10px] text-slate-400">{c.teacher}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#2487B8] text-[11px]">{c.time.split(' - ')[0]}</span>
                      <p className="text-[10px] text-slate-500 font-medium">{c.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Devoirs à rendre bientôt</h2>
                <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir mes devoirs</button>
              </div>

              <div className="space-y-2">
                {PENDING_HOMEWORK.map((hw, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[9px] font-bold border-none ${hw.tagColor}`}>{hw.tag}</Badge>
                      <Badge className={`text-[9px] font-bold border-none ${hw.urgencyColor}`}>{hw.daysLeft}</Badge>
                    </div>
                    <p className="font-bold text-[#16212B] text-xs">{hw.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{hw.due}</p>
                  </div>
                ))}
              </div>

              <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
                Voir mes devoirs
              </button>
            </Card>
          </div>

          {/* Row 2: Dernières notes & Progression chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Dernières notes</h2>
                <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Consulter mes notes</button>
              </div>

              <div className="space-y-2">
                {RECENT_GRADES.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                      <p className="font-bold text-[#16212B] text-[11px]">{g.subject}</p>
                      <p className="text-[10px] text-slate-400">{g.date}</p>
                    </div>
                    <span className={`font-mono font-extrabold text-xs ${g.color}`}>{g.grade}</span>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <Button className="w-full h-8 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white">
                  Consulter mes notes
                </Button>
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Ma progression par matière</h2>
                <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir le détail</button>
              </div>

              {/* Bar Chart */}
              <div className="flex items-end gap-2 h-36 pt-4 border-b border-slate-100">
                {SUBJECT_PROGRESS.map((item) => (
                  <div key={item.subject} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-600">{item.grade}</span>
                    <div className="w-full bg-slate-100 rounded-t-sm flex items-end h-24">
                      <div className="w-full bg-[#2487B8] rounded-t-sm" style={{ height: `${(item.grade / 20) * 100}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{item.subject}</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-center font-bold text-slate-400 uppercase">Moyenne (/20)</p>
            </Card>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          {/* Présences Donut */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">Présences</h2>

            <div className="flex items-center justify-center py-2">
              <div className="relative w-32 h-32 rounded-full border-8 border-[#2487B8] flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-[#16212B]">94%</span>
                <span className="text-[9px] font-bold text-slate-400">Taux de présence</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2487B8]" /><span className="font-semibold text-slate-600">Présent</span></div>
                <span className="font-extrabold text-[#16212B]">94%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="font-semibold text-slate-600">Absent justifié</span></div>
                <span className="font-extrabold text-[#16212B]">4%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /><span className="font-semibold text-slate-600">Absent non justifié</span></div>
                <span className="font-extrabold text-[#16212B]">2%</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center font-medium">Depuis le début de l&apos;année scolaire ℹ️</p>
          </Card>

          {/* Situation des frais */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Situation des frais de scolarité</h2>
              <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">À jour</Badge>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/80 text-xs">
              <CheckCircle2 className="w-4 h-4 text-[#17A673] shrink-0" />
              <div>
                <p className="font-bold text-[#17A673]">Aucun paiement en attente.</p>
                <p className="text-[10px] text-slate-500 font-medium">Merci de votre régularité.</p>
              </div>
            </div>

            <Button variant="outline" className="w-full h-8 text-xs font-bold rounded-xl border-slate-200 text-[#2487B8] hover:bg-[#DCEBF4]/30">
              Voir l&apos;historique des paiements
            </Button>
          </Card>

          {/* Annonces de l'établissement */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Annonces de l&apos;établissement</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir toutes</button>
            </div>

            <div className="space-y-2">
              {ANNOUNCEMENTS.map((anc, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                  <p className="font-bold text-[#16212B] text-[11px]">{anc.title}</p>
                  <p className="text-[10px] text-[#2487B8] font-semibold">{anc.date}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{anc.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Commentaires des enseignants */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Commentaires des enseignants</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir tous</button>
            </div>

            <div className="space-y-2">
              {TEACHER_COMMENTS.map((com, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold text-[10px] flex items-center justify-center shrink-0">
                    {com.initials}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#16212B] text-[11px]">{com.teacher}</span>
                      <span className="text-[9px] text-slate-400">{com.date}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-[#2487B8]">{com.subject}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{com.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full h-8 text-xs font-bold rounded-xl border-slate-200 text-[#2487B8] hover:bg-[#DCEBF4]/30">
              Voir tous les commentaires
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const StudentProfile360View = StudentPortalView;
export const StudentProfileView = StudentPortalView;
