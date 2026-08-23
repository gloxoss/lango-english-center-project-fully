'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IdCard, Plus, FileText, Search, CreditCard, Key, Archive, PenTool } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  status: 'draft' | 'published' | 'archived';
  isDefault: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  student_id: 'Carte d\'étudiant',
  employee_id: 'Carte d\'employé',
  admit_card: 'Convocation d\'examen',
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'info' | 'success' | 'danger' | 'warning' | 'signal' }> = {
  draft: { label: 'Brouillon', variant: 'neutral' },
  published: { label: 'Publié', variant: 'success' },
  archived: { label: 'Archivé', variant: 'warning' },
};

export default function TemplatesLibraryPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('student_id');
  const [creating, setCreating] = useState(false);

  const load = () => fetch('/api/cards/templates')
    .then(r => r.json())
    .then(j => { if (j.success) setTemplates(j.data); });

  useEffect(() => { 
    load().finally(() => setLoading(false)); 
  }, []);

  const handleCreate = async () => {
    if (!newName || !newType) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cards/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, type: newType }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateOpen(false);
        setNewName('');
        // navigate to designer
        router.push(`/${locale}/dashboard/cards/templates/${data.data.template.id}/edit`);
      } else {
        alert(data.message || 'Erreur lors de la création');
      }
    } finally {
      setCreating(false);
    }
  };

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const studentCount = templates.filter(t => t.type === 'student_id').length;
  const admitCount = templates.filter(t => t.type === 'admit_card').length;
  const publishedCount = templates.filter(t => t.status === 'published').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <IdCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Modèles de Cartes</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Gérez les modèles de cartes d'étudiants, d'employés et convocations.</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
        >
          <Plus className="w-4 h-4" /><span>Nouveau Modèle</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Modèles</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{templates.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </Card>
        
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cartes Étudiant</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{studentCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Convocations</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{admitCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Modèles Publiés</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{publishedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Main content card */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un modèle..." 
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Nom du modèle</th>
                <th className="p-3">Type</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Défaut</th>
                <th className="p-3">Créé le</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Chargement...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Aucun modèle trouvé.</td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 pl-4 font-semibold text-slate-700">{t.name}</td>
                    <td className="p-3 text-slate-600">{TYPE_LABELS[t.type] || t.type}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[t.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[t.status]?.label || t.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {t.isDefault && <Badge variant="info">Défaut</Badge>}
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <Button 
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                        onClick={() => router.push(`/${locale}/dashboard/cards/templates/${t.id}/edit`)}
                      >
                        <PenTool className="w-3.5 h-3.5 mr-1.5" />
                        Éditer
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nouveau Modèle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold text-slate-700">Nom du modèle</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Carte Étudiant 2026"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs font-bold text-slate-700">Type de document</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Sélectionnez un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student_id" className="text-xs">Carte d'étudiant</SelectItem>
                  <SelectItem value="employee_id" className="text-xs">Carte d'employé</SelectItem>
                  <SelectItem value="admit_card" className="text-xs">Convocation d'examen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">Annuler</Button>
            <Button 
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer" 
              onClick={handleCreate} 
              disabled={creating || !newName}
            >
              {creating ? 'Création...' : 'Créer le modèle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
