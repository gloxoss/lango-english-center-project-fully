'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Download, CheckCircle2, AlertTriangle, Lock, FileText, ChevronRight, RefreshCw, BarChart2, ShieldCheck, Check
} from 'lucide-react';

type ChecklistItem = {
  id: string;
  label: string;
  status: 'Validé' | 'En cours' | 'À faire';
};

const INITIAL_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: '1', label: 'Rapprochement bancaire', status: 'Validé' },
  { id: '2', label: 'Lettrage des comptes', status: 'Validé' },
  { id: '3', label: 'Apurement des comptes tiers', status: 'Validé' },
  { id: '4', label: 'Provisions & amortissements', status: 'En cours' },
  { id: '5', label: 'Inventaire & valorisation', status: 'En cours' },
  { id: '6', label: 'Charges à payer / produits à recevoir', status: 'À faire' },
  { id: '7', label: 'Contrôles analytiques', status: 'À faire' },
  { id: '8', label: 'Révision des écritures manuelles', status: 'À faire' },
  { id: '9', label: 'Validation des soldes', status: 'À faire' },
  { id: '10', label: 'Clôture de la période', status: 'À faire' },
];

const ANOMALIES = [
  { id: '1', title: 'Écart de rapprochement', details: 'BMCI - 512345 : écart de 3 250,00 MAD' },
  { id: '2', title: 'Compte débiteur avec solde créditeur', details: '411100 - Clients : -1 245,60 MAD' },
  { id: '3', title: 'Écritures non lettrées anciennes', details: 'Plus de 90 jours : 2 880,00 MAD' },
];

const GENERAL_LEDGER_BALANCES = [
  { code: '10', label: 'Capital', debit: 15000000.00, credit: 0.00, net: 15000000.00, type: 'D' },
  { code: '411', label: 'Clients', debit: 6842125.60, credit: 6840880.00, net: 1245.60, type: 'D' },
  { code: '512', label: 'Banques - BMCI 512345', debit: 3215430.25, credit: 3212180.25, net: 3250.00, type: 'D' },
  { code: '61', label: 'Charges de personnel', debit: 5210450.00, credit: 0.00, net: 5210450.00, type: 'D' },
  { code: '70', label: 'Produits des scolarités', debit: 0.00, credit: 11245860.20, net: -11245860.20, type: 'C' },
];

const RECENT_CLOSE_EVENTS = [
  { date: '30 avr. 2025 18:42', period: 'Avril 2025', status: 'Terminée', by: 'Mohamed Amine', duration: '00:12:34' },
  { date: '31 mars 2025 17:35', period: 'Mars 2025', status: 'Terminée', by: 'Samira Belkacem', duration: '00:08:21' },
  { date: '28 fév. 2025 17:10', period: 'Février 2025', status: 'Terminée', by: 'Mohamed Amine', duration: '00:10:05' },
];

const AVAILABLE_STATEMENTS = [
  { name: 'Compte de résultat – Avril 2025', format: 'PDF • 184 KB' },
  { name: 'Bilan – Avril 2025', format: 'PDF • 196 KB' },
  { name: 'Flux de trésorerie – Avril 2025', format: 'PDF • 172 KB' },
  { name: 'Grand livre détaillé – Avril 2025', format: 'XLSX • 256 KB' },
  { name: 'Annexe comptable – Avril 2025', format: 'PDF • 221 KB' },
];


