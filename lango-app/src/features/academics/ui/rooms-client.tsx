'use client';

import type { RoomItem, RoomType, RoomOccupancy } from '../data/rooms-config';
import {
  AlertCircle,
  Building2,
  Download,
  Loader2,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ROOM_TYPES,
  utilizationRate,
} from '../data/rooms-config';

type LoadState = 'loading' | 'ready' | 'error';

const EMPTY_FORM = {
  name: '',
  code: '',
  building: '',
  floor: '',
  capacity: '30',
  roomType: 'Classroom' as RoomType,
  equipment: '',
};

export function RoomsClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tc = useTranslations('Common');

  const roomTypeLabels: Record<string, string> = {
    'Classroom': t('catClassroom'),
    'Laboratory': t('catLaboratory'),
    'Amphitheater': t('catAmphitheater'),
    'Computer Lab': t('catComputerLab'),
  };

  const occupancyLabels: Record<RoomOccupancy, string> = {
    Occupied: t('statusOccupied'),
    Available: t('statusFree'),
    Maintenance: t('statusMaintenance'),
  };

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | RoomType>('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectRoom, setInspectRoom] = useState<RoomItem | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRoom, setNewRoom] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);

    try {
      const res = await fetch('/api/academics/rooms?pageSize=100');
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('loadRoomsError'));
      }

      setRooms(json.data as RoomItem[]);
      setLoadState('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t('loadRoomsError'));
      setLoadState('error');
    }
  }, [t]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const filteredRooms = rooms.filter((r) => {
    const needle = search.toLowerCase();
    const matchesSearch = r.name.toLowerCase().includes(needle) || (r.code ?? '').toLowerCase().includes(needle);
    const matchesCat = selectedCategory === 'All' || r.roomType === selectedCategory;
    const matchesStatus = statusFilter === 'all' || r.occupancyStatus === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim() || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/academics/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoom.name.trim(),
          code: newRoom.code.trim() || null,
          building: newRoom.building.trim() || null,
          floor: newRoom.floor.trim() || null,
          capacity: Number(newRoom.capacity) || null,
          roomType: newRoom.roomType,
          equipment: newRoom.equipment.split(',').map(e => e.trim()).filter(Boolean),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? t('createRoomError'));
      }

      setIsAddOpen(false);
      setNewRoom(EMPTY_FORM);
      await loadRooms();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('createRoomError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenance = async (room: RoomItem) => {
    const nextStatus = room.status === 'maintenance' ? 'available' : 'maintenance';

    try {
      const res = await fetch('/api/academics/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: room.id, status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error('Mise à jour impossible.');
      }

      setInspectRoom(null);
      await loadRooms();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Mise à jour impossible.');
    }
  };

  const totalCapacity = rooms.reduce((a, r) => a + (r.capacity ?? 0), 0);
  const freeCount = rooms.filter(r => r.occupancyStatus === 'Available').length;
  const utilization = utilizationRate(rooms);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('roomsPageTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('roomsPageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl border-slate-200 px-4 text-xs font-bold"
          >
            <Download className="size-4 text-slate-600" />
            <span>{t('btnExportRoomsPlan')}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-10 gap-2 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white shadow-2xs hover:bg-[#1B6C93]"
          >
            <Plus className="size-4" />
            <span>{t('btnAddRoom')}</span>
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{loadError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadRooms()}
            className="ms-auto h-7 text-xs font-bold text-red-700"
          >
            {t('retryBtn')}
          </Button>
        </div>
      )}

      {/* Top 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="space-y-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{t('totalRoomsCatalogued')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">
            {t('roomsCountLabel', { count: rooms.length })}
          </p>
          <p className="text-[10px] text-slate-400">
            {t('globalCapacityLabel', { count: totalCapacity })}
          </p>
        </Card>
        <Card className="space-y-1 rounded-2xl border border-emerald-200/60 bg-emerald-50/20 p-4 shadow-2xs">
          <p className="text-xs font-bold text-[#17A673]">{t('freeRoomsCurrently')}</p>
          <p className="text-2xl font-extrabold text-[#17A673]">
            {t('freeRoomsCount', { count: freeCount })}
          </p>
          <p className="text-[10px] text-slate-400">{t('readyForCoursesOrExams')}</p>
        </Card>
        <Card className="space-y-1 rounded-2xl border border-blue-200/60 bg-blue-50/20 p-4 shadow-2xs">
          <p className="text-xs font-bold text-[#1B6C93]">{t('todayOccupancyRate')}</p>
          <p className="text-2xl font-extrabold text-[#2487B8]">{utilization === null ? '—' : `${utilization}%`}</p>
          <p className="text-[10px] text-slate-400">{t('timeRangeLabel')}</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs sm:flex-row">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', ...ROOM_TYPES] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                selectedCategory === cat
                  ? 'bg-[#2487B8] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat === 'All' ? t('allRoomsCategory') : (roomTypeLabels[cat] || cat)}
            </button>
          ))}
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 rounded-xl border-none bg-slate-50 text-xs">
              <SelectValue placeholder={t('statusAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusAll')}</SelectItem>
              <SelectItem value="Available">{t('statusAvailableFilter')}</SelectItem>
              <SelectItem value="Occupied">{t('statusOccupiedFilter')}</SelectItem>
              <SelectItem value="Maintenance">{t('statusMaintenanceFilter')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-56">
            <Search className="absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('searchRoomPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 rounded-xl border-none bg-slate-50 ps-9 pe-3 text-xs"
            />
          </div>
        </div>
      </div>

      {loadState === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          <span>{t('loadingRooms')}</span>
        </div>
      )}

      {loadState === 'ready' && rooms.length === 0 && (
        <Card className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Building2 className="mx-auto size-8 text-slate-300" />
          <p className="text-sm font-extrabold text-[#16212B]">{t('noRoomsRegistered')}</p>
          <p className="text-xs text-slate-500">{t('noRoomsRegisteredDesc')}</p>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="mt-2 h-9 gap-2 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93]"
          >
            <Plus className="size-4" />
            <span>{t('btnAddFirstRoom')}</span>
          </Button>
        </Card>
      )}

      {loadState === 'ready' && rooms.length > 0 && filteredRooms.length === 0 && (
        <p className="py-10 text-center text-xs font-bold text-slate-400">{t('noRoomsMatchFilters')}</p>
      )}

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredRooms.map(room => (
          <Card
            key={room.id}
            className="flex flex-col justify-between space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-[#DCEBF4] font-bold text-[#1B6C93]">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#16212B]">{room.name}</h3>
                    <p className="text-[10px] text-slate-400">
                      {[room.code, room.building].filter(Boolean).join(' • ') || t('noCodeOrBuilding')}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  room.occupancyStatus === 'Occupied'
                    ? 'bg-[#DCEBF4] text-[#1B6C93]'
                    : room.occupancyStatus === 'Available'
                      ? 'bg-[#DDF5EC] text-[#17A673]'
                      : 'bg-amber-100 text-amber-800'
                }`}>
                  {occupancyLabels[room.occupancyStatus] || room.occupancyStatus}
                </span>
              </div>

              <div className="space-y-1 pt-2 text-xs text-slate-600">
                <p className="flex items-center justify-between">
                  <span className="text-slate-400">{t('maxCapacityPrefix')}</span>
                  <strong className="text-[#16212B]">
                    {room.capacity === null ? t('notSpecified') : `${room.capacity} ${t('studentsLabel')}`}
                  </strong>
                </p>
                {room.currentClass && (
                  <p className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{t('currentCourseLabel')}</span>
                    <strong className="text-[#2487B8]">{room.currentClass}</strong>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {room.equipment.map(eq => (
                  <span
                    key={eq}
                    className="rounded-sm bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span className="text-[10px] font-bold text-slate-400">{room.floor ?? '—'}</span>
              <Button
                onClick={() => setInspectRoom(room)}
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-bold text-[#2487B8] hover:bg-[#DCEBF4]/40"
              >
                {t('roomScheduleBtn')}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Room Schedule Drawer Dialog */}
      <Dialog open={!!inspectRoom} onOpenChange={() => setInspectRoom(null)}>
        {inspectRoom && (
          <DialogContent className="max-w-md rounded-2xl bg-white p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-[#16212B]">
                <Building2 className="size-5 text-[#2487B8]" />
                {t('dayScheduleTitle')}{' '}
                {inspectRoom.name}
                {inspectRoom.code ? ` (${inspectRoom.code})` : ''}
              </DialogTitle>
            </DialogHeader>

            <div className="my-3 space-y-3 text-xs">
              <div className="space-y-1 rounded-xl bg-slate-50 p-3">
                <p className="font-bold text-[#16212B]">{t('roomInfoTitle')}</p>
                <p className="text-slate-500">
                  {[inspectRoom.building, inspectRoom.floor].filter(Boolean).join(' • ') || t('locationNotSpecified')}
                  {inspectRoom.capacity !== null && ` • ${t('capacityLabel')} ${inspectRoom.capacity} ${t('placesLabel')}`}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-[#16212B]">{t('dayOccupationsTitle')}</h4>
                {inspectRoom.schedule.length === 0
                  ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400 italic">
                        {t('noClassesScheduledToday')}
                      </p>
                    )
                  : inspectRoom.schedule.map(slot => (
                      <div
                        key={`${slot.startTime}-${slot.course}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs"
                      >
                        <span className="font-bold text-[#2487B8]">{slot.time}</span>
                        <span className="font-extrabold text-[#16212B]">{slot.course}</span>
                      </div>
                    ))}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => void toggleMaintenance(inspectRoom)}
                className="h-9 gap-2 rounded-xl text-xs"
              >
                <Wrench className="size-3.5 me-1" />
                {inspectRoom.status === 'maintenance' ? t('btnRestoreService') : t('btnPutInMaintenance')}
              </Button>
              <Button
                onClick={() => setInspectRoom(null)}
                className="h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white hover:bg-[#1B6C93]"
              >
                {t('btnClosePreview')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Ajouter une salle Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-[#16212B]">
              <Building2 className="size-5 text-[#2487B8]" />
              {t('addRoomModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            {saveError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-bold text-red-700">
                {saveError}
              </p>
            )}

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="room-name">{t('roomNameLabel')}</label>
              <Input
                id="room-name"
                placeholder="Ex. Salle 204"
                value={newRoom.name}
                onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700" htmlFor="room-code">{t('roomCodeLabel')}</label>
                <Input
                  id="room-code"
                  placeholder="Ex. A-204"
                  value={newRoom.code}
                  onChange={e => setNewRoom({ ...newRoom, code: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700" htmlFor="room-capacity">{t('roomCapacityLabel')}</label>
                <Input
                  id="room-capacity"
                  type="number"
                  placeholder="30"
                  value={newRoom.capacity}
                  onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700" htmlFor="room-building">{t('roomBuildingLabel')}</label>
                <Input
                  id="room-building"
                  placeholder="Ex. Bâtiment Principal"
                  value={newRoom.building}
                  onChange={e => setNewRoom({ ...newRoom, building: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700" htmlFor="room-floor">{t('roomFloorLabel')}</label>
                <Input
                  id="room-floor"
                  placeholder="Ex. 1er Étage"
                  value={newRoom.floor}
                  onChange={e => setNewRoom({ ...newRoom, floor: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="room-type">{t('roomTypeLabel')}</label>
              <Select value={newRoom.roomType} onValueChange={val => setNewRoom({ ...newRoom, roomType: val as RoomType })}>
                <SelectTrigger id="room-type" className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map(rt => (
                    <SelectItem key={rt} value={rt}>{roomTypeLabels[rt] || rt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700" htmlFor="room-equipment">{t('roomEquipmentLabel')}</label>
              <Input
                id="room-equipment"
                placeholder="Vidéoprojecteur, Climatisation, TBI"
                value={newRoom.equipment}
                onChange={e => setNewRoom({ ...newRoom, equipment: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="h-9 rounded-xl text-xs"
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={() => void handleCreateRoom()}
              disabled={saving || !newRoom.name.trim()}
              className="h-9 gap-2 rounded-xl bg-[#2487B8] text-xs font-bold text-white hover:bg-[#1B6C93]"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {t('btnCreateRoom')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

