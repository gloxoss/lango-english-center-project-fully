'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Wallet,
  CreditCard,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Eye,
  Download,
} from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type StudentOption = { id: string; fullName: string; matricule: string };

type ApiInvoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  className: string | null;
  guardianName: string | null;
  amount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  issueDate: string;
  note: string | null;
};

const STATUS_LABELS: Record<ApiInvoice['status'], string> = {
  paid: 'Payé',
  partial: 'Partiel',
  pending: 'En attente',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

function formatMad(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function InvoicesListView({ locale }: { locale: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Tous les statuts');
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [form, setForm] = useState({ amount: '', discountAmount: '', dueDate: '', note: '' });
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadInvoices() {
    try {
      const res = await fetch('/api/finance/invoices');
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data);
      }
    } catch (err) {
      console.error('Failed loading invoices', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    const term = studentQuery.trim();
    if (term.length < 2) {
      setStudentResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(term)}&pageSize=5`);
        const json = await res.json();
        if (json.success) {
          setStudentResults(json.data.map((s: any) => ({ id: s.id, fullName: s.fullName, matricule: s.matricule })));
        }
      } catch (err) {
        console.error('Student search failed', err);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [studentQuery]);

  function resetCreateForm() {
    setSelectedStudent(null);
    setStudentQuery('');
    setStudentResults([]);
    setForm({ amount: '', discountAmount: '', dueDate: '', note: '' });
    setCreateError(null);
  }

  async function handleCreateInvoice() {
    setCreateError(null);
    if (!selectedStudent) {
      setCreateError('Sélectionnez un élève.');
      return;
    }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setCreateError('Montant invalide.');
      return;
    }
    if (!form.dueDate) {
      setCreateError('Échéance requise.');
      return;
    }
    try {
      const res = await fetch('/api/finance/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          amount,
          discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
          dueDate: form.dueDate,
          note: form.note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCreateError(json.message || 'Échec de la création de la facture.');
        return;
      }
      setIsCreateOpen(false);
      resetCreateForm();
      await loadInvoices();
    } catch (err) {
      console.error('Invoice creation failed', err);
      setCreateError('Connexion impossible.');
    }
  }

  const filtered = invoices.filter((inv) => {
    const matchesStatus = selectedStatus === 'Tous les statuts' || STATUS_LABELS[inv.status] === selectedStatus;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term
      || (inv.invoiceNumber ?? '').toLowerCase().includes(term)
      || (inv.studentName ?? '').toLowerCase().includes(term)
      || (inv.guardianName ?? '').toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.netAmount, 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalPending = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + (inv.netAmount - inv.paidAmount), 0);
  const totalOverdue = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.netAmount - inv.paidAmount), 0);

  const getStatusBadge = (status: ApiInvoice['status']) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-[#DCEBF4] text-[#1B6C93]">Payé</Badge>;
      case 'partial':
        return <Badge className="bg-[#FCF0DC] text-[#E8A33D]">Partiel</Badge>;
      case 'pending':
        return <Badge variant="neutral">En attente</Badge>;
      case 'overdue':
        return <Badge className="bg-[#FCE4E2] text-[#E5544B]">En retard</Badge>;
      default:
        return <Badge variant="neutral">{STATUS_LABELS[status] ?? status}</Badge>;
    }
  };

  const columns: Column<ApiInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'N° Facture',
      cell: (inv) => (
        <Link href={`/${locale}/dashboard/finance/invoices/${inv.id}`} className="font-mono font-bold text-[#16212B] hover:text-[#2487B8] hover:underline">
          {inv.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'studentName',
      header: 'Élève & Classe',
      cell: (inv) => (
        <div>
          <p className="font-bold text-[#16212B]">{inv.studentName}</p>
          <p className="text-[10px] text-slate-400">{inv.className ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'guardianName',
      header: 'Tuteur',
      cell: (inv) => <span className="text-slate-700">{inv.guardianName ?? '—'}</span>,
    },
    {
      key: 'issueDate',
      header: 'Date émission',
      cell: (inv) => <span className="text-slate-500">{formatDate(inv.issueDate)}</span>,
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      cell: (inv) => <span className="font-mono text-slate-600">{formatDate(inv.dueDate)}</span>,
    },
    {
      key: 'netAmount',
      header: 'Montant total',
      cell: (inv) => <span className="font-extrabold text-[#16212B]">{formatMad(inv.netAmount)}</span>,
    },
    {
      key: 'paidAmount',
      header: 'Payé',
      cell: (inv) => <span className="font-bold text-emerald-600">{formatMad(inv.paidAmount)}</span>,
    },
    {
      key: 'remaining',
      header: 'Reste',
      cell: (inv) => <span className="font-bold text-rose-600">{formatMad(Math.max(0, inv.netAmount - inv.paidAmount))}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (inv) => getStatusBadge(inv.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-center',
      cell: (inv) => (
        <div className="flex items-center justify-center gap-1">
          <Link href={`/${locale}/dashboard/finance/invoices/${inv.id}`}>
            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#2487B8]" title="Voir 360 Facture">
              <Eye className="w-4 h-4" />
            </button>
          </Link>
          <Link href={`/${locale}/dashboard/finance/invoices/${inv.id}`} title="Imprimer / PDF">
            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
              <Download className="w-4 h-4" />
            </button>
          </Link>
        </div>
      ),
      className: 'text-center',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Facturation & Appel de fond</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les appels de cotisations, le suivi des encaissements et les impayés.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2 h-10 rounded-full px-4 text-xs">
            <Plus className="w-4 h-4" />
            <span>Nouvelle facture</span>
          </Button>

          <Link href={`/${locale}/dashboard/finance/payments/new`}>
            <Button variant="outline" size="sm" className="gap-2 h-10 rounded-full px-4 bg-white text-xs">
              <CreditCard className="w-4 h-4 text-[#2487B8]" />
              <span>Enregistrer un paiement</span>
            </Button>
          </Link>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[150px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tous les statuts">Tous les statuts</SelectItem>
              <SelectItem value="Payé">Payé</SelectItem>
              <SelectItem value="Partiel">Partiel</SelectItem>
              <SelectItem value="En attente">En attente</SelectItem>
              <SelectItem value="En retard">En retard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4 Financial Health KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Total facturé</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(totalInvoiced)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Total encaissé</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(totalCollected)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">En attente</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(totalPending)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">En retard</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{formatMad(totalOverdue)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Search & Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative min-w-[280px] flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par N° facture, élève, tuteur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-full"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(filtered, 'factures-export')}
          className="gap-2 h-10 rounded-full px-4 text-xs font-bold border-slate-200"
        >
          <Download className="w-4 h-4" /> Exporter CSV
        </Button>
      </div>

      {/* Dynamic DataTable Component */}
      <DataTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        emptyTitle="Aucune facture trouvée"
        emptyDescription="Aucune facture ne correspond à vos filtres ou terme de recherche."
        defaultPageSize={10}
      />

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Nouvelle facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            {createError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{createError}</div>
            )}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Élève *</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between h-9 px-3 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="font-bold text-[#16212B]">{selectedStudent.fullName}</span>
                  <button type="button" onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-rose-600 text-[10px] font-bold">Changer</button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={studentQuery}
                    onChange={e => setStudentQuery(e.target.value)}
                    placeholder="Rechercher un élève par nom ou matricule..."
                    className="h-9 text-xs rounded-xl"
                  />
                  {studentResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {studentResults.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSelectedStudent(s); setStudentResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[11px]"
                        >
                          <p className="font-bold text-[#16212B]">{s.fullName}</p>
                          <p className="text-slate-400 font-mono">{s.matricule}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Montant (MAD) *</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="Ex. 3500"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Remise (MAD)</label>
                <Input
                  type="number"
                  value={form.discountAmount}
                  onChange={e => setForm({ ...form, discountAmount: e.target.value })}
                  placeholder="0"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Échéance *</label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Note</label>
              <Input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Ex. Frais de scolarité - Trimestre 2"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleCreateInvoice} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Créer la facture</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { InvoicesListView as InvoicesFinanceView };
