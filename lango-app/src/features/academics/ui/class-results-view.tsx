'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, Filter, Download, Send, TrendingUp, CheckCircle2,
  AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';

type StudentStatus = 'Validé' | 'En attente' | 'Corrigé';

type Student = {
  id: string;
  name: string;
  class: string;
  rawScore: number;
  adjustment: number;
  finalScore: number;
  mention: string;
  status: StudentStatus;
  initials: string;
  avatarColor: string;
  selected?: boolean;
};

const STUDENTS: Student[] = [
  { id: 's1', name: 'Bennani Salma', class: '3BAC-A', rawScore: 16.25, adjustment: 0.25, finalScore: 16.50, mention: 'Très bien', status: 'Validé', initials: 'BS', avatarColor: 'bg-[#DCEBF4] text-[#1B6C93]' },
  { id: 's2', name: 'El Fassi Youssef', class: '3BAC-A', rawScore: 18.75, adjustment: -0.25, finalScore: 18.50, mention: 'Très bien', status: 'Corrigé', initials: 'EF', avatarColor: 'bg-[#DDF5EC] text-[#17A673]', selected: true },
  { id: 's3', name: 'Bouziane Inès', class: '3BAC-A', rawScore: 14.75, adjustment: 0, finalScore: 14.75, mention: 'Bien', status: 'Validé', initials: 'BI', avatarColor: 'bg-amber-100 text-amber-700' },
  { id: 's4', name: 'El Mansouri Adam', class: '3BAC-A', rawScore: 10.25, adjustment: 0.50, finalScore: 10.75, mention: 'Assez bien', status: 'Validé', initials: 'EA', avatarColor: 'bg-violet-100 text-violet-700' },
  { id: 's5', name: 'Chraibi Lina', class: '3BAC-A', rawScore: 8.50, adjustment: 0.75, finalScore: 9.25, mention: 'Passable', status: 'En attente', initials: 'CL', avatarColor: 'bg-rose-100 text-rose-600' },
  { id: 's6', name: 'Tahiri Mehdi', class: '3BAC-A', rawScore: 12.00, adjustment: 0, finalScore: 12.00, mention: 'Assez bien', status: 'Corrigé', initials: 'TM', avatarColor: 'bg-teal-100 text-teal-700' },
  { id: 's7', name: 'Rachidi Maryem', class: '3BAC-A', rawScore: 15.25, adjustment: 0.25, finalScore: 15.50, mention: 'Bien', status: 'Corrigé', initials: 'RM', avatarColor: 'bg-pink-100 text-pink-600' },
  { id: 's8', name: 'Ait Ali Yassine', class: '3BAC-A', rawScore: 6.75, adjustment: 0, finalScore: 6.75, mention: 'Insuffisant', status: 'En attente', initials: 'AY', avatarColor: 'bg-orange-100 text-orange-600' },
];

const CLASS_RESULTS = [
  { class: '3BAC-A', count: 92, avg: 14.28, rate: 89, evolution: '+6.0%', up: true },
  { class: '3BAC-B', count: 90, avg: 13.64, rate: 83, evolution: '+3.2%', up: true },
  { class: '3BAC-C', count: 88, avg: 12.97, rate: 77, evolution: '+2.1%', up: true },
];

const MODERATION_DECISIONS = [
  { time: '20/05 09:27', user: 'Youssef El Fassi', class: '3BAC-A', adjustment: -0.25, status: 'Validé' },
  { time: '20/05 09:12', user: 'Inès Bouziane', class: '3BAC-A', adjustment: 0, status: 'Validé' },
  { time: '20/05 08:58', user: 'Adam El Mansouri', class: '3BAC-A', adjustment: 0.50, status: 'Validé' },
  { time: '20/05 08:44', user: 'Mehdi Tahiri', class: '3BAC-A', adjustment: 0, status: 'Validé' },
  { time: '20/05 08:31', user: 'Maryem Rachidi', class: '3BAC-A', adjustment: 0.25, status: 'Validé' },
];

const DISTRIBUTION = [
  { range: '0 – 4', count: 0 },
  { range: '4 – 6', count: 2 },
  { range: '6 – 8', count: 4 },
  { range: '8 – 10', count: 10 },
  { range: '10 – 12', count: 10 },
  { range: '12 – 14', count: 18 },
  { range: '14 – 16', count: 18 },
  { range: '16 – 18', count: 18 },
  { range: '18 – 20', count: 12 },
];

