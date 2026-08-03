'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare, Phone } from 'lucide-react';

type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  dueDate: string;
  netAmount: number;
  paidAmount: number;
  status: string;
};

function daysOverdue(dueDate: string): number {
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function RemindersStatementsView({ locale: _locale }: { locale?: string } = {}) {
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = () => {
    fetch('/api/finance/reminders')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setInvoices(json.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleSend = async (invoiceId: string) => {
    setSendingId(invoiceId);
    try {
      const res = await fetch('/api/finance/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      if (res.ok) {
        setSentIds(prev => new Set(prev).add(invoiceId));
      }
    } catch (err) {
      console.error('Failed to send reminder', err);
    } finally {
      setSendingId(null);
    }
  };

  const filtered = invoices.filter(r => r.studentName.toLowerCase().includes(search.toLowerCase()));
  const totalDueSum = invoices.reduce((acc, r) => acc + (r.netAmount - r.paidAmount), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Relances impayés</h1>
          <p className="text-xs text-slate-500 mt-1">Factures en retard de paiement, relance par SMS (simulé, journalisé).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-rose-200/60 bg-rose-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#E5544B]">Total impayés à recouvrer</p>
          <p className="text-2xl font-extrabold text-[#E5544B]">{totalDueSum.toLocaleString('fr-FR')} MAD</p>
          <p className="text-[10px] text-slate-400">{invoices.length} facture(s) en retard</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-500">Relances envoyées cette session</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{sentIds.size}</p>
        </Card>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher par élève..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center text-xs text-slate-400">
            Aucune facture en retard.
          </Card>
        )}
        {filtered.map((r) => {
          const balance = r.netAmount - r.paidAmount;
          const alreadySent = sentIds.has(r.id);
          return (
            <Card key={r.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#16212B]">{r.studentName}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FCE4E2] text-[#E5544B]">
                      {daysOverdue(r.dueDate)}
                      {' '}
                      jour(s) de retard
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Facture
                    {' '}
                    {r.invoiceNumber}
                    {' '}
                    · échéance
                    {' '}
                    {r.dueDate}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-[#E5544B]">{balance.toLocaleString('fr-FR')} MAD</p>
                    <p className="text-[10px] text-slate-400">Solde dû</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={sendingId === r.id || alreadySent}
                    onClick={() => handleSend(r.id)}
                    className="h-8 px-3 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1"
                  >
                    {alreadySent ? <Phone className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                    {alreadySent ? 'Relance envoyée' : 'Relancer par SMS'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
