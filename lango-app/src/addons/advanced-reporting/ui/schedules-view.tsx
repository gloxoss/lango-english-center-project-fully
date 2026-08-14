'use client';

import { useEffect, useState } from 'react';
import { ReportingNav } from './components/reporting-nav';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Clock, FileSpreadsheet } from 'lucide-react';

export function SchedulesView() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/addons/reporting/schedules');
      const json = await res.json();
      if (json.success) {
        setSchedules(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Nom de la Planification',
      cell: (row) => (
        <div className="font-bold text-[#16212B]">
          {row.name}
          <div className="text-[10px] font-mono text-slate-400">Key: {row.reportKey}</div>
        </div>
      ),
    },
    {
      key: 'cronExpression',
      header: 'Expression Cron',
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg w-fit border border-slate-200/60">
          <Clock className="h-3 w-3 text-slate-500" />
          {row.cronExpression}
        </div>
      ),
    },
    {
      key: 'format',
      header: 'Format Export',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5 text-[#2487B8]" />
          <span className="font-bold text-xs uppercase text-slate-700">{row.format}</span>
        </div>
      ),
    },
    {
      key: 'nextRunAt',
      header: 'Prochaine Exécution',
      cell: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : 'Sur demande'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'État Récurrence',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} className="font-bold">
          {row.isActive ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <ReportingNav />

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#16212B]">
            Planifications & Livraisons Automatiques
          </h2>
          <p className="text-xs text-slate-500">
            Gérez les récurrences automatisées (toutes les nuits, hebdomadaires ou mensuelles) pour la génération de vos bilans comptables et académiques.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
        <DataTable
          data={schedules}
          columns={columns}
          isLoading={loading}
          emptyTitle="Aucune planification configurée"
          emptyDescription="Les planifications automatiques seront listées ici une fois programmées par un administrateur."
        />
      </div>
    </div>
  );
}
