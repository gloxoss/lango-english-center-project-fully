import React from 'react';
import { WalkInInquiryModal } from '@/components/receptionist/WalkInInquiryModal';

export default function ReceptionistPortalPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-cyan-900/30 to-slate-900 p-6 rounded-2xl border border-blue-500/20 shadow-xl">
        <div>
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Espace Réception / Accueil</span>
          <h1 className="text-2xl font-bold text-white mt-1">Accueil des Visiteurs & Demandes d Information</h1>
          <p className="text-slate-400 text-sm mt-1">Saisie rapide des demandes de renseignements et orientation des tuteurs.</p>
        </div>
      </div>

      <WalkInInquiryModal />
    </div>
  );
}
