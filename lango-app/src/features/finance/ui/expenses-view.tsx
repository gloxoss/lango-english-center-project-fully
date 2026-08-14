'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Upload, Check, Download, Paperclip, FileText, CheckCircle2, Clock, AlertCircle, TrendingUp, Search
} from 'lucide-react';

type ExpenseStatus = 'En attente' | 'À valider' | 'Approuvée' | 'Remboursée';

type ExpenseRequest = {
  id: string;
  date: string;
  ref: string;
  category: string;
  supplier: string;
  amount: number;
  attachmentsCount: number;
  status: ExpenseStatus;
};

const INITIAL_EXPENSE_REQUESTS: ExpenseRequest[] = [
  { id: '1', date: '30/05/2025', ref: 'DEP-2025-0109', category: 'Fournitures de bureau', supplier: 'Marjane Marketplace', amount: 1250.00, attachmentsCount: 2, status: 'En attente' },
  { id: '2', date: '29/05/2025', ref: 'DEP-2025-0108', category: 'Maintenance', supplier: 'Techno Clim', amount: 4800.00, attachmentsCount: 3, status: 'En attente' },
  { id: '3', date: '29/05/2025', ref: 'DEP-2025-0107', category: 'Transport scolaire', supplier: 'STS Transport', amount: 8750.00, attachmentsCount: 1, status: 'À valider' },
  { id: '4', date: '28/05/2025', ref: 'DEP-2025-0106', category: 'Fournitures scolaires', supplier: 'Librairie Papeterie Najah', amount: 3640.00, attachmentsCount: 1, status: 'Approuvée' },
  { id: '5', date: '28/05/2025', ref: 'DEP-2025-0105', category: 'Services généraux', supplier: 'Lydec (Électricité)', amount: 2125.75, attachmentsCount: 1, status: 'Approuvée' },
  { id: '6', date: '27/05/2025', ref: 'DEP-2025-0104', category: 'Pédagogie', supplier: 'Edukash', amount: 6900.00, attachmentsCount: 1, status: 'Approuvée' },
  { id: '7', date: '27/05/2025', ref: 'DEP-2025-0103', category: 'Entretien & nettoyage', supplier: 'Maroc Clean', amount: 1950.00, attachmentsCount: 1, status: 'Remboursée' },
];

const ACCOUNTING_PIECES = [
  { date: '30/05/2025', type: 'Facture', ref: 'FACT-2025-1458', supplier: 'Marjane Marketplace', amount: 1250.00, status: 'En attente' as ExpenseStatus },
  { date: '29/05/2025', type: 'Facture', ref: 'FACT-2025-1457', supplier: 'Techno Clim', amount: 4800.00, status: 'En attente' as ExpenseStatus },
  { date: '29/05/2025', type: 'Facture', ref: 'FACT-2025-1456', supplier: 'STS Transport', amount: 8750.00, status: 'À valider' as ExpenseStatus },
  { date: '28/05/2025', type: 'Facture', ref: 'FACT-2025-1455', supplier: 'Librairie Papeterie Najah', amount: 3640.00, status: 'Approuvée' as ExpenseStatus },
  { date: '28/05/2025', type: 'Facture', ref: 'FACT-2025-1454', supplier: 'Lydec (Électricité)', amount: 2125.75, status: 'Approuvée' as ExpenseStatus },
];

const CASH_DEPOSITS = [
  { date: '30/05/2025 10:15', label: 'Frais de scolarité – Mai', by: 'Khadija B.', amount: 9250.00 },
  { date: '30/05/2025 09:42', label: 'Frais d\'inscription', by: 'Khadija B.', amount: 3700.00 },
  { date: '29/05/2025 16:35', label: 'Activités parascolaires', by: 'Khadija B.', amount: 2100.00 },
];

const BANK_DEPOSITS = [
  { date: '29/05/2025', bank: 'BMCE – Compte Courant', ref: 'DEP-2025-0058', amount: 27500.00 },
  { date: '27/05/2025', bank: 'Attijariwafa Bank', ref: 'DEP-2025-0057', amount: 15800.00 },
  { date: '26/05/2025', bank: 'BMCE – Compte Courant', ref: 'DEP-2025-0056', amount: 12400.00 },
];

