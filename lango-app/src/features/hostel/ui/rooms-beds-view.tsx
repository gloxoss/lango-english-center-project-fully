'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, BedDouble, DoorOpen, Loader2, Pencil, Plus, Search, Wrench,
} from 'lucide-react';
import { api, errMessage } from './api';

type HostelRow = { id: string; name: string; code: string; status: string };
type ZoneRow = { id: string; hostelId: string; name: string; status: string };
type CategoryRow = { id: string; name: string; code: string; status: string };

type RoomRow = {
  id: string;
  hostelId: string;
  zoneId: string | null;
  categoryId: string | null;
  code: string;
  name: string | null;
  isAccessible: boolean;
  status: 'active' | 'inactive' | 'out_of_service' | 'archived';
  zoneName: string | null;
  categoryName: string | null;
};

type BedRow = {
  id: string;
  roomId: string;
  code: string;
  isAccessible: boolean;
  status: 'active' | 'out_of_service' | 'archived';
  notes: string | null;
};

const ROOM_STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  out_of_service: 'Hors service',
  archived: 'Archivé',
};

const emptyRoomForm = {
  hostelId: '',
  zoneId: 'none',
  categoryId: 'none',
  code: '',
  name: '',
  isAccessible: false,
  status: 'active',
};

const emptyBedForm = {
  code: '',
  isAccessible: false,
  status: 'active',
  notes: '',
};

