'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Download, Bus, MapPin, Navigation, ShieldCheck } from 'lucide-react';

export default function TransportReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (type: 'vehicles' | 'stops' | 'routes') => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/transport/reports/export?type=${type}`);
      if (!res.ok) throw new Error('Erreur d\'export');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transport-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Impossible de télécharger le fichier CSV.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-[#0066FF]" />
            Rapports & Exports CSV
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Exportations conformes des données du parc, des itinéraires et des arrêts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vehicles Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 bg-blue-50 text-[#0066FF] w-fit rounded-lg">
              <Bus className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">Rapport de la Flotte</h3>
            <p className="text-xs text-slate-500">
              Export de tous les véhicules, leur capacité, leur statut et l'expiration des visites techniques et assurances.
            </p>
          </div>
          <button
            onClick={() => handleExport('vehicles')}
            disabled={downloading === 'vehicles'}
            className="w-full py-2.5 bg-[#0066FF] hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            {downloading === 'vehicles' ? 'Génération...' : 'Télécharger CSV Véhicules'}
          </button>
        </div>

        {/* Stops Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 w-fit rounded-lg">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">Répertoire des Arrêts</h3>
            <p className="text-xs text-slate-500">
              Export de l'ensemble des points de ramassage avec adresses et coordonnées GPS géolocalisées.
            </p>
          </div>
          <button
            onClick={() => handleExport('stops')}
            disabled={downloading === 'stops'}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            {downloading === 'stops' ? 'Génération...' : 'Télécharger CSV Arrêts'}
          </button>
        </div>

        {/* Routes Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 w-fit rounded-lg">
              <Navigation className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">Rapport des Circuits</h3>
            <p className="text-xs text-slate-500">
              Export des itinéraires homologués, directions de service et statuts opérationnels.
            </p>
          </div>
          <button
            onClick={() => handleExport('routes')}
            disabled={downloading === 'routes'}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            {downloading === 'routes' ? 'Génération...' : 'Télécharger CSV Circuits'}
          </button>
        </div>
      </div>
    </div>
  );
}
