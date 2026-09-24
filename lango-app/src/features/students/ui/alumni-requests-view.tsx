'use client';

import { ArrowRight, CheckCircle2, Inbox, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type RequestStatus = 'received' | 'accepted' | 'preparing' | 'ready' | 'taken' | 'refused';

type RequestRow = {
  id: string;
  alumnusId: string;
  alumnusName: string;
  type: string;
  status: RequestStatus;
  note: string;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  correction: 'Correction',
  reissue: 'Réémission',
  data_access: 'Accès aux données',
  deletion: 'Suppression',
};

export function AlumniRequestsView() {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const columns = useMemo<{ key: RequestStatus; label: string; dot: string }[]>(() => [
    { key: 'received', label: t('applicantReceived'), dot: 'bg-amber-500' },
    { key: 'accepted', label: t('statusAccepted'), dot: 'bg-blue-500' },
    { key: 'preparing', label: t('statusInPrep'), dot: 'bg-indigo-500' },
    { key: 'ready', label: t('statusReady'), dot: 'bg-violet-500' },
    { key: 'taken', label: t('retrieved'), dot: 'bg-emerald-500' },
    { key: 'refused', label: t('statusRefused'), dot: 'bg-rose-500' },
  ], [t]);

  const load = () => {
    fetch(`/api/students/alumni/requests?pageSize=200`).then(r => r.json()).then((j) => {
      if (j?.success) {
        setRows(j.data as RequestRow[]);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const advance = async (id: string, status: Exclude<RequestStatus, 'received'>) => {
    setAdvancing(id);
    try {
      await fetch(`/api/students/alumni/requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      load();
    } finally {
      setAdvancing(null);
    }
  };

  const byStatus = useMemo(() => {
    const map = new Map<RequestStatus, RequestRow[]>();
    for (const c of columns) {
      map.set(c.key, []);
    }
    for (const r of rows) {
      map.get(r.status)?.push(r);
    }
    return map;
  }, [rows, columns]);

  const inProgress = rows.filter(r => r.status !== 'taken' && r.status !== 'refused').length;
  const decided = rows.filter(r => r.decidedAt);
  const avgDays = decided.length
    ? Math.round(decided.reduce((s, r) => s + (new Date(r.decidedAt!).getTime() - new Date(r.createdAt).getTime()), 0) / decided.length / 86400000)
    : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('alumniRequestsTitle')}</h1>
      </div>

      {/* Analytics strip */}
      <div className="
        grid grid-cols-2 gap-3
        md:grid-cols-4
      "
      >
        <Card className="
          space-y-1 rounded-2xl border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <span className="
            text-[11px] font-bold tracking-wider text-slate-400 uppercase
          "
          >
            {t('totalRequestsLabel')}
          </span>
          <div className="text-2xl font-extrabold text-[#16212B]">{rows.length}</div>
        </Card>
        <Card className="
          space-y-1 rounded-2xl border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <span className="
            text-[11px] font-bold tracking-wider text-slate-400 uppercase
          "
          >
            {t('inProgress')}
          </span>
          <div className="text-2xl font-extrabold text-[#0066FF]">{inProgress}</div>
        </Card>
        <Card className="
          space-y-1 rounded-2xl border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <span className="
            text-[11px] font-bold tracking-wider text-slate-400 uppercase
          "
          >
            {t('retrieved')}
          </span>
          <div className="text-2xl font-extrabold text-emerald-600">{byStatus.get('taken')?.length ?? 0}</div>
        </Card>
        <Card className="
          space-y-1 rounded-2xl border-slate-200/80 bg-white p-4 shadow-2xs
        "
        >
          <span className="
            text-[11px] font-bold tracking-wider text-slate-400 uppercase
          "
          >
            {t('avgDecisionTime')}
          </span>
          <div className="text-2xl font-extrabold text-purple-700">{avgDays != null ? `${avgDays} j` : '—'}</div>
        </Card>
      </div>

      {loading
        ? (
            <div className="
              flex items-center justify-center gap-2 p-16 text-slate-400
            "
            >
              <Loader2 className="size-5 animate-spin text-[#0066FF]" />
              <span className="text-xs font-medium">{tCommon('loading')}</span>
            </div>
          )
        : (
            <div className="
              grid grid-cols-1 items-start gap-4
              sm:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-6
            "
            >
              {columns.map((col) => {
                const items = byStatus.get(col.key) ?? [];
                return (
                  <div
                    key={col.key}
                    className="
                      min-h-[120px] rounded-2xl border border-slate-200/70
                      bg-slate-50/70 p-2.5
                    "
                  >
                    <div className="flex items-center gap-2 p-1.5">
                      <span className={`
                        size-2 rounded-full
                        ${col.dot}
                      `}
                      />
                      <span className="text-xs font-extrabold text-[#16212B]">{col.label}</span>
                      <span className="
                        ms-auto rounded-full border border-slate-200 bg-white
                        px-2 py-0.5 text-[10px] font-bold text-slate-400
                      "
                      >
                        {items.length}
                      </span>
                    </div>

                    <div className="mt-2 space-y-2">
                      {items.length === 0 && (
                        <div className="
                          flex flex-col items-center gap-1 p-4 text-center
                          text-slate-300
                        "
                        >
                          <Inbox className="size-5" />
                          <span className="text-[10px] font-bold">{tCommon('empty')}</span>
                        </div>
                      )}
                      {items.map(r => (
                        <Card
                          key={r.id}
                          className="
                            space-y-2 rounded-xl border border-slate-200/80
                            bg-white p-3 shadow-2xs
                          "
                        >
                          <div>
                            <p className="
                              text-start text-xs/tight font-extrabold
                              text-[#16212B]
                            "
                            >
                              {r.alumnusName}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Badge className="
                                border-none bg-slate-100 text-[9px]
                                text-slate-600
                              "
                              >
                                {TYPE_LABELS[r.type] ?? r.type}
                              </Badge>
                            </div>
                          </div>
                          <p className="
                            line-clamp-2 text-start text-[10px] leading-snug
                            text-slate-500
                          "
                          >
                            {r.note}
                          </p>
                          {r.decisionNote && (
                            <p className="
                              text-start text-[10px] text-slate-400 italic
                            "
                            >
                              {tCommon('reason') || 'Note'}
                              {' '}
                              :
                              {' '}
                              {r.decisionNote}
                            </p>
                          )}

                          {r.status === 'received' && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <Button
                                size="sm"
                                disabled={advancing === r.id}
                                onClick={() => advance(r.id, 'accepted')}
                                className="
                                  h-7 flex-1 gap-1 rounded-lg bg-[#17A673]
                                  text-[10px] font-bold text-white
                                  hover:bg-[#149063]
                                "
                              >
                                <CheckCircle2 className="size-3" />
                                {' '}
                                {tCommon('approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={advancing === r.id}
                                onClick={() => advance(r.id, 'refused')}
                                className="
                                  h-7 flex-1 gap-1 rounded-lg border-rose-200
                                  text-[10px] font-bold text-rose-600
                                  hover:bg-rose-50
                                "
                              >
                                <XCircle className="size-3" />
                                {' '}
                                {tCommon('reject')}
                              </Button>
                            </div>
                          )}
                          {r.status === 'accepted' && (
                            <Button
                              size="sm"
                              disabled={advancing === r.id}
                              onClick={() => advance(r.id, 'preparing')}
                              className="
                                h-7 w-full gap-1 rounded-lg bg-[#0066FF]
                                text-[10px] font-bold text-white
                                hover:bg-[#0056d6]
                              "
                            >
                              {t('statusInPrep')}
                              {' '}
                              <ArrowRight className="
                                size-3
                                rtl:rotate-180
                              "
                              />
                            </Button>
                          )}
                          {r.status === 'preparing' && (
                            <Button
                              size="sm"
                              disabled={advancing === r.id}
                              onClick={() => advance(r.id, 'ready')}
                              className="
                                h-7 w-full gap-1 rounded-lg bg-violet-600
                                text-[10px] font-bold text-white
                                hover:bg-violet-700
                              "
                            >
                              {t('statusReady')}
                              {' '}
                              <ArrowRight className="
                                size-3
                                rtl:rotate-180
                              "
                              />
                            </Button>
                          )}
                          {r.status === 'ready' && (
                            <Button
                              size="sm"
                              disabled={advancing === r.id}
                              onClick={() => advance(r.id, 'taken')}
                              className="
                                h-7 w-full gap-1 rounded-lg bg-emerald-600
                                text-[10px] font-bold text-white
                                hover:bg-emerald-700
                              "
                            >
                              {t('retrieved')}
                              {' '}
                              <ArrowRight className="
                                size-3
                                rtl:rotate-180
                              "
                              />
                            </Button>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}
