'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, AlertTriangle, CalendarDays, HandHelping, Loader2, Package, Plus, Search, Undo2,
} from 'lucide-react';

type Row = {
  id: string; issueNumber: string; storeId: string; storeName: string;
  issueToRole: 'student' | 'staff' | 'guest';
  studentId: string | null; studentName: string | null; issueToName: string | null;
  issueDate: string; dueDate: string; returnDate: string | null;
  status: 'issued' | 'returned' | 'overdue' | 'lost' | 'damaged';
  isOverdue: boolean; recordedById: string | null; createdAt: string; updatedAt: string;
};

type StoreRef = { id: string; name: string; code: string | null; status: string };
type ProductRef = { id: string; name: string; code: string; salePrice: number | null };
type StudentRef = { id: string; fullName: string };

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_LABEL: Record<Row['status'], string> = {
  issued: 'En cours', returned: 'Retourné', overdue: 'En retard', lost: 'Perdu', damaged: 'Abîmé',
};
const STATUS_VARIANT: Record<Row['status'], 'warning' | 'success' | 'danger' | 'neutral'> = {
  issued: 'warning', returned: 'success', overdue: 'danger', lost: 'neutral', damaged: 'neutral',
};
const ROLE_LABEL: Record<Row['issueToRole'], string> = { student: 'Étudiant', staff: 'Personnel', guest: 'Comptoir' };

type LineForm = { productId: string; qty: string };

