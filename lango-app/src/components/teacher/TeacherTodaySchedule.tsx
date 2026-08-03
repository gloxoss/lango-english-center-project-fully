'use client';

import { Calendar, CheckCircle, Clock, BookOpen, UserCheck, Award } from 'lucide-react';
import React, { useState } from 'react';

interface ClassItem {
  id: string;
  className: string;
  sectionName: string;
  subjectName: string;
  timeSlot: string;
  roomName: string;
  studentCount: number;
}

export function TeacherTodaySchedule() {
  const [classes] = useState<ClassItem[]>([
    {
      id: 'cs-ce1-a',
      className: 'CE1',
      sectionName: 'Groupe A',
      subjectName: 'Français & Orthographe',
      timeSlot: '08:30 - 10:00',
      roomName: 'Salle 102',
      studentCount: 24,
    },
    {
      id: 'cs-ce2-b',
      className: 'CE2',
      sectionName: 'Groupe B',
      subjectName: 'Grammaire & Conjugaison',
      timeSlot: '10:15 - 11:45',
      roomName: 'Salle 105',
      studentCount: 22,
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-1">
              <Calendar className="w-4 h-4" />
              <span>Emploi du temps d aujourd hui</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Espace Enseignant / Professeur</h1>
            <p className="text-slate-400 text-sm mt-1">
              Gérez vos cours, saisissez la présence en 1 clic et attribuez les notes sur 20.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              2 cours planifiés aujourd hui
            </span>
          </div>
        </div>
      </div>

      {/* Class Schedule Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.map((cls) => (
          <div
            key={cls.id}
            className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-md border border-indigo-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {cls.timeSlot}
                </span>
                <span className="text-xs text-slate-400 font-medium">{cls.roomName}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                {cls.className} — {cls.sectionName}
              </h3>
              <p className="text-indigo-400 text-sm font-medium flex items-center gap-1.5 mb-4">
                <BookOpen className="w-4 h-4" />
                {cls.subjectName}
              </p>
              <div className="text-xs text-slate-400">
                Effectif: <span className="text-slate-200 font-semibold">{cls.studentCount} élèves</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-3">
              <button
                type="button"
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Faire l appel
              </button>
              <button
                type="button"
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                Saisir Notes /20
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
