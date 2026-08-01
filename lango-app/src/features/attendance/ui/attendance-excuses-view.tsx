'use client';

import { CheckCircle2, Clock, Download, Eye, FileText, Mail, Phone, Search, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/shared/data-table';

type ExcuseStatus = 'pending' | 'approved' | 'rejected';

type ApiExcuse = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  reason: string;
  documentUrl: string | null;
  documentFileExt: string | null;
  status: ExcuseStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
};

const STATUS_LABELS: Record<ExcuseStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status: ExcuseStatus) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-[#DCEBF4] text-[#1B6C93]">Approuvée</Badge>;
    case 'rejected':
      return <Badge className="bg-[#FCE4E2] text-[#E5544B]">Refusée</Badge>;
    default:
      return <Badge className="bg-[#FCF0DC] text-[#E8A33D]">En attente</Badge>;
  }
}

export function AttendanceExcusesView({ locale: _locale }: { locale: string }) {
  const [excuses, setExcuses] = useState<ApiExcuse[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'all' | ExcuseStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [actioning, setActioning] = useState(false);

  const [selected, setSelected] = useState<ApiExcuse | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  async function loadExcuses() {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/excuses');
      const json = await res.json();
      if (json.success) {
        setExcuses(json.data);
      }
    } catch (err) {
      console.error('Failed loading excuses', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExcuses();
  }, []);

  async function reviewExcuse(excuseId: string, status: 'approved' | 'rejected', reason?: string) {
    setActioning(true);
    try {
      const res = await fetch('/api/attendance/excuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excuseId, status, rejectionReason: reason }),
      });
      const json = await res.json();
      if (json.success) {
        setSelected(null);
        setShowRejectForm(false);
        setRejectionReason('');
        await loadExcuses();
      }
    } catch (err) {
      console.error('Excuse review failed', err);
    } finally {
      setActioning(false);
    }
  }

  const filtered = excuses.filter((exc) => {
    const matchesStatus = statusTab === 'all' || exc.status === statusTab;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || exc.studentName.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = excuses.filter(e => e.status === 'pending').length;
  const approvedCount = excuses.filter(e => e.status === 'approved').length;
  const rejectedCount = excuses.filter(e => e.status === 'rejected').length;

  const columns: Column<ApiExcuse>[] = [
    {
      key: 'studentName',
      header: 'Élève',
      cell: exc => <span className="font-bold text-[#16212B]">{exc.studentName}</span>,
    },
    {
      key: 'date',
      header: 'Date absence',
      cell: exc => <span className="font-mono text-slate-600">{formatDate(exc.date)}</span>,
    },
    {
      key: 'reason',
      header: 'Motif',
      cell: exc => <span className="text-slate-700 line-clamp-2 max-w-xs">{exc.reason}</span>,
    },
    {
      key: 'documentUrl',
      header: 'Document',
      cell: exc => (exc.documentUrl
        ? (
            <span className="inline-flex items-center gap-1 text-[#2487B8] font-semibold">
              <FileText className="w-3.5 h-3.5" />
              Joint
            </span>
          )
        : <span className="text-slate-400">Aucun document</span>),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: exc => getStatusBadge(exc.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: exc => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelected(exc)}
          className="h-8 rounded-full px-3 text-[11px] font-bold gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          Examiner
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Justificatifs d'absence</h1>
        <p className="text-xs text-slate-500 mt-1">Examinez et validez les demandes de justification soumises par les élèves et tuteurs.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">En attente</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Approuvées</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{approvedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Refusées</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{rejectedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`h-9 rounded-full px-4 text-xs font-bold transition-colors ${
                statusTab === tab
                  ? 'bg-[#0066FF] text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'all' ? 'Toutes' : STATUS_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un élève..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-xs bg-slate-50 border-none rounded-full"
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        emptyTitle="Aucune demande trouvée"
        emptyDescription="Aucune demande de justification ne correspond à vos filtres."
        exportFilename="justificatifs-absence"
      />

      {/* Review drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-slate-900/40" onClick={() => { setSelected(null); setShowRejectForm(false); }} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#16212B]">Réviser le justificatif</h2>
              <button type="button" onClick={() => { setSelected(null); setShowRejectForm(false); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-11 h-11 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold flex items-center justify-center">
                {selected.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-bold text-[#16212B] text-sm">{selected.studentName}</p>
                <p className="text-[11px] text-slate-500">
                  Absence du
                  {' '}
                  {formatDate(selected.date)}
                </p>
              </div>
              <div className="ml-auto">{getStatusBadge(selected.status)}</div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Motif de l'absence</p>
              <p className="text-xs text-slate-700">{selected.reason}</p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Contact parent</p>
              {selected.guardianName
                ? (
                    <div className="space-y-1 text-xs text-slate-700">
                      <p className="font-semibold">{selected.guardianName}</p>
                      {selected.guardianPhone && (
                        <p className="flex items-center gap-1.5 text-slate-500">
                          <Phone className="w-3.5 h-3.5" />
                          {selected.guardianPhone}
                        </p>
                      )}
                      {selected.guardianEmail && (
                        <p className="flex items-center gap-1.5 text-slate-500">
                          <Mail className="w-3.5 h-3.5" />
                          {selected.guardianEmail}
                        </p>
                      )}
                    </div>
                  )
                : <p className="text-xs text-slate-400">Aucun tuteur lié à cet élève.</p>}
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Document fourni</p>
              {selected.documentUrl
                ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">
                        {selected.documentFileExt?.toUpperCase() ?? 'Fichier'}
                      </span>
                      <a href={selected.documentUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      <a href={selected.documentUrl} download className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )
                : <p className="text-xs text-slate-400">Aucun document joint.</p>}
            </div>

            {selected.status !== 'pending' && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {selected.status === 'approved' ? 'Approuvée' : 'Refusée'}
                  {' '}
                  le
                </p>
                <p className="text-xs text-slate-700">{selected.reviewedAt ? formatDateTime(selected.reviewedAt) : '—'}</p>
                {selected.rejectionReason && (
                  <p className="text-xs text-rose-600 mt-1">
                    Motif du refus :
                    {' '}
                    {selected.rejectionReason}
                  </p>
                )}
              </div>
            )}

            {selected.status === 'pending' && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                {showRejectForm
                  ? (
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-700">Motif du refus (obligatoire)</label>
                        <textarea
                          value={rejectionReason}
                          onChange={e => setRejectionReason(e.target.value)}
                          rows={3}
                          maxLength={500}
                          placeholder="Expliquez clairement la raison du refus..."
                          className="w-full px-3 py-2 text-xs bg-rose-50 border border-rose-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400"
                        />
                        <p className="text-[10px] text-slate-400">Si ce justificatif est refusé, l'absence restera non justifiée pour cet élève.</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={actioning || rejectionReason.trim().length < 3}
                            onClick={() => reviewExcuse(selected.id, 'rejected', rejectionReason.trim())}
                            className="flex-1 h-9 rounded-lg text-xs bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            Confirmer le refus
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)} className="h-9 rounded-lg text-xs">
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )
                  : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={actioning}
                          onClick={() => reviewExcuse(selected.id, 'approved')}
                          className="flex-1 h-9 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Approuver la justification
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actioning}
                          onClick={() => setShowRejectForm(true)}
                          className="h-9 rounded-lg text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          Refuser
                        </Button>
                      </div>
                    )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
