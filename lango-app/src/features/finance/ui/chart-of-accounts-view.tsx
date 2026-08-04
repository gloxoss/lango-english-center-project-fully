'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';

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
        onClick={() => onSelect(node)}
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

export function ChartOfAccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', accountType: 'asset' });
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    fetch('/api/finance/chart-of-accounts')
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
      await fetch('/api/finance/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ code: '', name: '', accountType: 'asset' });
      load();
    } catch (err) {
      console.error('Failed to create account', err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = search
    ? accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
    : accounts;
  const tree = buildTree(filtered);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Plan comptable</h1>
          <p className="text-xs text-slate-500 mt-1">{accounts.length} compte(s) configuré(s) pour cet établissement.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Créer un compte
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Code</label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Libellé</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Type</label>
              <select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="asset">Actif</option>
                <option value="liability">Passif</option>
                <option value="equity">Capitaux propres</option>
                <option value="revenue">Produits</option>
                <option value="expense">Charges</option>
              </select>
            </div>
            <Button size="sm" disabled={isSaving} onClick={handleCreate} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              Créer
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <h3 className="text-xs font-extrabold text-[#16212B]">Hiérarchie des comptes</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-7 text-[10px] bg-slate-50 rounded-xl border-slate-200 w-48" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-4 text-left">Code</th>
                  <th className="py-2.5 px-3 text-left">Libellé</th>
                  <th className="py-2.5 px-3 text-left">Type</th>
                  <th className="py-2.5 px-3 text-left">Statut</th>
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
    </div>
  );
}
