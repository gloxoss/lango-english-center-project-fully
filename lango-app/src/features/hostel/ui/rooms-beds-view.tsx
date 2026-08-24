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
  AlertCircle,
  BedDouble,
  CheckCircle2,
  DoorOpen,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Wand2,
  Wrench,
} from 'lucide-react';
import { api, errMessage } from './api';

type HostelRow = { id: string; name: string; code: string; status: string };
type ZoneRow = { id: string; hostelId: string; name: string; status: string };
type CategoryRow = { id: string; name: string; code: string; status: string; defaultCapacity?: number | null };

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
  autoGenerateBeds: true,
  bedsCount: '2',
};

const emptyBedForm = {
  code: '',
  isAccessible: false,
  status: 'active',
  notes: '',
};

type WizardPreviewItem = {
  zoneName?: string;
  zoneCode?: string;
  roomCode: string;
  roomName?: string;
  isAccessible: boolean;
  bedCodes: string[];
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
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [bedForm, setBedForm] = useState(emptyBedForm);

  // Quick-Start Wizard State (§19.2 / §19.3 / §19.5)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'multi_floor' | 'single_batch'>('multi_floor');
  const [wizardHostelId, setWizardHostelId] = useState('');
  const [wizardCategoryId, setWizardCategoryId] = useState('none');
  const [wizardFloorsCount, setWizardFloorsCount] = useState('3');
  const [wizardRoomsPerFloor, setWizardRoomsPerFloor] = useState('6');
  const [wizardFloorPrefix, setWizardFloorPrefix] = useState('Étage');
  const [wizardNumberingFormat, setWizardNumberingFormat] = useState<'hundreds' | 'prefixed'>('hundreds');
  const [wizardIncludeRdc, setWizardIncludeRdc] = useState(true);
  const [wizardRdcPmr, setWizardRdcPmr] = useState(true);
  const [wizardAutoBeds, setWizardAutoBeds] = useState(true);
  const [wizardBedNaming, setWizardBedNaming] = useState<'alpha' | 'numeric'>('alpha');
  const [wizardCustomBedsCount, setWizardCustomBedsCount] = useState('2');

  // Single Batch wizard fields
  const [wizardBatchZoneId, setWizardBatchZoneId] = useState('none');
  const [wizardBatchPrefix, setWizardBatchPrefix] = useState('CH-');
  const [wizardBatchStartNum, setWizardBatchStartNum] = useState('101');
  const [wizardBatchRoomsCount, setWizardBatchRoomsCount] = useState('10');

  // Wizard execution state
  const [wizardRunning, setWizardRunning] = useState(false);
  const [wizardProgressText, setWizardProgressText] = useState('');
  const [wizardProgressPercent, setWizardProgressPercent] = useState(0);

  const loadRooms = useCallback(async (hostelId?: string) => {
    setLoading(true);
    setError(null);
    const qs = hostelId && hostelId !== 'all' ? `?hostelId=${encodeURIComponent(hostelId)}` : '';
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
    if (h.ok && Array.isArray(h.data)) {
      const activeHostels = h.data.filter(x => x.status === 'active');
      setHostels(activeHostels);
      if (activeHostels.length > 0 && activeHostels[0] && !wizardHostelId) {
        setWizardHostelId(activeHostels[0].id);
      }
    }
    if (z.ok && Array.isArray(z.data)) setZones(z.data);
    if (c.ok && Array.isArray(c.data)) setCategories(c.data);
  }, [wizardHostelId]);

  useEffect(() => {
    loadMeta().catch(() => {});
    loadRooms().catch(() => {});
  }, [loadMeta, loadRooms]);

  useEffect(() => { loadBeds(selectedRoomId).catch(() => {}); }, [selectedRoomId, loadBeds]);

  // When category changes in single room form, auto-fill default beds count
  const handleCategoryChangeInRoomForm = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    const cap = cat?.defaultCapacity ? String(cat.defaultCapacity) : '2';
    setRoomForm(prev => ({
      ...prev,
      categoryId: catId,
      bedsCount: cap,
    }));
  };

  // When category changes in wizard, update beds count
  const handleWizardCategoryChange = (catId: string) => {
    setWizardCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    if (cat?.defaultCapacity) {
      setWizardCustomBedsCount(String(cat.defaultCapacity));
    }
  };

  const hostelZones = zones.filter(z => z.hostelId === (roomModal ? roomForm.hostelId : wizardHostelId));

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
      autoGenerateBeds: false,
      bedsCount: '2',
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
      ? await api<RoomRow>(`/api/addons/hostel/rooms/${editingRoom.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api<RoomRow>('/api/addons/hostel/rooms', { method: 'POST', body: JSON.stringify(body) });

    if (res.ok && res.data) {
      // If new room & autoGenerateBeds is checked (§19.5):
      if (!editingRoom && roomForm.autoGenerateBeds) {
        const count = Number.parseInt(roomForm.bedsCount, 10) || 2;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (let i = 0; i < count; i++) {
          const suffix = letters[i] ?? `L${i + 1}`;
          await api('/api/addons/hostel/beds', {
            method: 'POST',
            body: JSON.stringify({
              roomId: res.data.id,
              code: `${roomForm.code.trim()}-${suffix}`,
              isAccessible: roomForm.isAccessible,
              status: 'active',
            }),
          });
        }
      }
      setSaving(false);
      setRoomModal(false);
      setSuccessBanner(`Chambre ${roomForm.code} enregistrée avec succès.`);
      setTimeout(() => setSuccessBanner(null), 4000);
      await loadRooms();
      if (res.data.id) {
        setSelectedRoomId(res.data.id);
        await loadBeds(res.data.id);
      }
    } else {
      setSaving(false);
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

  // Compute preview for Quick-Start Wizard
  const generateWizardPreview = (): WizardPreviewItem[] => {
    const items: WizardPreviewItem[] = [];
    const bedsPerRoom = wizardAutoBeds ? (Number.parseInt(wizardCustomBedsCount, 10) || 2) : 0;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    if (wizardMode === 'multi_floor') {
      const numFloors = Math.max(1, Math.min(10, Number.parseInt(wizardFloorsCount, 10) || 3));
      const roomsPerFloor = Math.max(1, Math.min(50, Number.parseInt(wizardRoomsPerFloor, 10) || 6));

      for (let f = 0; f < numFloors; f++) {
        const isRdc = f === 0 && wizardIncludeRdc;
        const floorName = isRdc ? 'Rez-de-chaussée (RDC)' : `${wizardFloorPrefix} ${f + (wizardIncludeRdc ? 0 : 1)}`;
        const floorCode = isRdc ? 'RDC' : `ET-${f + (wizardIncludeRdc ? 0 : 1)}`;

        for (let r = 1; r <= roomsPerFloor; r++) {
          let roomCode = '';
          if (wizardNumberingFormat === 'hundreds') {
            const floorDigit = isRdc ? '0' : String(f + (wizardIncludeRdc ? 0 : 1));
            roomCode = `${floorDigit}${String(r).padStart(2, '0')}`;
          } else {
            roomCode = `${floorCode}-${String(r).padStart(2, '0')}`;
          }

          const isAccessible = isRdc && wizardRdcPmr;
          const bedCodes: string[] = [];
          for (let b = 0; b < bedsPerRoom; b++) {
            const bedSuffix = wizardBedNaming === 'alpha' ? (letters[b] ?? `L${b + 1}`) : `L${b + 1}`;
            bedCodes.push(`${roomCode}-${bedSuffix}`);
          }

          items.push({
            zoneName: floorName,
            zoneCode: floorCode,
            roomCode,
            roomName: `Chambre ${roomCode}`,
            isAccessible,
            bedCodes,
          });
        }
      }
    } else {
      // Single Batch mode
      const startNum = Number.parseInt(wizardBatchStartNum, 10) || 101;
      const count = Math.max(1, Math.min(100, Number.parseInt(wizardBatchRoomsCount, 10) || 10));
      for (let i = 0; i < count; i++) {
        const roomCode = `${wizardBatchPrefix}${startNum + i}`;
        const bedCodes: string[] = [];
        for (let b = 0; b < bedsPerRoom; b++) {
          const bedSuffix = wizardBedNaming === 'alpha' ? (letters[b] ?? `L${b + 1}`) : `L${b + 1}`;
          bedCodes.push(`${roomCode}-${bedSuffix}`);
        }
        items.push({
          roomCode,
          roomName: `Chambre ${roomCode}`,
          isAccessible: false,
          bedCodes,
        });
      }
    }
    return items;
  };

  const previewItems = generateWizardPreview();
  const totalPreviewRooms = previewItems.length;
  const totalPreviewBeds = previewItems.reduce((sum, item) => sum + item.bedCodes.length, 0);

  // Execute the Quick-Start Wizard
  const handleExecuteWizard = async () => {
    if (!wizardHostelId || previewItems.length === 0) return;
    setWizardRunning(true);
    setError(null);
    setWizardProgressPercent(5);
    setWizardProgressText('Initialisation des zones et étages...');

    try {
      // 1. If multi-floor, ensure zones exist or create them
      const zoneIdMap: Record<string, string> = {};

      if (wizardMode === 'multi_floor') {
        const uniqueZones = Array.from(new Set(previewItems.map(i => JSON.stringify({ name: i.zoneName, code: i.zoneCode })))).map(s => JSON.parse(s));

        for (const z of uniqueZones) {
          const existing = zones.find(ez => ez.hostelId === wizardHostelId && ez.name.toLowerCase() === z.name.toLowerCase());
          if (existing) {
            zoneIdMap[z.name] = existing.id;
          } else {
            setWizardProgressText(`Création de la zone ${z.name}...`);
            const created = await api<ZoneRow>('/api/addons/hostel/zones', {
              method: 'POST',
              body: JSON.stringify({
                hostelId: wizardHostelId,
                name: z.name,
                code: z.code,
                zoneType: 'floor',
                status: 'active',
              }),
            });
            if (created.ok && created.data) {
              zoneIdMap[z.name] = created.data.id;
            }
          }
        }
      }

      // 2. Create Rooms and Beds sequentially
      const totalSteps = previewItems.length;
      let completedSteps = 0;

      for (const item of previewItems) {
        setWizardProgressText(`Création chambre ${item.roomCode} et de ses ${item.bedCodes.length} lits...`);

        const zoneId = wizardMode === 'multi_floor'
          ? (item.zoneName ? zoneIdMap[item.zoneName] : null)
          : (wizardBatchZoneId !== 'none' ? wizardBatchZoneId : null);

        const roomRes = await api<RoomRow>('/api/addons/hostel/rooms', {
          method: 'POST',
          body: JSON.stringify({
            hostelId: wizardHostelId,
            zoneId: zoneId || null,
            categoryId: wizardCategoryId !== 'none' ? wizardCategoryId : null,
            code: item.roomCode,
            name: item.roomName || null,
            isAccessible: item.isAccessible,
            status: 'active',
          }),
        });

        if (roomRes.ok && roomRes.data) {
          const roomId = roomRes.data.id;
          for (const bedCode of item.bedCodes) {
            await api('/api/addons/hostel/beds', {
              method: 'POST',
              body: JSON.stringify({
                roomId,
                code: bedCode,
                isAccessible: item.isAccessible,
                status: 'active',
              }),
            });
          }
        }

        completedSteps++;
        setWizardProgressPercent(Math.round(10 + (completedSteps / totalSteps) * 85));
      }

      setWizardProgressPercent(100);
      setWizardProgressText('Génération terminée avec succès !');

      setSuccessBanner(`${totalPreviewRooms} chambres et ${totalPreviewBeds} lits ont été créés avec succès.`);
      setTimeout(() => setSuccessBanner(null), 5000);

      await loadMeta();
      await loadRooms(wizardHostelId);
      setWizardOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Une erreur est survenue lors de la création groupée.');
    } finally {
      setWizardRunning(false);
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B] flex items-center gap-2.5">
            <DoorOpen className="w-6 h-6 text-[#0066FF]" />
            Chambres &amp; Lits
          </h1>
          <p className="text-sm text-slate-500">
            Gestion du parc résidentiel, assistant de génération rapide par étage et suivi des lits disponibles.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setWizardOpen(true)}
            className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Assistant de création groupée
          </Button>
          <Button
            variant="outline"
            onClick={openRoomCreate}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white font-bold gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nouvelle chambre
          </Button>
        </div>
      </div>

      {successBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successBanner}
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">
            Fermer
          </button>
        </div>
      )}

      {/* Main Filter and Rooms List Card */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par code ou nom…" className="pl-9 text-xs rounded-xl h-9 border-slate-200" />
          </div>
          <Select value={filterHostel} onValueChange={v => { setFilterHostel(v); loadRooms(v); }}>
            <SelectTrigger className="w-56 h-9 text-xs rounded-xl border-slate-200"><SelectValue placeholder="Toutes les résidences" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les résidences</SelectItem>
              {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" /> Chargement des chambres…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">Aucune chambre trouvée pour ces critères.</div>
          ) : (
            filtered.map(row => (
              <div key={row.id}
                onClick={() => setSelectedRoomId(row.id === selectedRoomId ? null : row.id)}
                className={`flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors ${selectedRoomId === row.id ? 'bg-[#0066FF]/10' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0066FF] font-bold"><DoorOpen className="h-5 w-5" /></div>
                  <div>
                    <p className="font-bold text-[#16212B] text-xs">{row.code}{row.name ? ` — ${row.name}` : ''}</p>
                    <p className="text-[11px] text-slate-500">
                      {row.zoneName ?? 'Sans zone'}
                      {row.categoryName ? ` · ${row.categoryName}` : ''}
                      {row.isAccessible ? ' · PMR' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={row.status === 'active' ? 'bg-[#DDF5EC] text-[#17A673] border-none font-bold text-[10px]' : 'bg-slate-100 text-slate-500 border-none font-bold text-[10px]'}>
                    {ROOM_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openRoomEdit(row); }}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Selected Room Beds Grid */}
      {selectedRoom && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066FF]"><BedDouble className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-[#16212B] text-xs">Lits assignés à la chambre {selectedRoom.code}</p>
                <p className="text-[11px] text-slate-400">{beds.length} lit(s) configuré(s) dans cette unité</p>
              </div>
            </div>
            <Button size="sm" onClick={openBedCreate} className="h-8 text-xs rounded-xl bg-[#0066FF] text-white font-bold gap-1"><Plus className="h-3.5 w-3.5" /> Ajouter un lit</Button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {beds.length === 0 && (
              <p className="col-span-full p-6 text-center text-xs text-slate-400">Aucun lit configuré dans cette chambre.</p>
            )}
            {beds.map(bed => (
              <div key={bed.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 p-3 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <BedDouble className="h-4 w-4 text-[#0066FF]" />
                  <div>
                    <p className="text-xs font-bold text-[#16212B] font-mono">{bed.code}</p>
                    <p className="text-[10px] text-slate-400">{bed.notes ?? (bed.isAccessible ? 'Accès PMR' : 'Standard')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Hors service"
                    onClick={() => setBedStatus(bed, bed.status === 'out_of_service' ? 'active' : 'out_of_service')}>
                    <Wrench className={`h-3.5 w-3.5 ${bed.status === 'out_of_service' ? 'text-red-500' : 'text-slate-400'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openBedEdit(bed)}>
                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* QUICK-START BULK CREATION WIZARD DIALOG (§19.2 / §19.3 / §19.5) */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0066FF]" />
              Assistant de Création Rapide (Étages × Chambres × Lits)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Mode selection tabs */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setWizardMode('multi_floor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  wizardMode === 'multi_floor' ? 'bg-[#0066FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Génération par Étages (Multi-Niveaux)
              </button>
              <button
                type="button"
                onClick={() => setWizardMode('single_batch')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  wizardMode === 'single_batch' ? 'bg-[#0066FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Génération par Série de Chambres
              </button>
            </div>

            {/* Target Hostel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Résidence de destination *</label>
                <Select value={wizardHostelId} onValueChange={setWizardHostelId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue placeholder="Choisir une résidence" /></SelectTrigger>
                  <SelectContent>
                    {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Catégorie de chambre</label>
                <Select value={wizardCategoryId} onValueChange={handleWizardCategoryChange}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standard (Sans catégorie)</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.defaultCapacity ? `(${c.defaultCapacity} lits)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mode-specific configuration */}
            {wizardMode === 'multi_floor' ? (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Nombre d'étages</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={wizardFloorsCount}
                      onChange={e => setWizardFloorsCount(e.target.value)}
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Chambres par étage</label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={wizardRoomsPerFloor}
                      onChange={e => setWizardRoomsPerFloor(e.target.value)}
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Préfixe de zone</label>
                    <Input
                      value={wizardFloorPrefix}
                      onChange={e => setWizardFloorPrefix(e.target.value)}
                      placeholder="Étage"
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Numérotation</label>
                    <Select value={wizardNumberingFormat} onValueChange={(v: any) => setWizardNumberingFormat(v)}>
                      <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hundreds">101, 102... 201</SelectItem>
                        <SelectItem value="prefixed">ET-1-01, ET-2-01</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={wizardIncludeRdc} onCheckedChange={(v) => setWizardIncludeRdc(v === true)} />
                    <span className="font-medium text-slate-700">Inclure un Rez-de-chaussée (RDC)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={wizardRdcPmr} onCheckedChange={(v) => setWizardRdcPmr(v === true)} />
                    <span className="font-medium text-slate-700">RDC accessible PMR</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Zone de rattachement</label>
                    <Select value={wizardBatchZoneId} onValueChange={setWizardBatchZoneId}>
                      <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white"><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sans zone</SelectItem>
                        {hostelZones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Préfixe code</label>
                    <Input
                      value={wizardBatchPrefix}
                      onChange={e => setWizardBatchPrefix(e.target.value)}
                      placeholder="CH-"
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Numéro initial</label>
                    <Input
                      type="number"
                      value={wizardBatchStartNum}
                      onChange={e => setWizardBatchStartNum(e.target.value)}
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Nombre de chambres</label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={wizardBatchRoomsCount}
                      onChange={e => setWizardBatchRoomsCount(e.target.value)}
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Auto Bed Generation Settings (§19.5) */}
            <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={wizardAutoBeds} onCheckedChange={(v) => setWizardAutoBeds(v === true)} />
                  <span className="font-bold text-[#16212B]">Générer automatiquement les lits selon la capacité (§19.5)</span>
                </label>
                <Badge className="bg-[#0066FF]/10 text-[#0066FF] border-none font-bold text-[10px]">
                  Auto-Génération
                </Badge>
              </div>

              {wizardAutoBeds && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Lits par chambre</label>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={wizardCustomBedsCount}
                      onChange={e => setWizardCustomBedsCount(e.target.value)}
                      className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Format de nommage des lits</label>
                    <Select value={wizardBedNaming} onValueChange={(v: any) => setWizardBedNaming(v)}>
                      <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alpha">101-A, 101-B (Lettres)</SelectItem>
                        <SelectItem value="numeric">101-L1, 101-L2 (Numéros)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Aperçu avant génération :</span>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="font-bold text-[10px]">{totalPreviewRooms} Chambres</Badge>
                  <Badge variant="neutral" className="font-bold text-[10px] bg-blue-50 text-[#0066FF] border-blue-200">{totalPreviewBeds} Lits</Badge>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-1.5 text-xs font-mono">
                {previewItems.slice(0, 30).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-100 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#16212B]">{item.roomCode}</span>
                      {item.zoneName && <span className="text-slate-400 font-sans">({item.zoneName})</span>}
                      {item.isAccessible && <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px]">PMR</Badge>}
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      {item.bedCodes.length > 0 ? `Lits: ${item.bedCodes.join(', ')}` : 'Sans lit'}
                    </div>
                  </div>
                ))}
                {previewItems.length > 30 && (
                  <div className="text-center text-slate-400 text-[10px] py-1">
                    ... et {previewItems.length - 30} autre(s) chambre(s)
                  </div>
                )}
              </div>
            </div>

            {/* Running progress bar */}
            {wizardRunning && (
              <div className="space-y-1.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center justify-between text-xs font-bold text-[#0066FF]">
                  <span>{wizardProgressText}</span>
                  <span>{wizardProgressPercent}%</span>
                </div>
                <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden">
                  <div className="bg-[#0066FF] h-2 transition-all duration-200 rounded-full" style={{ width: `${wizardProgressPercent}%` }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              disabled={wizardRunning}
              onClick={() => setWizardOpen(false)}
              className="h-9 text-xs rounded-xl border-slate-200"
            >
              Annuler
            </Button>
            <Button
              disabled={wizardRunning || !wizardHostelId || previewItems.length === 0}
              onClick={handleExecuteWizard}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs cursor-pointer"
            >
              {wizardRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Générer {totalPreviewRooms} chambres &amp; {totalPreviewBeds} lits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SINGLE ROOM MODAL */}
      <Dialog open={roomModal} onOpenChange={setRoomModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              {editingRoom ? `Modifier ${editingRoom.code}` : 'Nouvelle chambre'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="mb-1 block font-bold text-slate-700">Résidence *</label>
              <Select value={roomForm.hostelId} onValueChange={v => setRoomForm({ ...roomForm, hostelId: v })} disabled={Boolean(editingRoom)}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue placeholder="Sélectionner une résidence" /></SelectTrigger>
                <SelectContent>
                  {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Code chambre *</label>
                <Input value={roomForm.code} onChange={e => setRoomForm({ ...roomForm, code: e.target.value })} placeholder="Ex : 101" className="h-9 text-xs rounded-xl border-slate-200" />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Nom (optionnel)</label>
                <Input value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="Ex: Suite Sud" className="h-9 text-xs rounded-xl border-slate-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Zone / Étage</label>
                <Select value={roomForm.zoneId} onValueChange={v => setRoomForm({ ...roomForm, zoneId: v })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {hostelZones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Catégorie</label>
                <Select value={roomForm.categoryId} onValueChange={handleCategoryChangeInRoomForm}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.defaultCapacity ? `(${c.defaultCapacity} lits)` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editingRoom && (
              <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="auto-beds"
                    checked={roomForm.autoGenerateBeds}
                    onCheckedChange={(v) => setRoomForm({ ...roomForm, autoGenerateBeds: v === true })}
                  />
                  <label htmlFor="auto-beds" className="font-bold text-[#16212B] cursor-pointer">
                    Générer automatiquement les lits (§19.5)
                  </label>
                </div>
                {roomForm.autoGenerateBeds && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-slate-600">Nombre de lits :</span>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={roomForm.bedsCount}
                      onChange={e => setRoomForm({ ...roomForm, bedsCount: e.target.value })}
                      className="w-16 h-8 text-xs font-bold rounded-lg border-slate-200 bg-white"
                    />
                    <span className="text-slate-400 font-mono text-[11px]">({roomForm.code || '101'}-A, {roomForm.code || '101'}-B...)</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox id="room-pmr" checked={roomForm.isAccessible} onCheckedChange={(v) => setRoomForm({ ...roomForm, isAccessible: v === true })} />
              <label htmlFor="room-pmr" className="text-slate-700 font-medium cursor-pointer">Chambre accessible (PMR)</label>
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">Statut</label>
              <Select value={roomForm.status} onValueChange={v => setRoomForm({ ...roomForm, status: v })}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                  <SelectItem value="out_of_service">Hors service</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setRoomModal(false)} className="h-9 text-xs rounded-xl border-slate-200">Annuler</Button>
            <Button onClick={saveRoom} disabled={saving || !roomForm.hostelId || !roomForm.code.trim()} className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SINGLE BED MODAL */}
      <Dialog open={bedModal} onOpenChange={setBedModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              {editingBed ? `Modifier ${editingBed.code}` : `Nouveau lit — ${selectedRoom?.code ?? ''}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="mb-1 block font-bold text-slate-700">Code du lit *</label>
              <Input value={bedForm.code} onChange={e => setBedForm({ ...bedForm, code: e.target.value })} placeholder="Ex : 101-A" className="h-9 text-xs rounded-xl border-slate-200 font-mono font-bold" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="bed-pmr" checked={bedForm.isAccessible} onCheckedChange={(v) => setBedForm({ ...bedForm, isAccessible: v === true })} />
              <label htmlFor="bed-pmr" className="text-slate-700 font-medium cursor-pointer">Lit accessible (PMR)</label>
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">Statut</label>
              <Select value={bedForm.status} onValueChange={(v: any) => setBedForm({ ...bedForm, status: v })}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="out_of_service">Hors service</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">Notes ou remarques</label>
              <Input value={bedForm.notes} onChange={e => setBedForm({ ...bedForm, notes: e.target.value })} placeholder="Ex: Matelas neuf / Côté fenêtre" className="h-9 text-xs rounded-xl border-slate-200" />
            </div>
            {error && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setBedModal(false)} className="h-9 text-xs rounded-xl border-slate-200">Annuler</Button>
            <Button onClick={saveBed} disabled={saving || !bedForm.code.trim()} className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer le lit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
