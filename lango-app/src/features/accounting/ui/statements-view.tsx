'use client';

import { AlertCircle, ArrowLeft, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type StatementType = 'trial-balance' | 'general-ledger' | 'profit-loss' | 'balance-sheet' | 'cash-flow';

const TYPE_LABEL: Record<StatementType, string> = {
  'trial-balance': 'Balance générale',
  'general-ledger': 'Grand livre',
  'profit-loss': 'Compte de résultat',
  'balance-sheet': 'Bilan',
  'cash-flow': 'Flux de trésorerie',
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  asset: 'Actif', liability: 'Passif', equity: 'Capitaux propres', revenue: 'Produits', expense: 'Charges',
};

type GenericRow = Record<string, string | number | null>;

type Drill = {
  accountId: string;
  code: string;
  name: string;
  lines: GenericRow[];
  runningBalance: string;
  loading: boolean;
  error: string | null;
};

export function StatementsView({ locale = 'fr' }: { locale?: string }) {
  const ar = locale === 'ar';
  const [type, setType] = useState<StatementType>('trial-balance');
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [totals, setTotals] = useState<{ debit: string; credit: string; balanced: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [drill, setDrill] = useState<Drill | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/accounting/accounts?pageSize=100');
      const json = await res.json();
      if (json.success) setAccounts(json.data.map((a: { id: string; code: string; name: string }) => ({ id: a.id, code: a.code, name: a.name })));
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const load = useCallback(async (typeToLoad: StatementType) => {
    setLoading(true);
    setError(null);
    setDrill(null);
    try {
      const url = typeToLoad === 'trial-balance'
        ? `/api/finance/accounting/trial-balance?from=${from}&to=${to}`
        : typeToLoad === 'profit-loss' || typeToLoad === 'balance-sheet'
          ? `/api/finance/accounting/statements/${typeToLoad}?asOf=${to}`
          : `/api/finance/accounting/statements/${typeToLoad}?from=${from}&to=${to}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Chargement de l’état impossible');
      setRows(json.data);
      setMeta(json.meta ?? null);
      setTotals(json.totals ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(type); }, [load, type]);

  const csvUrl = () => {
    const base = type === 'trial-balance'
      ? '/api/finance/accounting/trial-balance'
      : `/api/finance/accounting/statements/${type}`;
    const query = type === 'profit-loss' || type === 'balance-sheet'
      ? `asOf=${to}`
      : type === 'trial-balance'
        ? `from=${from}&to=${to}`
        : `from=${from}&to=${to}`;
    return `${base}?${query}&format=csv`;
  };

  const openDrill = async (accountId: string | undefined, code: string, name: string) => {
    if (!accountId) {
      const match = accounts.find(a => a.code === code);
      if (!match) { setError('Compte introuvable pour le forage.'); return; }
      return openDrill(match.id, code, name);
    }
    setDrill({ accountId, code, name, lines: [], runningBalance: '', loading: true, error: null });
    try {
      const res = await fetch(`/api/finance/accounting/statements/drill-down?accountId=${accountId}&from=${from}&to=${to}&limit=1000`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Forage impossible');
      setDrill({ accountId, code, name, lines: json.data, runningBalance: json.meta?.runningBalance ?? '', loading: false, error: null });
    } catch (cause) {
      setDrill(d => d ? { ...d, loading: false, error: cause instanceof Error ? cause.message : 'Forage impossible' } : d);
    }
  };

  const money = (v: string | number | null | undefined) => Number(v ?? 0).toFixed(2);

  const renderAccountCell = (row: GenericRow) => {
    const code = String(row.accountCode ?? '');
    const name = String(row.accountName ?? '');
    return (
      <button onClick={() => openDrill(row.accountId as string | undefined, code, name)} className="group text-start">
        <span className="block font-bold text-slate-900">{code}</span>
        <span className="block text-[11px] font-medium text-slate-500 group-hover:text-[#0066FF]">{name}</span>
      </button>
    );
  };

  const typeBadge = (row: GenericRow) => (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">{ACCOUNT_TYPE_LABEL[String(row.accountType ?? '')] ?? row.accountType}</span>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ar ? 'القوائم المالية' : 'États financiers'}</h1>
          <p className="text-sm text-slate-500">{ar ? 'ميزان المراجعة ودفتر الأستاذ والنتائج والميزانية والتدفقات النقدية من القيود المرحلة.' : 'Balance, grand livre, résultat, bilan et flux de trésorerie tirés du grand livre comptabilisé — export CSV sur la capacité d’export.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40 text-xs" />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40 text-xs" />
          <Button variant="outline" onClick={() => load(type)} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {ar ? 'تحديث' : 'Actualiser'}
          </Button>
          <Button variant="outline" onClick={() => { const a = document.createElement('a'); a.href = csvUrl(); a.download = ''; a.click(); }}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
        {(Object.keys(TYPE_LABEL) as StatementType[]).map(key => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={`rounded-md px-4 py-2 ${type === key ? 'bg-[#0066FF] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {TYPE_LABEL[key]}
          </button>
        ))}
      </div>

      {totals && (
        <div className={`flex items-center gap-3 rounded-lg border p-3 text-xs font-bold ${totals.balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <FileSpreadsheet className="size-4" />
          Total débit : {totals.debit} · Total crédit : {totals.credit} — {totals.balanced ? 'ÉQUILIBRÉ' : 'DÉSÉQUILIBRÉ'}
        </div>
      )}

      {drill ? (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <button onClick={() => setDrill(null)} className="flex items-center gap-1 text-xs font-bold text-[#0066FF] hover:underline">
                <ArrowLeft className="size-3.5" /> Retour à l’état
              </button>
              <h3 className="mt-1 font-bold text-slate-900">Forage — {drill.code} · {drill.name}</h3>
              <p className="text-xs text-slate-500">Solde courant : {money(drill.runningBalance)} MAD</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Pièce</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3">Débit</th>
                  <th className="px-4 py-3">Crédit</th>
                  <th className="px-4 py-3">Solde cumulé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {drill.lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">{String(l.entryDate)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{String(l.entryNumber)}</td>
                    <td className="px-4 py-3">{String(l.description)}{l.memo ? <span className="ms-1 text-slate-400">— {String(l.memo)}</span> : null}</td>
                    <td className="px-4 py-3">{money(l.debit)}</td>
                    <td className="px-4 py-3">{money(l.credit)}</td>
                    <td className="px-4 py-3 font-bold">{money(l.balance)} MAD</td>
                  </tr>
                ))}
                {drill.loading && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Chargement du forage…</td></tr>}
                {!drill.loading && drill.error && <tr><td colSpan={6} className="p-8 text-center text-red-600">{drill.error}</td></tr>}
                {!drill.loading && !drill.error && drill.lines.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucune ligne sur la période.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="border-b border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">{TYPE_LABEL[type]}</h3>
            <p className="text-xs text-slate-500">
              {meta && `Basis : ${String(meta.basis ?? '')} · Devise : ${String(meta.currency ?? 'MAD')}`}
              {meta?.from ? ` · Du ${String(meta.from)} au ${String(meta.to ?? '')}` : meta?.asOf ? ` · Au ${String(meta.asOf)}` : ''}
              {meta?.result != null ? ` · Résultat : ${money(meta.result as string)}` : ''}
              {meta?.reconciled != null ? ` · Équation ${String(meta.equation ?? '')} : ${String(meta.reconciled)}` : ''}
            </p>
          </div>
          <div className="overflow-x-auto">
            {type === 'cash-flow' ? (
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Section</th><th className="px-4 py-3">Poste</th><th className="px-4 py-3">Montant</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{String(r.section)}</td>
                      <td className={`px-4 py-3 ${String(r.section) === 'total' || String(r.section) === 'treasury' ? 'font-extrabold text-slate-900' : ''}`}>{String(r.label)}</td>
                      <td className="px-4 py-3 font-bold">{money(r.amount)} MAD</td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Aucun flux sur la période.</td></tr>}
                </tbody>
              </table>
            ) : type === 'general-ledger' ? (
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Compte</th><th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Ouverture</th><th className="px-4 py-3">Débit période</th><th className="px-4 py-3">Crédit période</th><th className="px-4 py-3">Mouvement</th><th className="px-4 py-3">Clôture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">{renderAccountCell(r)}</td>
                      <td className="px-4 py-3">{typeBadge(r)}</td>
                      <td className="px-4 py-3">{money(r.openingBalance)}</td>
                      <td className="px-4 py-3">{money(r.periodDebit)}</td>
                      <td className="px-4 py-3">{money(r.periodCredit)}</td>
                      <td className="px-4 py-3 font-bold">{money(r.periodBalance)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{money(r.closingBalance)} MAD</td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucune écriture sur la période.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Compte</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Débit</th><th className="px-4 py-3">Crédit</th><th className="px-4 py-3">Montant</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">{renderAccountCell(r)}</td>
                      <td className="px-4 py-3">{typeBadge(r)}</td>
                      <td className="px-4 py-3">{money(r.debit)}</td>
                      <td className="px-4 py-3">{money(r.credit)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{money(r.amount)} MAD</td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Aucune écriture sur la période.</td></tr>}
                </tbody>
              </table>
            )}
            {loading && <div className="p-8 text-center text-xs text-slate-500">Chargement de l’état…</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
