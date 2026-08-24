'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

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

const COLUMNS: { key: RequestStatus; label: string; dot: string }[] = [
  { key: 'received', label: 'Reçues', dot: 'bg-amber-500' },
  { key: 'accepted', label: 'Acceptées', dot: 'bg-blue-500' },
  { key: 'preparing', label: 'En préparation', dot: 'bg-indigo-500' },
  { key: 'ready', label: 'Prêtes', dot: 'bg-violet-500' },
  { key: 'taken', label: 'Récupérées', dot: 'bg-emerald-500' },
  { key: 'refused', label: 'Refusées', dot: 'bg-rose-500' },
];

const STATUS_LABEL: Record<RequestStatus, string> = {
  received: 'Reçue',
  accepted: 'Acceptée',
  preparing: 'En préparation',
  ready: 'Prête',
  taken: 'Récupérée',
  refused: 'Refusée',
};

export function AlumniRequestsView() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/students/alumni/requests?pageSize=200`).then(r => r.json()).then(j => {
      if (j?.success) setRows(j.data as RequestRow[]);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

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
    for (const c of COLUMNS) map.set(c.key, []);
    for (const r of rows) map.get(r.status)?.push(r);
    return map;
  }, [rows]);

  const inProgress = rows.filter(r => r.status !== 'taken' && r.status !== 'refused').length;
  const decided = rows.filter(r => r.decidedAt);
  const avgDays = decided.length
    ? Math.round(decided.reduce((s, r) => s + (new Date(r.decidedAt!).getTime() - new Date(r.createdAt).getTime()), 0) / decided.length / 86400000)
    : null;

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Demandes Anciens Élèves</h1>
      </div>

      {/* Analytics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total demandes</span>
          <div className="text-2xl font-extrabold text-[#16212B]">{rows.length}</div>
        </Card>
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En cours</span>
          <div className="text-2xl font-extrabold text-[#0066FF]">{inProgress}</div>
        </Card>
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Récupérées</span>
          <div className="text-2xl font-extrabold text-emerald-600">{byStatus.get('taken')?.length ?? 0}</div>
        </Card>
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-1 bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Délai moyen décision</span>
          <div className="text-2xl font-extrabold text-purple-700">{avgDays != null ? `${avgDays} j` : '—'}</div>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#0066FF]" />
          <span className="text-xs font-medium">Chargement...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {COLUMNS.map(col => {
            const items = byStatus.get(col.key) ?? [];
            return (
              <div key={col.key} className="rounded-2xl bg-slate-50/70 border border-slate-200/70 p-2.5 min-h-[120px]">
                <div className="flex items-center gap-2 px-1.5 py-1.5">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-extrabold text-[#16212B]">{col.label}</span>
                  <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">{items.length}</span>
                </div>

                <div className="space-y-2 mt-2">
                  {items.length === 0 && (
                    <div className="p-4 text-center text-slate-300 flex flex-col items-center gap-1">
                      <Inbox className="w-5 h-5" />
                      <span className="text-[10px] font-bold">Vide</span>
                    </div>
                  )}
                  {items.map(r => (
                    <Card key={r.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                      <div>
                        <p className="text-xs font-extrabold text-[#16212B] leading-tight">{r.alumnusName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge className="bg-slate-100 text-slate-600 border-none text-[9px]">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">{r.note}</p>
                      {r.decisionNote && <p className="text-[10px] text-slate-400 italic">Note : {r.decisionNote}</p>}

                      {r.status === 'received' && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button size="sm" disabled={advancing === r.id} onClick={() => advance(r.id, 'accepted')} className="h-7 flex-1 text-[10px] rounded-lg bg-[#17A673] hover:bg-[#149063] text-white font-bold gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Accepter
                          </Button>
                          <Button size="sm" variant="outline" disabled={advancing === r.id} onClick={() => advance(r.id, 'refused')} className="h-7 flex-1 text-[10px] rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 font-bold gap-1">
                            <XCircle className="w-3 h-3" /> Refuser
                          </Button>
                        </div>
                      )}
                      {r.status === 'accepted' && (
                        <Button size="sm" disabled={advancing === r.id} onClick={() => advance(r.id, 'preparing')} className="h-7 w-full text-[10px] rounded-lg bg-[#0066FF] hover:bg-[#0056d6] text-white font-bold gap-1">
                          Préparer <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                      {r.status === 'preparing' && (
                        <Button size="sm" disabled={advancing === r.id} onClick={() => advance(r.id, 'ready')} className="h-7 w-full text-[10px] rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1">
                          Marquer prête <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                      {r.status === 'ready' && (
                        <Button size="sm" disabled={advancing === r.id} onClick={() => advance(r.id, 'taken')} className="h-7 w-full text-[10px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1">
                          Remettre <ArrowRight className="w-3 h-3" />
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
