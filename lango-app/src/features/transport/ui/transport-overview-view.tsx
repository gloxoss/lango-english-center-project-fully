'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bus, Navigation, Users, AlertTriangle, RefreshCw, ShieldAlert, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface TransportOverviewData {
  totalVehicles: number;
  totalRoutes: number;
  activeAllocations: number;
  todayTrips: number;
  openIncidents: number;
}

export function TransportOverviewView() {
  const tTransport = useTranslations('Transport');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

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
        setError(result.error?.message || tTransport('errorLoad'));
      }
    } catch {
      setError(tTransport('errorConnect'));
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
            {tTransport('title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tTransport('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            disabled={loading}
            aria-label={tCommon('refresh')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </button>
          <Link
            href={`/${locale}/dashboard/transport/trips`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
          >
            <Clock className="w-4 h-4" />
            {tTransport('todayDispatch')}
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
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tTransport('vehicles')}</span>
            <div className="p-2 bg-blue-50 text-[#0066FF] rounded-lg">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.totalVehicles ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">{tTransport('vehiclesSub')}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tTransport('routes')}</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Navigation className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.totalRoutes ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">{tTransport('routesSub')}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tTransport('enrolledStudents')}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.activeAllocations ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">{tTransport('enrolledStudentsSub')}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tTransport('todayTrips')}</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.todayTrips ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">{tTransport('todayTripsSub')}</p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tTransport('openIncidents')}</span>
            <div className={`p-2 rounded-lg ${data?.openIncidents ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{loading ? '...' : data?.openIncidents ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">{tTransport('openIncidentsSub')}</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href={`/${locale}/dashboard/transport/routes`}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 text-[#0066FF] rounded-lg group-hover:bg-[#0066FF] group-hover:text-white transition">
              <Navigation className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-[#0066FF] transition">{tTransport('routesAndStops')}</h2>
          <p className="text-xs text-slate-500 mt-1">{tTransport('routesAndStopsDesc')}</p>
        </Link>

        <Link
          href={`/${locale}/dashboard/transport/allocations`}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
              <Users className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-emerald-600 transition">{tTransport('studentAllocations')}</h2>
          <p className="text-xs text-slate-500 mt-1">{tTransport('studentAllocationsDesc')}</p>
        </Link>

        <Link
          href={`/${locale}/dashboard/transport/boarding`}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition">
              <CheckCircle className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-indigo-600 transition">{tTransport('boardingAndScans')}</h2>
          <p className="text-xs text-slate-500 mt-1">{tTransport('boardingAndScansDesc')}</p>
        </Link>
      </div>
    </div>
  );
}
