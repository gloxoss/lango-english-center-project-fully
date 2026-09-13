'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Video, CalendarClock, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getMySessions, joinSession, redeemJoin, errorMessage } from '../data/api';

const STATUS_KEYS: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; key: string }> = {
  scheduled: { variant: 'info', key: 'statusScheduled' },
  waiting: { variant: 'warning', key: 'statusWaiting' },
  live: { variant: 'success', key: 'statusLive' },
};

export function MySessionsClient() {
  const t = useTranslations('LiveClassrooms');
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getMySessions>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [joinLinks, setJoinLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getMySessions());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const grant = await joinSession(id);
      const redeemed = await redeemJoin(id, grant.token);
      setJoinLinks(prev => ({ ...prev, [id]: redeemed.url }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6 text-[#2487B8]" /> {t('myLiveClassesTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('myLiveClassesSubtitle')}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('refreshBtn')}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm font-semibold text-slate-400">{t('loadingText')}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
          <CalendarClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-[#16212B]">{t('noMySessionsTitle')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('noMySessionsDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map(r => {
            const st = STATUS_KEYS[r.status] ?? { variant: 'neutral' as const, key: 'statusDraft' };
            const link = joinLinks[r.id];
            return (
              <div key={r.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-extrabold text-[#16212B]">{r.title}</h2>
                  <Badge variant={st.variant}>{(t as any)(st.key)}</Badge>
                </div>
                <p className="text-[11px] font-semibold text-slate-500">
                  {[r.className, r.sectionName, r.subjectName].filter(Boolean).join(' · ') || t('classFallback')}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">{t('teacherLabelPrefix', { name: r.teacherName ?? '—' })}</p>
                <p className="text-[11px] font-bold text-slate-600">
                  {new Date(r.scheduledStart).toLocaleString()} — {new Date(r.scheduledEnd).toLocaleString()}
                </p>
                {link ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500">{t('devLinkWarning')}</p>
                    <a href={link} target="_blank" rel="noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#2487B8] px-3 text-[11px] font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                      <ExternalLink className="w-3 h-3" /> {t('openSessionAction')}
                    </a>
                  </div>
                ) : r.canJoin ? (
                  <button onClick={() => handleJoin(r.id)} disabled={busyId !== null}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                    <Video className="h-3.5 w-3.5" /> {busyId === r.id ? t('generatingToken') : t('joinAction')}
                  </button>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400">{t('joinAvailable10MinPrior')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
