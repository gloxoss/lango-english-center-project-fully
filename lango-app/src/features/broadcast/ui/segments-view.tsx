'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, Users, AlertCircle, X, Trash2,
} from 'lucide-react';
import { api, fmtDate, fmtCount, RECIPIENT_KIND_LABELS } from './broadcast-ui';

type SegmentDefinition = {
  kind: string;
  filters?: Record<string, unknown>;
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  memberCount: number | null;
  lastComputedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const KINDS = ['inquiry', 'student', 'guardian', 'staff', 'alumni', 'external'];

const KIND_FILTERS: Record<string, { key: string; label: string; values: string[] }[]> = {
  inquiry: [
    { key: 'status', label: 'Statut', values: ['new', 'contacted', 'qualified', 'converted', 'lost'] },
    { key: 'source', label: 'Source', values: ['walk_in', 'phone', 'web', 'referral', 'facebook_ads', 'google_ads'] },
    { key: 'interestLevel', label: 'Intérêt', values: ['low', 'medium', 'high'] },
  ],
  student: [
    { key: 'role', label: 'Rôle', values: ['student'] },
    { key: 'userStatus', label: 'Statut', values: ['active', 'inactive', 'archived'] },
    { key: 'contactByGuardian', label: 'Contact', values: ['guardian'] },
  ],
  staff: [
    { key: 'userStatus', label: 'Statut', values: ['active', 'inactive', 'archived'] },
  ],
  guardian: [
    { key: 'hasPhone', label: 'Téléphone', values: ['yes', 'no'] },
    { key: 'hasEmail', label: 'E-mail', values: ['yes', 'no'] },
  ],
  alumni: [
    { key: 'userStatus', label: 'Statut', values: ['active', 'inactive', 'archived'] },
  ],
};

const FILTER_LABELS: Record<string, string> = {
  status: 'Statut', source: 'Source', interestLevel: 'Intérêt', assignedToId: 'Responsable',
  tag: 'Étiquette', role: 'Rôle', userStatus: 'Statut', classSectionId: 'Section',
  branchId: 'Succursale', hasPhone: 'Téléphone', hasEmail: 'E-mail', contactByGuardian: 'Contact tuteur',
};

export function SegmentsView() {
  const [rows, setRows] = useState<Segment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('inquiry');
  const [tag, setTag] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Segment[]>('/api/addons/broadcast/segments');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error?.message ?? 'Impossible de charger les segments.');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async (s: Segment) => {
    // updateSegment recomputes memberCount; re-send the stored definition unchanged.
    await api(`/api/addons/broadcast/segments/${s.id}`, {
      method: 'PUT', body: JSON.stringify({ name: s.name, description: s.description, definition: s.definition }),
    });
    load();
  };

  const del = async (id: string) => {
    await api(`/api/addons/broadcast/segments/${id}`, { method: 'DELETE' });
    load();
  };

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const definition: SegmentDefinition = { kind, filters: { ...filters } };
    if (tag.trim()) definition.filters = { ...definition.filters, tag: tag.trim() };
    if (kind === 'student') definition.filters = { ...definition.filters, role: 'student', contactByGuardian: filters.contactByGuardian === 'guardian' };
    const res = await api<Segment>('/api/addons/broadcast/segments', {
      method: 'POST',
      body: JSON.stringify({ name, description, definition }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName(''); setDescription(''); setTag(''); setFilters({}); setKind('inquiry');
      load();
    } else {
      setFormError(res.error?.message ?? 'Création impossible.');
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement des segments…</div>;
  }

  if (error && !rows) {
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error}
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  const activeFilters = KIND_FILTERS[kind] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Segments d’audience</h1>
          <p className="text-sm text-slate-500">Audiences ciblées, calculées en direct à l’approbation d’une campagne.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Nouveau segment</Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">Nouveau segment</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Parents de nouveaux inscrits" />
            </div>
            <div>
              <Label>Type d’audience</Label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {KINDS.map((k) => <option key={k} value={k}>{RECIPIENT_KIND_LABELS[k]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Étiquette (facultatif)</Label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ex. : rentrée-2026" />
            </div>
            {activeFilters.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <select
                  value={filters[f.key] ?? ''}
                  onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Tous</option>
                  {f.values.map((v) => (
                    <option key={v} value={v}>
                      {f.key === 'source' ? v.replace(/_/g, ' ') : f.key === 'status' && kind === 'inquiry' ? (v === 'new' ? 'Nouveau' : v === 'contacted' ? 'Contacté' : v === 'qualified' ? 'Qualifié' : v === 'converted' ? 'Converti' : 'Perdu') : v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />} Créer le segment
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucun segment. Créez une audience pour lancer une campagne.
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Filtres</th>
                <th className="px-4 py-3">Membres</th>
                <th className="px-4 py-3">Calculé</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-[#16212B]">{s.name}</td>
                  <td className="px-4 py-3"><Badge className="border border-slate-200 bg-slate-50 text-slate-700">{RECIPIENT_KIND_LABELS[s.definition?.kind] ?? s.definition?.kind}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {Object.entries(s.definition?.filters ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${FILTER_LABELS[k] ?? k}: ${String(v)}`).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#16212B]">{fmtCount(s.memberCount)}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(s.lastComputedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => refresh(s)}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Recalculer</Button>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-rose-600" onClick={() => del(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
