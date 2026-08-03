'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { DollarSign, BookOpen, Save, FileText, CheckCircle2 } from 'lucide-react';

const POSTING_RULES = [
  { event: 'Paiement reçu pour scolarité', debit: '5141 — Banque (Société Générale)', credit: '7101 — Produits des frais de scolarité' },
  { event: 'Frais d\'inscription encaissés', debit: '5141 — Banque (Société Générale)', credit: '7103 — Droits d\'inscription' },
  { event: 'Avoir / Remboursement élève', debit: '7101 — Produits des frais de scolarité', credit: '5141 — Banque' },
  { event: 'Achat fourniture / matériel', debit: '6111 — Achats de matières et fournitures', credit: '5141 — Banque' },
];

export function AccountingDefaultsView({ locale: _locale }: { locale: string }) {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Liaisons comptables & comptes par défaut</h1>
          <p className="text-xs text-slate-500 mt-1">Configurez le plan comptable marocain et les règles de comptabilisation automatique.</p>
        </div>
        <Button className="gap-2 h-10 rounded-full px-5 text-xs font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white">
          <Save className="w-4 h-4" />
          <span>Enregistrer la configuration</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Default Accounts */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">Comptes par défaut</h3>
              <p className="text-[11px] text-slate-500">Comptes d&apos;imputation des factures et règlements (Plan Général Comptable Marocain)</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Compte Produits Scolarité</label>
              <Select defaultValue="7101">
                <SelectTrigger className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7101">7101 — Ventes de produits / Frais de scolarité</SelectItem>
                  <SelectItem value="7102">7102 — Activités périscolaires</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Compte Droits d&apos;inscription</label>
              <Select defaultValue="7103">
                <SelectTrigger className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7103">7103 — Droits et frais d&apos;inscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Taux de TVA (%)</label>
                <Input defaultValue="20" className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Devise officielle</label>
                <Input value="MAD (Dirham Marocain)" disabled className="h-10 text-xs bg-slate-100 border border-slate-200 rounded-xl font-bold" />
              </div>
            </div>
          </div>
        </Card>

        {/* Section 2: Automated Rules */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">Règles de saisie automatique</h3>
              <p className="text-[11px] text-slate-500">Journal d&apos;écriture généré lors des paiements</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 text-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-600">Événement</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Débit</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Crédit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {POSTING_RULES.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-semibold text-[#16212B]">{r.event}</TableCell>
                    <TableCell className="text-slate-600 font-mono text-[11px]">{r.debit}</TableCell>
                    <TableCell className="text-slate-600 font-mono text-[11px]">{r.credit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
