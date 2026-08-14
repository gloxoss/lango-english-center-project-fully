'use client';

import type { ColumnDefinition } from '../../types/reporting-types';
import { DataTable, Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';

export function ReportDatatable({
  columns,
  data,
}: {
  columns: ColumnDefinition[];
  data: Record<string, any>[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-2xs">
        <EmptyState
          title="Aucune donnée disponible"
          description="Ajustez vos critères de filtrage et cliquez sur 'Filtrer & Actualiser' pour générer un aperçu."
        />
      </div>
    );
  }

  const tableColumns: Column<Record<string, any>>[] = columns.map((col) => ({
    key: col.key,
    header: col.label,
    cell: (row) => (
      <span className="text-xs text-slate-800 font-medium">
        {row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '-'}
      </span>
    ),
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
      <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-700">
          Aperçu Interactif ({data.length} premières lignes)
        </span>
        <span className="text-[10px] font-bold text-[#2487B8] bg-[#E4EDFD] px-2 py-0.5 rounded-full">
          Standard Cap 50k
        </span>
      </div>

      <DataTable data={data} columns={tableColumns} />
    </div>
  );
}
