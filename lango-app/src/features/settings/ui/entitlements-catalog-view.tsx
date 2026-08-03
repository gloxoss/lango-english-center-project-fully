'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Package, Search, CheckCircle2, Lock, Sparkles } from 'lucide-react';

const ADDONS = [
  { id: 'multi-branch', name: 'Multi-Succursales & Multi-Campus', desc: 'Gestion centralisée de plusieurs sites et établissements', status: 'active', expiry: 'Licence permanente' },
  { id: 'lead-crm', name: 'Pipeline CRM & Admissions', desc: 'Gestion des prospects, relances automatiques et conversion', status: 'active', expiry: 'Valide jusqu\'au 31/12/2026' },
  { id: 'broadcast-messaging', name: 'Diffusion Messages SMS & Email', desc: 'Campagnes ciblées par classe, rôle ou niveau', status: 'active', expiry: 'Licence permanente' },
  { id: 'human-resources', name: 'Ressources Humaines & Contrats', desc: 'Dossiers employés, contrats de travail et pièces RH', status: 'inactive', expiry: 'Non souscrit' },
  { id: 'payroll-workforce', name: 'Paie & Bulletins de Salaire (Maroc)', desc: 'Calcul de la paie marocaine (IR, CNSS, AMO)', status: 'inactive', expiry: 'Non souscrit' },
  { id: 'library', name: 'Gestion de Bibliothèque Scolaire', desc: 'Gestion du fonds documentaire, prêts et retards', status: 'inactive', expiry: 'Non souscrit' },
];

export function EntitlementsCatalogView({ locale: _locale }: { locale: string }) {
  const [search, setSearch] = useState('');
  const [addons, setAddons] = useState(ADDONS);

  const toggleAddon = (id: string) => {
    setAddons((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a))
    );
  };

  const filtered = addons.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Catalogue de modules & licences</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les extensions actives de votre abonnement SchoolOS.</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un module…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white rounded-xl border border-slate-200"
          />
        </div>
      </div>

      {/* Addons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((a) => {
          const isActive = a.status === 'active';
          return (
            <Card key={a.id} className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <Badge className={isActive ? 'bg-[#D1F5E8] text-[#17A673] border-none font-bold text-[10px]' : 'bg-slate-100 text-slate-500 border-none font-bold text-[10px]'}>
                    {isActive ? 'Activé' : 'Désactivé'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#16212B]">{a.name}</h3>
                  <p className="text-xs text-slate-500">{a.desc}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-medium">{a.expiry}</span>
                <Switch checked={isActive} onCheckedChange={() => toggleAddon(a.id)} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
