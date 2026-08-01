'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CreditCard, CheckCircle2, Printer, AlertCircle } from 'lucide-react';
import { authClient } from '@/libs/auth-client';

type ApiInvoice = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  className: string | null;
  netAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
};

type ApiPayment = {
  id: string;
  studentName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
};

const PAYMENT_METHODS: { value: 'cash' | 'card' | 'transfer' | 'check'; label: string }[] = [
  { value: 'cash', label: 'Espèces' },
  { value: 'transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
  { value: 'card', label: 'TPE' },
];

function formatMad(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`;
}

export function PaymentEntryView() {
  const { data: session } = authClient.useSession();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<ApiPayment[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'check'>('cash');
  const [referenceId, setReferenceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        fetch('/api/finance/invoices'),
        fetch('/api/finance/payments?pageSize=5'),
      ]);
      const invoicesJson = await invoicesRes.json();
      const paymentsJson = await paymentsRes.json();
      if (invoicesJson.success) {
        setInvoices(invoicesJson.data.filter((inv: ApiInvoice) => inv.status !== 'paid' && inv.status !== 'cancelled'));
      }
      if (paymentsJson.success) {
        setRecentPayments(paymentsJson.data);
      }
    } catch (err) {
      console.error('Failed loading payment entry data', err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedInvoice = useMemo(() => invoices.find(inv => inv.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);
  const balance = selectedInvoice ? Math.max(0, selectedInvoice.netAmount - selectedInvoice.paidAmount) : 0;
  const enteredAmount = Number.parseFloat(amount) || 0;
  const remainingAfter = Math.max(0, balance - enteredAmount);

  async function handleSave() {
    if (!selectedInvoice || enteredAmount <= 0) {
      setError('Sélectionnez une facture et saisissez un montant valide.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          amount: enteredAmount,
          paymentMethod,
          ...(referenceId.trim() ? { referenceId: referenceId.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de l\'enregistrement du paiement.');
        return;
      }
      setSuccess(json.message || 'Paiement enregistré avec succès.');
      setAmount('');
      setReferenceId('');
      setSelectedInvoiceId('');
      await loadData();
    } catch (err) {
      console.error('Payment save failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Breadcrumb & Title */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <span>Finances</span>
          <span>/</span>
          <span className="font-bold text-[#16212B]">Enregistrer un paiement</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Enregistrer un paiement</h1>
        <p className="text-xs text-slate-500 mt-0.5">Sélectionnez une facture et saisissez le paiement reçu.</p>
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

      {/* Invoice Selector */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 text-xs">
        <label className="text-[11px] font-bold text-slate-600">Facture à régler *</label>
        <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
          <SelectTrigger className="w-full rounded-xl h-10 bg-slate-50 border-slate-200">
            <SelectValue placeholder="Sélectionnez une facture avec solde dû..." />
          </SelectTrigger>
          <SelectContent>
            {invoices.map(inv => (
              <SelectItem key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.studentName} — {formatMad(Math.max(0, inv.netAmount - inv.paidAmount))} dû
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedInvoice && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Élève</p>
              <p className="font-bold text-[#16212B]">{selectedInvoice.studentName}</p>
              <p className="text-[10px] text-slate-400">{selectedInvoice.className ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Solde dû</p>
              <p className="text-lg font-extrabold text-rose-600">{formatMad(balance)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Échéance</p>
              <p className="font-bold text-[#16212B]">{new Date(`${selectedInvoice.dueDate}T00:00:00`).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <Badge className={selectedInvoice.status === 'overdue' ? 'bg-rose-100 text-rose-800' : 'bg-[#FCF0DC] text-[#E8A33D]'}>
                {selectedInvoice.status === 'overdue' ? 'En retard' : selectedInvoice.status === 'partial' ? 'Partiel' : 'En attente'}
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Main Grid: Payment Form / Right Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 text-xs">
            <h3 className="font-extrabold text-[#16212B]">Informations du paiement</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Montant payé *</label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pr-12 h-9 text-xs font-bold bg-slate-50 border-slate-200 rounded-xl"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[11px]">MAD</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Encaissé par</label>
                <Input disabled value={session?.user?.name ?? '—'} className="h-9 text-xs font-bold bg-slate-100 border-slate-200 rounded-xl text-slate-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Mode de paiement *</label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                      paymentMethod === m.value
                        ? 'bg-[#DCEBF4] border-[#2487B8] text-[#1B6C93] shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">Référence / N° reçu (optionnel)</label>
              <Input value={referenceId} onChange={e => setReferenceId(e.target.value)} className="h-9 text-xs font-mono bg-slate-50 border-slate-200 rounded-xl" />
            </div>
          </Card>

          {/* Bottom Actions Bar */}
          <div className="flex items-center justify-end pt-2">
            <Button
              variant="primary"
              size="md"
              className="gap-2 rounded-xl px-6"
              disabled={saving || !selectedInvoice || enteredAmount <= 0}
              onClick={handleSave}
            >
              <Printer className="w-4 h-4" />
              <span>{saving ? 'Enregistrement...' : 'Enregistrer le paiement'}</span>
            </Button>
          </div>
        </div>

        {/* Right Summary & Recent Payments */}
        <div className="space-y-6 text-xs">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#16212B]">Résumé du paiement</h3>
            <div className="space-y-2 font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>Total de la facture</span>
                <span className="font-bold text-[#16212B]">{selectedInvoice ? formatMad(selectedInvoice.netAmount) : '—'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Montant déjà payé</span>
                <span className="font-bold text-slate-600">{selectedInvoice ? formatMad(selectedInvoice.paidAmount) : '—'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paiement saisi</span>
                <span className="font-bold text-[#2487B8]">{formatMad(enteredAmount)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-extrabold">
                <span className="text-[#16212B]">Reste après paiement</span>
                <span className="text-rose-600">{selectedInvoice ? formatMad(remainingAfter) : '—'}</span>
              </div>
            </div>
          </Card>

          {/* Paiements récents */}
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-[#16212B]">Paiements récents</h3>
            <div className="space-y-2.5 font-medium">
              {recentPayments.length === 0 && <p className="text-slate-400 text-[11px]">Aucun paiement enregistré.</p>}
              {recentPayments.map(p => (
                <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-[11px]">
                  <div>
                    <p className="font-bold text-[#16212B]">{p.studentName}</p>
                    <p className="text-[9px] text-slate-400">
                      {new Date(p.paymentDate).toLocaleDateString('fr-FR')} • {PAYMENT_METHODS.find(m => m.value === p.paymentMethod)?.label ?? p.paymentMethod}
                    </p>
                  </div>
                  <span className="font-extrabold text-[#2487B8]">{formatMad(p.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
