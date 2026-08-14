'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Banknote, CheckCircle2, FileUp, Landmark, RefreshCw, Scale, ShieldCheck, Split, Trash2, X,
} from 'lucide-react';

type BankAccount = { id: string; bankName: string; accountNumber: string; currency: string; currentBalance: string };
type Reconciliation = { id: string; bankAccountId: string; statementDate: string; statementBalance: string; reconciledBalance: string; status: string };
type Account = { id: string; code: string; name: string; accountType: string };
type StatementLine = { id: string; lineDate: string; description: string; reference: string | null; debitAmount: string; creditAmount: string; status: string };
type MatchRow = { id: string; statementLineId: string; journalLineId: string; matchedAmount: string; matchedById: string; createdAt: string };
type ImportRow = { id: string; filename: string; contentFingerprint: string; rowsImported: number; importedById: string; createdAt: string };
type EventRow = { id: string; eventType: string; actorId: string; reason: string | null; metadata: Record<string, unknown> | null; createdAt: string };
type Detail = {
  reconciliation: Reconciliation;
  lines: StatementLine[];
  matches: MatchRow[];
  imports: ImportRow[];
  events: EventRow[];
};
type JournalLine = { id: string; entryNumber: string; entryDate: string; description: string; debit: string; credit: string; memo: string | null; balance: string };

const money = (v: string | number | null | undefined) => Number(v ?? 0).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!json.success) throw new Error(json.error?.message ?? 'Erreur serveur.');
  return json;
}

function statusBadge(status: string) {
  if (status === 'matched') return <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#DDF5EC] text-[#17A673]">Rapproché</span>;
  if (status === 'partial') return <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Partiel</span>;
  return <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Non rapproché</span>;
}

function ReconciliationDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'lines' | 'matches' | 'fee' | 'close'>('lines');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assetAccountId, setAssetAccountId] = useState('');
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);

  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [matchAmount, setMatchAmount] = useState('');
  const [mergeIds, setMergeIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [splitParts, setSplitParts] = useState<Array<{ journalLineId: string; amount: string }>>([
    { journalLineId: '', amount: '' },
    { journalLineId: '', amount: '' },
  ]);

  const [fee, setFee] = useState({
    kind: 'fee', amount: '', offsetId: '', description: '', entryDate: today(),
    idempotencyKey: '', journalCode: 'GEN', voucherTypeCode: '',
  });

  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api(`/api/finance/bank-reconciliation/${id}`);
      setDetail(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le rapprochement.');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const loadAccounts = useCallback(async () => {
    try {
      const json = await api('/api/finance/accounting/accounts?pageSize=100');
      const assets = json.data.filter((a: Account) => a.accountType === 'asset');
      setAccounts(assets);
      setAssetAccountId(prev => prev || assets[0]?.id || '');
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const loadJournal = useCallback(async (accountId: string, statementDate: string) => {
    if (!accountId) { setJournalLines([]); return; }
    setJournalLoading(true);
    try {
      const from = `${new Date(statementDate).getFullYear()}-01-01`;
      const json = await api(`/api/finance/accounting/statements/drill-down?accountId=${accountId}&from=${from}&to=${statementDate}&limit=500`);
      setJournalLines(json.data);
    } catch (e) {
      setJournalLines([]);
      setFlash({ ok: false, text: e instanceof Error ? e.message : 'Impossible de charger les écritures du grand livre.' });
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (assetAccountId && detail) void loadJournal(assetAccountId, detail.reconciliation.statementDate);
  }, [assetAccountId, detail, loadJournal]);

  const runAction = async (path: string, body: unknown, successText: string) => {
    setBusy(true);
    setFlash(null);
    try {
      await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setFlash({ ok: true, text: successText });
      await load();
      onChanged();
    } catch (e) {
      setFlash({ ok: false, text: e instanceof Error ? e.message : 'Action échouée.' });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = () => {
    if (!file || importing) return;
    setImporting(true);
    setFlash(null);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const content = String(reader.result ?? '');
          const json = await api(`/api/finance/bank-reconciliation/${id}/import`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content }),
          });
          setFlash({ ok: true, text: json.data.alreadyImported ? 'Relevé déjà importé (contenu identique).' : `${json.data.rowsImported} ligne(s) de relevé importée(s).` });
          setFile(null);
          await load();
          onChanged();
        } catch (e) {
          setFlash({ ok: false, text: e instanceof Error ? e.message : 'Import échoué.' });
        } finally {
          setImporting(false);
        }
      })();
    };
    reader.readAsText(file);
  };

  const handleMatch = () => {
    if (!selectedLineId || !selectedJournalId) return;
    void runAction(`/api/finance/bank-reconciliation/${id}/match`,
      { statementLineId: selectedLineId, journalLineId: selectedJournalId, ...(matchAmount ? { amount: matchAmount } : {}) },
      'Ligne de relevé rapprochée.');
    setSelectedLineId(null);
    setSelectedJournalId(null);
    setMatchAmount('');
  };

  const handleUnmatch = (m: MatchRow) => {
    void runAction(`/api/finance/bank-reconciliation/${id}/matches/unmatch`,
      { statementLineId: m.statementLineId, journalLineId: m.journalLineId },
      'Rapprochement annulé.');
  };

  const handleSplit = () => {
    const parts = splitParts.filter(p => p.journalLineId && p.amount).map(p => ({ journalLineId: p.journalLineId, amount: p.amount }));
    if (!selectedLineId || parts.length < 2) return;
    void runAction(`/api/finance/bank-reconciliation/${id}/split`,
      { statementLineId: selectedLineId, parts },
      'Ligne de relevé découpée.');
    setSelectedLineId(null);
    setSplitParts([{ journalLineId: '', amount: '' }, { journalLineId: '', amount: '' }]);
  };

  const handleMerge = () => {
    const ids = [...mergeIds];
    if (ids.length < 2 || !selectedJournalId) return;
    void runAction(`/api/finance/bank-reconciliation/${id}/merge`,
      { statementLineIds: ids, journalLineId: selectedJournalId },
      'Lignes de relevé fusionnées.');
    setMergeIds(new Set());
    setSelectedJournalId(null);
  };

  const handleFeeInterest = () => {
    if (!fee.amount || !fee.offsetId || !fee.description || !fee.entryDate || fee.idempotencyKey.length < 8 || !fee.journalCode || !fee.voucherTypeCode) {
      setFlash({ ok: false, text: 'Renseignez tous les champs du frais / intérêt (clé d’idempotence ≥ 8 caractères).' });
      return;
    }
    void runAction(`/api/finance/bank-reconciliation/${id}/fee-interest`,
      {
        kind: fee.kind, amount: fee.amount, bankAssetAccountId: assetAccountId, offsetAccountId: fee.offsetId,
        description: fee.description, entryDate: fee.entryDate, idempotencyKey: fee.idempotencyKey,
        journalCode: fee.journalCode, voucherTypeCode: fee.voucherTypeCode,
      },
      fee.kind === 'fee' ? 'Frais bancaires comptabilisés.' : 'Intérêts comptabilisés.');
  };

  const handleClose = () => {
    const rec = detail?.reconciliation;
    if (!rec) return;
    const variance = Number(rec.statementBalance) - Number(rec.reconciledBalance);
    if (variance !== 0 && closeReason.trim().length < 3) {
      setFlash({ ok: false, text: 'Un motif d’écart (≥ 3 caractères) est requis pour clôturer un rapprochement déséquilibré.' });
      return;
    }
    setClosing(true);
    setFlash(null);
    void (async () => {
      try {
        await api(`/api/finance/bank-reconciliation/${id}/close`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(closeReason.trim() ? { varianceReason: closeReason.trim() } : {}),
        });
        setFlash({ ok: true, text: 'Rapprochement clôturé.' });
        setCloseReason('');
        await load();
        onChanged();
      } catch (e) {
        setFlash({ ok: false, text: e instanceof Error ? e.message : 'Clôture échouée.' });
      } finally {
        setClosing(false);
      }
    })();
  };

  const reconciliation = detail?.reconciliation;
  const variance = reconciliation ? Number(reconciliation.statementBalance) - Number(reconciliation.reconciledBalance) : 0;
  const closed = reconciliation?.status === 'completed';
  const unmatchedCount = detail?.lines.filter(l => l.status === 'unmatched' || l.status === 'partial').length ?? 0;
  const offsetAccounts = useMemo(() => accounts.filter(a => (fee.kind === 'fee' ? a.accountType === 'expense' : a.accountType === 'revenue')), [accounts, fee.kind]);

  const accountLabel = (id: string) => {
    const a = accounts.find(x => x.id === id);
    return a ? `${a.code} · ${a.name}` : '—';
  };
  const statementLineLabel = (id: string) => {
    const l = detail?.lines.find(x => x.id === id);
    return l ? `${l.lineDate} — ${l.description}` : id.slice(0, 8);
  };

  if (!detail) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        {error ?? 'Chargement du rapprochement…'}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </Button>
          <div>
            <h2 className="text-lg font-extrabold text-[#16212B] tracking-tight">Rapprochement du {reconciliation?.statementDate}</h2>
            <p className="text-xs text-slate-500">
              Relevé : {money(reconciliation?.statementBalance)} MAD · Comptable : {money(reconciliation?.reconciledBalance)} MAD ·
              Écart : <span className={variance === 0 ? 'text-[#17A673] font-bold' : 'text-[#E5544B] font-bold'}>{money(variance)} MAD</span>
              {closed ? ' · Clôturé' : ` · ${unmatchedCount} ligne(s) en attente`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reconciliation && (
            closed
              ? <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#DDF5EC] text-[#17A673]">Clôturé</span>
              : <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#DCEBF4] text-[#1B6C93]">En cours</span>
          )}
        </div>
      </div>

      {flash && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${flash.ok ? 'bg-[#DDF5EC] border border-[#17A673]/30 text-[#17A673]' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {flash.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          <span>{flash.text}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
        {([['lines', 'Lignes du relevé'], ['matches', 'Correspondances'], ['fee', 'Frais & intérêts'], ['close', 'Clôture']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 ${tab === key ? 'bg-[#2487B8] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'lines' && (
        <div className="space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><FileUp className="w-4 h-4" /> Importer le relevé bancaire</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                disabled={importing || closed}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#DCEBF4] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#1B6C93]"
              />
              <Button size="sm" disabled={!file || importing || closed} onClick={handleImport} className="h-8 gap-1 text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl">
                <FileUp className="w-3.5 h-3.5" /> {importing ? 'Import…' : 'Importer'}
              </Button>
              <span className="text-[11px] text-slate-400">CSV : en-têtes <code className="text-[#1B6C93]">date, description, debit, credit</code> (référence optionnelle).</span>
            </div>
            {detail.imports.length > 0 && (() => {
              const last = detail.imports[0]!;
              return (
                <p className="mt-2 text-[11px] text-slate-500">
                  Dernier import : <span className="font-bold text-slate-700">{last.filename}</span> · {last.rowsImported} ligne(s) · empreinte {last.contentFingerprint.slice(0, 10)}…
                </p>
              );
            })()}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="p-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="p-3 border-b border-slate-200/80 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lignes du relevé ({detail.lines.length})</h3>
                {selectedLineId && <span className="text-[11px] font-bold text-[#1B6C93]">Sélectionnée</span>}
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3"><input type="checkbox" checked={mergeIds.size > 0} onChange={() => setMergeIds(new Set(detail.lines.filter(l => l.status !== 'matched').map(l => l.id)))} className="accent-[#2487B8]" /></th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Libellé</th>
                      <th className="py-2.5 px-3 text-right">Débit</th>
                      <th className="py-2.5 px-3 text-right">Crédit</th>
                      <th className="py-2.5 px-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.lines.map(l => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLineId(selectedLineId === l.id ? null : l.id)}
                        className={`cursor-pointer transition ${selectedLineId === l.id ? 'bg-[#DCEBF4]/40' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={mergeIds.has(l.id)}
                            disabled={l.status === 'matched'}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const next = new Set(mergeIds);
                              if (e.target.checked) next.add(l.id); else next.delete(l.id);
                              setMergeIds(next);
                            }}
                            className="accent-[#2487B8]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{l.lineDate}</td>
                        <td className="py-2.5 px-3 font-medium text-[#16212B]">
                          {l.description}
                          {l.reference && <span className="ml-1 text-slate-400 text-[10px]">· {l.reference}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#16212B]">{money(l.debitAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#16212B]">{money(l.creditAmount)}</td>
                        <td className="py-2.5 px-3">{statusBadge(l.status)}</td>
                      </tr>
                    ))}
                    {detail.lines.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Aucune ligne importée. Importez un relevé CSV.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Landmark className="w-4 h-4" /> Grand livre bancaire</h3>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 text-xs">Compte d’actif bancaire</label>
                  <select
                    value={assetAccountId}
                    onChange={e => setAssetAccountId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium"
                  >
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </select>
                </div>
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80 sticky top-0">
                      <tr><th className="py-2 px-3">Pièce</th><th className="py-2 px-3">Date</th><th className="py-2 px-3">Libellé</th><th className="py-2 px-3 text-right">Débit</th><th className="py-2 px-3 text-right">Crédit</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journalLines.map(jl => (
                        <tr
                          key={jl.id}
                          onClick={() => setSelectedJournalId(selectedJournalId === jl.id ? null : jl.id)}
                          className={`cursor-pointer transition ${selectedJournalId === jl.id ? 'bg-[#DCEBF4]/40' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="py-2 px-3 font-bold text-[#16212B] whitespace-nowrap">{jl.entryNumber}</td>
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{jl.entryDate}</td>
                          <td className="py-2 px-3 font-medium text-[#16212B]">{jl.description}</td>
                          <td className="py-2 px-3 text-right font-extrabold text-[#16212B]">{money(jl.debit)}</td>
                          <td className="py-2 px-3 text-right font-extrabold text-[#16212B]">{money(jl.credit)}</td>
                        </tr>
                      ))}
                      {journalLoading && <tr><td colSpan={5} className="py-6 text-center text-slate-400">Chargement du grand livre…</td></tr>}
                      {!journalLoading && journalLines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucune écriture sur la période.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rapprocher</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input type="number" placeholder="Montant partiel (facultatif)" value={matchAmount} onChange={e => setMatchAmount(e.target.value)} disabled={closed} className="h-8 rounded-xl text-xs" />
                  <Button size="sm" disabled={!selectedLineId || !selectedJournalId || busy || closed} onClick={handleMatch} className="h-8 gap-1 text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Rapprocher la sélection
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400">Une ligne de relevé + une écriture du grand livre sélectionnées. Sans montant, la ligne est rapprochée pour son montant total.</p>

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1"><Split className="w-3.5 h-3.5" /> Découper la ligne sélectionnée</h4>
                  {splitParts.map((part, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <select value={part.journalLineId} onChange={e => setSplitParts(parts => parts.map((p, j) => j === i ? { ...p, journalLineId: e.target.value } : p))} disabled={closed} className="flex-1 h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium">
                        <option value="">Écriture…</option>
                        {journalLines.map(jl => <option key={jl.id} value={jl.id}>{jl.entryNumber} · {money(jl.debit)}/{money(jl.credit)}</option>)}
                      </select>
                      <Input type="number" placeholder="Montant" value={part.amount} onChange={e => setSplitParts(parts => parts.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))} disabled={closed} className="h-8 w-28 rounded-xl text-xs" />
                      {splitParts.length > 2 && (
                        <Button variant="ghost" size="sm" onClick={() => setSplitParts(parts => parts.filter((_, j) => j !== i))} className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={closed} onClick={() => setSplitParts(parts => [...parts, { journalLineId: '', amount: '' }])} className="h-8 text-xs rounded-xl">+ Ajouter une part</Button>
                    <Button size="sm" disabled={!selectedLineId || splitParts.filter(p => p.journalLineId && p.amount).length < 2 || busy || closed} onClick={handleSplit} className="h-8 text-xs rounded-xl bg-[#16212B] hover:bg-slate-800 text-white font-bold">Valider le découpage</Button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-[11px] font-bold text-slate-500 mb-2">Fusionner des lignes sur une écriture</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500">Cochez ≥ 2 lignes de relevé, puis une écriture du grand livre.</span>
                    <Button size="sm" disabled={mergeIds.size < 2 || !selectedJournalId || busy || closed} onClick={handleMerge} className="h-8 text-xs rounded-xl bg-[#16212B] hover:bg-slate-800 text-white font-bold">Fusionner ({mergeIds.size})</Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === 'matches' && (
        <Card className="p-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Correspondances ({detail.matches.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                <tr><th className="py-3 px-4">Ligne de relevé</th><th className="py-3 px-4">Écriture du grand livre</th><th className="py-3 px-4 text-right">Montant rapproché</th><th className="py-3 px-4">Date</th><th className="py-3 px-4"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.matches.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition font-medium">
                    <td className="py-3 px-4 text-[#16212B]">{statementLineLabel(m.statementLineId)}</td>
                    <td className="py-3 px-4 text-slate-500">Écriture {m.journalLineId.slice(0, 8)}…</td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#16212B]">{money(m.matchedAmount)} MAD</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{m.createdAt?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" disabled={busy || closed} onClick={() => handleUnmatch(m)} className="h-7 px-2 text-xs text-slate-400 hover:text-red-500 gap-1">
                        <X className="w-3 h-3" /> Annuler
                      </Button>
                    </td>
                  </tr>
                ))}
                {detail.matches.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aucune correspondance établie.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'fee' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comptabiliser frais / intérêts bancaires</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-600">Type</label>
                <select value={fee.kind} onChange={e => setFee({ ...fee, kind: e.target.value })} disabled={closed} className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium">
                  <option value="fee">Frais bancaires (charge)</option>
                  <option value="interest">Intérêts créditeurs (produit)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600">Montant (MAD)</label>
                <Input type="number" value={fee.amount} onChange={e => setFee({ ...fee, amount: e.target.value })} disabled={closed} className="h-9 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600">Date d’écriture</label>
                <Input type="date" value={fee.entryDate} onChange={e => setFee({ ...fee, entryDate: e.target.value })} disabled={closed} className="h-9 rounded-xl text-xs" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-600">Compte bancaire (actif)</label>
                <select value={assetAccountId} onChange={e => setAssetAccountId(e.target.value)} disabled={closed} className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-600">Compte de contrepartie ({fee.kind === 'fee' ? 'charge' : 'produit'})</label>
                <select value={fee.offsetId} onChange={e => setFee({ ...fee, offsetId: e.target.value })} disabled={closed} className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium">
                  <option value="">Choisir un compte…</option>
                  {offsetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-600">Libellé</label>
                <Input value={fee.description} onChange={e => setFee({ ...fee, description: e.target.value })} disabled={closed} placeholder="Frais de tenue de compte août" className="h-9 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600">Journal</label>
                <Input value={fee.journalCode} onChange={e => setFee({ ...fee, journalCode: e.target.value })} disabled={closed} placeholder="GEN" className="h-9 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600">Type de pièce</label>
                <Input value={fee.voucherTypeCode} onChange={e => setFee({ ...fee, voucherTypeCode: e.target.value })} disabled={closed} placeholder="OD" className="h-9 rounded-xl text-xs" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-600">Clé d’idempotence (≥ 8 caractères)</label>
                <Input value={fee.idempotencyKey} onChange={e => setFee({ ...fee, idempotencyKey: e.target.value })} disabled={closed} placeholder={`recon-${id.slice(0, 8)}-${fee.kind}-001`} className="h-9 rounded-xl text-xs font-mono" />
              </div>
            </div>
            <Button size="sm" disabled={busy || closed} onClick={handleFeeInterest} className="h-9 gap-1 text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5" /> Comptabiliser {fee.kind === 'fee' ? 'les frais' : 'les intérêts'}
            </Button>
            <p className="text-[11px] text-slate-400">Écriture passée via le service de comptabilisation central : immuable, idempotente et numérotée.</p>
          </Card>

          <Card className="p-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-200/80">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Journal des événements</h3>
            </div>
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80 sticky top-0">
                  <tr><th className="py-2.5 px-4">Date</th><th className="py-2.5 px-4">Événement</th><th className="py-2.5 px-4">Raison / détail</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.events.map(ev => (
                    <tr key={ev.id} className="font-medium text-[#16212B]">
                      <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{ev.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="py-2.5 px-4 font-extrabold text-[#1B6C93]">{ev.eventType}</td>
                      <td className="py-2.5 px-4 text-slate-500">{ev.reason ?? (ev.metadata ? JSON.stringify(ev.metadata) : '')}</td>
                    </tr>
                  ))}
                  {detail.events.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate-400">Aucun événement.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'close' && (
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clôture signée</h3>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-bold">Solde relevé</p>
              <p className="text-lg font-extrabold text-[#16212B]">{money(reconciliation?.statementBalance)} MAD</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Solde rapproché</p>
              <p className="text-lg font-extrabold text-[#16212B]">{money(reconciliation?.reconciledBalance)} MAD</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Écart</p>
              <p className={`text-lg font-extrabold ${variance === 0 ? 'text-[#17A673]' : 'text-[#E5544B]'}`}>{money(variance)} MAD</p>
            </div>
            <div className="ml-auto">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${closed ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-amber-100 text-amber-700'}`}>
                {closed ? 'Clôturé' : `${unmatchedCount} ligne(s) non rapprochée(s)`}
              </span>
            </div>
          </div>
          {!closed && (
            <>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 text-xs">Motif d’écart (requis si le rapprochement n’est pas équilibré)</label>
                <Input value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder="Ex. : chèques en circulation, frais non encore imputés…" className="h-9 rounded-xl text-xs" />
              </div>
              <Button size="sm" disabled={closing || busy || closed} onClick={handleClose} className="h-9 gap-1 text-xs bg-[#16212B] hover:bg-slate-800 text-white font-bold rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5" /> {closing ? 'Clôture…' : 'Clôturer le rapprochement'}
              </Button>
              <p className="text-[11px] text-slate-400">Après clôture, toute modification du relevé, des correspondances ou des événements est rejetée par la base de données.</p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export function BankReconciliationView({ locale: _locale }: { locale?: string } = {}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [reconciledBalance, setReconciledBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        setFeedbackMsg('Rapprochement bancaire enregistré avec succès !');
        setTimeout(() => setFeedbackMsg(null), 4000);
        loadReconciliations(accountId);
      }
    } catch (err) {
      console.error('Failed to create reconciliation', err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const openCount = reconciliations.filter(r => r.status !== 'completed').length;

  if (selectedId) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <ReconciliationDetail
          id={selectedId}
          onBack={() => setSelectedId(null)}
          onChanged={() => accountId && loadReconciliations(accountId)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Rapprochement bancaire</h1>
          <p className="text-xs text-slate-500 mt-1">Importez le relevé, rapprochez chaque ligne avec le grand livre, imputez frais et intérêts, puis clôturez.</p>
        </div>
        {selectedAccount && (
          <Button size="sm" variant="outline" onClick={() => loadReconciliations(accountId)} className="h-8 gap-1 text-xs rounded-xl">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </Button>
        )}
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#1B6C93] shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Comptes Bancaires</p>
            <p className="text-xl font-extrabold text-[#16212B]">{accounts.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Actifs de trésorerie</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] flex items-center justify-center text-[#17A673] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Rapprochements</p>
            <p className="text-xl font-extrabold text-[#16212B]">{reconciliations.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">{openCount} en cours</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Cycle complet</p>
            <p className="text-xl font-extrabold text-[#16212B]">Import → Rapprochement → Clôture</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Signé et immuable</p>
          </div>
        </Card>
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
              className={`w-full text-left p-3 rounded-xl text-xs flex items-center gap-2 ${accountId === a.id ? 'bg-[#DCEBF4]/40 border border-[#2487B8]/30' : 'bg-slate-50 border border-transparent'}`}
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
            className="h-9 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Enregistrer le rapprochement
          </Button>
        </Card>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200/80">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rapprochements — cliquez une ligne pour ouvrir le cycle complet</h3>
        </div>
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
                const isClosed = r.status === 'completed';
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="hover:bg-[#DCEBF4]/20 transition font-medium cursor-pointer"
                  >
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{r.statementDate}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(r.statementBalance).toLocaleString('fr-FR')} MAD</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#16212B]">{Number(r.reconciledBalance).toLocaleString('fr-FR')} MAD</td>
                    <td className={`py-3.5 px-4 text-right font-bold ${gap === 0 ? 'text-[#17A673]' : 'text-[#E5544B]'}`}>{gap.toLocaleString('fr-FR')} MAD</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isClosed ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#DCEBF4] text-[#1B6C93]'}`}>
                        {isClosed ? 'Clôturé' : 'En cours'}
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