const CATEGORY_BREAKDOWN = [
  { name: 'Transport scolaire', amount: 21770.00, pct: 34.7, color: 'bg-blue-600' },
  { name: 'Pédagogie', amount: 13800.00, pct: 22.0, color: 'bg-emerald-500' },
  { name: 'Maintenance', amount: 9600.00, pct: 15.3, color: 'bg-teal-400' },
  { name: 'Fournitures scolaires', amount: 7890.00, pct: 12.6, color: 'bg-amber-400' },
  { name: 'Fournitures de bureau', amount: 5020.50, pct: 8.0, color: 'bg-[#2487B8]' },
  { name: 'Autres', amount: 2700.00, pct: 4.3, color: 'bg-slate-300' },
];

function getStatusBadge(status: ExpenseStatus) {
  switch (status) {
    case 'En attente': return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    case 'À valider': return 'bg-[#DCEBF4] text-[#1B6C93] hover:bg-[#DCEBF4]';
    case 'Approuvée': return 'bg-[#DDF5EC] text-[#17A673] hover:bg-[#DDF5EC]';
    case 'Remboursée': return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
  }
}

export function ExpensesView({ locale: _locale }: { locale?: string }) {
  const [requests, setRequests] = useState<ExpenseRequest[]>(INITIAL_EXPENSE_REQUESTS);
  const [selectedReqId, setSelectedReqId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous les status');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [newExpense, setNewExpense] = useState({
    supplier: '',
    category: 'Fournitures de bureau',
    amount: 1000,
  });

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesSearch = r.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'Tous les status' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  const activeReq = useMemo(() => {
    return requests.find((r) => r.id === selectedReqId) || requests[0]!;
  }, [requests, selectedReqId]);

  const handleCreateExpense = () => {
    if (!newExpense.supplier.trim()) return;
    const created: ExpenseRequest = {
      id: `dep-${Date.now()}`,
      date: 'Aujourd\'hui',
      ref: `DEP-2025-0${requests.length + 110}`,
      category: newExpense.category,
      supplier: newExpense.supplier.trim(),
      amount: newExpense.amount || 1000,
      attachmentsCount: 1,
      status: 'En attente',
    };
    setRequests((prev) => [created, ...prev]);
    setSelectedReqId(created.id);
    setNewExpense({ supplier: '', category: 'Fournitures de bureau', amount: 1000 });
    setIsAddModalOpen(false);
    setFeedbackMsg(`Nouvelle dépense "${created.ref}" créée avec succès !`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleValidateActive = () => {
    setRequests((prev) =>
      prev.map((r) => (r.id === activeReq.id ? { ...r, status: 'Approuvée' as ExpenseStatus } : r))
    );
    setFeedbackMsg(`Dépense "${activeReq.ref}" validée et approuvée !`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Dépôts, dépenses &amp; pièces comptables</h1>
          <p className="text-xs text-slate-500 mt-1">Suivez les dépôts, validez les dépenses et centralisez les justificatifs.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle dépense
          </Button>
          <Button
            onClick={handleValidateActive}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#17A673] hover:bg-[#138A5F] text-white gap-1.5 font-bold shadow-sm"
          >
            <Check className="w-3.5 h-3.5" /> Valider la sélection
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Dépôts du jour</p>
            <p className="text-xl font-extrabold text-[#16212B]">18 450,00 MAD</p>
            <p className="text-[10px] font-semibold text-slate-500">3 opérations</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Dépenses totales</p>
            <p className="text-xl font-extrabold text-[#16212B]">{requests.length} demandes</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Suivi centralisé</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">En attente</p>
            <p className="text-xl font-extrabold text-[#16212B]">{requests.filter(r => r.status === 'En attente').length}</p>
            <p className="text-[10px] font-bold text-amber-600">À valider</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Approuvées</p>
            <p className="text-xl font-extrabold text-[#16212B]">{requests.filter(r => r.status === 'Approuvée').length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Dépenses validées</p>
          </div>
        </Card>
      </div>

      {/* Main Grid: 3 Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols): Cash & Bank Deposits */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Derniers dépôts en caisse</h2>
            </div>
            <div className="space-y-3">
              {CASH_DEPOSITS.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between pb-2 border-b border-slate-100 last:border-none last:pb-0">
                  <div>
                    <p className="text-[10px] font-medium text-slate-400">{item.date}</p>
                    <p className="text-xs font-bold text-[#16212B]">{item.label}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Reçu par : {item.by}</p>
                  </div>
                  <span className="text-xs font-extrabold text-[#17A673]">{item.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Derniers dépôts bancaires</h2>
            </div>
            <div className="space-y-3">
              {BANK_DEPOSITS.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between pb-2 border-b border-slate-100 last:border-none last:pb-0">
                  <div>
                    <p className="text-[10px] font-medium text-slate-400">{item.date}</p>
                    <p className="text-xs font-bold text-[#16212B]">{item.bank}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Réf. : {item.ref}</p>
                  </div>
                  <span className="text-xs font-extrabold text-[#17A673]">{item.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center Column (6 cols): Expense Requests & Accounting Pieces */}
        <div className="xl:col-span-6 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Demandes de dépenses</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-36"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2 h-8"
                >
                  <option>Tous les status</option>
                  <option>En attente</option>
                  <option>À valider</option>
                  <option>Approuvée</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Référence</th>
                    <th className="pb-2">Catégorie</th>
                    <th className="pb-2">Fournisseur</th>
                    <th className="pb-2 text-right">Montant</th>
                    <th className="pb-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedReqId(req.id)}
                      className={`cursor-pointer transition-colors ${selectedReqId === req.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-2.5 text-slate-500 text-[11px] whitespace-nowrap">{req.date}</td>
                      <td className="py-2.5 font-mono text-[11px] font-bold text-slate-700">{req.ref}</td>
                      <td className="py-2.5 text-[11px] text-slate-600">{req.category}</td>
                      <td className="py-2.5 font-bold text-[#16212B]">{req.supplier}</td>
                      <td className="py-2.5 text-right font-extrabold text-[#16212B] whitespace-nowrap">{req.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                      <td className="py-2.5 text-right">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border-none ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Dernières pièces comptables</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Référence</th>
                    <th className="pb-2">Fournisseur</th>
                    <th className="pb-2 text-right">Montant (MAD)</th>
                    <th className="pb-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {ACCOUNTING_PIECES.map((piece, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2 text-slate-500 text-[11px]">{piece.date}</td>
                      <td className="py-2 font-semibold text-slate-600 text-[11px]">{piece.type}</td>
                      <td className="py-2 font-mono text-[11px] font-bold text-[#2487B8]">{piece.ref}</td>
                      <td className="py-2 font-bold text-[#16212B]">{piece.supplier}</td>
                      <td className="py-2 text-right font-extrabold text-[#16212B]">{piece.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 text-right">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border-none ${getStatusBadge(piece.status)}`}>
                          {piece.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column (3 cols): Selected Document Inspector */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <h2 className="text-xs font-extrabold text-[#16212B]">Détail de la dépense</h2>

            {activeReq ? (
              <>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#2487B8] truncate">{activeReq.ref}</p>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{activeReq.supplier}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs border-b border-slate-100 pb-3">
                  <div className="flex justify-between"><span className="text-slate-500">Catégorie</span><span className="font-bold text-[#16212B]">{activeReq.category}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date du document</span><span className="font-bold text-[#16212B]">{activeReq.date}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Montant TTC</span><span className="font-extrabold text-[#16212B]">{activeReq.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Statut</span><span className="font-bold text-emerald-700">{activeReq.status}</span></div>
                </div>

                <Button
                  onClick={handleValidateActive}
                  className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Approuver la dépense
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucune dépense sélectionnée.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer une nouvelle demande de dépense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Fournisseur / Beneficiaire *</label>
              <Input
                placeholder="ex: Marjane / Papeterie Central"
                value={newExpense.supplier}
                onChange={(e) => setNewExpense({ ...newExpense, supplier: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Catégorie</label>
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
              >
                <option>Fournitures de bureau</option>
                <option>Maintenance</option>
                <option>Transport scolaire</option>
                <option>Fournitures scolaires</option>
                <option>Pédagogie</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Montant TTC (MAD)</label>
              <Input
                type="number"
                placeholder="1000"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) || 0 })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateExpense} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Enregistrer la dépense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const ExpensesManagementView = ExpensesView;

