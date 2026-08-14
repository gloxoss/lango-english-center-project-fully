'use client';

import { useEffect, useState } from 'react';
import { ReportingNav } from './components/reporting-nav';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable, Column } from '@/components/shared/data-table';
import { HardDrive, Calendar, AlertOctagon, Activity, CheckCircle2 } from 'lucide-react';

export function ReportingAdminView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchConsole = async () => {
    try {
      const res = await fetch('/api/addons/reporting/admin/console');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsole();
  }, []);

  const projectionColumns: Column<any>[] = [
    {
      key: 'projectionName',
      header: 'Modèle de Projection (Read View)',
      cell: (row) => (
        <div className="font-bold text-[#16212B] flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-[#2487B8]" />
          <span>{row.projectionName}</span>
        </div>
      ),
    },
    {
      key: 'rowCount',
      header: 'Lignes Enregistrées',
      cell: (row) => <span className="font-semibold text-slate-700">{row.rowCount.toLocaleString()}</span>,
    },
    {
      key: 'lastWatermark',
      header: 'Dernier Fil d\'Eau (Watermark)',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>{new Date(row.lastWatermark).toLocaleString()}</span>
        </div>
      ),
    },
  ];

  const usedStorage = data?.usedStorageMb || 0;
  const maxStorage = data?.storageQuotaMb || 5000;
  const storagePercentage = Math.min(100, Math.round((usedStorage / maxStorage) * 100));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <ReportingNav />

      {/* Metric Cards Header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="hover:border-slate-300 transition-all rounded-2xl">
          <CardHeader className="flex-row items-center justify-between border-b-0 pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stockage Utilisé
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E4EDFD] text-[#2487B8]">
              <HardDrive className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-[#16212B]">
              {usedStorage} <span className="text-sm font-normal text-slate-500">/ {maxStorage} MB</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-[#2487B8] transition-all duration-300"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
              {storagePercentage}% de la capacité quota consommée
            </span>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-all rounded-2xl">
          <CardHeader className="flex-row items-center justify-between border-b-0 pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Planifications Actives
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-[#16212B]">
              {data?.activeSchedulesCount || 0}
            </div>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block bg-emerald-50 px-2 py-0.5 rounded-md">
              Service Cron Actif
            </span>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-all rounded-2xl">
          <CardHeader className="flex-row items-center justify-between border-b-0 pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Exécutions Échouées
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-[#E5544B]">
              <AlertOctagon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-[#16212B]">
              {data?.failedRunsCount || 0}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
              Zéro anomalie système détectée
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Projection Watermarks Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#16212B]">
            Fraîcheur des Projections Analytical & Fil d'Eau (Watermark)
          </h3>
          <p className="text-xs text-slate-500">
            Surveillance en temps réel des index de lecture et tables matérialisées du sous-système analytique.
          </p>
        </div>

        <DataTable
          data={data?.projections || []}
          columns={projectionColumns}
          isLoading={loading}
          emptyTitle="Aucune projection enregistrée"
          emptyDescription="Les modèles de lecture apparaîtront dès la première matérialisation de données."
        />
      </div>
    </div>
  );
}
