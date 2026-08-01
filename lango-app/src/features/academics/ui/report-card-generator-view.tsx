'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { FileCheck, Download, Printer, Send, Eye, CheckCircle2, ShieldCheck, Sparkles, Maximize2 } from 'lucide-react';

export function ReportCardGeneratorView({ locale }: { locale: string }) {
  const [classFilter, setClassFilter] = useState('3ème année Collège');
  const [periodFilter, setPeriodFilter] = useState('2ème trimestre 2024-2025');

  const selectedStudents = [
    { id: 'E-2024-001239', name: 'Salma Bennani', score: '16,25/20', selected: true },
    { id: 'E-2024-001245', name: 'Yassine El Amrani', score: '15,80/20', selected: true },
    { id: 'E-2024-001247', name: 'Maya Benjelloun', score: '17,10/20', selected: true },
    { id: 'E-2024-001246', name: 'Omar El Idrissi', score: '16,70/20', selected: true },
    { id: 'E-2024-001248', name: 'Lina Bakkali', score: '15,50/20', selected: true },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Générer les bulletins</h1>
          <p className="text-xs text-slate-500 mt-1">Configurez, prévisualisez et générez les bulletins scolaires officiels.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 h-9 text-xs rounded-xl">
            <Eye className="w-3.5 h-3.5" />
            <span>Aperçu</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 text-xs rounded-xl">
            <Download className="w-3.5 h-3.5" />
            <span>Exporter la sélection</span>
          </Button>
          <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl px-4">
            <FileCheck className="w-4 h-4" />
            <span>Générer PDF</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Configuration & Right Live PDF Report Card Graphic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Form Configurations */}
        <div className="space-y-6">
          {/* 1. Bulletin Parameters */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Paramètres du bulletin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Classe</label>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full rounded-xl h-9 bg-white">
                    <SelectValue placeholder="3ème année Collège" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3ème année Collège">3ème année Collège</SelectItem>
                    <SelectItem value="6ème A">6ème A</SelectItem>
                    <SelectItem value="2nde A">2nde A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Période</label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-full rounded-xl h-9 bg-white">
                    <SelectValue placeholder="2ème trimestre 2024-2025" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2ème trimestre 2024-2025">2ème trimestre 2024-2025</SelectItem>
                    <SelectItem value="1er trimestre 2024-2025">1er trimestre 2024-2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* 2. Students Selection List */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Élèves sélectionnés</h3>
              <Badge className="bg-[#DCEBF4] text-[#1B6C93]">28 Sélectionnés sur 32</Badge>
            </div>

            <div className="space-y-2">
              {selectedStudents.map((st) => (
                <div key={st.id} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded text-[#2487B8]" />
                    <div>
                      <p className="font-bold text-[#16212B]">{st.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{st.id}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#2487B8]">{st.score}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 3. Generation Actions */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <span className="text-xs font-bold text-[#16212B]">28 élèves prêts pour la génération</span>
            <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl px-4">
              <Send className="w-3.5 h-3.5" />
              <span>Envoyer aux parents</span>
            </Button>
          </Card>
        </div>

        {/* Right Live Report Card Graphic Graphic Sheet */}
        <div className="space-y-4">
          <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-md space-y-6 text-xs relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2487B8] text-white flex items-center justify-center font-extrabold text-lg">
                  S
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-[#16212B]">GROUPE SCOLAIRE ATLAS</h2>
                  <p className="text-[10px] text-slate-400">Casablanca — Maroc • Année scolaire 2024-2025</p>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-[#DCEBF4] text-[#1B6C93]">Bulletin du 2ème trimestre</Badge>
                <p className="text-[10px] text-slate-400 mt-1">Édité le : 20 mai 2025</p>
              </div>
            </div>

            {/* Student Meta Row */}
            <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">Élève</p>
                <p className="font-bold text-[#16212B]">Salma Bennani</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">Classe</p>
                <p className="font-bold text-[#16212B]">3ème année Collège</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">Matricule</p>
                <p className="font-bold text-slate-600 font-mono">E-2024-001239</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">Classement</p>
                <p className="font-extrabold text-[#2487B8]">3 / 32</p>
              </div>
            </div>

            {/* Main Grades Matrix */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 text-left px-2">Matières</th>
                    <th className="py-2 px-2">Coeff.</th>
                    <th className="py-2 px-2">Devoirs</th>
                    <th className="py-2 px-2">Examen</th>
                    <th className="py-2 px-2">Moyenne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="py-2 text-left px-2 font-bold text-[#16212B]">Français</td>
                    <td className="py-2 px-2">4</td>
                    <td className="py-2 px-2">16,00</td>
                    <td className="py-2 px-2">17,00</td>
                    <td className="py-2 px-2 font-bold text-[#2487B8]">16,50</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-left px-2 font-bold text-[#16212B]">Mathématiques</td>
                    <td className="py-2 px-2">5</td>
                    <td className="py-2 px-2">15,00</td>
                    <td className="py-2 px-2">18,00</td>
                    <td className="py-2 px-2 font-bold text-[#2487B8]">16,50</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-left px-2 font-bold text-[#16212B]">Physique-Chimie</td>
                    <td className="py-2 px-2">4</td>
                    <td className="py-2 px-2">14,50</td>
                    <td className="py-2 px-2">16,00</td>
                    <td className="py-2 px-2 font-bold text-[#2487B8]">15,25</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* General Appréciation & Visa */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Appréciation générale</p>
              <p className="text-xs text-slate-700 italic">"Salma est une élève sérieuse, assidue et investie. Elle fait preuve d'excellentes capacités..."</p>
              <div className="pt-2 flex justify-between items-center text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">Moyenne générale</p>
                  <p className="text-xl font-extrabold text-[#2487B8]">16,25 /20</p>
                </div>
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-xs px-3 py-1">Mention Très bien</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
