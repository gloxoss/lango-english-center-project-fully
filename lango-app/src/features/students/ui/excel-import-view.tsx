'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

type ParsedRow = {
  fullName: string;
  email?: string;
  phone?: string;
  classLabel?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
};
type ImportResult = { line: number; status: 'inserted' | 'error'; message?: string; id?: string };

const TEMPLATE_HEADERS = ['fullName', 'email', 'phone', 'classLabel', 'dateOfBirth', 'guardianName', 'guardianPhone'];

// ponytail: the "Création manuelle" tab this page used to have was a second,
// fully fake duplicate of the real admission wizard (/students/add) already
// built - dropped in favor of linking to it, not maintaining two
// implementations of the same job. POST /api/students/import + its
// studentImportSchema are real (built by the other session working this
// repo in parallel) - wired to that exact shape rather than a fresh one.
function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0]!.split(',').map(h => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map(c => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return {
      fullName: row.fullName ?? '',
      email: row.email || undefined,
      phone: row.phone || undefined,
      classLabel: row.classLabel || undefined,
      dateOfBirth: row.dateOfBirth || undefined,
      guardianName: row.guardianName || undefined,
      guardianPhone: row.guardianPhone || undefined,
    };
  }).filter(r => r.fullName);
}

export function ExcelImportView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADERS.join(','), 'Yassine El Amrani,yassine@example.com,+212600000000,2nde A'].join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-import-eleves.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResults(null);
    setError(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setError(t('noValidRowsFound'));
    }
    setRows(parsed);
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || t('importFailedGeneric'));
        return;
      }
      setResults(json.results);
    } catch {
      setError(t('connectionError'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('bulkImportTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('bulkImportSubtitle')}{' '}
            <Link href={`/${_locale || 'fr'}/dashboard/students/add`} className="text-[#2487B8] font-bold hover:underline">{t('admissionFormLink')}</Link>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
          <Download className="w-4 h-4 text-slate-600" />
          <span>{t('downloadTemplate')}</span>
        </Button>
      </div>

      <Card className="p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-2xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center mx-auto">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-[#16212B]">{fileName ?? t('selectCsvFile')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('expectedColumns')}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
        />
        <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm" className="h-9 rounded-xl px-4 text-xs font-bold border-slate-200 text-[#2487B8]">
          {t('browseFiles')}
        </Button>
      </Card>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {rows.length > 0 && !results && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-[#16212B]">{t('importRowsReady', { count: rows.length })}</p>
            <Button size="sm" disabled={importing} onClick={handleImport} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {importing ? t('importInProgress') : t('importNow')}
            </Button>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-4">{t('studentNameCol')}</th>
                <th className="py-2.5 px-4">{t('email')}</th>
                <th className="py-2.5 px-4">{t('phone')}</th>
                <th className="py-2.5 px-4">{t('classCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-2 px-4 font-bold text-[#16212B]">{r.fullName}</td>
                  <td className="py-2 px-4 text-slate-500">{r.email ?? '—'}</td>
                  <td className="py-2 px-4 text-slate-500">{r.phone ?? '—'}</td>
                  <td className="py-2 px-4 text-slate-500">{r.classLabel ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {results && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-bold text-[#16212B]">
              {t('importedStudentsCount', { count: results.filter(r => r.status === 'inserted').length, total: results.length })}
            </p>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-4">{t('rowLineCol')}</th>
                <th className="py-2.5 px-4">{t('studentNameCol')}</th>
                <th className="py-2.5 px-4">{tCommon('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.line}>
                  <td className="py-2 px-4 text-slate-500">{r.line}</td>
                  <td className="py-2 px-4 font-bold text-[#16212B]">{rows[r.line - 1]?.fullName ?? '—'}</td>
                  <td className="py-2 px-4">
                    {r.status === 'inserted' && <span className="flex items-center gap-1 text-[#17A673] font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> {t('importedStatus')}</span>}
                    {r.status === 'error' && <span className="text-rose-600 font-bold">{t('importFailed', { message: r.message ?? '' })}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
