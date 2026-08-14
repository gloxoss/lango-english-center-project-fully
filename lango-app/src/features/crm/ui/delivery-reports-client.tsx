'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart3, CheckCircle2, Eye, MousePointer, Mail, Smartphone, MessageSquare, Download, Filter, Search, Check
} from 'lucide-react';
import { CAMPAIGN_REPORTS, CampaignReportItem } from '../data/delivery-reports-config';

export function DeliveryReportsClient({ locale: _locale }: { locale?: string }) {
  const [selectedReportId, setSelectedReportId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadFeedback, setDownloadFeedback] = useState(false);

  const filteredReports = useMemo(() => {
    return CAMPAIGN_REPORTS.filter((rep) =>
      rep.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.channel.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const activeReport = useMemo(() => {
    return CAMPAIGN_REPORTS.find((r) => r.id === selectedReportId) || CAMPAIGN_REPORTS[0];
  }, [selectedReportId]);

  const handleExportPDF = () => {
    setDownloadFeedback(true);
    setTimeout(() => setDownloadFeedback(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Rapports de distribution &amp; Délivrabilité</h1>
          <p className="text-xs text-slate-500 mt-1">Analysez les taux de livraison, d&apos;ouverture et de clics par canal et campagne.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            size="sm"
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]"
          >
            {downloadFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Exporté en PDF !
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-slate-400" /> Exporter PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 6 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Total envoyés (30j)</p>
            <p className="text-xl font-extrabold text-[#16212B]">18 450</p>
            <p className="text-[10px] font-semibold text-[#17A673]">📈 14% vs mois dernier</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Taux de livraison</p>
            <p className="text-xl font-extrabold text-[#16212B]">99,2%</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Excellente délivrabilité</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Taux d&apos;ouverture</p>
            <p className="text-xl font-extrabold text-[#16212B]">74,8%</p>
            <p className="text-[10px] font-semibold text-[#17A673]">📈 4.2 pts vs mois dernier</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <MousePointer className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Taux de clic (CTR)</p>
            <p className="text-xl font-extrabold text-[#16212B]">52,1%</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Engagement très fort</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 shrink-0 flex items-center justify-center text-rose-600">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Bounces / Échecs</p>
            <p className="text-xl font-extrabold text-[#16212B]">0,8%</p>
            <p className="text-[10px] font-semibold text-emerald-700">Sous le seuil d&apos;alerte</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 shrink-0 flex items-center justify-center text-blue-700">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Canal N°1</p>
            <p className="text-xl font-extrabold text-[#16212B]">WhatsApp</p>
            <p className="text-[10px] font-semibold text-[#17A673]">89% d&apos;ouverture</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Rapports de campagnes</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une campagne..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Nom de la campagne</th>
                    <th className="pb-2">Canal</th>
                    <th className="pb-2 text-center">Envoyés</th>
                    <th className="pb-2 text-center">Livrés %</th>
                    <th className="pb-2 text-center">Ouverts %</th>
                    <th className="pb-2 text-center">Clics %</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredReports.map((rep) => (
                    <tr
                      key={rep.id}
                      onClick={() => setSelectedReportId(rep.id)}
                      className={`cursor-pointer transition-all ${
                        selectedReportId === rep.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{rep.campaignName}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{rep.channel}</td>
                      <td className="py-2.5 text-center font-bold text-[#16212B]">{rep.sentCount}</td>
                      <td className="py-2.5 text-center font-extrabold text-emerald-700">{rep.deliveredPct}</td>
                      <td className="py-2.5 text-center font-extrabold text-[#2487B8]">{rep.openPct}</td>
                      <td className="py-2.5 text-center font-extrabold text-purple-700">{rep.clickPct}</td>
                      <td className="py-2.5 text-[10px] text-slate-400 font-mono">{rep.date}</td>
                      <td className="py-2.5">
                        <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{rep.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            {activeReport ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeReport.campaignName}</h2>
                    <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[9px] font-bold">{activeReport.channel}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Envoyé le {activeReport.date}</p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">Total envoyés :</span><span className="font-bold text-[#16212B]">{activeReport.sentCount}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Taux de livraison :</span><span className="font-bold text-emerald-700">{activeReport.deliveredPct}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Taux d&apos;ouverture :</span><span className="font-bold text-[#2487B8]">{activeReport.openPct}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Taux de clic (CTR) :</span><span className="font-bold text-purple-700">{activeReport.clickPct}</span></div>
                </div>

                <Button onClick={handleExportPDF} className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] text-white hover:bg-[#1B6C93]">
                  Télécharger le rapport ({activeReport.campaignName.slice(0, 15)}...)
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucun rapport sélectionné.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

