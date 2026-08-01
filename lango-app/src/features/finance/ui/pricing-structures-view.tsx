'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Wallet, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

type ApiFeeStructure = {
  id: string;
  name: string;
  amount: number;
  description: string | null;
  isActive: boolean;
};

function formatMad(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`;
}

export function PricingStructuresView() {
  const [structures, setStructures] = useState<ApiFeeStructure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStructure, setNewStructure] = useState({ name: '', amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  async function loadStructures() {
    try {
      const res = await fetch('/api/finance/fee-structures?pageSize=100');
      const json = await res.json();
      if (json.success) {
        setStructures(json.data);
      }
    } catch (err) {
      console.error('Failed loading fee structures', err);
    }
  }

  useEffect(() => {
    loadStructures();
  }, []);

  async function handleCreate() {
    const amount = Number.parseFloat(newStructure.amount);
    if (!newStructure.name || !amount || amount < 0) {
      setError('Nom et montant valide sont requis.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/fee-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStructure.name, amount, ...(newStructure.description ? { description: newStructure.description } : {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la création.');
        return;
      }
      setSuccess(json.message);
      setIsAddOpen(false);
      setNewStructure({ name: '', amount: '', description: '' });
      await loadStructures();
    } catch (err) {
      console.error('Fee structure create failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s: ApiFeeStructure) {
    setError(null);
    try {
      const res = await fetch('/api/finance/fee-structures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, isActive: !s.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la mise à jour.');
        return;
      }
      await loadStructures();
    } catch (err) {
      console.error('Fee structure toggle failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/finance/fee-structures?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la suppression.');
        return;
      }
      await loadStructures();
    } catch (err) {
      console.error('Fee structure delete failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Structures tarifaires</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les plans tarifaires de l&apos;établissement.</p>
        </div>
        <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl px-4" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Créer une structure tarifaire</span>
        </Button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-3">Nom</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Montant</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {structures.length === 0 && (
                <tr><td colSpan={5} className="py-8 px-4 text-center text-slate-400">Aucune structure tarifaire.</td></tr>
              )}
              {structures.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-bold text-[#16212B]">{row.name}</td>
                  <td className="py-3 px-3 text-slate-500">{row.description ?? '—'}</td>
                  <td className="py-3 px-3 font-extrabold text-[#2487B8]">{formatMad(row.amount)}</td>
                  <td className="py-3 px-3">
                    <button onClick={() => handleToggleActive(row)}>
                      <Badge className={row.isActive ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'bg-slate-100 text-slate-500'}>
                        {row.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button onClick={() => handleDelete(row.id)} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B] flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Nouvelle structure tarifaire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom *</label>
              <Input value={newStructure.name} onChange={e => setNewStructure({ ...newStructure, name: e.target.value })} placeholder="Ex. Scolarité Collège 2026" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Montant (MAD) *</label>
              <Input type="number" min="0" step="0.01" value={newStructure.amount} onChange={e => setNewStructure({ ...newStructure, amount: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description (optionnel)</label>
              <Input value={newStructure.description} onChange={e => setNewStructure({ ...newStructure, description: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" disabled={saving} onClick={handleCreate} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">{saving ? 'Création...' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
