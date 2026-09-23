'use client';

import type { MarkRow, MarkStatus, NavigationKey } from '../services/marksheet-grid';
import { AlertCircle, CheckCircle2, Download, Keyboard, Loader2, Save, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  buildSavePayload,
  mentionFor,
  nextRowIndex,
  parseMarkInput,
  summarize,
} from '../services/marksheet-grid';

type MarksheetStudent = {
  studentId: string;
  name: string;
  nationalId: string | null;
  classSectionId: string | null;
};

type MarksheetPayload = {
  definition: {
    id: string;
    title: string;
    type: string;
    maximumScore: number;
    passMark: number;
    coefficient: number;
    status: string;
  };
  students: MarksheetStudent[];
  existingMarks: {
    studentId: string;
    rawScore: number | null;
    status: MarkStatus | 'pending';
  }[];
};

const MENTION_STYLES: Record<string, string> = {
  'Très Bien': 'bg-emerald-100 text-emerald-800',
  'Bien': 'bg-teal-100 text-teal-800',
  'Assez Bien': 'bg-sky-100 text-sky-800',
  'Passable': 'bg-amber-100 text-amber-800',
  'Insuffisant': 'bg-rose-100 text-rose-800',
};

export function MarksheetGridView({
  assessmentDefinitionId,
  loadUrl,
  saveUrl,
}: {
  assessmentDefinitionId: string;
  loadUrl: string;
  saveUrl: string;
}) {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');
  const [payload, setPayload] = useState<MarksheetPayload | null>(null);
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const statusLabels: Record<MarkStatus, string> = {
    graded: t('statusGraded'),
    exempted: t('statusExempted'),
    absent: t('statusAbsent'),
    withheld: t('statusWithheld'),
  };

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importingMassar, setImportingMassar] = useState(false);

  const handleExportMassar = () => {
    window.open(`/api/academics/massar/export/marksheet?assessmentDefId=${assessmentDefinitionId}`, '_blank');
  };

  const handleImportMassar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingMassar(true);
    try {
      const fd = new FormData();
      fd.append('assessmentDefId', assessmentDefinitionId);
      fd.append('file', file);
      const res = await fetch('/api/academics/massar/import/marks', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        void load();
      } else {
        alert(json.message || 'Erreur lors de l’import Massar');
      }
    } catch {
      alert('Erreur réseau lors de l’import Massar');
    } finally {
      setImportingMassar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(loadUrl);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('marksheetUnavailable'));
      }

      const data = json.data as MarksheetPayload;
      const byStudent = new Map(data.existingMarks.map(m => [m.studentId, m]));

      setPayload(data);
      setRows(data.students.map((student) => {
        const existing = byStudent.get(student.studentId);
        return {
          studentId: student.studentId,
          input: existing?.rawScore === null || existing?.rawScore === undefined ? '' : String(existing.rawScore),
          status: existing && existing.status !== 'pending' ? existing.status : 'graded',
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marksheetUnavailable'));
    } finally {
      setLoading(false);
    }
  }, [loadUrl, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const maximumScore = payload?.definition.maximumScore ?? 20;
  const passMark = payload?.definition.passMark ?? 10;

  const summary = useMemo(() => summarize(rows, maximumScore, passMark), [rows, maximumScore, passMark]);

  const focusRow = (index: number | null) => {
    if (index === null) {
      return;
    }
    const input = inputRefs.current[index];
    input?.focus();
    input?.select();
  };

  const setCell = (index: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) {
        return prev;
      }

      const parsed = parseMarkInput(value, maximumScore);

      if (parsed.kind === 'status') {
        next[index] = { ...row, input: '', status: parsed.status };
        return next;
      }

      next[index] = { ...row, input: value, status: 'graded' };
      return next;
    });
  };

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    const navKey: NavigationKey | null
      = event.key === 'Enter'
        ? 'Enter'
        : event.key === 'ArrowDown'
          ? 'ArrowDown'
          : event.key === 'ArrowUp'
            ? 'ArrowUp'
            : event.key === 'Tab'
              ? (event.shiftKey ? 'ShiftTab' : 'Tab')
              : null;

    if (!navKey) {
      return;
    }

    event.preventDefault();
    focusRow(nextRowIndex(index, navKey, rows.length));
  };

  const clearStatus = (index: number) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (row) {
        next[index] = { ...row, status: 'graded', input: '' };
      }
      return next;
    });
    focusRow(index);
  };

  const save = async () => {
    if (!payload || saving) {
      return;
    }

    const marks = buildSavePayload(rows, maximumScore);
    if (marks.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentDefinitionId, marks }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('errSaveMarks'));
      }

      setSavedAt(new Date().toLocaleTimeString('fr-FR'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errSaveMarks'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        <span>{t('loadingMarksheet')}</span>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
        <AlertCircle className="size-4 shrink-0" />
        <span>{error ?? t('marksheetUnavailable')}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="ms-auto h-7 text-xs font-bold text-red-700"
        >
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#16212B]">{payload.definition.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('marksheetMeta', {
              max: maximumScore,
              pass: passMark,
              coeff: payload.definition.coefficient,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              {t('savedAtTime', { time: savedAt })}
            </span>
          )}

          {/* Massar Official Moroccan Actions */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportMassar}
            accept=".xlsx"
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportMassar}
            className="h-9 gap-1.5 rounded-xl border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100"
            title="Exporter la feuille de notes au format officiel Massar (.xlsx)"
          >
            <Download className="size-3.5 text-emerald-600" />
            <span>Export Massar</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importingMassar}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 gap-1.5 rounded-xl border-blue-200 bg-white text-slate-700 text-xs font-bold hover:bg-blue-50"
            title="Importer les notes depuis un fichier Excel Massar"
          >
            {importingMassar ? (
              <Loader2 className="size-3.5 animate-spin text-[#0066FF]" />
            ) : (
              <Upload className="size-3.5 text-[#0066FF]" />
            )}
            <span>Import Massar</span>
          </Button>

          <Button
            onClick={() => void save()}
            disabled={saving || summary.invalidCount > 0 || buildSavePayload(rows, maximumScore).length === 0}
            className="h-9 gap-2 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93]"
          >
            {saving
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Save className="size-3.5" />}
            {t('saveMarks')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {summary.invalidCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          {t('invalidEntriesWarning', { count: summary.invalidCount })}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <Keyboard className="size-3.5 shrink-0" />
        <span>{t('keyboardShortcutsGuide')}</span>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                <th className="w-10 px-3 py-2.5 text-start">#</th>
                <th className="px-3 py-2.5 text-start">{t('studentHeader')}</th>
                <th className="w-32 px-3 py-2.5 text-start">
                  {t('markHeader', { max: maximumScore })}
                </th>
                <th className="w-36 px-3 py-2.5 text-start">{t('mentionHeader')}</th>
                <th className="w-32 px-3 py-2.5 text-start">{tCommon('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payload.students.map((student, index) => {
                const row = rows[index];
                if (!row) {
                  return null;
                }

                const parsed = parseMarkInput(row.input, maximumScore);
                const score = parsed.kind === 'score' ? parsed.score : null;
                const mention = row.status === 'graded' ? mentionFor(score, maximumScore) : null;
                const invalid = parsed.kind === 'invalid';

                return (
                  <tr key={student.studentId} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-[10px] font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-[#16212B]">{student.name}</div>
                      {student.nationalId && (
                        <div className="font-mono text-[10px] text-slate-400">{student.nationalId}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        value={row.status === 'graded' ? row.input : ''}
                        disabled={row.status !== 'graded'}
                        onChange={e => setCell(index, e.target.value)}
                        onKeyDown={handleKeyDown(index)}
                        inputMode="decimal"
                        aria-label={`Note de ${student.name}`}
                        aria-invalid={invalid}
                        className={`h-8 w-24 rounded-lg border px-2 text-xs font-bold tabular-nums outline-none ${
                          invalid
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-slate-200 focus:border-[#2487B8]'
                        } disabled:bg-slate-100 disabled:text-slate-400`}
                      />
                      {invalid && (
                        <p className="mt-0.5 text-[10px] font-bold text-rose-600">
                          {parsed.error}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {mention
                        ? (
                            <Badge className={`border-none text-[10px] font-bold ${MENTION_STYLES[mention] ?? ''}`}>
                              {mention}
                            </Badge>
                          )
                        : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === 'graded'
                        ? <span className="text-[10px] text-slate-400">{statusLabels.graded}</span>
                        : (
                            <button
                              type="button"
                              onClick={() => clearStatus(index)}
                              title={t('revertToNumeric')}
                              className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-300 cursor-pointer"
                            >
                              {statusLabels[row.status]} ✕
                            </button>
                          )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {payload.students.length === 0 && (
          <p className="py-10 text-center text-xs font-bold text-slate-400">
            {t('noStudentsInAssessment')}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryTile label={t('gradedCountTile')} value={String(summary.gradedCount)} />
        <SummaryTile label={t('pendingCountTile')} value={String(summary.pendingCount)} />
        <SummaryTile label={t('absentsCountTile')} value={String(summary.absentCount + summary.exemptedCount + summary.withheldCount)} />
        <SummaryTile
          label={t('averageTile')}
          value={summary.average === null ? '—' : summary.average.toFixed(2)}
          hint={t('outOfScore', { max: maximumScore })}
        />
        <SummaryTile
          label={t('passRateTile')}
          value={summary.passRate === null ? '—' : `${summary.passRate}%`}
          hint={t('excludingAbsents')}
        />
      </div>
    </div>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="space-y-0.5 rounded-2xl border border-slate-200/80 p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
      <p className="text-lg font-extrabold text-[#16212B] tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </Card>
  );
}
