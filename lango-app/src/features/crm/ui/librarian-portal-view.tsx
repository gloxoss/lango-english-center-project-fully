'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpen, Clock, Bookmark, PlusCircle, Search, Filter, RotateCcw, Plus, ArrowRightLeft, BookMarked, Calendar
} from 'lucide-react';

type BorrowStatus = 'À temps' | 'En retard (1 j)' | 'En retard (2 j)' | 'En retard (0 j)';

type ActiveBorrow = {
  id: string;
  member: string;
  class: string;
  book: string;
  author: string;
  borrowDate: string;
  dueDate: string;
  status: BorrowStatus;
  avatar: string;
};

const ACTIVE_BORROWS: ActiveBorrow[] = [
  { id: '1', member: 'Yassine Ait Lahcen', class: '2nde A', book: 'L\'Étranger', author: 'Albert Camus', borrowDate: '13 mai 2025', dueDate: '27 mai 2025', status: 'À temps', avatar: 'YA' },
  { id: '2', member: 'Inès Kabbaj', class: '1ère B', book: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', borrowDate: '10 mai 2025', dueDate: '24 mai 2025', status: 'À temps', avatar: 'IK' },
  { id: '3', member: 'Omar Amrani', class: '3ème C', book: 'Histoire du Maroc contemporain', author: 'Collectif', borrowDate: '30 avr. 2025', dueDate: '20 mai 2025', status: 'En retard (1 j)', avatar: 'OA' },
  { id: '4', member: 'Sara Alaoui', class: '1ère A', book: '1984', author: 'George Orwell', borrowDate: '5 mai 2025', dueDate: '19 mai 2025', status: 'En retard (2 j)', avatar: 'SA' },
  { id: '5', member: 'Mehdi Haddad', class: '2nde B', book: 'Sapiens : Une brève histoire de l\'humanité', author: 'Yuval Noah Harari', borrowDate: '7 mai 2025', dueDate: '21 mai 2025', status: 'En retard (0 j)', avatar: 'MH' },
];

const UPCOMING_RETURNS = [
  { book: 'L\'Étranger', member: 'Yassine Ait Lahcen (2nde A)', dueDate: '27 mai 2025', color: 'bg-blue-600' },
  { book: 'Le Petit Prince', member: 'Inès Kabbaj (1ère B)', dueDate: '24 mai 2025', color: 'bg-amber-500' },
  { book: 'Sapiens : Une brève histoire de l\'humanité', member: 'Mehdi Haddad (2nde B)', dueDate: '21 mai 2025', color: 'bg-rose-500' },
];

const MOST_BORROWED_BOOKS = [
  { rank: 1, title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', count: 12 },
  { rank: 2, title: 'L\'Étranger', author: 'Albert Camus', count: 9 },
  { rank: 3, title: '1984', author: 'George Orwell', count: 8 },
  { rank: 4, title: 'Sapiens : Une brève histoire de l\'humanité', author: 'Yuval Noah Harari', count: 7 },
  { rank: 5, title: 'L\'Alchimiste', author: 'Paulo Coelho', count: 6 },
];

function getBorrowStatusBadge(status: BorrowStatus) {
  if (status === 'À temps') return 'bg-[#DDF5EC] text-[#17A673] border-none';
  return 'bg-rose-100 text-rose-600 border-none';
}

export function LibrarianPortalView() {
  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Portail bibliothèque</h1>
          <p className="text-xs text-slate-500 mt-1">Suivez le catalogue, les emprunts, les retours et les réservations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
            <PlusCircle className="w-3.5 h-3.5" /> Enregistrer un emprunt
          </Button>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
            <RotateCcw className="w-3.5 h-3.5" /> Traiter un retour
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]">
            <Plus className="w-3.5 h-3.5" /> Ajouter un ouvrage
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Ouvrages empruntés</p>
            <p className="text-xl font-extrabold text-[#16212B]">128</p>
            <p className="text-[10px] font-semibold text-slate-500">Actuellement en circulation ℹ️</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 shrink-0 flex items-center justify-center text-rose-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Retours en retard</p>
            <p className="text-xl font-extrabold text-[#16212B]">18</p>
            <p className="text-[10px] font-semibold text-rose-600 font-bold">À retourner au plus vite ℹ️</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Réservations actives</p>
            <p className="text-xl font-extrabold text-[#16212B]">34</p>
            <p className="text-[10px] font-semibold text-slate-500">En attente de disponibilité ℹ️</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Nouveaux ouvrages</p>
            <p className="text-xl font-extrabold text-[#16212B]">27</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Ajoutés ce mois-ci ℹ️</p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Left Table (8 cols) & Right Sidebar (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Emprunts en cours & Actions rapides */}
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Emprunts en cours</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="Rechercher un membre ou un ouvrage..." className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-64" />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200 gap-1 text-slate-600">
                  <Filter className="w-3.5 h-3.5" /> Filtres
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Membre</th>
                    <th className="pb-2">Ouvrage</th>
                    <th className="pb-2">Date d&apos;emprunt</th>
                    <th className="pb-2">Date de retour prévue</th>
                    <th className="pb-2">Statut</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {ACTIVE_BORROWS.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {b.avatar}
                          </div>
                          <div>
                            <p className="font-bold text-[#16212B] text-[11px]">{b.member}</p>
                            <p className="text-[9px] text-slate-400 font-semibold">{b.class}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <p className="font-bold text-[#16212B] text-[11px]">{b.book}</p>
                        <p className="text-[9px] text-slate-400">{b.author}</p>
                      </td>
                      <td className="py-2.5 text-slate-500 text-[11px]">{b.borrowDate}</td>
                      <td className="py-2.5 text-slate-500 text-[11px]">{b.dueDate}</td>
                      <td className="py-2.5">
                        <Badge className={`text-[9px] font-bold ${getBorrowStatusBadge(b.status)}`}>{b.status}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <button className="text-slate-400 hover:text-slate-600 font-bold">⋮</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir tous les emprunts →
            </button>
          </Card>

          {/* Actions rapides */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">Actions rapides</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3 hover:bg-slate-100/80 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-[#2487B8] text-white flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#16212B]">Enregistrer un emprunt</p>
                  <p className="text-[9px] text-slate-400">Scanner ou rechercher un membre et un ouvrage</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3 hover:bg-slate-100/80 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-[#17A673] text-white flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#16212B]">Traiter un retour</p>
                  <p className="text-[9px] text-slate-400">Scanner ou rechercher un ouvrage et vérifier l&apos;état</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3 hover:bg-slate-100/80 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#16212B]">Ajouter un ouvrage</p>
                  <p className="text-[9px] text-slate-400">Ajouter un nouvel ouvrage au catalogue</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (4 cols): Retours à venir & Ouvrages les plus empruntés */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Retours à venir</h2>
              <div className="flex items-center gap-1 text-xs">
                <button className="text-slate-400 hover:text-slate-600">‹</button>
                <button className="text-slate-400 hover:text-slate-600">›</button>
                <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">Aujourd&apos;hui</span>
              </div>
            </div>

            {/* Days Calendar Strip */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold py-1 border-b border-slate-100">
              <div className="text-slate-400">LUN<br /><span className="text-slate-700">19</span></div>
              <div className="text-slate-400">MAR<br /><span className="text-slate-700">20</span></div>
              <div className="text-[#2487B8] font-extrabold">MER<br /><span className="bg-[#2487B8] text-white rounded-full w-5 h-5 inline-flex items-center justify-center mt-0.5">21</span></div>
              <div className="text-slate-400">JEU<br /><span className="text-slate-700">22</span></div>
              <div className="text-slate-400">VEN<br /><span className="text-slate-700">23</span></div>
              <div className="text-slate-400">SAM<br /><span className="text-slate-700">24</span></div>
              <div className="text-slate-400">DIM<br /><span className="text-slate-700">25</span></div>
            </div>

            <div className="space-y-2">
              {UPCOMING_RETURNS.map((ret, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ret.color}`} />
                  <div className="flex-1">
                    <p className="font-bold text-[#16212B] text-[11px]">{ret.book}</p>
                    <p className="text-[10px] text-slate-400">{ret.member}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{ret.dueDate}</span>
                </div>
              ))}
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir le calendrier complet →
            </button>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">Ouvrages les plus empruntés</h2>

            <div className="space-y-2 text-xs">
              {MOST_BORROWED_BOOKS.map((book) => (
                <div key={book.rank} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-extrabold text-[10px] flex items-center justify-center">
                      {book.rank}
                    </span>
                    <div>
                      <p className="font-bold text-[#16212B] text-[11px]">{book.title}</p>
                      <p className="text-[9px] text-slate-400">{book.author}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#2487B8] text-xs">{book.count}</span>
                </div>
              ))}
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir le rapport complet →
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
