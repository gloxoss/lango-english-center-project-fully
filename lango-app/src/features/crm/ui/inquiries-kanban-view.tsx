'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type InquiryStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

type Inquiry = {
  id: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
  source: string;
  interestLevel: string;
  status: InquiryStatus;
  assignedToId?: string | null;
  notes?: string | null;
  createdAt: string;
};

const COLUMNS: { key: InquiryStatus; label: string; color: string; dot: string }[] = [
  { key: 'new', label: 'Nouveau', color: 'border-blue-500/30 bg-blue-900/10', dot: 'bg-blue-400' },
  { key: 'contacted', label: 'Contacté', color: 'border-amber-500/30 bg-amber-900/10', dot: 'bg-amber-400' },
  { key: 'qualified', label: 'Qualifié', color: 'border-violet-500/30 bg-violet-900/10', dot: 'bg-violet-400' },
  { key: 'converted', label: 'Converti', color: 'border-emerald-500/30 bg-emerald-900/10', dot: 'bg-emerald-400' },
  { key: 'lost', label: 'Perdu', color: 'border-slate-500/30 bg-slate-900/10', dot: 'bg-slate-500' },
];

const SOURCE_LABELS: Record<string, string> = {
  walk_in: 'Sur place',
  phone: 'Téléphone',
  web: 'Web',
  referral: 'Recommandation',
};

const INTEREST_COLORS: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-400',
  high: 'bg-emerald-400',
};

function InquiryCard({
  inquiry,
  onDragStart,
}: {
  inquiry: Inquiry;
  onDragStart: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(inquiry.id)}
      className="cursor-grab rounded-xl border border-slate-700/40 bg-slate-800/60 p-3 shadow transition hover:border-slate-600/60 hover:bg-slate-800/90 active:cursor-grabbing"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{inquiry.contactName}</p>
        <span
          title={`Intérêt: ${inquiry.interestLevel}`}
          className={`mt-1 size-2 shrink-0 rounded-full ${INTEREST_COLORS[inquiry.interestLevel] ?? 'bg-slate-400'}`}
        />
      </div>
      {inquiry.phone && (
        <p className="text-xs text-slate-400">{inquiry.phone}</p>
      )}
      <div className="mt-2">
        <span className="rounded-full border border-slate-600/40 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
          {SOURCE_LABELS[inquiry.source] ?? inquiry.source}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  cards,
  onDragStart,
  onDrop,
}: {
  col: (typeof COLUMNS)[number];
  cards: Inquiry[];
  onDragStart: (id: string) => void;
  onDrop: (targetStatus: InquiryStatus) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex min-h-48 w-60 shrink-0 flex-col rounded-2xl border p-3 transition ${col.color} ${dragOver ? 'ring-2 ring-white/20' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDrop(col.key); }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`size-2 rounded-full ${col.dot}`} />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-300">{col.label}</p>
        <span className="ml-auto rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">{cards.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {cards.map(c => (
          <InquiryCard key={c.id} inquiry={c} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

type FormState = {
  contactName: string;
  phone: string;
  source: string;
  interestLevel: string;
  notes: string;
};

const BLANK_FORM: FormState = { contactName: '', phone: '', source: 'walk_in', interestLevel: 'medium', notes: '' };

export function InquiriesKanbanView() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const draggingId = useRef<string | null>(null);

  const fetchInquiries = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/inquiries?pageSize=100');
      const data = await res.json();
      if (data.success) setInquiries(data.data);
      else setError(data.error?.message ?? 'Erreur chargement');
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInquiries(); }, [fetchInquiries]);

  async function handleDrop(targetStatus: InquiryStatus) {
    const id = draggingId.current;
    if (!id) return;
    const inquiry = inquiries.find(i => i.id === id);
    if (!inquiry || inquiry.status === targetStatus) return;

    // Optimistic update
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: targetStatus } : i));

    try {
      const res = await fetch(`/api/crm/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        // Rollback
        setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: inquiry.status } : i));
        setError(data.error?.message ?? 'Erreur mise à jour');
      }
    } catch {
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: inquiry.status } : i));
      setError('Erreur réseau');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contactName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: form.contactName.trim(),
          phone: form.phone.trim() || undefined,
          source: form.source,
          interestLevel: form.interestLevel,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInquiries(prev => [data.data, ...prev]);
        setForm(BLANK_FORM);
        setShowForm(false);
      } else {
        setError(data.error?.message ?? 'Erreur création');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Chargement du pipeline…</p>;
  }

  const byStatus = (status: InquiryStatus) => inquiries.filter(i => i.status === status);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Pipeline CRM</h2>
          <p className="text-xs text-slate-400">Glissez les cartes pour changer de statut</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          + Nouveau prospect
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-2xl border border-violet-500/20 bg-slate-900/60 p-5 backdrop-blur-md"
        >
          <h3 className="mb-4 font-semibold text-white">Nouveau prospect</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Nom *</label>
              <input
                required
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
                placeholder="Nom complet"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Téléphone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
                placeholder="+212 6xx xxx xxx"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Source</label>
              <select
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
              >
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Niveau d'intérêt</label>
              <select
                value={form.interestLevel}
                onChange={e => setForm(f => ({ ...f, interestLevel: e.target.value }))}
                className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
                placeholder="Notes optionnelles"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {submitting ? 'Création…' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}
              className="rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.key}
            col={col}
            cards={byStatus(col.key)}
            onDragStart={(id) => { draggingId.current = id; }}
            onDrop={(status) => void handleDrop(status)}
          />
        ))}
      </div>
    </div>
  );
}
