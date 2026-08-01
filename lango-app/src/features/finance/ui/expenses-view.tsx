'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ShoppingBag, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type ApiExpense = {
  id: string;
  category: 'salary' | 'rent' | 'utilities' | 'supplies' | 'marketing' | 'other';
  amount: number;
  expenseDate: string;
  description: string;
  receiptUrl: string | null;
};

const CATEGORY_LABELS: Record<ApiExpense['category'], string> = {
  salary: 'Salaires',
  rent: 'Loyer',
  utilities: 'Charges',
  supplies: 'Fournitures',
  marketing: 'Marketing',
  other: 'Autre',
};

function formatMad(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`;
}

export function ExpensesManagementView() {
  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string>('Toutes catégories');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'supplies' as ApiExpense['category'],
    expenseDate: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/finance/expenses');
        if (res.ok) {
          const json = await res.json();
          if (json.success) setExpenses(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch expenses', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newExpense.description,
          amount: Number(newExpense.amount),
          category: newExpense.category,
          expenseDate: newExpense.expenseDate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Erreur lors de la création');
        return;
      }
      setSuccess('Dépense enregistrée.');
      setIsAddOpen(false);
      setNewExpense({
        description: '',
        amount: '',
        category: 'supplies',
        expenseDate: new Date().toISOString().slice(0, 10),
      });
      setExpenses(prev => [json.data, ...prev]);
    } catch (err) {
      console.error(err);
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  const filtered = expenses.filter(e => catFilter === 'Toutes catégories' || CATEGORY_LABELS[e.category] === catFilter);

  const columns: Column<ApiExpense>[] = [
    {
      key: 'description',
      header: 'Description',
      cell: (row) => <span className="font-bold text-[#16212B]">{row.description}</span>,
    },
    {
      key: 'category',
      header: 'Catégorie',
      cell: (row) => <Badge variant="neutral" className="text-[10px]">{CATEGORY_LABELS[row.category]}</Badge>,
    },
    {
      key: 'expenseDate',
      header: 'Date',
      cell: (row) => <span className="text-slate-500 font-mono text-[11px]">{new Date(`${row.expenseDate}T00:00:00`).toLocaleDateString('fr-FR')}</span>,
    },
    {
      key: 'amount',
      header: 'Montant',
      cell: (row) => <span className="font-extrabold text-[#16212B]">{formatMad(row.amount)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-center',
      cell: (row) => (
        <button onClick={() => handleDelete(row.id)} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500" title="Supprimer">
          <Trash2 className="w-4 h-4" />
        </button>
      ),
      className: 'text-center',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Gestion des Dépenses</h1>
          <p className="text-xs text-slate-500 mt-1">Suivi et enregistrement des charges de fonctionnement de l&apos;établissement.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered, 'depenses-export')} className="gap-2 h-10 rounded-full px-4 text-xs font-bold border-slate-200">
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)} className="gap-2 h-10 rounded-full px-4 text-xs">
            <Plus className="w-4 h-4" />
            <span>Nouvelle dépense</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs rounded-full border-slate-200"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Toutes catégories">Toutes catégories</SelectItem>
            {Object.values(CATEGORY_LABELS).map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        emptyTitle="Aucune dépense enregistrée"
        emptyDescription="Aucune dépense ne correspond à vos filtres actuels."
        defaultPageSize={10}
      />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Nouvelle dépense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description *</label>
              <Input value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Montant (MAD) *</label>
                <Input type="number" min="0" step="0.01" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} className="h-9 text-xs rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date *</label>
                <Input type="date" value={newExpense.expenseDate} onChange={e => setNewExpense({ ...newExpense, expenseDate: e.target.value })} className="h-9 text-xs rounded-xl" />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Catégorie</label>
              <Select value={newExpense.category} onValueChange={v => setNewExpense({ ...newExpense, category: v as ApiExpense['category'] })}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" disabled={saving} onClick={handleCreate} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