function statusColor(s: StudentStatus) {
  if (s === 'Validé') return 'bg-[#DDF5EC] text-[#17A673]';
  if (s === 'Corrigé') return 'bg-[#DCEBF4] text-[#1B6C93]';
  return 'bg-amber-100 text-amber-700';
}

function mentionColor(m: string) {
  if (m === 'Très bien') return 'text-[#17A673] font-bold';
  if (m === 'Bien') return 'text-[#2487B8] font-bold';
  if (m === 'Assez bien') return 'text-violet-600 font-bold';
  if (m === 'Passable') return 'text-amber-600 font-bold';
  return 'text-rose-600 font-bold';
}

const MENTIONS_DIST = [
  { label: 'Très bien (≥ 16)', count: 22, pct: 23.9, color: '#17A673' },
  { label: 'Bien (14 – 15,99)', count: 26, pct: 28.3, color: '#2487B8' },
  { label: 'Assez bien (12 – 13,99)', count: 18, pct: 19.6, color: '#8B5CF6' },
  { label: 'Passable (10 – 11,99)', count: 10, pct: 10.9, color: '#F59E0B' },
  { label: 'Insuffisant (< 10)', count: 16, pct: 17.4, color: '#EF4444' },
];

const EVAL_CRITERIA = [
  { label: 'Compréhension', bareme: 4.00, note: 3.75 },
  { label: 'Méthodologie & démarche', bareme: 5.00, note: 4.75 },
  { label: 'Applications & calculs', bareme: 6.00, note: 5.75 },
  { label: 'Présentation & rédaction', bareme: 3.00, note: 2.50 },
];

