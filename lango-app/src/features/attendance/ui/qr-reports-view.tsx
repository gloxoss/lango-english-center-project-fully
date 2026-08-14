'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  FileCheck2,
  Search,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Laptop,
  RotateCcw,
} from 'lucide-react';

interface ScanEventItem {
  id: string;
  scannedAt: string;
  resultStatus: string;
  rejectionReason: string | null;
  stagedStatus: 'present' | 'late' | null;
  studentId: string | null;
  studentName: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  operatorId: string | null;
  operatorName: string | null;
  classSectionId: string | null;
  className: string | null;
  sectionName: string | null;
}

interface Aggregates {
  total: number;
  accepted: number;
  rejected: number;
  alreadyScanned: number;
}

interface ReportOptions {
  operators: { id: string; name: string | null }[];
  devices: { id: string; label: string }[];
}

const REJECTION_REASONS = [
  { value: 'WRONG_CLASS', label: 'Mauvaise classe' },
  { value: 'REGISTER_LOCKED', label: 'Registre verrouillé' },
  { value: 'SESSION_INVALID', label: 'Session invalide' },
  { value: 'SESSION_CLOSED', label: 'Session clôturée' },
  { value: 'INVALID_CREDENTIAL', label: 'Badge invalide' },
  { value: 'BADGE_REVOKED', label: 'Badge révoqué' },
  { value: 'BADGE_EXPIRED', label: 'Badge expiré' },
  { value: 'BADGE_REPLACED', label: 'Badge remplacé' },
];

const RESULT_LABELS: Record<string, string> = {
  accepted: 'Accepté',
  rejected: 'Rejeté',
  already_scanned: 'Déjà scanné',
};

function resultVariant(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'accepted') return 'success';
  if (status === 'already_scanned') return 'warning';
  return 'danger';
}

export function QrReportsView() {
  const [events, setEvents] = useState<ScanEventItem[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates>({
    total: 0, accepted: 0, rejected: 0, alreadyScanned: 0,
  });
  const [pairedDeviceCount, setPairedDeviceCount] = useState(0);
  const [options, setOptions] = useState<ReportOptions>({ operators: [], devices: [] });
  const [sections, setSections] = useState<{ id: string; className: string; sectionName: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (mirror the server's QrEventsFilters exactly).
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [classSectionId, setClassSectionId] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [studentName, setStudentName] = useState('');

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (classSectionId) params.set('classSectionId', classSectionId);
    if (resultStatus) params.set('resultStatus', resultStatus);
    if (rejectionReason) params.set('rejectionReason', rejectionReason);
    if (deviceId) params.set('deviceId', deviceId);
    if (operatorId) params.set('operatorId', operatorId);
    if (studentName.trim()) params.set('studentName', studentName.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [from, to, classSectionId, resultStatus, rejectionReason, deviceId, operatorId, studentName]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/qr/events${buildQuery()}`);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data || []);
        setAggregates(json.aggregates || { total: 0, accepted: 0, rejected: 0, alreadyScanned: 0 });
        setPairedDeviceCount(json.pairedDeviceCount || 0);
        setOptions(json.options || { operators: [], devices: [] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Debounce filter changes (typing in the person field in particular).
  useEffect(() => {
    const timer = setTimeout(() => fetchEvents(), 300);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  // Roster for the class filter, shared with the scanner kiosk.
  useEffect(() => {
    fetch('/api/academics/class-sections')
      .then(r => r.json())
      .then((json) => {
        if (json.success) setSections(json.data || []);
      })
      .catch(() => {});
  }, []);

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setClassSectionId('');
    setResultStatus('');
    setRejectionReason('');
    setDeviceId('');
    setOperatorId('');
    setStudentName('');
  };

  const exportUrl = (format: string) =>
    `/api/attendance/qr/events/export?format=${format}${buildQuery()}`;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Journal d'Audit & Rapports de Scans QR
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Historique immuable des preuves de présence et raisons de rejet des badges scannés.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-200 font-bold text-xs gap-2"
            onClick={() => { window.location.href = exportUrl('csv'); }}
          >
            <Download className="w-4 h-4 text-[#2487B8]" />
            <span>Exporter CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-200 font-bold text-xs gap-2"
            onClick={() => { window.location.href = exportUrl('pdf'); }}
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>Exporter PDF</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
            <Search className="w-4 h-4 text-[#2487B8]" />
            <span>Filtres du rapport</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-8 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Du</label>
            <Input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-medium text-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Au</label>
            <Input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-medium text-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Classe / Section</label>
            <Select value={classSectionId} onValueChange={setClassSectionId}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.className} — {s.sectionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Résultat</label>
            <Select value={resultStatus} onValueChange={setResultStatus}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="accepted">Accepté</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
                <SelectItem value="already_scanned">Déjà scanné</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Motif de rejet</label>
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {REJECTION_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Dispositif</label>
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {options.devices.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Opérateur</label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {options.operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>{op.name || 'Opérateur'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">Élève</label>
            <Input
              type="text"
              placeholder="Nom..."
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-medium text-slate-800"
            />
          </div>
        </div>
      </Card>

      {/* KPI Stats — server-computed aggregates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Scans Valides Acceptés</span>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{aggregates.accepted}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">Preuves de présence staged</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Badges Rejetés</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{aggregates.rejected}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">Authentification bloquée</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Déjà Scannés</span>
            <h3 className="text-2xl font-extrabold text-[#E8A33D] mt-1">{aggregates.alreadyScanned}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">Tentatives en double</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terminaux Appairés Actifs</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{pairedDeviceCount}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">Dispositifs sur le réseau</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Events Table Card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold text-slate-700">
            {loading ? 'Chargement...' : `${events.length} événement(s) trouvé(s)`}
          </p>
          <Badge variant="neutral" className="font-mono text-[10px]">
            {aggregates.total} au total
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Événement ID</th>
                <th className="py-3.5 px-4">Horodatage Scan</th>
                <th className="py-3.5 px-4">Résultat Scan</th>
                <th className="py-3.5 px-4">Statut Staged</th>
                <th className="py-3.5 px-4">Raison Rejet</th>
                <th className="py-3.5 px-4">Classe / Section</th>
                <th className="py-3.5 px-4">Élève Cible</th>
                <th className="py-3.5 px-4">Dispositif</th>
                <th className="py-3.5 px-4">Opérateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{evt.id.slice(0, 8)}…</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(evt.scannedAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={resultVariant(evt.resultStatus)} className="text-[10px] uppercase font-bold">
                      {RESULT_LABELS[evt.resultStatus] || evt.resultStatus}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4">
                    {evt.stagedStatus
                      ? <Badge variant="info" className="text-[10px] uppercase font-bold">
                          {evt.stagedStatus === 'late' ? 'Retard' : 'Présent'}
                        </Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{evt.rejectionReason || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {evt.className ? `${evt.className}${evt.sectionName ? ' — ' + evt.sectionName : ''}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#2487B8] font-bold">
                    {evt.studentName || evt.studentId || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{evt.deviceLabel || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600">{evt.operatorName || '—'}</td>
                </tr>
              ))}
              {events.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                    Aucun événement de scan trouvé. Modifiez les filtres ou effectuez des scans.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                    Chargement de l'historique...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
