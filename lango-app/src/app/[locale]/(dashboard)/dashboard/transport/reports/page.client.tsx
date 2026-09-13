'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Download, Bus, MapPin, Navigation } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function TransportReportsPage() {
  const t = useTranslations('Transport');
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (type: 'vehicles' | 'stops' | 'routes') => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/transport/reports/export?type=${type}`);
      if (!res.ok) throw new Error('Export error');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transport-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert(t('exportFailed'));
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
            {t('transportReportsTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('transportReportsSubtitle')}
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
            <h3 className="font-bold text-slate-900">{t('fleetReportTitle')}</h3>
            <p className="text-xs text-slate-500">
              {t('fleetReportDesc')}
            </p>
          </div>
          <button
            onClick={() => handleExport('vehicles')}
            disabled={downloading === 'vehicles'}
            className="w-full py-2.5 bg-[#0066FF] hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            {downloading === 'vehicles' ? t('generatingExport') : t('downloadVehiclesCsv')}
          </button>
        </div>

        {/* Stops Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 w-fit rounded-lg">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">{t('stopsReportTitle')}</h3>
            <p className="text-xs text-slate-500">
              {t('stopsReportDesc')}
            </p>
          </div>
          <button
            onClick={() => handleExport('stops')}
            disabled={downloading === 'stops'}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            {downloading === 'stops' ? t('generatingExport') : t('downloadStopsCsv')}
          </button>
        </div>

        {/* Routes Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 w-fit rounded-lg">
              <Navigation className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">{t('routesReportTitle')}</h3>
            <p className="text-xs text-slate-500">
              {t('routesReportDesc')}
            </p>
          </div>
          <button
            onClick={() => handleExport('routes')}
            disabled={downloading === 'routes'}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            {downloading === 'routes' ? t('generatingExport') : t('downloadRoutesCsv')}
          </button>
        </div>
      </div>
    </div>
  );
}