export function ClassResultsView() {
  const [selectedStudent, setSelectedStudent] = useState<Student>(STUDENTS[1]!);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous les statuts');
  const [moderatorDecision, setModeratorDecision] = useState('Confirmer la note finale');
  const [publishMode, setPublishMode] = useState<'Parents et élèves' | 'Directeurs'>('Parents et élèves');
  const [includeRanking, setIncludeRanking] = useState(true);
  const [includeAppreciations, setIncludeAppreciations] = useState(true);
  const [pubDate] = useState('21/05/2026 18:00');

  const filtered = STUDENTS.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Tous les statuts' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const maxBar = Math.max(...DISTRIBUTION.map(d => d.count));

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Notes, modération &amp; résultats</h1>
          <p className="text-xs text-slate-500 mt-1">Vérifiez les copies, modérez les notes et publiez les résultats en toute confiance.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Importer les notes
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Lancer la modération
          </Button>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 shadow-sm">
            <Send className="w-3.5 h-3.5" />
            Publier les résultats
          </Button>
        </div>
      </div>

      {/* Breadcrumb / context filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'Année scolaire', value: '2025 – 2026' },
          { label: 'Période d\'examen', value: 'Contrôle 3' },
          { label: 'Classe', value: '3BAC Sciences A' },
          { label: 'Matière', value: 'Mathématiques' },
          { label: 'Épreuve', value: 'Contrôle 3 – Mai 2026' },
        ].map(filter => (
          <div key={filter.label} className="flex items-center gap-1">
            <select className="h-8 pl-2 pr-6 text-[11px] border border-slate-200 rounded-xl bg-white font-semibold">
              <option>{filter.value}</option>
            </select>
          </div>
        ))}
      </div>

      {/* Stat Band */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <CheckCircle2 className="w-5 h-5 text-[#1B6C93]" />, color: 'bg-[#DCEBF4]', label: 'Copies corrigées', value: '86 / 92', sub: '93,5%' },
          { icon: <AlertCircle className="w-5 h-5 text-amber-600" />, color: 'bg-amber-100', label: 'En modération', value: '6', sub: '6,5%' },
          { icon: <Send className="w-5 h-5 text-violet-600" />, color: 'bg-violet-100', label: 'Résultats prêts', value: '80', sub: '87,0%' },
          { icon: <TrendingUp className="w-5 h-5 text-[#17A673]" />, color: 'bg-[#DDF5EC]', label: 'Moyenne générale', value: '14,28 / 20', sub: '↑ +1,12 pts vs Ctrl 2' },
        ].map((stat, i) => (
          <Card key={i} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">{stat.label}</p>
              <p className="text-xl font-extrabold text-[#16212B] leading-tight">{stat.value}</p>
              <p className="text-[10px] text-slate-500 font-semibold">{stat.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* 3-Column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px_280px] gap-5 items-start">
        {/* LEFT — Student grade table */}
        <div className="space-y-4">
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="p-4 flex items-center gap-2 flex-wrap border-b border-slate-100">
              <h3 className="text-xs font-extrabold text-[#16212B]">Élèves (92)</h3>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input placeholder="Rechercher un élève…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} className="pl-8 h-8 text-[11px] bg-slate-50 rounded-xl border-slate-200 w-44 border focus:outline-none focus:border-[#2487B8] rounded-xl px-3" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 px-2 text-[11px] border border-slate-200 rounded-xl bg-slate-50 font-semibold">
                  <option>Tous les statuts</option>
                  <option>Validé</option>
                  <option>Corrigé</option>
                  <option>En attente</option>
                </select>
                <button className="h-8 px-2 border border-slate-200 rounded-xl bg-slate-50 text-[11px] font-semibold flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filtres
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-4"><input type="checkbox" className="accent-[#2487B8]" /></th>
                    <th className="py-2.5 px-3 text-left">Élève</th>
                    <th className="py-2.5 px-3 text-left">Classe</th>
                    <th className="py-2.5 px-3 text-center">Note brute /20</th>
                    <th className="py-2.5 px-3 text-center">Ajustement +/−</th>
                    <th className="py-2.5 px-3 text-center">Note finale /20</th>
                    <th className="py-2.5 px-3 text-center">Mention</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(student => (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`cursor-pointer transition-colors ${selectedStudent.id === student.id ? 'bg-[#DCEBF4]/30' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-2.5 px-4"><input type="checkbox" checked={!!student.selected} onChange={() => {}} className="accent-[#2487B8]" /></td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${student.avatarColor} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                            {student.initials}
                          </div>
                          <span className="font-bold text-[#16212B]">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{student.class}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-[#16212B]">{student.rawScore.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-center font-mono font-bold ${student.adjustment > 0 ? 'text-[#17A673]' : student.adjustment < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {student.adjustment > 0 ? '+' : ''}{student.adjustment.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-extrabold text-[#16212B] text-sm">{student.finalScore.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge className={`text-[9px] border-none font-bold ${statusColor(student.status)}`}>{student.status}</Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <button className="p-1 text-slate-300 hover:text-slate-500">⋮</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 flex items-center justify-between border-t border-slate-100 text-[10px] text-slate-500">
              <span>Affichage de 1 à 8 sur 92 élèves</span>
              <div className="flex items-center gap-1">
                <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100"><ChevronLeft className="w-3 h-3" /></button>
                {[1,2,3,4,5,'…',10].map((n, i) => (
                  <button key={i} className={`w-6 h-6 rounded text-[9px] font-bold ${n === 1 ? 'bg-[#2487B8] text-white' : 'hover:bg-slate-100'}`}>{n}</button>
                ))}
                <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100"><ChevronRight className="w-3 h-3" /></button>
                <select className="ml-2 h-6 px-1 text-[9px] border border-slate-200 rounded">
                  <option>10 / page</option>
                  <option>25 / page</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Distribution bar chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <h3 className="text-xs font-extrabold text-[#16212B]">Distribution des notes</h3>
              <p className="text-[10px] text-slate-400">Nombre d&apos;élèves</p>
              <div className="flex items-end gap-1.5 h-24">
                {DISTRIBUTION.map(bar => (
                  <div key={bar.range} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full bg-[#2487B8] rounded-t-sm" style={{ height: `${(bar.count / maxBar) * 100}%` }} />
                    <span className="text-[8px] text-slate-400 rotate-45 origin-left">{(bar.range.split('–')[0] ?? '').trim()}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 text-center">Notes (/20)</p>
            </Card>

            {/* Results by class */}
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#16212B]">Résultats par classe</h3>
                <button className="text-[10px] font-bold text-[#2487B8]">Voir le détail par classe →</button>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                    <th className="pb-2 text-left">Classe</th>
                    <th className="pb-2 text-center">Effectif</th>
                    <th className="pb-2 text-center">Moyenne</th>
                    <th className="pb-2 text-center">Taux</th>
                    <th className="pb-2 text-right">Évolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CLASS_RESULTS.map(row => (
                    <tr key={row.class}>
                      <td className="py-1.5 font-bold text-[#16212B]">{row.class}</td>
                      <td className="py-1.5 text-center text-slate-600">{row.count}</td>
                      <td className="py-1.5 text-center font-bold">{row.avg.toFixed(2)}</td>
                      <td className="py-1.5 text-center font-bold text-[#2487B8]">{row.rate}%</td>
                      <td className={`py-1.5 text-right font-bold ${row.up ? 'text-[#17A673]' : 'text-rose-600'}`}>{row.evolution} {row.up ? '↑' : '↓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Recent moderation decisions */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#16212B]">Décisions de modération récentes</h3>
              <button className="text-[10px] font-bold text-[#2487B8] hover:text-[#1B6C93]">Voir toutes les décisions →</button>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                  <th className="pb-2 text-left">Heure</th>
                  <th className="pb-2 text-left">Utilisateur</th>
                  <th className="pb-2 text-center">Classe</th>
                  <th className="pb-2 text-center">Ajustement</th>
                  <th className="pb-2 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MODERATION_DECISIONS.map((d, i) => (
                  <tr key={i}>
                    <td className="py-1.5 font-mono text-[10px] text-slate-500">{d.time}</td>
                    <td className="py-1.5 font-semibold text-[#16212B]">{d.user}</td>
                    <td className="py-1.5 text-center text-slate-600">{d.class}</td>
                    <td className={`py-1.5 text-center font-bold ${d.adjustment > 0 ? 'text-[#17A673]' : d.adjustment < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {d.adjustment > 0 ? '+' : ''}{d.adjustment.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-center">
                      <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{d.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* CENTER — Selected student detail */}
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4 sticky top-4">
          <h3 className="text-xs font-extrabold text-[#16212B]">Copie sélectionnée : {selectedStudent.name}</h3>

          {/* Score summary */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] font-extrabold text-[#16212B]">Résumé de la copie</p>
            {[
              { label: 'Note brute', value: `${selectedStudent.rawScore.toFixed(2)} / 20`, color: '' },
              { label: 'Barème total', value: '20,00', color: '' },
              { label: 'Pourcentage', value: `${(selectedStudent.rawScore * 5).toFixed(2)}%`, color: '' },
              { label: 'Date de correction', value: '18 mai 2026', color: '' },
              { label: 'Corrigée par', value: 'Omar Taïl…', color: '' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-[11px] border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-semibold">{row.label}</span>
                <span className={`font-bold text-[#16212B] ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Evaluation criteria */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-[#16212B]">Critères d&apos;évaluation</p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                  <th className="pb-1.5 text-left">Critère</th>
                  <th className="pb-1.5 text-center">Barème</th>
                  <th className="pb-1.5 text-right">Note brute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {EVAL_CRITERIA.map(c => (
                  <tr key={c.label}>
                    <td className="py-1.5 font-semibold text-[#16212B]">{c.label}</td>
                    <td className="py-1.5 text-center text-slate-500">{c.bareme.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-bold text-[#16212B]">{c.note.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-extrabold">
                  <td className="pt-2 text-[#16212B]">Total</td>
                  <td className="pt-2 text-center text-[#16212B]">18,00</td>
                  <td className="pt-2 text-right text-[#16212B]">{selectedStudent.rawScore.toFixed(2)} / 20,00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Corrector comments */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-[#16212B]">Commentaires du correcteur</p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              Très bonne maîtrise des notions. Démarche rigoureuse et bien présentée. Quelques petites imprécisions dans la question 3.
            </div>
            <p className="text-[10px] text-slate-400">Omar Taïl · 18 mai 2026</p>
          </div>

          {/* Moderation */}
          <div className="space-y-2 p-3 bg-[#DDF5EC]/40 rounded-xl border border-[#17A673]/20">
            <p className="text-[10px] font-extrabold text-[#16212B]">Ajustement modérateur</p>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500">Modérateur</span>
              <select className="h-7 px-2 text-[11px] border border-slate-200 rounded-lg bg-white flex-1">
                <option>Salma Bennani</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500">Ajustement</span>
              <input type="number" step="0.25" defaultValue={selectedStudent.adjustment} className="h-7 w-16 px-2 text-xs border border-slate-200 rounded-lg bg-white font-mono text-center" />
              <span className="text-[#17A673] font-bold">→</span>
              <input type="number" defaultValue={selectedStudent.finalScore} className="h-7 w-20 px-2 text-xs border border-slate-200 rounded-lg bg-white font-mono font-bold text-center" />
            </div>
            <div className="space-y-1 text-[11px]">
              <label className="font-bold text-slate-600">Justification</label>
              <input className="w-full h-8 px-3 text-[10px] border border-slate-200 rounded-xl bg-white" defaultValue="Légère surévaluation de la présentation." />
            </div>
          </div>

          {/* Decision */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-[#16212B]">Décision de modération</p>
            {['Confirmer la note finale', 'Modifier davantage'].map(d => (
              <label key={d} className="flex items-center gap-2 text-[11px] cursor-pointer">
                <input type="radio" name="decision" checked={moderatorDecision === d} onChange={() => setModeratorDecision(d)} className="accent-[#2487B8]" />
                <span className="font-semibold text-slate-700">{d}</span>
              </label>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold text-[#17A673]">Validé</span>
              <div className="text-[10px] text-slate-400">Décidé par Salma Bennani · 20 mai 2026</div>
            </div>
          </div>

          {/* Audit trail */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold text-[#16212B]">Historique d&apos;audit</p>
            {[
              { time: '18/05 10:42', color: 'bg-[#2487B8]', text: 'Copie corrigée par Omar Taïl' },
              { time: '19/05 15:21', color: 'bg-amber-400', text: 'Soumise à modération' },
              { time: '20/05 09:15', color: 'bg-[#17A673]', text: 'Ajustement proposé par Salma Bennani (-0,25)' },
              { time: '20/05 09:27', color: 'bg-[#17A673]', text: 'Décision validée' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <div className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
                <span className="font-mono text-slate-400">{item.time}</span>
                <span className="text-slate-600">{item.text}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* RIGHT — Overview & publication */}
        <div className="space-y-4">
          {/* Results overview */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <h3 className="text-xs font-extrabold text-[#16212B]">Aperçu des résultats (3BAC Sciences A – Mathématiques)</h3>

            {/* Circular progress */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EEF2F7" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2487B8" strokeWidth="3"
                    strokeDasharray={`${89} ${100 - 89}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-extrabold text-[#16212B]">89%</span>
                  <span className="text-[8px] text-slate-400">82 / 92 élèves</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <p><span className="font-extrabold text-[#16212B]">Taux de réussite</span></p>
                <p>+6% vs Ctrl 2</p>
              </div>
            </div>

            {/* Mention breakdown */}
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold text-[#16212B]">Répartition des mentions</p>
              {MENTIONS_DIST.map(m => (
                <div key={m.label} className="flex items-center gap-2 text-[10px]">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="text-slate-600 flex-1">{m.label}</span>
                  <span className="font-bold text-[#16212B]">{m.count}</span>
                  <span className="text-slate-400 w-10 text-right">{m.pct}%</span>
                </div>
              ))}
            </div>

            {/* Best results */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-extrabold text-[#16212B]">Meilleurs résultats</p>
              {[
                { rank: 1, name: 'El Fassi Youssef', score: 18.50 },
                { rank: 2, name: 'Bennani Salma', score: 16.50 },
                { rank: 3, name: 'Rachidi Maryem', score: 15.50 },
              ].map(r => (
                <div key={r.rank} className="flex items-center gap-2 text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold text-[10px] flex items-center justify-center">{r.rank}</span>
                  <span className="font-semibold text-[#16212B] flex-1">{r.name}</span>
                  <span className="font-extrabold text-[#2487B8]">{r.score.toFixed(2)}/20</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Publication settings */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <h3 className="text-xs font-extrabold text-[#16212B]">Paramètres de publication</h3>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-600">Résultats visibles par</label>
              <select value={publishMode} onChange={e => setPublishMode(e.target.value as typeof publishMode)} className="w-full h-8 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold">
                <option>Parents et élèves</option>
                <option>Directeurs</option>
                <option>Tous</option>
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600">Inclure le classement</span>
              <button
                onClick={() => setIncludeRanking(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${includeRanking ? 'bg-[#2487B8]' : 'bg-slate-200'} relative`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeRanking ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600">Inclure les appréciations</span>
              <button
                onClick={() => setIncludeAppreciations(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${includeAppreciations ? 'bg-[#2487B8]' : 'bg-slate-200'} relative`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeAppreciations ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-600">Date de publication</label>
              <input type="datetime-local" defaultValue="2026-05-21T18:00" className="w-full h-8 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 font-mono" />
            </div>

            <div className="p-2.5 bg-[#DCEBF4]/50 rounded-xl border border-[#2487B8]/20 text-[10px] text-[#1B6C93] font-semibold">
              Les résultats seront publiés pour la classe 3BAC Sciences A – Mathématiques à {pubDate}.
            </div>

            <Button className="w-full h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Publier les résultats
            </Button>

            <button className="text-[10px] font-bold text-[#2487B8] hover:text-[#1B6C93] w-full text-center">Voir le classement complet →</button>
          </Card>
        </div>
      </div>
    </div>
  );
}
