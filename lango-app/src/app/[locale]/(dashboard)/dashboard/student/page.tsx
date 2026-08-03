import { BookOpen, Calendar, Award } from 'lucide-react';
import React from 'react';

export default function StudentPortalPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 p-6 rounded-2xl border border-blue-500/20 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Portail Élève</span>
            <h1 className="text-2xl font-bold text-white mt-1">Espace Apprenant</h1>
            <p className="text-slate-400 text-sm mt-1">Consultez votre emploi du temps, vos devoirs et vos résultats d examens.</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Mon Emploi du Temps</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Français & Orthographe</div>
                <div className="text-xs text-slate-400">08:30 - 10:00 • Salle 102</div>
              </div>
              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-md">En cours</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Derniers Résultats /20</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Contrôle N°1 — Orthographe</div>
                <div className="text-xs text-slate-400">Évaluation Trimestrielle</div>
              </div>
              <span className="text-base font-bold text-emerald-400">18.5 / 20</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
