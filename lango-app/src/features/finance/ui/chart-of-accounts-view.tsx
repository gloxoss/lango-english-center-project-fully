'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, BookOpen, CheckCircle2, FileSpreadsheet, Archive, AlertCircle } from 'lucide-react';


type Account = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  parentAccountId: string | null;
  isActive: boolean;
};

type AccountNode = Account & { children: AccountNode[] };

function buildTree(accounts: Account[]): AccountNode[] {
  const byId = new Map<string, AccountNode>(accounts.map(a => [a.id, { ...a, children: [] }]));
  const roots: AccountNode[] = [];
  for (const node of byId.values()) {
    if (node.parentAccountId && byId.has(node.parentAccountId)) {
      byId.get(node.parentAccountId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function AccountRow({ node, depth, selectedId, onSelect }: { node: AccountNode; depth: number; selectedId: string | null; onSelect: (a: Account) => void }) {
  return (
    <>
      <tr
        tabIndex={0}
        role="button"
        aria-pressed={selectedId === node.id}
        onClick={() => onSelect(node)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node); } }}
        className={`cursor-pointer transition-colors border-b border-slate-100 ${selectedId === node.id ? 'bg-[#DCEBF4]/30' : 'hover:bg-slate-50/80'}`}
      >
        <td className="py-2 px-4" style={{ paddingLeft: `${16 + depth * 20}px` }}>
          <span className="text-[11px] font-mono font-bold text-[#16212B]">{node.code}</span>
        </td>
        <td className="py-2 px-3 text-[11px] font-semibold text-[#16212B]">{node.name}</td>
        <td className="py-2 px-3 text-[10px] text-slate-500 capitalize">{node.accountType}</td>
        <td className="py-2 px-3">
          <Badge className={`text-[9px] border-none font-bold ${node.isActive ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
            {node.isActive ? 'Actif' : 'Inactif'}
          </Badge>
        </td>
      </tr>
      {node.children.map(child => (
        <AccountRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

export function ChartOfAccountsView({ locale = 'fr' }: { locale?: string }) {
  const isArabic = locale === 'ar';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', accountType: 'asset' });
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = () => {
    fetch('/api/finance/accounting/accounts?pageSize=100')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setAccounts(json.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.code || !form.name) {
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/finance/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error('ACCOUNT_CREATE_FAILED');
      setIsAddModalOpen(false);
      setForm({ code: '', name: '', accountType: 'asset' });
      setFeedbackMsg(`Compte "${form.code} - ${form.name}" ajouté au Plan Comptable.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      load();
    } catch (err) {
      console.error('Failed to create account', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selected?.isActive) return;
    setIsArchiving(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/finance/accounting/accounts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, isActive: false }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? (isArabic ? 'تعذر أرشفة الحساب.' : 'Impossible d’archiver le compte.'));
      setFeedbackMsg(isArabic ? `تمت أرشفة الحساب ${selected.code}.` : `Compte ${selected.code} archivé.`);
      setSelected({ ...selected, isActive: false });
      load();
    } catch (cause) {
      setErrorMsg(cause instanceof Error ? cause.message : (isArabic ? 'تعذر أرشفة الحساب.' : 'Impossible d’archiver le compte.'));
    } finally { setIsArchiving(false); }
  };

  const filtered = search
    ? accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
    : accounts;
  const tree = buildTree(filtered);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto" dir={isArabic ? 'rtl' : 'ltr'} lang={locale}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{isArabic ? 'الدليل المحاسبي العام' : 'Plan comptable général (PCG)'}</h1>
          <p className="text-xs text-slate-500 mt-1">{isArabic ? `${accounts.length} حساباً مهيأً لهذه المؤسسة.` : `${accounts.length} compte(s) configuré(s) pour cet établissement.`}</p>
        </div>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
        </Button>
      </div>

      {feedbackMsg && (
        <div role="status" aria-live="polite" className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}
      {errorMsg && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700"><AlertCircle className="size-4" />{errorMsg}</div>}

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#1B6C93] shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Total Comptes PCG</p>
            <p className="text-xl font-extrabold text-[#16212B]">{accounts.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Plan comptable général</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] flex items-center justify-center text-[#17A673] shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Comptes Actifs</p>
            <p className="text-xl font-extrabold text-[#16212B]">{accounts.filter(a => a.isActive).length}</p>
            <p className="text-[10px] font-semibold text-slate-500">Prêts aux écritures</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{isArabic ? 'أنواع الحسابات' : 'Types de comptes'}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{new Set(accounts.map(account => account.accountType)).size}</p>
            <p className="text-[10px] font-semibold text-slate-500">{isArabic ? 'بيانات المؤسسة الفعلية' : 'Données réelles de l’établissement'}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <h3 className="text-xs font-extrabold text-[#16212B]">Hiérarchie des comptes</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input aria-label={isArabic ? 'البحث في الحسابات' : 'Rechercher dans les comptes'} placeholder={isArabic ? 'بحث...' : 'Rechercher...'} value={search} onChange={e => setSearch(e.target.value)} className="ps-8 h-8 text-[11px] bg-slate-50 rounded-xl border-slate-200 w-full sm:w-56" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-4 text-start">Code</th>
                  <th className="py-2.5 px-3 text-start">Libellé</th>
                  <th className="py-2.5 px-3 text-start">Type</th>
                  <th className="py-2.5 px-3 text-start">Statut</th>
                </tr>
              </thead>
              <tbody>
                {tree.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">Aucun compte configuré.</td></tr>
                )}
                {tree.map(node => (
                  <AccountRow key={node.id} node={node} depth={0} selectedId={selected?.id ?? null} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">Détail du compte</h3>
          {!selected && <p className="text-xs text-slate-500">Sélectionnez un compte pour voir son détail.</p>}
          {selected && (
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-500 font-semibold">Code</span>
                <span className="font-bold text-[#16212B] font-mono">{selected.code}</span>
              </div>
              {selected.isActive && <Button type="button" variant="outline" className="mt-3 w-full text-xs" disabled={isArchiving} onClick={handleArchive}><Archive className="size-3.5" />{isArchiving ? (isArabic ? 'جارٍ الأرشفة…' : 'Archivage…') : (isArabic ? 'أرشفة الحساب' : 'Archiver le compte')}</Button>}
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-500 font-semibold">Libellé</span>
                <span className="font-bold text-[#16212B]">{selected.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-500 font-semibold">Type</span>
                <span className="font-bold text-[#16212B] capitalize">{selected.accountType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-500 font-semibold">Statut</span>
                <span className="font-bold text-[#16212B]">{selected.isActive ? 'Actif' : 'Inactif'}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Add Account Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer un nouveau compte comptable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Code du compte *</label>
              <Input
                placeholder="ex: 611100"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Libellé du compte *</label>
              <Input
                placeholder="ex: Achats de fournitures de bureau"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Type de compte</label>
              <select
                value={form.accountType}
                onChange={e => setForm({ ...form, accountType: e.target.value })}
                className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white font-medium"
              >
                <option value="asset">Actif</option>
                <option value="liability">Passif</option>
                <option value="equity">Capitaux propres</option>
                <option value="revenue">Produits</option>
                <option value="expense">Charges</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button disabled={isSaving} onClick={handleCreate} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Enregistrer le compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
