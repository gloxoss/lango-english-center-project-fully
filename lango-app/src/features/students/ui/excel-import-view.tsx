'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { findCsvColumn, parseCsv } from '@/libs/csv';

type ImportRow = {
  line: number;
  fullName: string;
  email: string;
  phone: string;
  classLabel: string;
  guardianName: string;
  guardianPhone: string;
  valid: boolean;
  errorMessage?: string;
};

const HEADERS = ['Nom complet', 'Email', 'Téléphone', 'Classe', 'Tuteur', 'Téléphone tuteur'];
const TEMPLATE_CSV = `${HEADERS.join(',')}\nYassine El Amrani,yassine.elamrani@email.com,0612345678,2nde A,M. El Amrani,0687654321\n`;

export function ExcelImportView({ locale }: { locale: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ insertedCount: number; errorCount: number; message: string } | null>(null);

  function handleDownloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_eleves.csv';
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
        setError('Le fichier ne contient aucune ligne de données.');
        setRows([]);
        return;
      }
      const [header, ...dataRows] = parsed as [string[], ...string[][]];
      const nameCol = findCsvColumn(header, ['nom complet', 'nom', 'fullname']);
      const emailCol = findCsvColumn(header, ['email', 'e-mail']);
      const phoneCol = findCsvColumn(header, ['téléphone', 'telephone', 'phone']);
      const classCol = findCsvColumn(header, ['classe', 'class']);
      const guardianCol = findCsvColumn(header, ['tuteur', 'parent', 'guardian']);
      const guardianPhoneCol = findCsvColumn(header, ['téléphone tuteur', 'telephone tuteur', 'guardian phone']);

      if (nameCol === -1) {
        setError('Colonne "Nom complet" introuvable. Utilisez le modèle fourni.');
        setRows([]);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const parsedRows: ImportRow[] = dataRows.map((cols, idx) => {
        const fullName = (cols[nameCol] ?? '').trim();
        const email = emailCol !== -1 ? (cols[emailCol] ?? '').trim() : '';
        let errorMessage: string | undefined;
        if (!fullName) {
          errorMessage = 'Nom complet manquant';
        } else if (email && !emailRegex.test(email)) {
          errorMessage = 'Email invalide';
        }
        return {
          line: idx + 2,
          fullName,
          email,
          phone: phoneCol !== -1 ? (cols[phoneCol] ?? '').trim() : '',
          classLabel: classCol !== -1 ? (cols[classCol] ?? '').trim() : '',
          guardianName: guardianCol !== -1 ? (cols[guardianCol] ?? '').trim() : '',
          guardianPhone: guardianPhoneCol !== -1 ? (cols[guardianPhoneCol] ?? '').trim() : '',
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
      setError('Aucune ligne valide à importer.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map(r => ({
            fullName: r.fullName,
            ...(r.email ? { email: r.email } : {}),
            ...(r.phone ? { phone: r.phone } : {}),
            ...(r.classLabel ? { classLabel: r.classLabel } : {}),
            ...(r.guardianName ? { guardianName: r.guardianName } : {}),
            ...(r.guardianPhone ? { guardianPhone: r.guardianPhone } : {}),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de l\'import.');
        return;
      }
      setResult({ insertedCount: json.insertedCount, errorCount: json.errorCount, message: json.message });
      setRows([]);
      setFileName(null);
    } catch (err) {
      console.error('Import failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.length - validCount;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Import CSV</h1>
        <p className="text-xs text-slate-500 mt-1">Importez vos données élèves à partir d&apos;un fichier CSV.</p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{result.message}</span>
        </div>
      )}

      {/* Upload */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Upload className="w-8 h-8 mx-auto text-[#2487B8]" />
          <p className="font-bold text-slate-700 text-xs">{fileName ?? 'Cliquez pour sélectionner un fichier CSV'}</p>
          <p className="text-[10px] text-slate-400">Colonnes attendues : {HEADERS.join(', ')}</p>
        </div>
      </Card>

      {/* Preview table */}
      {rows.length > 0 && (
        <>
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <p className="font-bold text-xs text-[#16212B]">{fileName}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-extrabold text-[#2487B8]">{validCount}</p>
                <p className="text-[10px] text-slate-400">Lignes valides</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-extrabold text-[#E5544B]">{errorCount}</p>
                <p className="text-[10px] text-slate-400">Lignes avec erreurs</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Ligne</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Nom complet</th>
                    <th className="py-3 px-4">Classe</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.line} className={row.valid ? 'hover:bg-slate-50/80' : 'bg-rose-50/50 hover:bg-rose-50'}>
                      <td className="py-3 px-4 font-mono text-slate-400">{row.line}</td>
                      <td className="py-3 px-4">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2487B8]"><CheckCircle2 className="w-3.5 h-3.5" /> Valide</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E5544B]"><AlertTriangle className="w-3.5 h-3.5" /> Erreur</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#16212B]">{row.fullName || '—'}</td>
                      <td className="py-3 px-4 text-slate-700">{row.classLabel || '—'}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{row.phone || '—'}</td>
                      <td className="py-3 px-4 text-slate-500">{row.email || '—'}</td>
                      <td className="py-3 px-4">{row.errorMessage ? <span className="font-bold text-[#E5544B] text-[11px]">{row.errorMessage}</span> : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Footer Actions Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-2 text-xs rounded-xl h-10" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" />
          <span>Télécharger le modèle</span>
        </Button>

        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard/students`}>
            <Button variant="outline" size="sm" className="text-xs rounded-xl h-10 px-4">
              Retour
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            className="text-xs rounded-xl h-10 px-5"
            disabled={importing || validCount === 0}
            onClick={handleConfirmImport}
          >
            {importing ? 'Import en cours...' : `Confirmer l'import (${validCount})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
