'use client';

import { UserPlus, CheckCircle2, Phone, Mail } from 'lucide-react';
import React, { useState } from 'react';

export function WalkInInquiryModal() {
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [interestLevel, setInterestLevel] = useState('high');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('processing');
    setTimeout(() => {
      setStatus('success');
    }, 800);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Accueil / Réception — Saisie Rapide Prospect</h2>
            <p className="text-xs text-slate-400">Enregistrement des demandes de renseignements et visiteurs sur place</p>
          </div>
        </div>
      </div>

      {status === 'success' ? (
        <div className="p-6 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-indigo-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Prospect Enregistré avec Succès !</h3>
          <p className="text-xs text-slate-300">Fiche prospect ajoutée au pipeline d admission.</p>
          <button
            type="button"
            onClick={() => {
              setParentName('');
              setPhone('');
              setStudentName('');
              setStatus('idle');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Saisir un Autre Prospect
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nom du Tuteur / Parent</label>
              <input
                type="text"
                required
                placeholder="Ex: Mme. Amina Benjelloun"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Téléphone Mobile</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  placeholder="06 61 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nom de l Élève / Enfant</label>
              <input
                type="text"
                required
                placeholder="Ex: Mehdi Benjelloun"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Niveau d Intérêt</label>
              <select
                value={interestLevel}
                onChange={(e) => setInterestLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="high">Élevé (Prêt à s inscrire)</option>
                <option value="medium">Moyen (Demande d information)</option>
                <option value="low">Faible</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'processing'}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            {status === 'processing' ? 'Enregistrement...' : 'Enregistrer la Demande de Renseignements'}
          </button>
        </form>
      )}
    </div>
  );
}
