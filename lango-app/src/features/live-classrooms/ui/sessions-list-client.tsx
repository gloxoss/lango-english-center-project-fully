'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus, RefreshCw, Video, Users, Calendar, AlertTriangle, Search, VideoOff, MonitorPlay } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getSessions, errorMessage, type LiveSessionRow,
} from '../data/api';

export function SessionsListClient({ locale }: { locale: string }) {
  const t = useTranslations('LiveClassrooms');
  const tCommon = useTranslations('Common');

  const [rows, setRows] = useState<LiveSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  const STATUS_CONFIG: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal'; labelKey: string }> = {
    draft: { variant: 'neutral', labelKey: 'statusDraft' },
    scheduled: { variant: 'info', labelKey: 'statusScheduled' },
    waiting: { variant: 'warning', labelKey: 'statusWaiting' },
    live: { variant: 'success', labelKey: 'statusLive' },
    ended: { variant: 'neutral', labelKey: 'statusEnded' },
    cancelled: { variant: 'danger', labelKey: 'statusCancelled' },
    failed: { variant: 'danger', labelKey: 'statusFailed' },
    expired: { variant: 'neutral', labelKey: 'statusExpired' },
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: '1', pageSize: '100' };
      if (status) params.status = status;
      const data = await getSessions(params);
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const filtered = query
    ? rows.filter(r => (r.title ?? '').toLowerCase().includes(query.toLowerCase())
      || (r.teacherName ?? '').toLowerCase().includes(query.toLowerCase())
      || (r.className ?? '').toLowerCase().includes(query.toLowerCase()))
    : rows;

  const liveCount = rows.filter(r => r.status === 'live').length;
  const scheduledCount = rows.filter(r => r.status === 'scheduled' || r.status === 'waiting').length;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] shadow-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('refreshBtn')}
          </button>
          <Link
            href={`/${locale}/dashboard/academics/live-class/new`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-3 text-xs font-bold text-white shadow-2xs hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> {t('newSessionBtn')}
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiLive')}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : liveCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiScheduledWaiting')}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : scheduledCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 shrink-0 flex items-center justify-center text-[#2487B8]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiTotalSessions')}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : total}</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-xs font-medium text-[#16212B] placeholder:text-slate-400 focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20"
        >
          <option value="">{t('allStatuses')}</option>
          {Object.entries(STATUS_CONFIG).map(([key, s]) => (
            <option key={key} value={key}>{t(s.labelKey as any)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400">{t('loadingSessions')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <MonitorPlay className="mx-auto w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-[#16212B]">{t('noSessions')}</p>
            <p className="text-xs text-slate-500">{t('noSessionsDesc')}</p>
            <Link
              href={`/${locale}/dashboard/academics/live-class/new`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-3 text-xs font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> {t('createSessionAction')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                  <th className="py-2.5 px-4 text-start">{t('colSession')}</th>
                  <th className="py-2.5 px-3 text-start">{t('colTeacher')}</th>
                  <th className="py-2.5 px-3 text-start">{t('colClass')}</th>
                  <th className="py-2.5 px-3 text-start">{t('colSubject')}</th>
                  <th className="py-2.5 px-3 text-start">{t('colScheduled')}</th>
                  <th className="py-2.5 px-3 text-center">{t('colStatus')}</th>
                  <th className="py-2.5 px-4 text-end">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((r) => {
                  const cfg = STATUS_CONFIG[r.status] ?? { variant: 'neutral' as const, labelKey: 'statusDraft' };
                  const label = STATUS_CONFIG[r.status] ? t(cfg.labelKey as any) : r.status;
                  const start = new Date(r.scheduledStart).toLocaleString(undefined, {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 text-start">
                        <Link href={`/${locale}/dashboard/academics/live-class/${r.id}`} className="font-bold text-[#16212B] hover:text-[#2487B8] text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
                          {r.title}
                        </Link>
                        <p className="text-[10px] text-slate-400 mt-0.5">{r.providerType === 'dev' ? t('devProvider') : (r.profileName ?? '—')}</p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] text-start">{r.teacherName ?? '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] text-start">
                        {r.className ? `${r.className}${r.sectionName ? ` · ${r.sectionName}` : ''}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] text-start">{r.subjectName ?? '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] text-start">{start}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={cfg.variant}>{label}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/${locale}/dashboard/academics/live-class/${r.id}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
                          >
                            {t('actionOpen')}
                          </Link>
                          {r.status === 'live' && (
                            <Link
                              href={`/${locale}/dashboard/academics/live-class/${r.id}`}
                              className="inline-flex h-7 items-center gap-1 rounded-lg bg-rose-600 px-2 text-[10px] font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 cursor-pointer"
                            >
                              <VideoOff className="w-3 h-3" /> {t('actionEnd')}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
