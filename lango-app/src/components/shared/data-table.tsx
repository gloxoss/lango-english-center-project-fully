'use client';

import { useState, useEffect, ReactNode } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { TableSkeleton } from './table-skeleton';
import { EmptyState } from './empty-state';
import { exportToCsv } from '@/libs/csv-export';

export interface Column<T> {
  key: string;
  header: string | ReactNode;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  defaultPageSize?: number;
  selectedRowIndex?: number | null;
  selectedRowId?: string | null;
  onRowClick?: (row: T, index: number) => void;
  exportFilename?: string;
  keyExtractor?: (row: T, index: number) => string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  emptyTitle = 'Aucune donnée disponible',
  emptyDescription = 'Aucun élément ne correspond à vos critères.',
  defaultPageSize = 10,
  selectedRowIndex,
  selectedRowId,
  onRowClick,
  exportFilename,
  keyExtractor = (row, index) => row.id ?? String(index),
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Reset page to 1 whenever total data length changes or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentRows = data.slice(startIndex, endIndex);

  const handleExport = () => {
    if (exportFilename && data.length > 0) {
      exportToCsv(data, exportFilename);
    }
  };

  if (isLoading) {
    return <TableSkeleton rowCount={pageSize} columnCount={columns.length} />;
  }

  if (!isLoading && data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      {exportFilename && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-2 h-9 rounded-full px-4 text-xs font-bold border-slate-200"
          >
            <Download className="w-3.5 h-3.5" /> Exporter en CSV
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <Table>
          <TableHeader className="bg-[#F6F9FC] text-slate-500 font-semibold text-xs border-b border-slate-200/80">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 text-xs font-medium">
            {currentRows.map((row, idx) => {
              const globalIndex = startIndex + idx;
              const rowKey = keyExtractor(row, globalIndex);
              const isSelected =
                selectedRowId !== undefined
                  ? selectedRowId !== null && (selectedRowId === rowKey || selectedRowId === row.id)
                  : selectedRowIndex === globalIndex;
              return (
                <TableRow
                  key={keyExtractor(row, globalIndex)}
                  onClick={() => onRowClick && onRowClick(row, globalIndex)}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${isSelected ? 'bg-blue-50/60 font-semibold' : ''}`}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row, globalIndex)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Real Dynamic Pagination Controls */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Affichage de <strong className="font-bold text-slate-700">{totalItems > 0 ? startIndex + 1 : 0}</strong> à{' '}
              <strong className="font-bold text-slate-700">{endIndex}</strong> sur{' '}
              <strong className="font-bold text-slate-700">{totalItems}</strong> éléments
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Lignes par page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-7 text-[11px] rounded-lg border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 p-0 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - validPage) <= 1)
              .map((p, i, arr) => {
                const prev = arr[i - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <div key={p} className="flex items-center gap-1">
                    {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                    <Button
                      variant={validPage === p ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 p-0 rounded-lg text-xs font-bold ${
                        validPage === p
                          ? 'bg-[#0066FF] text-white hover:bg-[#0052CC]'
                          : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {p}
                    </Button>
                  </div>
                );
              })}

            <Button
              variant="outline"
              size="sm"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 p-0 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
