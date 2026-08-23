'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, Plus, Lock, Archive, RotateCcw } from 'lucide-react';

type AttachmentType = {
  id: string;
  name: string;
  code: string;
  allowedMimeFamilies: string[];
  maxSizeBytes: number;
  studentVisible: boolean;
  downloadable: boolean;
  isSystem: boolean;
  isActive: boolean;
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AttachmentTypesPage() {
  const [types, setTypes] = useState<AttachmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [mimeFamilies, setMimeFamilies] = useState('image,pdf,document');
  const [maxSizeMb, setMaxSizeMb] = useState('25');
  const [error, setError] = useState('');

  const load = () => fetch('/api/content/attachment-types?includeArchived=true').then(r => r.json()).then((j) => { if (j.success) setTypes(j.data); }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const visibleTypes = types.filter(t => (archivedOnly ? !t.isActive : t.isActive));

  const handleRestore = async (id: string) => {
    await fetch(`/api/content/attachment-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
    load();
  };

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) {
      setError('Nom et code sont requis.');
      return;
    }
    setError('');
    const res = await fetch('/api/content/attachment-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        code: code.trim(),
        allowedMimeFamilies: mimeFamilies.split(',').map(s => s.trim()).filter(Boolean),
        maxSizeBytes: (Number.parseFloat(maxSizeMb) || 25) * 1024 * 1024,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setName(''); setCode(''); setCodeTouched(false); setMimeFamilies('image,pdf,document'); setMaxSizeMb('25');
      setCreateOpen(false);
      load();
    } else {
      setError(json.error?.message || 'Échec de la création.');
    }
  };

  const handleArchive = async (id: string) => {
    await fetch(`/api/content/attachment-types/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Types de Pièces Jointes</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Taxonomie configurable pour la bibliothèque de ressources pédagogiques.</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /> Nouveau Type
        </Button>
      </div>

      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          {([
            { value: false, label: 'Types actifs' },
            { value: true, label: 'Types archivés' },
          ] as const).map(tab => (
            <button
              key={String(tab.value)}
              onClick={() => setArchivedOnly(tab.value)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${archivedOnly === tab.value ? 'bg-[#0066FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 text-center py-8">Chargement...</p>
        ) : visibleTypes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">{archivedOnly ? 'Aucun type archivé.' : 'Aucun type actif.'}</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Formats</th>
                <th className="py-2 pr-4">Taille Max</th>
                <th className="py-2 pr-4">Visible Élèves</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleTypes.map(t => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-semibold text-[#16212B] flex items-center gap-1.5">
                    {t.name}
                    {t.isSystem && <span title="Type système - verrouillé"><Lock className="w-3 h-3 text-slate-400" /></span>}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{t.code}</td>
                  <td className="py-3 pr-4 text-slate-500">{t.allowedMimeFamilies.join(', ')}</td>
                  <td className="py-3 pr-4 text-slate-500">{Math.round(t.maxSizeBytes / (1024 * 1024))} Mo</td>
                  <td className="py-3 pr-4">
                    <Badge variant={t.studentVisible ? 'success' : 'neutral'} className="text-[10px]">{t.studentVisible ? 'Oui' : 'Non'}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    {!t.isActive ? (
                      <button
                        onClick={() => handleRestore(t.id)}
                        title="Restaurer"
                        className="cursor-pointer text-slate-500 hover:text-emerald-600"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchive(t.id)}
                        disabled={t.isSystem}
                        title={t.isSystem ? 'Type système - verrouillé' : 'Archiver'}
                        className={`cursor-pointer ${t.isSystem ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-red-600'}`}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau Type de Pièce Jointe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Nom</label>
              <Input value={name} onChange={e => { const v = e.target.value; setName(v); if (!codeTouched) setCode(slugify(v)); }} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Code</label>
              <Input value={code} onChange={e => { setCode(e.target.value); setCodeTouched(true); }} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Familles MIME autorisées (séparées par virgule)</label>
              <Input value={mimeFamilies} onChange={e => setMimeFamilies(e.target.value)} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Taille max (Mo)</label>
              <Input value={maxSizeMb} onChange={e => setMaxSizeMb(e.target.value)} className="mt-1 text-xs rounded-xl h-9" />
            </div>
            {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl cursor-pointer">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
