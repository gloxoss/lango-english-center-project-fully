'use client';

import { AlertTriangle, Flag, Search, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/data-table';

type FlagType = 'UNJUSTIFIED_ABSENCE' | 'REPEATED_LATE' | 'CONSECUTIVE_ABSENCE';
type FlagSeverity = 'CRITIQUE' | 'ELEVE' | 'MOYEN';

type ApiFlag = {
  id: string;
  studentId: string;
  studentName: string;
  type: FlagType;
  status: 'OPEN' | 'RESOLVED';
  severity: FlagSeverity;
  assignedToId: string | null;
  assignedToName: string | null;
  guardianPhone: string | null;
  detectedAt: string;
  resolvedAt: string | null;
};

const TYPE_KEYS: Record<FlagType, string> = {
  UNJUSTIFIED_ABSENCE: 'flagUnjustifiedAbsence',
  CONSECUTIVE_ABSENCE: 'flagConsecutiveAbsence',
  REPEATED_LATE: 'flagRepeatedLate',
};

export function AttendanceFlagsView({ locale }: { locale: string }) {
  const t = useTranslations('Attendance');

  const [flags, setFlags] = useState<ApiFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  function severityBadge(severity: FlagSeverity) {
    switch (severity) {
      case 'CRITIQUE':
        return <Badge className="bg-[#FCE4E2] text-[#E5544B]">{t('severityCritical')}</Badge>;
      case 'ELEVE':
        return <Badge className="bg-[#FCF0DC] text-[#E8A33D]">{t('severityHigh')}</Badge>;
      default:
        return <Badge variant="neutral">{t('severityMedium')}</Badge>;
    }
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (severityFilter !== 'all') {
        params.set('severity', severityFilter);
      }
      const res = await fetch(`/api/attendance/flags?${params.toString()}&pageSize=100`);
      const json = await res.json();
      if (json.success) {
        setFlags(json.data);
      }
    } catch (err) {
      console.error('Failed loading flags', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, severityFilter]);

  const filtered = flags.filter((f) => {
    const term = searchTerm.trim().toLowerCase();
    return !term || f.studentName.toLowerCase().includes(term);
  });

  const severityCounts = {
    CRITIQUE: flags.filter(f => f.severity === 'CRITIQUE').length,
    ELEVE: flags.filter(f => f.severity === 'ELEVE').length,
    MOYEN: flags.filter(f => f.severity === 'MOYEN').length,
  };

  const columns: Column<ApiFlag>[] = [
    {
      key: 'type',
      header: t('colFlagType'),
      cell: f => (
        <div className="flex items-center gap-2 text-start">
          <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-[#16212B]">{(t as any)(TYPE_KEYS[f.type])}</span>
        </div>
      ),
    },
    {
      key: 'studentName',
      header: t('colStudentName'),
      cell: f => (
        <Link href={`/${locale}/dashboard/attendance/flags/${f.id}`} className="font-bold text-[#16212B] hover:text-[#2487B8] hover:underline text-start block">
          {f.studentName}
        </Link>
      ),
    },
    {
      key: 'severity',
      header: t('colSeverity'),
      cell: f => severityBadge(f.severity),
    },
    {
      key: 'guardianPhone',
      header: t('colGuardianPhone'),
      cell: f => <span className="font-mono text-slate-600 text-start block">{f.guardianPhone ?? '—'}</span>,
    },
    {
      key: 'assignedToName',
      header: t('colAssignedTo'),
      cell: f => (f.assignedToName
        ? <span className="text-slate-700 font-semibold text-start block">{f.assignedToName}</span>
        : <span className="text-slate-400 text-start block">{t('unassigned')}</span>),
    },
    {
      key: 'detectedAt',
      header: t('colDetectedAt'),
      cell: f => <span className="text-slate-500 text-start block">{formatDateTime(f.detectedAt)}</span>,
    },
    {
      key: 'status',
      header: t('colFlagStatus'),
      cell: f => (f.status === 'OPEN'
        ? <Badge className="bg-[#FCF0DC] text-[#E8A33D]">{t('statusOpen')}</Badge>
        : <Badge className="bg-[#D1F5E8] text-[#17A673]">{t('statusResolved')}</Badge>),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="text-start">
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('flagsTitle')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('flagsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 text-start">
            <p className="text-xs font-bold text-slate-500">{t('severityCritical')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{severityCounts.CRITIQUE}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 text-start">
            <p className="text-xs font-bold text-slate-500">{t('severityHigh')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{severityCounts.ELEVE}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 text-start">
            <p className="text-xs font-bold text-slate-500">{t('severityMedium')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{severityCounts.MOYEN}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] rounded-full h-9 text-xs font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">{t('statusOpen')}</SelectItem>
            <SelectItem value="RESOLVED">{t('statusResolved')}</SelectItem>
            <SelectItem value="all">{t('allStatusesOption')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px] rounded-full h-9 text-xs font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSeveritiesOption')}</SelectItem>
            <SelectItem value="CRITIQUE">{t('severityCritical')}</SelectItem>
            <SelectItem value="ELEVE">{t('severityHigh')}</SelectItem>
            <SelectItem value="MOYEN">{t('severityMedium')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-[220px] ms-auto">
          <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('searchStudentPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="ps-10 h-9 text-xs bg-slate-50 border-none rounded-full text-start"
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        emptyTitle={t('emptyFlagsTitle')}
        emptyDescription={t('emptyFlagsDesc')}
        exportFilename="signalements-presence"
      />
    </div>
  );
}
