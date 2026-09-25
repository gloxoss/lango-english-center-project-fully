'use client';

import type { Column } from '@/components/shared/data-table';
import { Activity, ChevronLeft, ChevronRight, LogIn, X, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCsv } from '@/libs/csv-export';

type LoginEventItem = {
  id: string;
  email: string | null;
  userId: string | null;
  method: string;
  success: boolean;
  failureReason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type ApiResponse = {
  success: boolean;
  rows: LoginEventItem[];
  total: number;
  summary: { total: number; failed: number; success: number };
  page: number;
  limit: number;
};

// Browser/OS names are product names; unknown browsers show only the OS.
function describeDevice(userAgent: string | null): string {
  if (!userAgent) {
    return '—';
  }
  const ua = userAgent.toLowerCase();
  const browser = /edg\//.test(ua) ? 'Edge' : /opr\//.test(ua) ? 'Opera' : /firefox/.test(ua) ? 'Firefox' : /safari/.test(ua) && !/chrome/.test(ua) ? 'Safari' : /chrome/.test(ua) ? 'Chrome' : '';
  const os = /windows/.test(ua) ? 'Windows' : /mac os|macintosh/.test(ua) ? 'macOS' : /android/.test(ua) ? 'Android' : /iphone|ipad/.test(ua) ? 'iOS' : /linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ') || '—';
}

export function LoginEventsView() {
  const t = useTranslations('LoginEvents');
  const locale = useLocale();
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(intlLocale, { dateStyle: 'short', timeStyle: 'short' });
  };
  const [rows, setRows] = useState<LoginEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, failed: 0, success: 0 });
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== 'all') {
      params.set('success', statusFilter === 'success' ? 'true' : 'false');
    }
    try {
      const res = await fetch(`/api/settings/security/login-events?${params}`);
      const json: ApiResponse = await res.json();
      if (res.ok && json.success) {
        setRows(json.rows);
        setTotal(json.total);
        setSummary(json.summary);
      } else {
        setError((json as { error?: { message?: string } }).error?.message ?? t('loadError'));
      }
    } catch {
      setError(t('networkError'));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const successRate = summary.total > 0 ? Math.round((summary.success / summary.total) * 100) : 0;
  const selected = rows.find(r => r.id === selectedId) ?? null;

  const columns: Column<LoginEventItem>[] = [
    {
      key: 'createdAt',
      header: t('colDate'),
      cell: e => <span className="font-mono text-[11px] text-slate-500">{formatDate(e.createdAt)}</span>,
    },
    {
      key: 'email',
      header: t('colUser'),
      cell: e => <span className="font-bold text-[#16212B]">{e.email ?? e.userId ?? '—'}</span>,
    },
    {
      key: 'method',
      header: t('colMethod'),
      cell: e => (
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          {e.method}
        </span>
      ),
    },
    {
      key: 'success',
      header: t('colStatus'),
      cell: e => e.success
        ? <Badge className="bg-emerald-100 text-emerald-800">{t('succeeded')}</Badge>
        : <Badge className="bg-rose-100 text-rose-800">{t('failed')}</Badge>,
    },
    {
      key: 'ip',
      header: t('colIp'),
      cell: e => <span className="font-mono text-[11px] text-slate-500" dir="ltr">{e.ip ?? '—'}</span>,
    },
    {
      key: 'userAgent',
      header: t('colDevice'),
      cell: e => <span className="text-slate-500">{describeDevice(e.userAgent)}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('subtitle')}
          </p>
        </div>

        {/* The API is paged, so this only ever exported the visible page; say so. */}
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() => exportToCsv(rows, `login-events-p${page}`)}
          className="
            h-9 gap-2 rounded-full border-slate-200 px-4 text-xs font-bold
          "
        >
          {t('exportPage', { count: rows.length })}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="
            rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs
            font-semibold text-rose-700
          "
        >
          {error}
        </div>
      )}

      <div className="
        grid grid-cols-1 gap-4
        sm:grid-cols-3
      "
      >
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statTotal')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{summary.total}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-[#DCEBF4]
            text-[#1B6C93]
          "
          >
            <Activity className="size-5" />
          </div>
        </Card>
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statFailed')}</p>
            <p className="text-2xl font-extrabold text-rose-600">{summary.failed}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-rose-50
            text-rose-600
          "
          >
            <XCircle className="size-5" />
          </div>
        </Card>
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statRate')}</p>
            <p className="text-2xl font-extrabold text-emerald-600">
              {successRate}
              %
            </p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-full bg-emerald-50
            text-emerald-600
          "
          >
            <LogIn className="size-5" />
          </div>
        </Card>
      </div>

      <div className="
        flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80
        bg-white p-4 shadow-2xs
      "
      >
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as 'all' | 'success' | 'failed');
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[180px] rounded-full bg-white" aria-label={t('colStatus')}>
            <SelectValue placeholder={t('allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="success">{t('filterSucceeded')}</SelectItem>
            <SelectItem value="failed">{t('filterFailed')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-full px-3" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="
              size-4
              rtl:rotate-180
            "
            />
            {' '}
            {t('previous')}
          </Button>
          <span className="text-xs font-bold text-slate-500">{t('pageOf', { page, total: totalPages })}</span>
          <Button variant="outline" size="sm" className="h-9 rounded-full px-3" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            {t('next')}
            {' '}
            <ChevronRight className="
              size-4
              rtl:rotate-180
            "
            />
          </Button>
        </div>
      </div>

      <div className="
        grid grid-cols-1 gap-6 text-xs
        lg:grid-cols-3
      "
      >
        <div className="lg:col-span-2">
          <DataTable
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyTitle={t('emptyTitle')}
            emptyDescription={t('emptyBody')}
            defaultPageSize={limit}
            selectedRowId={selectedId}
            onRowClick={row => setSelectedId(row.id)}
          />
        </div>

        <div className="space-y-4">
          <Card className="
            space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6
            shadow-2xs
          "
          >
            <div className="
              flex items-center justify-between border-b border-slate-100 pb-3
            "
            >
              <h3 className="font-extrabold text-[#16212B]">{t('detailTitle')}</h3>
              {selected && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={t('closeDetail')}
                  className="
                    text-slate-400
                    hover:text-slate-600
                  "
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {!selected && <p className="text-slate-400">{t('selectRow')}</p>}

            {selected && (
              <div className="space-y-2 font-medium">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-400">{t('colDate')}</span>
                  <span className="font-mono text-slate-700">{formatDate(selected.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-400">{t('colUser')}</span>
                  <span className="font-bold text-[#16212B]">{selected.email ?? selected.userId ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-400">{t('colStatus')}</span>
                  <span className={selected.success
                    ? `font-bold text-emerald-700`
                    : `font-bold text-rose-700`}
                  >
                    {selected.success ? t('succeeded') : t('failed')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-400">{t('colMethod')}</span>
                  <span className="font-bold text-slate-800 uppercase">{selected.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-400">{t('colIp')}</span>
                  <span className="font-mono text-slate-700" dir="ltr">{selected.ip ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-400">{t('colDevice')}</span>
                  <span className="text-slate-700">{describeDevice(selected.userAgent)}</span>
                </div>
                {selected.failureReason && (
                  <div className="
                    rounded-xl border border-rose-100 bg-rose-50 p-3
                    text-rose-700
                  "
                  >
                    <p className="
                      mb-1 font-sans text-[10px] font-bold uppercase
                    "
                    >
                      {t('reason')}
                    </p>
                    <p className="font-mono text-[11px]">{selected.failureReason}</p>
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
