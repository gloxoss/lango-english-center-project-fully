'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ExportJob = {
  id: string;
  reportType: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  resultPath: string | null;
  params: Record<string, unknown> | null;
  completedAt: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<ExportJob['status'], { cls: string; icon: React.ReactNode }> = {
  pending: {
    cls: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: <Clock className="size-3" />,
  },
  processing: {
    cls: 'bg-blue-50 text-blue-600 border-blue-200',
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  complete: {
    cls: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    cls: 'bg-red-50 text-red-600 border-red-200',
    icon: <XCircle className="size-3" />,
  },
};

export default function ExportsPage() {
  const locale = useLocale();
  const t = useTranslations('SettingsExports');
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobsRef = useRef<ExportJob[]>(jobs);
  const loadFailedRef = useRef(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(setToast, 4000, null);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/exports');
      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error('Export list failed');
      }
      setJobs(json.data);
      jobsRef.current = json.data;
      loadFailedRef.current = false;
    } catch {
      if (!loadFailedRef.current || showLoading) {
        showToast('err', t('loadError'));
      }
      loadFailedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  // Auto-poll every 10 s while any job is running/pending.
  // jobsRef tracks the latest list so the interval closure stays fresh.
  useEffect(() => {
    void load(true);
    pollRef.current = setInterval(() => {
      const hasActive = jobsRef.current.some(j => j.status === 'pending' || j.status === 'processing');
      if (hasActive) {
        void load();
      }
    }, 10_000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: 'audit-logs' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('ok', t('created'));
        await load();
      } else {
        showToast('err', t('createError'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (job: ExportJob) => {
    if (!job.resultPath) {
      return;
    }
    try {
      const res = await fetch(`/api/exports/${encodeURIComponent(job.id)}/download`);
      if (!res.ok) {
        throw new Error('Export download failed');
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date(job.createdAt).toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast('err', t('downloadError'));
    }
  };

  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={loading}
          className="gap-2 rounded-full text-xs"
        >
          <RefreshCw className={`
            size-3.5
            ${loading ? 'animate-spin' : ''}
          `}
          />
          {t('refresh')}
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          className={`
            flex items-center gap-2 rounded-xl p-3 text-xs font-semibold
            ${
        toast.type === 'ok'
          ? `border border-emerald-200 bg-emerald-50 text-emerald-700`
          : `border border-red-200 bg-red-50 text-red-700`
        }
          `}
        >
          {toast.type === 'ok'
            ? <CheckCircle2 className="size-4 shrink-0" />
            : (
                <AlertCircle className="size-4 shrink-0" />
              )}
          {toast.msg}
        </div>
      )}

      {/* New export panel */}
      <Card className="rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="
          mb-3 flex items-center gap-2 text-sm font-bold text-slate-800
        "
        >
          <Plus className="size-4 text-blue-500" />
          {t('newExport')}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-700">{t('auditLogsCsv')}</span>
          <Button
            onClick={() => void handleCreate()}
            disabled={creating}
            className="
              h-9 gap-2 rounded-xl bg-blue-600 text-xs font-semibold text-white
              hover:bg-blue-700
            "
          >
            {creating
              ? <Loader2 className="size-3.5 animate-spin" />
              : (
                  <Download className="size-3.5" />
                )}
            {creating ? t('generating') : t('generate')}
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('onlyAuditLogs')}</p>
      </Card>

      {/* Job list */}
      <Card className="
        overflow-hidden rounded-2xl border border-slate-200 shadow-xs
      "
      >
        {loading
          ? (
              <div className="flex items-center justify-center py-12">
                <div className="
                  size-7 animate-spin rounded-full border-2 border-blue-500
                  border-t-transparent
                "
                />
              </div>
            )
          : jobs.length === 0
            ? (
                <div className="flex flex-col items-center py-16 text-slate-400">
                  <FileText className="mb-3 size-10 opacity-30" />
                  <p className="text-sm font-medium">{t('emptyTitle')}</p>
                  <p className="mt-1 text-xs">{t('emptyDescription')}</p>
                </div>
              )
            : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="
                        px-4 py-3 text-left font-bold text-slate-600
                      "
                      >
                        {t('type')}
                      </th>
                      <th className="
                        px-4 py-3 text-left font-bold text-slate-600
                      "
                      >
                        {t('statusLabel')}
                      </th>
                      <th className="
                        px-4 py-3 text-left font-bold text-slate-600
                      "
                      >
                        {t('requestedAt')}
                      </th>
                      <th className="
                        px-4 py-3 text-left font-bold text-slate-600
                      "
                      >
                        {t('completedAt')}
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const cfg = STATUS_CONFIG[job.status];
                      const isReady = job.reportType === 'audit-logs' && job.status === 'complete' && Boolean(job.resultPath);

                      return (
                        <tr
                          key={job.id}
                          className="
                            border-t border-slate-100 transition-colors
                            hover:bg-slate-50/40
                          "
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">
                              {job.reportType === 'audit-logs' ? t('auditLogsCsv') : job.reportType}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {cfg && (
                              <Badge className={`
                                flex w-fit items-center gap-1 border px-2
                                text-[10px]
                                ${cfg.cls}
                              `}
                              >
                                {cfg.icon}
                                {t(`status.${job.status}`)}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDate(job.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDate(job.completedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!isReady}
                              onClick={() => void handleDownload(job)}
                              className="h-7 gap-1.5 rounded-lg text-[10px]"
                            >
                              <Download className="size-3" />
                              {isReady ? t('download') : '—'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
      </Card>

      {/* Note */}
      <p className="text-center text-[10px] text-slate-400">
        {t('refreshNote')}
      </p>
    </div>
  );
}