export function IssuesView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [returnTarget, setReturnTarget] = useState<Row | null>(null);
  const [returnDisposition, setReturnDisposition] = useState<'returned' | 'damaged' | 'lost'>('returned');
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  const [form, setForm] = useState({
    storeId: '', issueToRole: 'student', studentId: '', issueToName: '',
    issueDate: today(), dueDate: today(),
  });
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', qty: '1' }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (roleFilter) qs.set('issueToRole', roleFilter);
    const res = await api<Row[]>(`/api/addons/inventory/issues?${qs.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setRows(
        search.trim()
          ? res.data.filter(r => `${r.issueNumber} ${r.storeName} ${r.issueToName ?? ''} ${r.studentName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
          : res.data,
      );
    } else setError(res.error?.message ?? 'Chargement impossible.');
    setLoading(false);
  }, [search, statusFilter, roleFilter]);

  const loadRefs = useCallback(async () => {
    const [storeRes, prodRes, stuRes] = await Promise.all([
      api<StoreRef[]>('/api/addons/inventory/stores?status=active'),
      api<ProductRef[]>('/api/addons/inventory/products?status=active'),
      api<StudentRef[]>('/api/students'),
    ]);
    if (storeRes.ok && Array.isArray(storeRes.data)) setStores(storeRes.data);
    if (prodRes.ok && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    if (stuRes.ok && Array.isArray(stuRes.data)) setStudents(stuRes.data.filter(s => s.id && s.fullName));
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => { loadRefs().catch(() => {}); }, [loadRefs]);

  const counts = useMemo(() => ({
    total: rows.length,
    issued: rows.filter(r => r.status === 'issued' || r.isOverdue).length,
    returned: rows.filter(r => r.status === 'returned').length,
    lost: rows.filter(r => r.status === 'lost' || r.status === 'damaged').length,
  }), [rows]);

  const customerLabel = (row: Row) => row.issueToRole === 'student' ? (row.studentName ?? row.studentId ?? '—') : (row.issueToName ?? '—');

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const openCreate = () => {
    setForm({ storeId: '', issueToRole: 'student', studentId: '', issueToName: '', issueDate: today(), dueDate: today() });
    setLines([{ productId: '', qty: '1' }]);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.storeId || !form.issueDate || !form.dueDate) return;
    if (form.issueToRole === 'student' && !form.studentId) return;
    if (form.issueToRole !== 'student' && !form.issueToName.trim()) return;
    const validLines = lines.filter(l => l.productId && l.qty.trim());
    if (validLines.length === 0) return;
    setSaving(true);
    setError(null);
    const body = {
      storeId: form.storeId,
      issueToRole: form.issueToRole,
      studentId: form.issueToRole === 'student' ? form.studentId : null,
      issueToName: form.issueToRole === 'student' ? null : form.issueToName.trim(),
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      lines: validLines.map(l => ({ productId: l.productId, qty: l.qty.trim() })),
    };
    const res = await api('/api/addons/inventory/issues', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(res.error?.message ?? 'Enregistrement impossible.');
    }
  };

  const submitReturn = async () => {
    if (!returnTarget) return;
    setReturning(true);
    setError(null);
    const res = await api(`/api/addons/inventory/issues/${returnTarget.id}/return`, {
      method: 'POST',
      body: JSON.stringify({ disposition: returnDisposition, reason: returnReason.trim() || null }),
    });
    setReturning(false);
    if (res.ok) {
      setReturnTarget(null);
      setReturnReason('');
      setReturnDisposition('returned');
      await load();
    } else {
      setError(res.error?.message ?? 'Retour impossible.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Prêts &amp; sorties</h1>
          <p className="text-sm text-slate-500">Équipement prêté à un étudiant, au personnel ou au comptoir.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nouveau prêt</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><HandHelping className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Prêts</p><p className="text-2xl font-bold text-[#16212B]">{counts.total}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Package className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">En cours</p><p className="text-2xl font-bold text-[#16212B]">{counts.issued}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Undo2 className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Retournés</p><p className="text-2xl font-bold text-[#16212B]">{counts.returned}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">Perdus / Abîmés</p><p className="text-2xl font-bold text-[#16212B]">{counts.lost}</p></div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher (N°, bénéficiaire, magasin)…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="issued">En cours</SelectItem>
                <SelectItem value="returned">Retourné</SelectItem>
                <SelectItem value="lost">Perdu</SelectItem>
                <SelectItem value="damaged">Abîmé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter || 'all'} onValueChange={v => setRoleFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tous les bénéficiaires" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les bénéficiaires</SelectItem>
                <SelectItem value="student">Étudiant</SelectItem>
                <SelectItem value="staff">Personnel</SelectItem>
                <SelectItem value="guest">Comptoir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucun prêt trouvé.</div>
          ) : (
            rows.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Package className="h-5 w-5" /></div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#16212B]">
                      {row.issueNumber}
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      <Badge variant={ROLE_LABEL[row.issueToRole] === 'Étudiant' ? 'info' : 'neutral'}>{ROLE_LABEL[row.issueToRole]}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      {customerLabel(row)} · {row.storeName} · Sorti le {fmtDate(row.issueDate)} · Échéance {fmtDate(row.dueDate)}
                      {row.returnDate && ` · Retour le ${fmtDate(row.returnDate)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {row.isOverdue
                      ? <p className="text-sm font-bold text-red-600">En retard</p>
                      : <p className="text-xs text-slate-400"><CalendarDays className="mr-1 inline h-3 w-3" />Échéance {fmtDate(row.dueDate)}</p>}
                  </div>
                  {(row.status === 'issued' || row.isOverdue) && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setReturnTarget(row); setReturnDisposition('returned'); setReturnReason(''); }}>
                        <Undo2 className="mr-1 h-4 w-4" /> Retourner
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau prêt</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Magasin *</label>
                <Select value={form.storeId} onValueChange={v => setForm({ ...form, storeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bénéficiaire *</label>
                <Select value={form.issueToRole} onValueChange={v => setForm({ ...form, issueToRole: v, studentId: '', issueToName: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Étudiant</SelectItem>
                    <SelectItem value="staff">Personnel</SelectItem>
                    <SelectItem value="guest">Comptoir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.issueToRole === 'student' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Étudiant *</label>
                <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.id})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom du bénéficiaire *</label>
                <Input value={form.issueToName} onChange={e => setForm({ ...form, issueToName: e.target.value })} placeholder="Nom du bénéficiaire" />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date de sortie *</label>
                <Input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Échéance de retour *</label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lignes *</label>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={line.productId} onValueChange={v => updateLine(i, { productId: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Produit" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min={0} step="0.001" className="w-24" placeholder="Qté"
                      value={line.qty}
                      onChange={e => updateLine(i, { qty: e.target.value })}
                    />
                    <Button
                      variant="ghost" size="icon" disabled={lines.length === 1}
                      onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setLines(prev => [...prev, { productId: '', qty: '1' }])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
                </Button>
              </div>
            </div>

            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={save}
              disabled={saving || !form.storeId || !form.issueDate || !form.dueDate
                || (form.issueToRole === 'student' ? !form.studentId : !form.issueToName.trim())
                || !lines.some(l => l.productId && l.qty.trim())}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Créer le prêt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnTarget} onOpenChange={o => !o && setReturnTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Retourner {returnTarget?.issueNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Disposition *</label>
              <Select value={returnDisposition} onValueChange={v => setReturnDisposition(v as 'returned' | 'damaged' | 'lost')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="returned">Retourné en bon état</SelectItem>
                  <SelectItem value="damaged">Retourné abîmé</SelectItem>
                  <SelectItem value="lost">Perdu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Motif (optionnel)</label>
              <Textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} rows={2} placeholder="Observations…" />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>Annuler</Button>
            <Button onClick={submitReturn} disabled={returning}>
              {returning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {returnDisposition === 'returned' ? 'Valider le retour' : returnDisposition === 'damaged' ? 'Marquer abîmé' : 'Marquer perdu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
