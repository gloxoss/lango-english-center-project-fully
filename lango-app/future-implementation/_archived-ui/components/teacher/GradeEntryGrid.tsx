'use client';

import { Award, Save, CheckCircle } from 'lucide-react';
import React, { useState } from 'react';

interface StudentGrade {
  id: string;
  name: string;
  matricule: string;
  score: string;
}

export function GradeEntryGrid() {
  const [students, setStudents] = useState<StudentGrade[]>([
    { id: '1', name: 'Youssef El Amrani', matricule: '2026-0042', score: '16.5' },
    { id: '2', name: 'Kenza Benjelloun', matricule: '2026-0089', score: '18.0' },
    { id: '3', name: 'Omar Berrada', matricule: '2026-0104', score: '14.0' },
    { id: '4', name: 'Salma Tazi', matricule: '2026-0112', score: '17.5' },
  ]);

  const [saved, setSaved] = useState(false);

  const handleScoreChange = (id: string, val: string) => {
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, score: val } : s)));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Carnet de Notes — Barème Marocain /20</h2>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
        >
          {saved ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
          {saved ? 'Enregistré avec succès !' : 'Enregistrer les notes'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Élève</th>
              <th className="px-4 py-3 text-right">Note sur 20</th>
              <th className="px-4 py-3 text-center">Appréciation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {students.map((student) => {
              const numScore = parseFloat(student.score);
              let badgeColor = 'bg-slate-800 text-slate-400';
              let appreciation = 'Moyen';

              if (!isNaN(numScore)) {
                if (numScore >= 16) {
                  badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                  appreciation = 'Très Bien';
                } else if (numScore >= 14) {
                  badgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
                  appreciation = 'Bien';
                } else if (numScore >= 12) {
                  badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                  appreciation = 'Assez Bien';
                } else {
                  badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                  appreciation = 'À renforcer';
                }
              }

              return (
                <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{student.matricule}</td>
                  <td className="px-4 py-3 font-medium text-white">{student.name}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.25"
                      value={student.score}
                      onChange={(e) => handleScoreChange(student.id, e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-right font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeColor}`}>
                      {appreciation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
