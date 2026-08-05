'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2, Download, Plus, Search,
} from 'lucide-react';
import { RoomItem, MOCK_ROOMS } from '../data/rooms-config';

export function RoomsClient({ locale: _locale }: { locale?: string } = {}) {
  const [rooms, setRooms] = useState<RoomItem[]>(MOCK_ROOMS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Classroom' | 'Laboratory' | 'Amphitheater'>('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectRoom, setInspectRoom] = useState<RoomItem | null>(null);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    code: '',
    building: 'Bâtiment Principal',
    floor: '1er Étage',
    capacity: '30',
    type: 'Classroom' as RoomItem['type'],
    equipment: 'Vidéoprojecteur, Climatisation',
  });

  const filteredRooms = rooms.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'All' || r.type === selectedCategory;
    const matchesStatus = statusFilter === 'all' || r.occupancyStatus === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const handleCreateRoom = () => {
    if (!newRoom.name.trim()) return;
    const created: RoomItem = {
      id: `r-${Date.now()}`,
      name: newRoom.name.trim(),
      code: newRoom.code.trim() || `ROOM-${Date.now()}`,
      building: newRoom.building,
      floor: newRoom.floor,
      capacity: Number(newRoom.capacity) || 30,
      type: newRoom.type,
      equipment: newRoom.equipment.split(',').map(e => e.trim()).filter(Boolean),
      occupancyStatus: 'Available',
      schedule: [],
    };
    setRooms(prev => [created, ...prev]);
    setIsAddOpen(false);
    setNewRoom({ name: '', code: '', building: 'Bâtiment Principal', floor: '1er Étage', capacity: '30', type: 'Classroom', equipment: 'Vidéoprojecteur, Climatisation' });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Gestion des Salles & Capacité des Locaux</h1>
          <p className="text-xs text-slate-500 mt-1">Inventaire des salles de cours, laboratoires, capacités d&apos;accueil et statut d&apos;occupation en temps réel.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter le plan des salles</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une salle / local</span>
          </Button>
        </div>
      </div>

      {/* Top 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-500">Total Salles Recensées</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{rooms.length} Locaux</p>
          <p className="text-[10px] text-slate-400">Capacité globale: {rooms.reduce((a, r) => a + r.capacity, 0)} places</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">Salles Libres Actuellement</p>
          <p className="text-2xl font-extrabold text-[#17A673]">
            {rooms.filter(r => r.occupancyStatus === 'Available').length} Salles libres
          </p>
          <p className="text-[10px] text-slate-400">Prêtes pour cours ou épreuves</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">Taux d&apos;Occupation Média</p>
          <p className="text-2xl font-extrabold text-[#2487B8]">68%</p>
          <p className="text-[10px] text-slate-400">Plage de 08:00 à 18:00</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['All', 'Classroom', 'Laboratory', 'Amphitheater'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                selectedCategory === cat ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat === 'All' ? 'Toutes les salles' : cat === 'Classroom' ? 'Salles de cours' : cat === 'Laboratory' ? 'Laboratoires' : 'Amphithéâtres'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 rounded-xl text-xs bg-slate-50 border-none">
              <SelectValue placeholder="Tous statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="Available">Libres</SelectItem>
              <SelectItem value="Occupied">Occupées</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher salle ou code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
            />
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map(room => (
          <Card key={room.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#16212B]">{room.name}</h3>
                    <p className="text-[10px] text-slate-400">{room.code} • {room.building}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  room.occupancyStatus === 'Occupied' ? 'bg-[#DCEBF4] text-[#1B6C93]' :
                  room.occupancyStatus === 'Available' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-amber-100 text-amber-800'
                }`}>
                  {room.occupancyStatus === 'Occupied' ? 'Occupée' : room.occupancyStatus === 'Available' ? 'Libre' : 'Maintenance'}
                </span>
              </div>

              <div className="pt-2 text-xs text-slate-600 space-y-1">
                <p className="flex items-center justify-between">
                  <span className="text-slate-400">Capacité maximale:</span>
                  <strong className="text-[#16212B]">{room.capacity} Élèves</strong>
                </p>
                {room.currentClass && (
                  <p className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Cours en cours:</span>
                    <strong className="text-[#2487B8]">{room.currentClass}</strong>
                  </p>
                )}
              </div>

              {/* Equipment badges */}
              <div className="flex flex-wrap gap-1 pt-1">
                {room.equipment.map((eq, i) => (
                  <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {eq}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400 font-bold">{room.floor}</span>
              <Button
                onClick={() => setInspectRoom(room)}
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-bold text-[#2487B8] hover:bg-[#DCEBF4]/40"
              >
                Planning de la salle →
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Room Schedule Drawer Dialog */}
      <Dialog open={!!inspectRoom} onOpenChange={() => setInspectRoom(null)}>
        {inspectRoom && (
          <DialogContent className="max-w-md bg-white rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#2487B8]" />
                Planning du Jour: {inspectRoom.name} ({inspectRoom.code})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 my-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p className="font-bold text-[#16212B]">Informations Local:</p>
                <p className="text-slate-500">{inspectRoom.building} • {inspectRoom.floor} • Capacité: {inspectRoom.capacity} places</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-[#16212B] text-xs">Occupations du jour:</h4>
                {inspectRoom.schedule.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 rounded-xl">Aucun cours planifié pour aujourd&apos;hui.</p>
                ) : (
                  inspectRoom.schedule.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs">
                      <span className="font-bold text-[#2487B8]">{slot.time}</span>
                      <span className="font-extrabold text-[#16212B]">{slot.course}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setInspectRoom(null)} className="w-full rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
                Fermer l&apos;aperçu
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Ajouter une salle Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#2487B8]" />
              Ajouter une nouvelle salle / local
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du local *</label>
              <Input
                placeholder="Ex. Salle 204"
                value={newRoom.name}
                onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Code / Identifiant *</label>
                <Input
                  placeholder="Ex. A-204"
                  value={newRoom.code}
                  onChange={e => setNewRoom({ ...newRoom, code: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Capacité *</label>
                <Input
                  type="number"
                  placeholder="30"
                  value={newRoom.capacity}
                  onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bâtiment *</label>
                <Input
                  value={newRoom.building}
                  onChange={e => setNewRoom({ ...newRoom, building: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Type de local *</label>
                <Select value={newRoom.type} onValueChange={val => setNewRoom({ ...newRoom, type: val as RoomItem['type'] })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classroom">Salle de cours</SelectItem>
                    <SelectItem value="Laboratory">Laboratoire</SelectItem>
                    <SelectItem value="Amphitheater">Amphithéâtre</SelectItem>
                    <SelectItem value="Computer Lab">Salle Informatique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Équipements (séparés par virgules)</label>
              <Input
                placeholder="Vidéoprojecteur, Climatisation, TBI"
                value={newRoom.equipment}
                onChange={e => setNewRoom({ ...newRoom, equipment: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateRoom} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Créer le local
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
