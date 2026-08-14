'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Inbox } from 'lucide-react';

type RequestRow = { id: string; alumnusId: string; alumnusName: string; type: string; status: string; note: string; decisionNote: string | null; createdAt: string };

const TYPE_LABELS: Record<string, string> = {
  correction: 'Correction', reissue: 'Réémission', data_access: 'Accès aux données', deletion: 'Suppression',
};
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', approved: 'bg-[#DDF5EC] text-[#17A673]', rejected: 'bg-rose-100 text-rose-600',
};

export function AlumniRequestsView() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = () => {
    const params = statusFilter === 'pending' ? '?status=pending' : '';
    fetch(`/api/students/alumni/requests${params}`).then(r => r.json()).then(j => j?.success && setRows(j.data));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
    setDeciding(id);
    try {
      await fetch(`/api/students/alumni/requests/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      load();
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Demandes Anciens Élèves</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setStatusFilter('pending')} className={`h-9 px-3 rounded-xl text-xs font-bold ${statusFilter === 'pending' ? 'bg-[#2487B8] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>En attente</button>
          <button onClick={() => setStatusFilter('all')} className={`h-9 px-3 rounded-xl text-xs font-bold ${statusFilter === 'all' ? 'bg-[#2487B8] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Toutes</button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
            <Inbox className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucune demande.</p>
          </Card>
        )}
        {rows.map(r => (
          <Card key={r.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#16212B]">{r.alumnusName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-slate-100 text-slate-600 border-none text-[10px]">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                  <Badge className={`${STATUS_BADGE[r.status]} border-none text-[10px]`}>{r.status}</Badge>
                </div>
              </div>
              {r.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" disabled={deciding === r.id} onClick={() => handleDecide(r.id, 'approved')} className="h-8 rounded-lg bg-[#17A673] hover:bg-[#149063] text-white text-xs font-bold gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                  </Button>
                  <Button size="sm" variant="outline" disabled={deciding === r.id} onClick={() => handleDecide(r.id, 'rejected')} className="h-8 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Rejeter
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-2">{r.note}</p>
            {r.decisionNote && <p className="text-[10px] text-slate-400 mt-1">Note : {r.decisionNote}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
