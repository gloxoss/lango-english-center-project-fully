'use client';

import React, { useState } from 'react';
import { Sliders, ShieldCheck, CheckCircle, Bell, AlertTriangle } from 'lucide-react';

export default function TransportPoliciesPage() {
  const [saved, setSaved] = useState(false);
  const [policyData, setPolicyData] = useState({
    enforceSequenceCheck: true,
    allowCapacityOverbook: false,
    maxCapacityPercentage: 100,
    emergencyHotline: '+212 5 37 00 00 00',
    notifyGuardianOnBoarding: true,
    notifyGuardianOnDropoff: true,
    notifyGuardianOnDelay: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-7 h-7 text-[#0066FF]" />
            Règles & Politiques de Transport
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configuration des contrôles de sécurité, notifications d'embarquement et limites de capacité.
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Politiques enregistrées avec succès.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 text-base">
            <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
            Contrôle & Sécurité des Trajets
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="font-semibold text-slate-800 text-sm block">Vérification Stricte de la Séquence des Arrêts</span>
              <span className="text-xs text-slate-500">Refuser le pointage si l'élève est déposé avant son arrêt configuré.</span>
            </div>
            <input
              type="checkbox"
              checked={policyData.enforceSequenceCheck}
              onChange={e => setPolicyData({ ...policyData, enforceSequenceCheck: e.target.checked })}
              className="w-4 h-4 text-[#0066FF] rounded border-slate-300 focus:ring-[#0066FF]"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div>
              <span className="font-semibold text-slate-800 text-sm block">Autoriser la Surcapacité des Véhicules</span>
              <span className="text-xs text-slate-500">Permettre le surbooking temporaire des places assises (déconseillé).</span>
            </div>
            <input
              type="checkbox"
              checked={policyData.allowCapacityOverbook}
              onChange={e => setPolicyData({ ...policyData, allowCapacityOverbook: e.target.checked })}
              className="w-4 h-4 text-[#0066FF] rounded border-slate-300 focus:ring-[#0066FF]"
            />
          </div>

          <div className="py-2 border-t">
            <label className="font-semibold text-slate-800 text-sm block mb-1">Seuil Maximal de Remplissage Bus (%)</label>
            <input
              type="number"
              min={50}
              max={120}
              value={policyData.maxCapacityPercentage}
              onChange={e => setPolicyData({ ...policyData, maxCapacityPercentage: Number(e.target.value) })}
              className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 text-base">
            <Bell className="w-5 h-5 text-[#0066FF]" />
            Notifications tuteurs & Parents
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="font-semibold text-slate-800 text-sm block">Notification Instantanée à la Montée</span>
              <span className="text-xs text-slate-500">Envoyer un SMS/Push aux parents dès le scan du badge au départ.</span>
            </div>
            <input
              type="checkbox"
              checked={policyData.notifyGuardianOnBoarding}
              onChange={e => setPolicyData({ ...policyData, notifyGuardianOnBoarding: e.target.checked })}
              className="w-4 h-4 text-[#0066FF] rounded border-slate-300 focus:ring-[#0066FF]"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div>
              <span className="font-semibold text-slate-800 text-sm block">Notification Instantanée à la Dépose</span>
              <span className="text-xs text-slate-500">Avertir le tuteur lors du débarquement sécurisé à l'arrêt.</span>
            </div>
            <input
              type="checkbox"
              checked={policyData.notifyGuardianOnDropoff}
              onChange={e => setPolicyData({ ...policyData, notifyGuardianOnDropoff: e.target.checked })}
              className="w-4 h-4 text-[#0066FF] rounded border-slate-300 focus:ring-[#0066FF]"
            />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#0066FF] hover:bg-blue-600 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            Enregistrer les Modificateurs
          </button>
        </div>
      </form>
    </div>
  );
}
