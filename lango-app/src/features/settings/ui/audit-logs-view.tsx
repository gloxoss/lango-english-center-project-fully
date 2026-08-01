'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Activity, X } from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type ApiAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = { create: 'Création', update: 'Modification', delete: 'Suppression' };

export function AuditLogsView() {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState('Tous les modules');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ pageSize: '200' });
    if (entityFilter !== 'Tous les modules') {
      params.set('entityType', entityFilter);
    }
    setError(null);
    fetch(`/api/audit-logs?${params}`)
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setLogs(json.data);
          setTodayCount(json.todayCount ?? 0);
        } else {
          setError(json.message || 'Erreur lors du chargement des journaux');
        }
      })
      .catch(err => {
        console.error('Failed loading audit logs', err);
        setError('Connexion impossible. Vérifiez votre réseau.');
      })
      .finally(() => setIsLoading(false));
  }, [entityFilter]);

  const entityTypes = Array.from(new Set(logs.map(l => l.entityType)));
  const selected = logs.find(l => l.id === selectedId) ?? null;

  const columns: Column<ApiAuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Date et heure',
      cell: (log) => <span className="font-mono text-[11px] text-slate-500">{new Date(log.createdAt).toLocaleString('fr-FR')}</span>,
    },
    {
      key: 'actor',
      header: 'Acteur',
      cell: (log) => <span className="font-bold text-[#16212B]">{log.actorName ?? log.actorId}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      cell: (log) => (
        <Badge className={
          log.action === 'delete' ? 'bg-rose-100 text-rose-800'
            : log.action === 'create' ? 'bg-emerald-100 text-emerald-800'
              : 'bg-[#FCF0DC] text-[#E8A33D]'
        }
        >
          {ACTION_LABELS[log.action] ?? log.action}
        </Badge>
      ),
    },
    {
      key: 'entityType',
      header: 'Module',
      cell: (log) => <span className="text-slate-600">{log.entityType}</span>,
    },
    {
      key: 'entityId',
      header: 'Élément',
      cell: (log) => <span className="text-slate-400 font-mono text-[11px]">{log.entityId}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Journal d&apos;audit</h1>
          <p className="text-xs text-slate-500 mt-1">Actions réelles enregistrées sur les créations, modifications et suppressions.</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => exportToCsv(logs, 'journal-audit-export')} className="gap-2 h-9 rounded-full px-4 text-xs font-bold border-slate-200">
          Exporter CSV
        </Button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Actions aujourd&apos;hui</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{todayCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-center gap-3">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[180px] rounded-full h-9 bg-white">
            <SelectValue placeholder="Tous les modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Tous les modules">Tous les modules</SelectItem>
            {entityTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        <div className="lg:col-span-2">
          <DataTable
            data={logs}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Aucune action enregistrée"
            emptyDescription="Aucun journal d'audit ne correspond à vos filtres actuels."
            defaultPageSize={10}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </div>

        <div className="space-y-4">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#16212B]">Détail de l&apos;événement</h3>
              {selected && (
                <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              )}
            </div>

            {!selected && <p className="text-slate-400">Sélectionnez une ligne pour voir le détail.</p>}

            {selected && (
              <div className="space-y-2 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Date et heure</span>
                  <span className="font-mono text-slate-700">{new Date(selected.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Acteur</span>
                  <span className="font-bold text-[#16212B]">{selected.actorName ?? selected.actorId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Action</span>
                  <span className="font-bold text-slate-800">{ACTION_LABELS[selected.action] ?? selected.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Module</span>
                  <span className="font-bold text-slate-800">{selected.entityType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">ID élément</span>
                  <span className="font-mono text-[11px] text-slate-700">{selected.entityId}</span>
                </div>
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[11px] mt-2">
                    <p className="font-sans font-bold text-slate-400 text-[10px] uppercase mb-1">Métadonnées</p>
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(selected.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
