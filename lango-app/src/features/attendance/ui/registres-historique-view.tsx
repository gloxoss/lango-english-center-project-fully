'use client';

import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { casablancaTodayIso } from '@/libs/finance/today';

/**
 * REGISTRES & HISTORIQUE — the administrative history surface (phase 8).
 *
 * Manual and badge attendance in one table, because the origin is a property of
 * the mark rather than a reason to visit two pages. Scope and filtering happen
 * server-side in /api/attendance/history, so the rows shown are the rows the
 * caller is allowed to see.
 *
 * Internal identifiers are not shown by default. They are real and occasionally
 * necessary, so they sit behind "Journal technique" rather than being deleted or
 * put in front of a head of year.
 */

type HistoryRow = {
  id: string;
  date: string;
  period: number;
  status: string;
  lateMinutes: number | null;
  note: string | null;
  studentId: string;
  studentName: string | null;
  source: 'qr' | 'manual';
  registerReference: string | null;
  registerStatus: string | null;
  classNameLabel: string | null;
  subjectName: string | null;
};

const STATUS_KEY: Record<string, string> = {
  present: 'statusPresent',
  absent: 'statusAbsent',
  late: 'statusLate',
  excused: 'statusExcused',
};

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  absent: 'bg-rose-50 text-rose-700 border-rose-200',
  late: 'bg-amber-50 text-amber-800 border-amber-200',
  excused: 'bg-violet-50 text-violet-700 border-violet-200',
};

export function RegistresHistoriqueView() {
  const t = useTranslations('Attendance');
  // The four attendance-status labels already exist under Students; reusing them
  // rather than duplicating twelve strings across three locales.
  const tStatus = useTranslations('Students');

  const today = casablancaTodayIso();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [classSectionId, setClassSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTechnical, setShowTechnical] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (classSectionId) {
        params.set('classSectionId', classSectionId);
      }
      if (status) {
        params.set('status', status);
      }
      if (source) {
        params.set('source', source);
      }
      const res = await fetch(`/api/attendance/history?${params.toString()}`);
      const json = await res.json();
      setRows(Array.isArray(json?.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, [from, to, classSectionId, status, source]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/academics/class-sections?pageSize=100');
        const json = await res.json();
        const items = json?.data?.items ?? json?.data ?? [];
        setSections((Array.isArray(items) ? items : []).map((s: { id: string; name?: string; className?: string }) => ({
          id: s.id,
          label: s.className ? `${s.className}` : (s.name ?? s.id),
        })));
      } catch {
        // The class filter simply stays empty; the rest of the page works.
      }
    })();
  }, []);

  /** A local wall-clock time is not on the mark; the period is what exists. */
  const timeLabel = (row: HistoryRow) => `${t('periodNumbered', { period: row.period })}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('historyTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('historySubtitle')}</p>
      </div>

      <Card className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="history-from">{t('historyFrom')}</label>
            <input id="history-from" type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="mt-1 h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="history-to">{t('historyTo')}</label>
            <input id="history-to" type="date" value={to} onChange={e => setTo(e.target.value)}
              className="mt-1 h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="history-class">{t('historyClassLabel')}</label>
            <select id="history-class" value={classSectionId} onChange={e => setClassSectionId(e.target.value)}
              className="mt-1 h-9 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
              <option value="">{t('historyAll')}</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="history-status">{t('historyStatusLabel')}</label>
            <select id="history-status" value={status} onChange={e => setStatus(e.target.value)}
              className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
              <option value="">{t('historyAll')}</option>
              <option value="present">{tStatus('statusPresent')}</option>
              <option value="late">{tStatus('statusLate')}</option>
              <option value="absent">{tStatus('statusAbsent')}</option>
              <option value="excused">{tStatus('statusExcused')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="history-source">{t('historySourceLabel')}</label>
            <select id="history-source" value={source} onChange={e => setSource(e.target.value)}
              className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
              <option value="">{t('historyAll')}</option>
              <option value="manual">{t('historySourceManual')}</option>
              <option value="qr">{t('historySourceQr')}</option>
            </select>
          </div>
          <span className="ms-auto text-xs text-slate-500">{rows.length} {t('historyCount')}</span>
        </div>
      </Card>

      {loading
        ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('loading')}
            </div>
          )
        : rows.length === 0
          ? <Card className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{t('historyEmpty')}</Card>
          : (
              <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColDate')}</th>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColStudent')}</th>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColClass')}</th>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColSubject')}</th>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColStatus')}</th>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColSource')}</th>
                        <th className="px-3 py-2 text-start font-medium">{t('historyColRegister')}</th>
                        {showTechnical && <th className="px-3 py-2 text-start font-medium">{t('historyColId')}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map(row => (
                        <tr key={row.id} className="text-slate-700">
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                            {row.date}
                            <span className="ms-2 text-xs text-slate-400">{timeLabel(row)}</span>
                          </td>
                          <td className="px-3 py-2">{row.studentName ?? row.studentId}</td>
                          <td className="px-3 py-2">{row.classNameLabel ?? '—'}</td>
                          <td className="px-3 py-2">{row.subjectName ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[row.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {tStatus(STATUS_KEY[row.status] ?? 'statusPresent')}
                            </span>
                            {row.status === 'late' && row.lateMinutes ? (
                              <span className="ms-1 text-xs text-slate-400">{row.lateMinutes} min</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.source === 'qr' ? t('historySourceQr') : t('historySourceManual')}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">{row.registerReference ?? '—'}</td>
                          {showTechnical && <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{row.id}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <button
          type="button"
          onClick={() => setShowTechnical(v => !v)}
          className="flex w-full items-center gap-2 text-start text-xs font-medium text-slate-600"
          aria-expanded={showTechnical}
        >
          {showTechnical ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          {t('historyTechnicalJournal')}
        </button>
        <p className="mt-1 ps-5 text-xs text-slate-400">{t('historyTechnicalHint')}</p>
      </div>
    </div>
  );
}