export function RoomsBedsView() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterHostel, setFilterHostel] = useState('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomModal, setRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [bedModal, setBedModal] = useState(false);
  const [editingBed, setEditingBed] = useState<BedRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [bedForm, setBedForm] = useState(emptyBedForm);

  const loadRooms = useCallback(async (hostelId?: string) => {
    setLoading(true);
    setError(null);
    const qs = hostelId ? `?hostelId=${encodeURIComponent(hostelId)}` : '';
    const res = await api<RoomRow[]>(`/api/addons/hostel/rooms${qs}`);
    if (res.ok && Array.isArray(res.data)) setRooms(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  const loadBeds = useCallback(async (roomId: string | null) => {
    if (!roomId) { setBeds([]); return; }
    const res = await api<BedRow[]>(`/api/addons/hostel/beds?roomId=${roomId}`);
    if (res.ok && Array.isArray(res.data)) setBeds(res.data);
  }, []);

  const loadMeta = useCallback(async () => {
    const [h, z, c] = await Promise.all([
      api<HostelRow[]>('/api/addons/hostel/hostels'),
      api<ZoneRow[]>('/api/addons/hostel/zones'),
      api<CategoryRow[]>('/api/addons/hostel/categories'),
    ]);
    if (h.ok && Array.isArray(h.data)) setHostels(h.data.filter(x => x.status === 'active'));
    if (z.ok && Array.isArray(z.data)) setZones(z.data);
    if (c.ok && Array.isArray(c.data)) setCategories(c.data);
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {});
    loadRooms().catch(() => {});
  }, [loadMeta, loadRooms]);

  useEffect(() => { loadBeds(selectedRoomId).catch(() => {}); }, [selectedRoomId, loadBeds]);

  const hostelZones = zones.filter(z => z.hostelId === roomForm.hostelId);

  const filtered = rooms.filter(r => {
    const matchesHostel = filterHostel === 'all' || r.hostelId === filterHostel;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || r.code.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q);
    return matchesHostel && matchesSearch;
  });

  const openRoomCreate = () => {
    const firstHostel = hostels[0];
    setEditingRoom(null);
    setRoomForm({ ...emptyRoomForm, hostelId: firstHostel?.id ?? '' });
    setRoomModal(true);
  };

  const openRoomEdit = (row: RoomRow) => {
    setEditingRoom(row);
    setRoomForm({
      hostelId: row.hostelId,
      zoneId: row.zoneId ?? 'none',
      categoryId: row.categoryId ?? 'none',
      code: row.code,
      name: row.name ?? '',
      isAccessible: row.isAccessible,
      status: row.status,
    });
    setRoomModal(true);
  };

  const saveRoom = async () => {
    if (!roomForm.hostelId || !roomForm.code.trim()) return;
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      zoneId: roomForm.zoneId && roomForm.zoneId !== 'none' ? roomForm.zoneId : null,
      categoryId: roomForm.categoryId && roomForm.categoryId !== 'none' ? roomForm.categoryId : null,
      code: roomForm.code.trim(),
      name: roomForm.name.trim() || null,
      isAccessible: roomForm.isAccessible,
      status: roomForm.status,
    };
    if (!editingRoom) body.hostelId = roomForm.hostelId;
    const res = editingRoom
      ? await api(`/api/addons/hostel/rooms/${editingRoom.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/hostel/rooms', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setRoomModal(false);
      await loadRooms();
    } else {
      setError(errMessage(res));
    }
  };

  const openBedCreate = () => {
    if (!selectedRoomId) return;
    setEditingBed(null);
    setBedForm(emptyBedForm);
    setBedModal(true);
  };

  const openBedEdit = (row: BedRow) => {
    setEditingBed(row);
    setBedForm({
      code: row.code,
      isAccessible: row.isAccessible,
      status: row.status,
      notes: row.notes ?? '',
    });
    setBedModal(true);
  };

  const saveBed = async () => {
    if (!bedForm.code.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      code: bedForm.code.trim(),
      isAccessible: bedForm.isAccessible,
      status: bedForm.status,
      notes: bedForm.notes.trim() || null,
    };
    const res = editingBed
      ? await api(`/api/addons/hostel/beds/${editingBed.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/hostel/beds', { method: 'POST', body: JSON.stringify({ ...body, roomId: selectedRoomId! }) });
    setSaving(false);
    if (res.ok) {
      setBedModal(false);
      await loadBeds(selectedRoomId);
    } else {
      setError(errMessage(res));
    }
  };

  const setBedStatus = async (bed: BedRow, status: BedRow['status']) => {
    const res = await api(`/api/addons/hostel/beds/${bed.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (res.ok) {
      await loadBeds(selectedRoomId);
    } else {
      setError(errMessage(res));
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Chambres & Lits</h1>
          <p className="text-sm text-slate-500">Sélectionnez une chambre pour gérer ses lits et leur statut.</p>
        </div>
        <Button onClick={openRoomCreate}><Plus className="mr-2 h-4 w-4" /> Nouvelle chambre</Button>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une chambre…" className="pl-9" />
          </div>
          <Select value={filterHostel} onValueChange={v => { setFilterHostel(v); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les résidences</SelectItem>
              {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Aucune chambre trouvée.</div>
          ) : (
            filtered.map(row => (
              <div key={row.id}
                onClick={() => setSelectedRoomId(row.id === selectedRoomId ? null : row.id)}
                className={`flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors ${selectedRoomId === row.id ? 'bg-[#D1F5E8]/40' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><DoorOpen className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{row.code}{row.name ? ` — ${row.name}` : ''}</p>
                    <p className="text-xs text-slate-500">
                      {row.zoneName ?? 'Sans zone'}
                      {row.categoryName ? ` · ${row.categoryName}` : ''}
                      {row.isAccessible ? ' · PMR' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={row.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {ROOM_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openRoomEdit(row); }}><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {selectedRoom && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><BedDouble className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold text-[#16212B]">Lits — {selectedRoom.code}</p>
                <p className="text-xs text-slate-500">{beds.length} lit(s) au total</p>
              </div>
            </div>
            <Button onClick={openBedCreate}><Plus className="mr-2 h-4 w-4" /> Ajouter un lit</Button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {beds.length === 0 && (
              <p className="col-span-full p-4 text-center text-sm text-slate-500">Aucun lit dans cette chambre.</p>
            )}
            {beds.map(bed => (
              <div key={bed.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 p-3">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-[#16212B]">{bed.code}</p>
                    <p className="text-[11px] text-slate-500">{bed.notes ?? (bed.isAccessible ? 'PMR' : '—')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Hors service"
                    onClick={() => setBedStatus(bed, bed.status === 'out_of_service' ? 'active' : 'out_of_service')}>
                    <Wrench className={`h-4 w-4 ${bed.status === 'out_of_service' ? 'text-red-500' : 'text-slate-400'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBedEdit(bed)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={roomModal} onOpenChange={setRoomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? `Modifier ${editingRoom.code}` : 'Nouvelle chambre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Résidence *</label>
              <Select value={roomForm.hostelId} onValueChange={v => setRoomForm({ ...roomForm, hostelId: v })} disabled={Boolean(editingRoom)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
                <Input value={roomForm.code} onChange={e => setRoomForm({ ...roomForm, code: e.target.value })} placeholder="Ex : 101" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
                <Input value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Zone</label>
                <Select value={roomForm.zoneId} onValueChange={v => setRoomForm({ ...roomForm, zoneId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {hostelZones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Catégorie</label>
                <Select value={roomForm.categoryId} onValueChange={v => setRoomForm({ ...roomForm, categoryId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="room-pmr" checked={roomForm.isAccessible} onCheckedChange={(v) => setRoomForm({ ...roomForm, isAccessible: v === true })} />
              <label htmlFor="room-pmr" className="text-sm text-slate-700">Chambre accessible (PMR)</label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
              <Select value={roomForm.status} onValueChange={v => setRoomForm({ ...roomForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                  <SelectItem value="out_of_service">Hors service</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomModal(false)}>Annuler</Button>
            <Button onClick={saveRoom} disabled={saving || !roomForm.hostelId || !roomForm.code.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bedModal} onOpenChange={setBedModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBed ? `Modifier ${editingBed.code}` : `Nouveau lit — ${selectedRoom?.code ?? ''}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
              <Input value={bedForm.code} onChange={e => setBedForm({ ...bedForm, code: e.target.value })} placeholder="Ex : 101A" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="bed-pmr" checked={bedForm.isAccessible} onCheckedChange={(v) => setBedForm({ ...bedForm, isAccessible: v === true })} />
              <label htmlFor="bed-pmr" className="text-sm text-slate-700">Lit accessible (PMR)</label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
              <Select value={bedForm.status} onValueChange={v => setBedForm({ ...bedForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="out_of_service">Hors service</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <Input value={bedForm.notes} onChange={e => setBedForm({ ...bedForm, notes: e.target.value })} />
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBedModal(false)}>Annuler</Button>
            <Button onClick={saveBed} disabled={saving || !bedForm.code.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
