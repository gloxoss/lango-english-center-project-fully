'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { findCsvColumn, parseCsv } from '@/libs/csv';

type ImportRow = {
  line: number;
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  employeeId: string;
  valid: boolean;
  errorMessage?: string;
};

type ImportResultRow = {
  line: number;
  status: 'inserted' | 'error';
  id?: string;
  employeeId?: string;
  message?: string;
  code?: string;
};

const HEADERS = ['Nom complet', 'Email', 'Téléphone', 'Spécialité', 'Matricule'];
const TEMPLATE_CSV = `${HEADERS.join(',')}\nYoussef El Amrani,y.elamrani@atlas.ma,0665879012,Mathématiques,\n`;

/**
 * Bulk teacher import.
 *
 * Rows go through the same server domain path as a single create (branch
 * validation, duplicate email/employee-id refusal, tenant-scoped employee id
 * reservation, activation token per phone number). The server reports each
 * failed line with its reason; partial success is explicit and duplicate
 * identities are refused, never silently created.
 */
export function TeachersBulkImportView({ locale }: { locale: string }) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ importedCount: number; errorCount: number; message: string; results: ImportResultRow[] } | null>(null);

  function handleDownloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_enseignants.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setError(t('noDataRowsFound'));
        setRows([]);
        return;
      }
      const [header, ...dataRows] = parsed as [string[], ...string[][]];
      const nameCol = findCsvColumn(header, ['nom complet', 'nom', 'fullname', 'full name', 'الاسم الكامل']);
      const emailCol = findCsvColumn(header, ['email', 'e-mail', 'البريد']);
      const phoneCol = findCsvColumn(header, ['téléphone', 'telephone', 'phone', 'الهاتف']);
      const specCol = findCsvColumn(header, ['spécialité', 'specialite', 'specialization', 'speciality', 'التخصص']);
      const employeeIdCol = findCsvColumn(header, ['matricule', 'employee id', 'employeeid', 'identifiant']);

      if (nameCol === -1) {
        setError(t('missingFullNameCol'));
        setRows([]);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
      const parsedRows: ImportRow[] = dataRows.map((cols, idx) => {
        const fullName = (cols[nameCol] ?? '').trim();
        const email = emailCol !== -1 ? (cols[emailCol] ?? '').trim() : '';
        let errorMessage: string | undefined;
        if (!fullName) {
          errorMessage = t('fullNameMissing');
        } else if (email && !emailRegex.test(email)) {
          errorMessage = t('invalidEmail');
        }
        return {
          line: idx + 2,
          fullName,
          email,
          phone: phoneCol !== -1 ? (cols[phoneCol] ?? '').trim() : '',
          specialization: specCol !== -1 ? (cols[specCol] ?? '').trim() : '',
          employeeId: employeeIdCol !== -1 ? (cols[employeeIdCol] ?? '').trim() : '',
          valid: !errorMessage,
          errorMessage,
        };
      });
      setRows(parsedRows);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleConfirmImport() {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) {
      setError(t('noValidRowsToImport'));
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/teachers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map(r => ({
            fullName: r.fullName,
            ...(r.email ? { email: r.email } : {}),
            ...(r.phone ? { phone: r.phone } : {}),
            ...(r.specialization ? { specialization: r.specialization } : {}),
            ...(r.employeeId ? { employeeId: r.employeeId } : {}),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json?.error?.message || json?.message || t('importFailed'));
        return;
      }
      setResult({
        importedCount: json.importedCount,
        errorCount: json.errorCount,
        message: json.message,
        results: json.results ?? [],
      });
      setRows([]);
      setFileName(null);
    } catch (err) {
      console.error('Teacher import failed', err);
      setError(t('networkError'));
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.length - validCount;
  const failedRows = result?.results.filter(r => r.status === 'error') ?? [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('bulkImportTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('bulkImportDesc')}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="
            flex items-center gap-2.5 rounded-xl border border-rose-200
            bg-rose-50 p-3.5 text-xs font-semibold text-rose-700
          "
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="
          rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs
          font-semibold text-emerald-700
        "
        >
          <p className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0" />
            {' '}
            <span>{result.message}</span>
          </p>
          {failedRows.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 ps-6 text-rose-700">
              {failedRows.map(row => (
                <li key={row.line}>
                  {t('importLine', { line: row.line })}
                  {' '}
                  :
                  {' '}
                  {row.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs
      "
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          className="
            cursor-pointer space-y-2 rounded-xl border-2 border-dashed
            border-slate-200 bg-slate-50/50 p-8 text-center transition-colors
            hover:bg-slate-50
          "
        >
          <Upload className="mx-auto size-8 text-[#2487B8]" />
          <p className="text-xs font-bold text-slate-700">{fileName ?? t('clickToSelectCsv')}</p>
          <p className="text-[10px] text-slate-400">{t('expectedColumns', { cols: HEADERS.join(', ') })}</p>
          <p className="text-[10px] text-slate-400">{t('importBranchHint')}</p>
        </div>
      </Card>

      {rows.length > 0 && (
        <>
          <Card className="
            rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs
          "
          >
            <div className="
              grid grid-cols-1 items-center gap-4
              sm:grid-cols-3
            "
            >
              <div className="
                flex items-center gap-3 rounded-xl border border-slate-100
                bg-slate-50 p-3
              "
              >
                <div className="
                  flex size-10 items-center justify-center rounded-xl
                  bg-emerald-100 text-emerald-700
                "
                >
                  <FileSpreadsheet className="size-5" />
                </div>
                <p className="text-xs font-bold text-[#16212B]">{fileName}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-extrabold text-[#2487B8]">{validCount}</p>
                <p className="text-[10px] text-slate-400">{t('validRowsCount')}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-extrabold text-[#E5544B]">{errorCount}</p>
                <p className="text-[10px] text-slate-400">{t('errorRowsCount')}</p>
              </div>
            </div>
          </Card>

          <Card className="
            overflow-hidden rounded-2xl border border-slate-200/80 bg-white
            shadow-2xs
          "
          >
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="
                  border-b border-slate-200/80 bg-[#F6F9FC] font-semibold
                  text-slate-500
                "
                >
                  <tr>
                    <th className="px-4 py-3 text-start">{t('rowLine')}</th>
                    <th className="px-4 py-3 text-start">{tCommon('status')}</th>
                    <th className="px-4 py-3 text-start">{t('fullNameRequired')}</th>
                    <th className="px-4 py-3 text-start">{t('specialty')}</th>
                    <th className="px-4 py-3 text-start">{t('employeeIdLabel')}</th>
                    <th className="px-4 py-3 text-start">{t('phone')}</th>
                    <th className="px-4 py-3 text-start">{t('email')}</th>
                    <th className="px-4 py-3 text-start">{t('error')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr
                      key={row.line}
                      className={row.valid
                        ? `hover:bg-slate-50/80`
                        : `
                          bg-rose-50/50
                          hover:bg-rose-50
                        `}
                    >
                      <td className="px-4 py-3 font-mono text-slate-400">{row.line}</td>
                      <td className="px-4 py-3">
                        {row.valid
                          ? (
                              <span className="
                                inline-flex items-center gap-1 text-xs font-bold
                                text-[#2487B8]
                              "
                              >
                                <CheckCircle2 className="size-3.5" />
                                {' '}
                                {t('valid')}
                              </span>
                            )
                          : (
                              <span className="
                                inline-flex items-center gap-1 text-xs font-bold
                                text-[#E5544B]
                              "
                              >
                                <AlertTriangle className="size-3.5" />
                                {' '}
                                {t('error')}
                              </span>
                            )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#16212B]">{row.fullName || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.specialization || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{row.employeeId || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{row.phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{row.email || '—'}</td>
                      <td className="px-4 py-3">
                        {row.errorMessage
                          ? (
                              <span className="
                                text-[11px] font-bold text-[#E5544B]
                              "
                              >
                                {row.errorMessage}
                              </span>
                            )
                          : (
                              <span className="text-slate-300">
                                —
                              </span>
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="
        flex items-center justify-between rounded-2xl border border-slate-200/80
        bg-white p-4 shadow-2xs
      "
      >
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-2 rounded-xl text-xs"
          onClick={handleDownloadTemplate}
        >
          <Download className="size-4" />
          <span>{t('downloadTemplate')}</span>
        </Button>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-10 rounded-xl px-4 text-xs">
            <Link href={`/${locale}/dashboard/teachers/manage`}>
              {tCommon('back')}
            </Link>
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-10 rounded-xl px-5 text-xs"
            disabled={importing || validCount === 0}
            onClick={handleConfirmImport}
          >
            {importing ? t('importingAction') : t('confirmImportCount', { count: validCount })}
          </Button>
        </div>
      </div>
    </div>
  );
}
