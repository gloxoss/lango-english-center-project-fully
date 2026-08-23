'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Phone, Mail, AlertCircle, Printer } from 'lucide-react';

type ApiInvoiceDetail = {
  id: string;
  studentId: string;
  invoiceNumber: string;
  studentName: string;
  studentPhone: string | null;
  studentEmail: string;
  className: string | null;
  amount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  issueDate: string;
  note: string | null;
  items: { id: string; description: string; amount: number }[];
  payments: { id: string; amount: number; paymentMethod: string; paymentDate: string; referenceId: string | null }[];
  guardian: { firstName: string; lastName: string; phone: string | null; email: string | null; relationshipType: string } | null;
};

const STATUS_LABELS: Record<ApiInvoiceDetail['status'], string> = {
  paid: 'Payée',
  partial: 'Partiellement payée',
  pending: 'En attente',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

function formatMad(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`;
}

export function InvoiceDetailView({ locale, invoiceId }: { locale: string; invoiceId: string }) {
  const [invoice, setInvoice] = useState<ApiInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/finance/invoices?id=${invoiceId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || 'Facture introuvable.');
          return;
        }
        setInvoice(json.data);
      } catch (err) {
        console.error('Failed loading invoice detail', err);
        setError('Connexion impossible. Vérifiez votre réseau.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  if (loading) {
    return <div className="max-w-[1600px] mx-auto text-sm text-slate-500">Chargement...</div>;
  }

  if (error || !invoice) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error ?? 'Facture introuvable.'}</span>
        </div>
      </div>
    );
  }

  const balance = Math.max(0, invoice.netAmount - invoice.paidAmount);
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href={`/${locale}/dashboard/finance/invoices`} className="hover:text-[#2487B8]">Finances</Link>
          <span>/</span>
          <span>Factures</span>
          <span>/</span>
          <span className="font-bold text-[#16212B]">{invoice.invoiceNumber}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 h-9 rounded-full px-4 text-xs">
          <Printer className="w-3.5 h-3.5" />
          <span>Imprimer / PDF</span>
        </Button>
      </div>

      {/* Header Info Card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-6 text-xs">
          <div>
            <h1 className="text-xl font-extrabold text-[#16212B]">Détail de la facture</h1>
            <p className="font-bold text-slate-500 font-mono mt-1">{invoice.invoiceNumber}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 font-medium">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                {invoice.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-[#16212B]">{invoice.studentName}</p>
                <p className="text-[11px] text-slate-400">{invoice.className ?? 'Non classé'}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Date d&apos;émission</p>
              <p className="font-bold text-[#16212B]">{new Date(`${invoice.issueDate}T00:00:00`).toLocaleDateString('fr-FR')}</p>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Date d&apos;échéance</p>
              <p className="font-bold text-[#16212B]">{new Date(`${invoice.dueDate}T00:00:00`).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          <Badge className={
            invoice.status === 'paid' ? 'bg-[#DCEBF4] text-[#1B6C93] px-3 py-1 text-xs'
              : invoice.status === 'overdue' ? 'bg-[#FCE4E2] text-[#E5544B] px-3 py-1 text-xs'
                : 'bg-[#FCF0DC] text-[#E8A33D] px-3 py-1 text-xs'
          }
          >
            {STATUS_LABELS[invoice.status]}
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-extrabold text-xs text-[#16212B]">Détails de la facture</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoice.items.length === 0 && (
                    <tr>
                      <td className="py-3 px-4 font-bold text-[#16212B]">{invoice.note ?? 'Frais de scolarité'}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#16212B]">{formatMad(invoice.amount)}</td>
                    </tr>
                  )}
                  {invoice.items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#16212B]">{item.description}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#16212B]">{formatMad(item.amount)}</td>
                    </tr>
                  ))}
                  {invoice.discountAmount > 0 && (
                    <tr>
                      <td className="py-3 px-4 font-bold text-emerald-700">Remise</td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-700">-{formatMad(invoice.discountAmount)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-[#F6F9FC] border-t border-slate-200/80 font-extrabold text-xs text-[#16212B]">
                  <tr>
                    <td className="py-3.5 px-4 text-right">Total</td>
                    <td className="py-3.5 px-4 text-right text-[#2487B8] text-sm">{formatMad(invoice.netAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Payment History */}
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-extrabold text-xs text-[#16212B]">Historique des paiements</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Référence</th>
                    <th className="py-3 px-4">Méthode</th>
                    <th className="py-3 px-4 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoice.payments.length === 0 && (
                    <tr><td colSpan={4} className="py-6 px-4 text-center text-slate-400">Aucun paiement enregistré.</td></tr>
                  )}
                  {invoice.payments.map(pm => (
                    <tr key={pm.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600">{new Date(pm.paymentDate).toLocaleString('fr-FR')}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{pm.referenceId ?? '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{pm.paymentMethod}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#16212B]">{formatMad(pm.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {invoice.payments.length > 0 && (
                  <tfoot className="bg-[#F6F9FC] border-t border-slate-200/80 font-extrabold text-xs">
                    <tr>
                      <td colSpan={3} className="py-3.5 px-4 text-right text-[#16212B]">Total payé</td>
                      <td className="py-3.5 px-4 text-right text-emerald-600 text-sm font-bold">{formatMad(totalPaid)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>

        {/* Right Section */}
        <div className="space-y-6 text-xs">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#16212B]">Récapitulatif</h3>
            <div className="space-y-2 font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>Total de la facture</span>
                <span className="font-bold text-[#16212B]">{formatMad(invoice.netAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Montant payé</span>
                <span className="font-bold text-emerald-600">{formatMad(invoice.paidAmount)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-extrabold">
                <span className="text-[#16212B]">Solde restant</span>
                <span className="text-rose-600">{formatMad(balance)}</span>
              </div>
            </div>

            {balance > 0 && (
              <Link href={`/${locale}/dashboard/finance/payments/new?studentId=${invoice.studentId}`}>
                <Button variant="primary" size="md" className="w-full gap-2 rounded-xl">
                  <CreditCard className="w-4 h-4" />
                  <span>Enregistrer un paiement</span>
                </Button>
              </Link>
            )}
          </Card>

          {invoice.guardian && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Informations du parent</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-bold text-sm">
                  {invoice.guardian.firstName[0]}{invoice.guardian.lastName[0]}
                </div>
                <div>
                  <p className="font-bold text-[#16212B]">{invoice.guardian.firstName} {invoice.guardian.lastName}</p>
                  <p className="text-[11px] text-slate-400">{invoice.guardian.relationshipType}</p>
                </div>
              </div>
              <div className="space-y-2 text-slate-600 font-medium">
                {invoice.guardian.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{invoice.guardian.phone}</span>
                  </div>
                )}
                {invoice.guardian.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{invoice.guardian.email}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
