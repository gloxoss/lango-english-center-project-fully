'use client';

import { useState } from 'react';
import type { ReportCatalogItem } from '../types/reporting-types';
import { ReportingNav } from './components/reporting-nav';
import { ParameterForm } from './components/parameter-form';
import { ReportChart } from './components/report-chart';
import { ReportDatatable } from './components/report-datatable';
import { SaveViewModal } from './components/save-view-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, CheckCircle2, Clock } from 'lucide-react';

export function ReportWorkspaceView({ report }: { report: ReportCatalogItem }) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [currentParameters, setCurrentParameters] = useState<Record<string, any>>({});

  const handleFilter = async (params: Record<string, any>) => {
    setCurrentParameters(params);
    setLoading(true);
    try {
      const res = await fetch(`/api/addons/reporting/reports/${report.key}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: params }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const res = await fetch(`/api/addons/reporting/reports/${report.key}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      const json = await res.json();
      if (json.success) {
        setExportMessage(
          `Exportation ${format.toUpperCase()} initialisée en arrière-plan (Run ID: ${json.runId.slice(0, 8)}...). Consultez l'onglet "Mes Exécutions" pour la télécharger.`
        );
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <ReportingNav currentKey={report.key} />

      {/* Header Workspace Title & Actions */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="info" className="font-bold">
              {report.domain}
            </Badge>
            <span className="text-xs text-slate-400 font-semibold">
              Key: <code className="font-mono text-slate-600">{report.key}</code>
            </span>
          </div>
          <h1 className="mt-1.5 text-xl font-extrabold text-[#16212B]">{report.title}</h1>
          <p className="text-xs text-slate-500 font-medium">{report.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SaveViewModal reportKey={report.key} currentParameters={currentParameters} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('csv')}
            className="gap-1.5 font-bold border-slate-200 rounded-xl"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#2487B8]" />
            <span>Export CSV</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('xlsx')}
            className="gap-1.5 font-bold border-slate-200 rounded-xl"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => handleExport('pdf')}
            className="gap-1.5 font-bold shadow-2xs rounded-xl"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      {/* Success Export Banner */}
      {exportMessage && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Parameter Form Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <ParameterForm parameters={report.parametersSchema} onSubmit={handleFilter} />
      </div>

      {/* Visualizations & Data Tables */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin text-[#2487B8]" />
          <span>Compilations des données en cours...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportChart columns={report.columnsSchema} data={data} />
          <ReportDatatable columns={report.columnsSchema} data={data} />
        </div>
      )}
    </div>
  );
}
