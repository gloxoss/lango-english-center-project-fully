'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Languages, Plus, Trash2, Edit, Save } from 'lucide-react';

const CUSTOM_FIELDS = [
  { id: 1, label: 'Code MASSAR', type: 'Texte', entity: 'Élève', required: true },
  { id: 2, label: 'Groupe sanguin', type: 'Sélecteur', entity: 'Élève', required: false },
  { id: 3, label: 'CIN Employé', type: 'Texte', entity: 'Employé', required: true },
];

export function TranslationsCustomFieldsView({ locale: _locale }: { locale: string }) {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Traductions & champs personnalisés</h1>
          <p className="text-xs text-slate-500 mt-1">Personnalisez les libellés de l&apos;interface et ajoutez des champs spécifiques aux fiches d&apos;inscription.</p>
        </div>
        <Button className="gap-2 h-9 text-xs rounded-xl px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white">
          <Plus className="w-4 h-4" />
          <span>Ajouter un champ</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Custom Fields Card */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">Champs personnalisés</h3>
                <p className="text-[11px] text-slate-500">Champs additionnels pour les profils</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 text-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-600">Nom du champ</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Type</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Entité</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CUSTOM_FIELDS.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-semibold text-[#16212B]">
                      {f.label}
                      {f.required && <Badge className="ml-2 bg-[#FCF0DC] text-[#E8A33D] border-none text-[10px] font-bold">Requis</Badge>}
                    </TableCell>
                    <TableCell className="text-slate-600">{f.type}</TableCell>
                    <TableCell className="text-slate-600">{f.entity}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit className="w-3.5 h-3.5 text-slate-500" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Translation Overrides */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">Surcharges de libellés</h3>
              <p className="text-[11px] text-slate-500">Adaptez le vocabulaire officiel à votre établissement</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Libellé pour &quot;Section&quot;</label>
              <Input defaultValue="Section / Groupe" className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl" />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Libellé pour &quot;Niveau&quot;</label>
              <Input defaultValue="Niveau d&apos;études" className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl" />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Libellé pour &quot;Matière&quot;</label>
              <Input defaultValue="Discipline / Matière" className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl" />
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" className="h-9 text-xs rounded-xl bg-[#0066FF] text-white gap-2">
                <Save className="w-3.5 h-3.5" />
                <span>Sauvegarder les libellés</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
