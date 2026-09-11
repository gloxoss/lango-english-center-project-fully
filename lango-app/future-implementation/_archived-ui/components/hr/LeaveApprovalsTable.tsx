'use client';

import React, { useEffect, useState } from 'react';

type LeaveRequest = {
  id: string;
  employeeName: string;
  categoryName: string;
  startDate: string;
  endDate: string;
  daysRequested: string;
  status: string;
  reason?: string | null;
  createdAt: string;
};

export function LeaveApprovalsTable() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/leave/requests?status=pending');
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch {
      setError('Erreur lors du chargement des demandes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRequests();
  }, []);

  async function review(id: string, action: 'approved' | 'rejected') {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/hr/leave/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchRequests();
      } else {
        setError(data.error?.message ?? 'Erreur lors de la révision.');
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-6 backdrop-blur-md">
        <p className="text-sm text-slate-400">Chargement des demandes de congé…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-900/20 to-slate-900 p-6 shadow-lg backdrop-blur-md">
      <h2 className="mb-4 text-lg font-bold text-white">Demandes de Congé en Attente</h2>

      {error && (
        <p className="mb-3 rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {requests.length === 0
        ? (
            <p className="text-sm text-slate-400">Aucune demande en attente.</p>
          )
        : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Employé</th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Catégorie</th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Dates</th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Jours</th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {requests.map(req => (
                    <tr key={req.id} className="group hover:bg-slate-800/30">
                      <td className="py-3 font-medium text-white">{req.employeeName}</td>
                      <td className="py-3 text-slate-300">{req.categoryName}</td>
                      <td className="py-3 text-slate-300">
                        {req.startDate}
                        {' '}
                        →
                        {' '}
                        {req.endDate}
                      </td>
                      <td className="py-3 text-slate-300">
                        {Number(req.daysRequested)}
                        {' '}
                        j
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={reviewingId === req.id}
                            onClick={() => void review(req.id, 'approved')}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Approuver
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === req.id}
                            onClick={() => void review(req.id, 'rejected')}
                            className="rounded-lg bg-red-700/70 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            Refuser
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}
