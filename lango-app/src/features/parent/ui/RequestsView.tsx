'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, FileText, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ParentPageShell, type ParentPageShellContext } from './ParentPageShell';

type RequestRow = {
  id: string;
  requestType: string;
  subject: string;
  body: string | null;
  status: string;
  decisionNotes: string | null;
  createdAt: string | null;
};

type DocumentRow = {
  id: string;
  documentType: string;
  fileExt: string | null;
  uploadedAt: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  profile_correction: 'Correction de fiche',
  leave_permission: 'Permission / sortie',
  document_request: 'Demande de document',
  other: 'Autre',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

const DOC_LABEL: Record<string, string> = {
  photo: 'Photo',
  birth_certificate: 'Acte de naissance',
  school_certificate: "Certificat de scolarité",
  guardian_cni: 'CNI tuteur',
  bulletin: 'Bulletin',
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');

export function RequestsView() {
  return (
    <ParentPageShell
      title="Demandes & documents"
      subtitle="Transmettez vos demandes et consultez les documents de votre enfant."
      icon={<Inbox className="w-6 h-6" />}
    >
      <RequestsContent />
    </ParentPageShell>
  );
}

function RequestsContent({ relationshipId, loading: shellLoading }: Partial<ParentPageShellContext>) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ requestType: 'document_request', subject: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, docRes] = await Promise.all([
        fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/requests`),
        fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/documents`),
      ]);
      const [req, doc] = await Promise.all([reqRes.json(), docRes.json()]);
      if (req.success) setRequests(req.data as RequestRow[]);
      if (doc.success) setDocuments(doc.data as DocumentRow[]);
      if (!req.success || !doc.success) setError('Une partie des données est indisponible.');
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (relationshipId) load(relationshipId);
  }, [relationshipId, load]);

  const submit = useCallback(async () => {
    if (!relationshipId || form.subject.trim().length < 3) return;
    setSubmitting(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(relationshipId)}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: form.requestType,
          subject: form.subject,
          body: form.body || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setForm({ requestType: 'document_request', subject: '', body: '' });
        setFlash('Demande soumise avec succès.');
        load(relationshipId);
      } else {
        setFlash(json.error?.message ?? "Erreur lors de l'envoi.");
      }
    } catch {
      setFlash('Impossible de se connecter au serveur.');
    } finally {
      setSubmitting(false);
    }
  }, [relationshipId, form.requestType, form.subject, form.body, load]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(loading || shellLoading) && requests.length === 0 ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-semibold text-slate-900">Mes demandes</h2>
              </div>
              {requests.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-500">Aucune demande pour le moment.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <div key={r.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm font-semibold text-slate-800">{r.subject}</div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === 'pending' ? 'bg-amber-50 text-amber-700'
                          : r.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                        }`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {TYPE_LABEL[r.requestType] ?? r.requestType} · {fmt(r.createdAt)}
                      </div>
                      {r.body && <p className="mt-2 text-sm text-slate-600">{r.body}</p>}
                      {r.decisionNotes && (
                        <p className="mt-2 text-sm text-slate-500 italic">Note : {r.decisionNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-semibold text-slate-900">Nouvelle demande</h2>
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-500 font-medium">Type</span>
                  <select
                    value={form.requestType}
                    onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {Object.entries(TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-500 font-medium">Objet</span>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Objet de la demande (3 caractères min.)"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-500 font-medium">Détails (optionnel)</span>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={3}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !relationshipId}
                  className="w-full px-4 py-2 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50"
                >
                  {submitting ? 'Envoi…' : 'Soumettre'}
                </button>
                {flash && (
                  <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${flash.includes('succès') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{flash}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Documents scolaires</h2>
            </div>
            {documents.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucun document enregistré.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                {documents.map((d) => (
                  <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-semibold text-slate-800 text-sm">{DOC_LABEL[d.documentType] ?? d.documentType}</div>
                    <div className="mt-1 text-xs text-slate-500">{fmt(d.uploadedAt)} · {d.fileExt ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
