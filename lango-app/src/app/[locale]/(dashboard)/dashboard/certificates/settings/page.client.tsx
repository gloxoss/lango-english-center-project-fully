'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, ScrollText, Layers, FileCheck2, PenLine, Plus, Trash2, Loader2 } from 'lucide-react';

type Signatory = {
  id: string;
  name: string;
  title: string;
  signatureImageId: string | null;
  isActive: boolean;
  createdAt: string;
};

type SettingsData = {
  issuer: { name: string; id: string };
  signatories: Signatory[];
  counts: { definitions: number; templates: number; issued: number };
  serialPrefix: string;
};

export default function CertificatesSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [signatureImageId, setSignatureImageId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certificates/settings').then(r => r.json());
      if (res.success) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim() || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/certificates/signatories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          signatureImageId: signatureImageId.trim(),
          isActive,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || json.error?.message || 'Erreur lors de la création.');
        return;
      }
      setName('');
      setTitle('');
      setSignatureImageId('');
      setIsActive(true);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (s: Signatory) => {
    const res = await fetch(`/api/certificates/signatories/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    const json = await res.json();
    if (!json.success) alert(json.message || json.error?.message || 'Erreur lors de la mise à jour');
    await load();
  };

  const handleDelete = async (s: Signatory) => {
    if (!confirm(`Supprimer le signataire « ${s.name} » ?`)) return;
    setDeletingId(s.id);
    try {
      const res = await fetch(`/api/certificates/signatories/${s.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) alert(json.message || json.error?.message || 'Erreur lors de la suppression');
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = data?.signatories.filter(s => s.isActive).length ?? 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Paramètres & Signataires</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Émetteur, compteurs et signataires autorisés.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : !data ? (
        <p className="text-center text-slate-400 text-xs py-16">Impossible de charger les paramètres.</p>
      ) : (
        <>
          {/* KPI banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Émetteur</span>
                <h3 className="text-xl font-extrabold text-[#16212B] mt-1 truncate max-w-[180px]">{data.issuer.name}</h3>
                <span className="text-[10px] font-medium text-slate-400">Préfixe {data.serialPrefix}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><Settings2 className="w-5 h-5" /></div>
            </Card>
            <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Définitions</span>
                <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{data.counts.definitions}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
            </Card>
            <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Modèles</span>
                <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{data.counts.templates}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><Layers className="w-5 h-5" /></div>
            </Card>
            <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Émis</span>
                <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{data.counts.issued}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add signatory */}
            <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2487B8] flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <h2 className="text-sm font-extrabold text-[#16212B]">Nouveau signataire</h2>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Nom complet</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Pr. Amine Bennani" className="h-9 text-xs rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Fonction</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Directeur de l'établissement" className="h-9 text-xs rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Image de signature (ID, optionnel)</Label>
                <Input value={signatureImageId} onChange={e => setSignatureImageId(e.target.value)} placeholder="ID du fichier signature" className="h-9 text-xs rounded-xl" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#2487B8]" />
                <span className="text-xs font-semibold text-slate-600">Signataire actif</span>
              </label>
              {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
              <Button className="w-full bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold rounded-xl gap-1.5 cursor-pointer" onClick={handleCreate} disabled={creating || !name.trim() || !title.trim()}>
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Ajout...' : 'Ajouter le signataire'}
              </Button>
            </Card>

            {/* Signatories list */}
            <Card className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-extrabold text-[#16212B]">Signataires ({data.signatories.length})</h2>
                <Badge variant="success">{activeCount} actifs</Badge>
              </div>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-3 pl-4">Nom</th>
                      <th className="p-3">Fonction</th>
                      <th className="p-3">Statut</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.signatories.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400">Aucun signataire. Ajoutez le premier signataire autorisé.</td></tr>
                    ) : (
                      data.signatories.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="p-3 pl-4 font-semibold text-slate-700">{s.name}</td>
                          <td className="p-3 text-slate-500">{s.title}</td>
                          <td className="p-3">
                            <Badge variant={s.isActive ? 'success' : 'neutral'}>
                              {s.isActive ? 'Actif' : 'Inactif'}
                            </Badge>
                          </td>
                          <td className="p-3 pr-4 text-right space-x-1.5">
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={() => toggleActive(s)}>
                              <PenLine className="w-3.5 h-3.5 mr-1.5" />{s.isActive ? 'Désactiver' : 'Activer'}
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleDelete(s)} disabled={deletingId === s.id}>
                              {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}Supprimer
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
