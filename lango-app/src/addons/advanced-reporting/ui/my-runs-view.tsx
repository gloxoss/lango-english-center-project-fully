'use client';

import { useEffect, useState } from 'react';
import { ReportingNav } from './components/reporting-nav';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export function MyRunsView() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/addons/reporting/runs');
      const json = await res.json();
      if (json.success) {
        setRuns(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  const columns: Column<any>[] = [
    {
      key: 'reportKey',
      header: 'Rapport Executé',
      cell: (row) => (
        <div className="font-bold text-[#16212B]">
          {row.reportKey}
          <div className="text-[10px] font-normal text-slate-500">ID: {row.id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut Exécution',
      cell: (row) => {
        if (row.status === 'completed') {
          return (
            <Badge variant="success" className="gap-1 font-bold">
              <CheckCircle2 className="h-3 w-3 text-[#2487B8]" />
              Terminé
            </Badge>
          );
        }
        if (row.status === 'failed') {
          return (
            <Badge variant="danger" className="gap-1 font-bold">
              <AlertTriangle className="h-3 w-3 text-[#E5544B]" />
              Échoué
            </Badge>
          );
        }
        return (
          <Badge variant="warning" className="gap-1 font-bold">
            <Clock className="h-3 w-3 animate-spin text-amber-600" />
            En cours
          </Badge>
        );
      },
    },
    {
      key: 'rowCount',
      header: 'Lignes Produites',
      cell: (row) => <span className="font-semibold text-slate-700">{row.rowCount.toLocaleString()}</span>,
    },
    {
      key: 'executionTimeMs',
      header: 'Temps Exécution',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.executionTimeMs ? `${row.executionTimeMs} ms` : '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Horodatage',
      cell: (row) => (
        <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => {
        if (row.status === 'completed') {
          return (
            <Button asChild size="sm" variant="outline" className="gap-1.5 font-bold border-slate-300 rounded-xl">
              <a href={`/api/addons/reporting/runs/${row.id}/download`}>
                <Download className="h-3.5 w-3.5 text-[#2487B8]" />
                <span>Télécharger</span>
              </a>
            </Button>
          );
        }
        return <span className="text-xs text-slate-400 font-medium">Traitement en cours...</span>;
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <ReportingNav />

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#16212B]">
            Historique des Exécutions en Arrière-Plan
          </h2>
          <p className="text-xs text-slate-500">
            Chaque rapport volumineux est compilé en tâche de fond et archivé sous signature cryptographique HMAC SHA-256.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchRuns}
          className="gap-2 font-bold border-slate-200 rounded-xl"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
        <DataTable
          data={runs}
          columns={columns}
          isLoading={loading}
          emptyTitle="Aucune exécution enregistrée"
          emptyDescription="Déclenchez une exportation depuis le Centre de Rapports pour afficher les résultats ici."
        />
      </div>
    </div>
  );
}
