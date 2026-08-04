'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Banknote } from 'lucide-react';

type BankAccount = { id: string; bankName: string; accountNumber: string; currency: string; currentBalance: string };
type Reconciliation = { id: string; statementDate: string; statementBalance: string; reconciledBalance: string; status: string };

export function BankReconciliationView({ locale: _locale }: { locale?: string } = {}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [reconciledBalance, setReconciledBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/finance/bank-reconciliation')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setAccounts(json.data.accounts);
          if (json.data.accounts[0]) {
            setAccountId(json.data.accounts[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadReconciliations = (id: string) => {
    fetch(`/api/finance/bank-reconciliation?bankAccountId=${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setReconciliations(json.data.reconciliations);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (accountId) {
      loadReconciliations(accountId);
    }
  }, [accountId]);

  const handleCreate = async () => {
    if (!accountId || !statementDate || !statementBalance || !reconciledBalance) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/finance/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId: accountId, statementDate, statementBalance, reconciledBalance }),
      });
      if (res.ok) {
        setStatementDate('');
        setStatementBalance('');
        setReconciledBalance('');
        loadReconciliations(accountId);
      }
    } catch (err) {
      console.error('Failed to create reconciliation', err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Rapprochement bancaire</h1>
        <p className="text-xs text-slate-500 mt-1">Enregistrez le rapprochement entre le solde du relevé bancaire et le solde comptable, par compte.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comptes bancaires</h3>
          {accounts.length === 0 && <p className="text-xs text-slate-500">Aucun compte bancaire configuré.</p>}
          {accounts.map(a => (
            <button
              type="button"
              key={a.id}
              onClick={() => setAccountId(a.id)}
              className={`w-full text-left p-3 rounded-xl text-xs flex items-center gap-2 ${accountId === a.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-transparent'}`}
            >
              <Banknote className="w-4 h-4 text-[#2487B8] shrink-0" />
              <div>
                <p className="font-bold text-[#16212B]">{a.bankName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{a.accountNumber} · {Number(a.currentBalance).toLocaleString('fr-FR')} {a.currency}</p>
              </div>
            </button>
          ))}
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Nouveau rapprochement{selectedAccount ? ` — ${selectedAccount.bankName}` : ''}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Date du relevé</label>
              <Input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Solde relevé (MAD)</label>
              <Input type="number" value={statementBalance} onChange={e => setStatementBalance(e.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Solde comptable (MAD)</label>
              <Input type="number" value={reconciledBalance} onChange={e => setReconciledBalance(e.target.value)} className="h-9 rounded-xl" />
            </div>
          </div>
          <Button
            size="sm"
            disabled={isSaving || !accountId}
            onClick={handleCreate}
            className="h-9 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4" />
            Enregistrer le rapprochement
          </Button>
        </Card>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Date relevé</th>
                <th className="py-3.5 px-4 text-right">Solde relevé</th>
                <th className="py-3.5 px-4 text-right">Solde comptable</th>
                <th className="py-3.5 px-4 text-right">Écart</th>
                <th className="py-3.5 px-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliations.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aucun rapprochement enregistré pour ce compte.</td></tr>
              )}
              {reconciliations.map((r) => {
                const gap = Number(r.statementBalance) - Number(r.reconciledBalance);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition font-medium">
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{r.statementDate}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(r.statementBalance).toLocaleString('fr-FR')}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(r.reconciledBalance).toLocaleString('fr-FR')}</td>
                    <td className={`py-3.5 px-4 text-right font-bold ${gap === 0 ? 'text-[#17A673]' : 'text-[#E5544B]'}`}>{gap.toLocaleString('fr-FR')}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${gap === 0 ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-amber-100 text-amber-700'}`}>
                        {gap === 0 ? 'Équilibré' : 'Écart'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
