'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle, Clock, Layers, Loader2, Pencil, Plus, Search,
} from 'lucide-react';
import { api, errMessage } from './api';

type ZoneRow = {
  id: string;
  hostelId: string;
  parentZoneId: string | null;
  zoneType: 'building' | 'floor' | 'wing' | 'zone';
  code: string | null;
  name: string;
  curfewTime: string | null;
  rollCallTime: string | null;
  emergencyAssemblyPoint: string | null;
  status: 'active' | 'archived';
};

type HostelRow = {
  id: string;
  name: string;
  code: string;
  status: string;
};

const emptyForm = {
  hostelId: '',
  parentZoneId: 'none',
  zoneType: 'floor',
  code: '',
  name: '',
  curfewTime: '',
  rollCallTime: '',
  emergencyAssemblyPoint: '',
  status: 'active',
};

export function ZonesView() {
  const t = useTranslations('Hostel');
  const tCommon = useTranslations('Common');

  const ZONE_TYPE_LABELS: Record<string, string> = {
    building: t('zoneBuilding'),
    floor: t('zoneFloor'),
    wing: t('zoneWing'),
    zone: t('zoneZone'),
  };

  const [rows, setRows] = useState<ZoneRow[]>([]);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterHostel, setFilterHostel] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<ZoneRow[]>('/api/addons/hostel/zones');
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  const loadHostels = useCallback(async () => {
    const res = await api<HostelRow[]>('/api/addons/hostel/hostels');
    if (res.ok && Array.isArray(res.data)) setHostels(res.data.filter(h => h.status === 'active'));
  }, []);

  useEffect(() => { Promise.all([load(), loadHostels()]).catch(() => {}); }, [load, loadHostels]);

  const zoneNames = new Map(rows.map(z => [z.id, z.name]));

  const filtered = rows.filter(r => {
    const matchesHostel = filterHostel === 'all' || r.hostelId === filterHostel;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || r.name.toLowerCase().includes(q) || (r.code ?? '').toLowerCase().includes(q);
    return matchesHostel && matchesSearch;
  });

  const openCreate = () => {
    const firstHostel = hostels[0];
    setEditing(null);
    setForm({ ...emptyForm, hostelId: firstHostel?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (row: ZoneRow) => {
    setEditing(row);
    setForm({
      hostelId: row.hostelId,
      parentZoneId: row.parentZoneId ?? 'none',
      zoneType: row.zoneType,
      code: row.code ?? '',
      name: row.name,
      curfewTime: row.curfewTime ?? '',
      rollCallTime: row.rollCallTime ?? '',
      emergencyAssemblyPoint: row.emergencyAssemblyPoint ?? '',
      status: row.status,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.hostelId || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      parentZoneId: form.parentZoneId && form.parentZoneId !== 'none' ? form.parentZoneId : null,
      zoneType: form.zoneType,
      code: form.code.trim() || null,
      name: form.name.trim(),
      curfewTime: form.curfewTime || null,
      rollCallTime: form.rollCallTime || null,
      emergencyAssemblyPoint: form.emergencyAssemblyPoint.trim() || null,
      status: form.status,
    };
    if (!editing) body.hostelId = form.hostelId;
    const res = editing
      ? await api(`/api/addons/hostel/zones/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/addons/hostel/zones', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('zonesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('zonesSubtitle')}</p>
        </div>
        <Button onClick={openCreate} disabled={hostels.length === 0}><Plus className="mr-2 h-4 w-4" /> {t('btnNewZone')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Layers className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('zonesTitle')}</p><p className="text-2xl font-bold text-[#16212B]">{rows.length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Clock className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('curfewTime')}</p><p className="text-2xl font-bold text-[#16212B]">{rows.filter(r => r.curfewTime).length}</p></div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#16212B]"><Layers className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{t('statusActive')}</p><p className="text-2xl font-bold text-[#16212B]">{rows.filter(r => r.status === 'active').length}</p></div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchHostelPlaceholder')} className="pl-9" />
          </div>
          <Select value={filterHostel} onValueChange={setFilterHostel}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAllHostels')}</SelectItem>
              {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {hostels.length === 0 ? t('createHostelFirst') : t('noZones')}
            </div>
          ) : (
            filtered.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Layers className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {ZONE_TYPE_LABELS[row.zoneType] ?? row.zoneType}
                      {row.code ? ` · ${row.code}` : ''}
                      {row.parentZoneId ? ` · parent: ${zoneNames.get(row.parentZoneId) ?? '—'}` : ''}
                      {row.curfewTime ? ` · ${t('curfewTime')} ${row.curfewTime}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={row.status === 'active' ? 'bg-[#D1F5E8] text-[#0b5c3a]' : 'bg-slate-100 text-slate-500'}>
                    {row.status === 'active' ? t('statusActive') : t('statusArchived')}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('dialogHostelTitleEdit', { name: editing.name }) : t('btnNewZone')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('hostelName')}</label>
                <Select value={form.hostelId} onValueChange={v => setForm({ ...form, hostelId: v })} disabled={Boolean(editing)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('zoneType')}</label>
                <Select value={form.zoneType} onValueChange={v => setForm({ ...form, zoneType: v as ZoneRow['zoneType'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="building">{t('zoneBuilding')}</SelectItem>
                    <SelectItem value="floor">{t('zoneFloor')}</SelectItem>
                    <SelectItem value="wing">{t('zoneWing')}</SelectItem>
                    <SelectItem value="zone">{t('zoneZone')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('hostelName')}</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Étage 2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('hostelCode')}</label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex : ET-02" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('curfewTime')} (HH:MM)</label>
                <Input value={form.curfewTime} onChange={e => setForm({ ...form, curfewTime: e.target.value })} placeholder="Ex : 22:00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('rollCallTime')} (HH:MM)</label>
                <Input value={form.rollCallTime} onChange={e => setForm({ ...form, rollCallTime: e.target.value })} placeholder="Ex : 21:30" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('zonesTitle')}</label>
              <Select value={form.parentZoneId} onValueChange={v => setForm({ ...form, parentZoneId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tCommon('all')}</SelectItem>
                  {rows.filter(r => r.id !== editing?.id && r.hostelId === form.hostelId).map(z =>
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('emergencyAssemblyPoint')}</label>
              <Input value={form.emergencyAssemblyPoint} onChange={e => setForm({ ...form, emergencyAssemblyPoint: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{tCommon('status')}</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as ZoneRow['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('statusActive')}</SelectItem>
                  <SelectItem value="archived">{t('statusArchived')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.hostelId || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
