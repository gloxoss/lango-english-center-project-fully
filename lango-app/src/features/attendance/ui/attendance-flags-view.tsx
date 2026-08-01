'use client';

import { AlertTriangle, Flag, Search, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const TYPE_LABELS: Record<FlagType, string> = {
  UNJUSTIFIED_ABSENCE: 'Absence non justifiée',
  CONSECUTIVE_ABSENCE: 'Absences consécutives',
  REPEATED_LATE: 'Retards répétés',
};

const SEVERITY_LABELS: Record<FlagSeverity, string> = {
  CRITIQUE: 'Critique',
  ELEVE: 'Élevé',
  MOYEN: 'Moyen',
};

function severityBadge(severity: FlagSeverity) {
  switch (severity) {
    case 'CRITIQUE':
      return <Badge className="bg-[#FCE4E2] text-[#E5544B]">Critique</Badge>;
    case 'ELEVE':
      return <Badge className="bg-[#FCF0DC] text-[#E8A33D]">Élevé</Badge>;
    default:
      return <Badge variant="neutral">Moyen</Badge>;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AttendanceFlagsView({ locale }: { locale: string }) {
  const [flags, setFlags] = useState<ApiFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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
      header: 'Type de signalement',
      cell: f => (
        <div className="flex items-center gap-2">
          <Flag className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-[#16212B]">{TYPE_LABELS[f.type]}</span>
        </div>
      ),
    },
    {
      key: 'studentName',
      header: 'Élève',
      cell: f => (
        <Link href={`/${locale}/dashboard/attendance/flags/${f.id}`} className="font-bold text-[#16212B] hover:text-[#2487B8] hover:underline">
          {f.studentName}
        </Link>
      ),
    },
    {
      key: 'severity',
      header: 'Gravité',
      cell: f => severityBadge(f.severity),
    },
    {
      key: 'guardianPhone',
      header: 'Tél. tuteur',
      cell: f => <span className="font-mono text-slate-600">{f.guardianPhone ?? '—'}</span>,
    },
    {
      key: 'assignedToName',
      header: 'Assigné à',
      cell: f => (f.assignedToName
        ? <span className="text-slate-700 font-semibold">{f.assignedToName}</span>
        : <span className="text-slate-400">Non assigné</span>),
    },
    {
      key: 'detectedAt',
      header: 'Détecté le',
      cell: f => <span className="text-slate-500">{formatDateTime(f.detectedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: f => (f.status === 'OPEN'
        ? <Badge className="bg-[#FCF0DC] text-[#E8A33D]">À traiter</Badge>
        : <Badge className="bg-[#D1F5E8] text-[#17A673]">Résolu</Badge>),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Signalements de présence</h1>
        <p className="text-xs text-slate-500 mt-1">Suivi des élèves à risque : absences non justifiées, absences consécutives, retards répétés.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Critique</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{severityCounts.CRITIQUE}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Élevé</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{severityCounts.ELEVE}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <Flag className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Moyen</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{severityCounts.MOYEN}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
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
            <SelectItem value="OPEN">À traiter</SelectItem>
            <SelectItem value="RESOLVED">Résolu</SelectItem>
            <SelectItem value="all">Tous les statuts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px] rounded-full h-9 text-xs font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes gravités</SelectItem>
            <SelectItem value="CRITIQUE">Critique</SelectItem>
            <SelectItem value="ELEVE">Élevé</SelectItem>
            <SelectItem value="MOYEN">Moyen</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-[220px] ml-auto">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un élève..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-xs bg-slate-50 border-none rounded-full"
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        emptyTitle="Aucun signalement"
        emptyDescription="Aucun signalement ne correspond à vos filtres."
        exportFilename="signalements-presence"
      />
    </div>
  );
}
