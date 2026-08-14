'use client';

import React, { useEffect, useState } from 'react';
import { Bus, MapPin, Navigation, Users, AlertTriangle, RefreshCw, FileSpreadsheet, ShieldAlert, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface TransportOverviewData {
  totalVehicles: number;
  totalRoutes: number;
  activeAllocations: number;
  todayTrips: number;
  openIncidents: number;
}

export function TransportOverviewView() {
  const [data, setData] = useState<TransportOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/transport/reports/overview');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Erreur lors du chargement des statistiques');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bus className="w-7 h-7 text-[#0066FF]" />
            Transport Scolaire & Flotte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tableau de bord exécutif, suivi du réseau de transport, véhicules et sécurité des élèves.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <Link
            href="/dashboard/transport/trips"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
          >
            <Clock className="w-4 h-4" />
            Dispatch du Jour
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Véhicules</span>
            <div className="p-2 bg-blue-50 text-[#0066FF] rounded-lg">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.totalVehicles ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Flotte active & maintenance</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Itinéraires</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Navigation className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.totalRoutes ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Lignes homologuées</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Élèves Inscrits</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.activeAllocations ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Abonnements actifs</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trajets d'aujourd'hui</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.todayTrips ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Missions programmées</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Incidents Ouverts</span>
            <div className={`p-2 rounded-lg ${data?.openIncidents ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.openIncidents ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Attention requise</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/transport/routes"
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 text-[#0066FF] rounded-lg group-hover:bg-[#0066FF] group-hover:text-white transition">
              <Navigation className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-[#0066FF] transition">Itinéraires & Arrêts</h2>
          <p className="text-xs text-slate-500 mt-1">Gérer les circuits de ramassage, les arrêts, la séquence et la géolocalisation.</p>
        </Link>

        <Link
          href="/dashboard/transport/allocations"
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
              <Users className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-emerald-600 transition">Affectations Élèves</h2>
          <p className="text-xs text-slate-500 mt-1">Assigner les élèves aux bus, calculer la capacité par segment et gérer les tarifs.</p>
        </Link>

        <Link
          href="/dashboard/transport/boarding"
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition">
              <CheckCircle className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-indigo-600 transition">Pointage & Scans QR</h2>
          <p className="text-xs text-slate-500 mt-1">Validation de la montée et de la descente avec vérification de séquence et badge QR.</p>
        </Link>
      </div>
    </div>
  );
}
