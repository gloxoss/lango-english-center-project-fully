'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
  { value: 'WRONG_CLASS', key: 'reasonWrongClass' },
  { value: 'REGISTER_LOCKED', key: 'reasonRegisterLocked' },
  { value: 'SESSION_INVALID', key: 'reasonSessionInvalid' },
  { value: 'SESSION_CLOSED', key: 'reasonSessionClosed' },
  { value: 'INVALID_CREDENTIAL', key: 'reasonInvalidCredential' },
  { value: 'BADGE_REVOKED', key: 'reasonBadgeRevoked' },
  { value: 'BADGE_EXPIRED', key: 'reasonBadgeExpired' },
  { value: 'BADGE_REPLACED', key: 'reasonBadgeReplaced' },
] as const;

function resultVariant(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'accepted') return 'success';
  if (status === 'already_scanned') return 'warning';
  return 'danger';
}

export function QrReportsView() {
  const t = useTranslations('Attendance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
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
              {t('qrReportsTitle')}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('qrReportsSubtitle')}
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
            <span>{t('exportAuditCsvBtn')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-200 font-bold text-xs gap-2"
            onClick={() => { window.location.href = exportUrl('pdf'); }}
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>{t('exportPdfBtn')}</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
            <Search className="w-4 h-4 text-[#2487B8]" />
            <span>{t('reportFiltersHeading')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('resetFiltersBtn')}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-8 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterFrom')}</label>
            <Input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-medium text-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterTo')}</label>
            <Input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-medium text-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterClassSection')}</label>
            <Select value={classSectionId} onValueChange={setClassSectionId}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder={t('allClassesOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allClassesOption')}</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.className} — {s.sectionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterResult')}</label>
            <Select value={resultStatus} onValueChange={setResultStatus}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder={t('allResultsOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allResultsOption')}</SelectItem>
                <SelectItem value="accepted">{t('resultAccepted')}</SelectItem>
                <SelectItem value="rejected">{t('resultRejected')}</SelectItem>
                <SelectItem value="already_scanned">{t('resultAlreadyScanned')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterRejectionReason')}</label>
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder={t('allReasonsOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allReasonsOption')}</SelectItem>
                {REJECTION_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{t(r.key as any)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterDevice')}</label>
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder={t('allDevicesOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allDevicesOption')}</SelectItem>
                {options.devices.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterOperator')}</label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue placeholder={t('allOperatorsOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allOperatorsOption')}</SelectItem>
                {options.operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>{op.name || t('colOperator')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500">{t('filterStudent')}</label>
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
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
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiAcceptedScans')}</span>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{aggregates.accepted}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{t('kpiAcceptedScansDesc')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiRejectedScans')}</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{aggregates.rejected}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{t('kpiRejectedScansDesc')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiAlreadyScanned')}</span>
            <h3 className="text-2xl font-extrabold text-[#E8A33D] mt-1">{aggregates.alreadyScanned}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{t('kpiAlreadyScannedDesc')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiPairedTerminals')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{pairedDeviceCount}</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">{t('kpiPairedTerminalsDesc')}</p>
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
            {loading ? t('loading') : t('eventsFoundCount', { count: events.length })}
          </p>
          <Badge variant="neutral" className="font-mono text-[10px]">
            {t('totalCountBadge', { count: aggregates.total })}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4 text-start">{t('colEventId')}</th>
                <th className="py-3.5 px-4 text-start">{t('colScanTime')}</th>
                <th className="py-3.5 px-4 text-start">{t('colScanResult')}</th>
                <th className="py-3.5 px-4 text-start">{t('colStagedStatus')}</th>
                <th className="py-3.5 px-4 text-start">{t('colReason')}</th>
                <th className="py-3.5 px-4 text-start">{t('colClassSection')}</th>
                <th className="py-3.5 px-4 text-start">{t('colTargetStudent')}</th>
                <th className="py-3.5 px-4 text-start">{t('colTerminal')}</th>
                <th className="py-3.5 px-4 text-start">{t('colOperator')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{evt.id.slice(0, 8)}…</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(evt.scannedAt).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={resultVariant(evt.resultStatus)} className="text-[10px] uppercase font-bold">
                      {evt.resultStatus === 'accepted'
                        ? t('resultAccepted')
                        : evt.resultStatus === 'rejected'
                        ? t('resultRejected')
                        : evt.resultStatus === 'already_scanned'
                        ? t('resultAlreadyScanned')
                        : evt.resultStatus}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4">
                    {evt.stagedStatus
                      ? <Badge variant="info" className="text-[10px] uppercase font-bold">
                          {evt.stagedStatus === 'late' ? tStatus('late') : tStatus('present')}
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
                    {t('noScanEventsFound')}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                    {t('loadingScanHistory')}
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
