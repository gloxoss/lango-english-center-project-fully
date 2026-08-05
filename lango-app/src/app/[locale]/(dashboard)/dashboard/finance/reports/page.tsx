'use client';

import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
} from 'lucide-react';
import React, { useState } from 'react';

export default function ReportsPage() {
  const [period, setPeriod] = useState('2026-08');

  const handleExport = (reportName: string) => {
    alert(`Rapport "${reportName}" généré pour la période ${period}. Téléchargement prêt.`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Rapports & Exports Comptables
          </h1>
          <p className="text-sm text-slate-500">
            Génération des états financiers, grand livre, journal des encaissements et exports FEC.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Période:</label>
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          />
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066FF]">
              <FileSpreadsheet className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">Journal des Encaissements</h3>
            <p className="mt-1 text-xs text-slate-500">
              Détail chronologique de tous les règlements scolarité (espèces, virement, chèque, TPE).
            </p>
          </div>
          <button
            onClick={() => handleExport('Journal des Encaissements')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Download className="size-3.5" />
            Télécharger CSV / Excel
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">Bilan des Dépenses D'Exploitation</h3>
            <p className="mt-1 text-xs text-slate-500">
              Répartition par catégorie des frais généraux, loyers, salaires et petite caisse.
            </p>
          </div>
          <button
            onClick={() => handleExport('Bilan des Dépenses')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Download className="size-3.5" />
            Télécharger PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">État de l'Ancienneté des Créances</h3>
            <p className="mt-1 text-xs text-slate-500">
              Balance âgée globale des reste-à-payer avec découpage par tranche d'impayé.
            </p>
          </div>
          <button
            onClick={() => handleExport('Ancienneté des Créances')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Download className="size-3.5" />
            Télécharger Excel
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FileText className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">Grand Livre & Balance Générale</h3>
            <p className="mt-1 text-xs text-slate-500">
              Extrait du plan comptable et balance générale des comptes d'imputation.
            </p>
          </div>
          <button
            onClick={() => handleExport('Grand Livre')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Download className="size-3.5" />
            Générer Grand Livre
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <FileSpreadsheet className="size-5" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">Export FEC (Fichier des Écritures Comptables)</h3>
            <p className="mt-1 text-xs text-slate-500">
              Export réglementaire aux normes pour intégration dans Sage / QuickBooks / Odoo.
            </p>
          </div>
          <button
            onClick={() => handleExport('Fichier FEC')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-xs font-bold text-white hover:bg-[#0052CC]"
          >
            <Download className="size-3.5" />
            Exporter Format FEC
          </button>
        </div>
      </div>
    </div>
  );
}