export function FinancialReportsView() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST_ITEMS);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const toggleCheckitem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === 'Validé' ? 'En cours' : item.status === 'En cours' ? 'À faire' : 'Validé';
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  const handleClosePeriod = () => {
    setIsCloseModalOpen(false);
    setFeedbackMsg('La période comptable Mai 2025 a été clôturée avec succès.');
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const validatedCount = checklist.filter((c) => c.status === 'Validé').length;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">États financiers &amp; clôture</h1>
          <p className="text-xs text-slate-500 mt-1">Préparez la clôture, contrôlez les soldes et exportez les états.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              setFeedbackMsg('Exportation des états comptables en cours...');
              setTimeout(() => setFeedbackMsg(null), 3000);
            }}
            variant="outline"
            size="sm"
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]"
          >
            <Download className="w-3.5 h-3.5" /> Exporter les états
          </Button>
          <Button
            onClick={() => setIsCloseModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Lock className="w-3.5 h-3.5" /> Clôturer la période
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Résultat net</p>
            <p className="text-xl font-extrabold text-[#16212B]">1 245 870,35 MAD</p>
            <p className="text-[10px] font-semibold text-[#17A673]">+18,6% vs N-1</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Périodes ouvertes</p>
            <p className="text-xl font-extrabold text-[#16212B]">1</p>
            <p className="text-[10px] font-semibold text-slate-500">Mai 2025</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Écarts de clôture</p>
            <p className="text-xl font-extrabold text-[#16212B]">{ANOMALIES.length}</p>
            <p className="text-[10px] font-bold text-amber-600">Voir les anomalies</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Contrôles validés</p>
            <p className="text-xl font-extrabold text-[#16212B]">{validatedCount} / {checklist.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">{Math.round((validatedCount / checklist.length) * 100)}%</p>
          </div>
        </Card>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): 3 Statements Summary Grid & Grand Livre */}
        <div className="xl:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Compte de résultat */}
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Compte de résultat</h2>
                <span className="text-[10px] text-slate-400 font-bold">⚖️</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Produits d&apos;exploitation</span><span className="font-bold text-[#16212B]">14 852 560,20 MAD</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Charges d&apos;exploitation</span><span className="font-bold text-rose-600">-12 764 890,50 MAD</span></div>
                <div className="pt-1 border-t border-slate-100 flex justify-between"><span className="font-semibold text-slate-600">Résultat d&apos;exploitation</span><span className="font-extrabold text-[#16212B]">2 087 669,70 MAD</span></div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm">
                  <span className="text-[#2487B8]">Résultat net</span>
                  <span className="text-[#2487B8]">1 245 870,35 MAD</span>
                </div>
              </div>
            </Card>

            {/* Bilan */}
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Bilan synthétique</h2>
                <span className="text-[10px] text-slate-400 font-bold">🏛️</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Actif immobilisé</span><span className="font-bold text-[#16212B]">8 450 000,00 MAD</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Actif circulant</span><span className="font-bold text-[#16212B]">6 842 125,60 MAD</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Trésorerie Actif</span><span className="font-bold text-[#16212B]">3 215 430,25 MAD</span></div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm">
                  <span className="text-[#17A673]">Total Actif</span>
                  <span className="text-[#17A673]">18 507 555,85 MAD</span>
                </div>
              </div>
            </Card>

            {/* Flux de trésorerie */}
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Flux de trésorerie</h2>
                <span className="text-[10px] text-slate-400 font-bold">💧</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Flux opérationnels</span><span className="font-bold text-[#17A673]">+2 450 120,00 MAD</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Flux d&apos;investissement</span><span className="font-bold text-rose-600">-650 000,00 MAD</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Flux de financement</span><span className="font-bold text-slate-700">-320 000,00 MAD</span></div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm">
                  <span className="text-[#16212B]">Variation nette</span>
                  <span className="text-[#16212B]">+1 480 120,00 MAD</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Grand Livre Summary Table */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <h2 className="text-xs font-extrabold text-[#16212B] mb-3">Balance synthétique du Grand Livre</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Intitulé du compte</th>
                    <th className="pb-2 text-right">Débit</th>
                    <th className="pb-2 text-right">Crédit</th>
                    <th className="pb-2 text-right">Solde net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {GENERAL_LEDGER_BALANCES.map((b) => (
                    <tr key={b.code}>
                      <td className="py-2.5 font-mono font-bold text-[#2487B8]">{b.code}</td>
                      <td className="py-2.5 font-bold text-[#16212B]">{b.label}</td>
                      <td className="py-2.5 text-right font-semibold">{b.debit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 text-right font-semibold">{b.credit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 text-right font-extrabold text-[#16212B]">{b.net.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bottom 2 Cards: Événements de clôture & États financiers disponibles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">Événements de clôture récents</h2>
                <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir tout</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Période</th>
                      <th className="pb-2">Statut</th>
                      <th className="pb-2">Lancé par</th>
                      <th className="pb-2 text-right">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {RECENT_CLOSE_EVENTS.map((ev, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2 text-slate-500 text-[10px]">{ev.date}</td>
                        <td className="py-2 font-bold text-[#16212B] text-[11px]">{ev.period}</td>
                        <td className="py-2">
                          <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{ev.status}</Badge>
                        </td>
                        <td className="py-2 text-slate-600 text-[11px]">{ev.by}</td>
                        <td className="py-2 text-right font-mono text-slate-500 text-[11px]">{ev.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">États financiers disponibles</h2>
                <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir tous les états</button>
              </div>

              <div className="space-y-2 text-xs">
                {AVAILABLE_STATEMENTS.map((st, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2487B8]" />
                      <div>
                        <p className="font-bold text-[#16212B] text-[11px]">{st.name}</p>
                        <p className="text-[9px] text-slate-400">{st.format}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Column (4 cols): Checklist de clôture & Anomalies à résoudre */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Checklist de clôture</h2>
              <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none font-extrabold text-xs">7/10 ▾</Badge>
            </div>

            <div className="space-y-2 text-xs">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center justify-between pb-1.5 border-b border-slate-100 last:border-none">

                  <div className="flex items-center gap-2">
                    {item.status === 'Validé' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#17A673]" />
                    ) : item.status === 'En cours' ? (
                      <span className="w-4 h-4 rounded-full border-2 border-amber-500 flex items-center justify-center text-[9px] font-bold text-amber-500">○</span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-300">○</span>
                    )}
                    <span className={`font-semibold ${item.status === 'Validé' ? 'text-slate-700' : item.status === 'En cours' ? 'text-amber-700' : 'text-slate-400'}`}>{item.label}</span>
                  </div>
                  <Badge className={`text-[9px] font-bold border-none ${item.status === 'Validé' ? 'bg-[#DDF5EC] text-[#17A673]' : item.status === 'En cours' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Anomalies à résoudre</h2>
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center">3 ▾</span>
            </div>

            <div className="space-y-2 text-xs">
              {ANOMALIES.map((anom) => (
                <div key={anom.id} className="p-3 bg-rose-50 rounded-xl border border-rose-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-rose-700 text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {anom.title}
                    </p>
                    <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <p className="text-[10px] text-slate-600 font-semibold">{anom.details}</p>
                </div>
              ))}
            </div>

            <button className="text-[11px] font-bold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir toutes les anomalies
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
