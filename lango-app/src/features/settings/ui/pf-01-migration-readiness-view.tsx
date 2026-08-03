'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  Users, School, CheckCircle2, Clock, AlertTriangle, FileSpreadsheet,
  Download, ArrowRight, X, Play, RefreshCw,
} from 'lucide-react';

const STATS = [
  { label: 'Élèves importés', value: '1 248', sub: '+124 cette semaine', icon: Users, iconBg: 'bg-[#DCEBF4] text-[#1B6C93]' },
  { label: 'Sections configurées', value: '18 / 20', sub: '2 restantes', icon: School, iconBg: 'bg-[#FCF0DC] text-[#E8A33D]' },
  { label: 'Utilisateurs activés', value: '34', sub: '+8 ce mois', icon: CheckCircle2, iconBg: 'bg-[#D1F5E8] text-[#17A673]' },
  { label: 'Tâches en attente', value: '7', sub: '3 critiques', icon: Clock, iconBg: 'bg-[#FCE4E2] text-[#E5544B]' },
];

const MIGRATION_TASKS = [
  { id: 1, task: 'Importer les données des élèves (MASSAR)', status: 'done', assignee: 'Yassine El Amrani', initials: 'YA', date: '28/07/2026' },
  { id: 2, task: 'Configurer les sections et niveaux', status: 'done', assignee: 'Salma Bennani', initials: 'SB', date: '29/07/2026' },
  { id: 3, task: 'Associer les matières aux professeurs', status: 'in_progress', assignee: 'Omar Tazi', initials: 'OT', date: '31/07/2026' },
  { id: 4, task: 'Paramétrer les frais de scolarité', status: 'in_progress', assignee: 'Fatima Oulhaj', initials: 'FO', date: '01/08/2026' },
  { id: 5, task: 'Activer les accès parents/tuteurs', status: 'pending', assignee: 'Rachid Alaoui', initials: 'RA', date: '03/08/2026' },
  { id: 6, task: 'Former l\'équipe administrative', status: 'pending', assignee: 'Khadija El Fassi', initials: 'KF', date: '05/08/2026' },
  { id: 7, task: 'Vérifier l\'import des notes historiques', status: 'blocked', assignee: 'Hamid Benali', initials: 'HB', date: '02/08/2026' },
];

const ALERTS = [
  { id: 1, type: 'danger', msg: 'Import ligne 47: numéro tuteur manquant (Amine Chakir)', time: 'Il y a 12 min' },
  { id: 2, type: 'warning', msg: '3 sections dépassent la capacité maximale (Niveau CM2)', time: 'Il y a 1h' },
  { id: 3, type: 'info', msg: 'Sauvegarde automatique effectuée avec succès', time: 'Il y a 2h' },
  { id: 4, type: 'success', msg: '1 248 élèves importés sans erreur', time: 'Il y a 4h' },
];

const READINESS_STEPS = [
  { label: 'Structure académique', pct: 100, done: true },
  { label: 'Import élèves', pct: 94, done: false },
  { label: 'Finances & frais', pct: 60, done: false },
  { label: 'Portails utilisateurs', pct: 30, done: false },
  { label: 'Communication SMS', pct: 10, done: false },
];

export function MigrationReadinessCenterView({ locale: _locale }: { locale: string }) {
  const [selectedTask, setSelectedTask] = useState<(typeof MIGRATION_TASKS)[0] | null>(null);

  const renderBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge className="bg-[#D1F5E8] text-[#17A673] hover:bg-[#D1F5E8] border-none font-bold text-[11px]">Terminé</Badge>;
      case 'in_progress':
        return <Badge className="bg-[#FCF0DC] text-[#E8A33D] hover:bg-[#FCF0DC] border-none font-bold text-[11px]">En cours</Badge>;
      case 'pending':
        return <Badge variant="neutral" className="text-slate-500 font-bold text-[11px]">À faire</Badge>;
      case 'blocked':
        return <Badge className="bg-[#FCE4E2] text-[#E5544B] hover:bg-[#FCE4E2] border-none font-bold text-[11px]">Bloqué</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Centre de préparation à la migration</h1>
            <Badge className="bg-[#D1F5E8] text-[#17A673] border-none font-bold text-xs">78% Prêt</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">École Groupe Scolaire Atlas — Casablanca · Démarrage prévu le 05/09/2026</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 h-9 text-xs rounded-xl">
            <Download className="w-3.5 h-3.5" />
            <span>Exporter le rapport</span>
          </Button>
          <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl px-4 bg-[#0066FF] hover:bg-[#0052CC]">
            <Play className="w-4 h-4 fill-current" />
            <span>Valider la migration</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s, idx) => {
          const IconComp = s.icon;
          return (
            <Card key={idx} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400">{s.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{s.value}</p>
                <p className="text-[11px] font-bold text-[#2487B8]">{s.sub}</p>
              </div>
              <div className={`w-11 h-11 rounded-2xl ${s.iconBg} flex items-center justify-center`}>
                <IconComp className="w-5 h-5" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Migration Tasks Table */}
        <Card className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#0066FF]" />
              <h3 className="text-sm font-bold text-[#16212B]">Tâches de migration</h3>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-600">Tâche</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Responsable</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Échéance</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MIGRATION_TASKS.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors text-xs"
                  >
                    <TableCell className="font-semibold text-[#16212B]">{t.task}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6 text-[10px] bg-[#DCEBF4] text-[#1B6C93] font-bold">
                          <AvatarFallback>{t.initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-slate-600">{t.assignee}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 font-mono">{t.date}</TableCell>
                    <TableCell className="text-right">{renderBadge(t.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Readiness Progress & Alerts */}
        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#16212B]">Niveau de préparation</h3>
            <div className="space-y-3">
              {READINESS_STEPS.map((s, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-700">{s.label}</span>
                    <span className="font-bold text-[#16212B] font-mono">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-2 bg-slate-100" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#16212B]">Alertes récentes</h3>
            <div className="space-y-2 text-xs">
              {ALERTS.map((a) => (
                <div key={a.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <p className="text-slate-700 font-medium">{a.msg}</p>
                  <p className="text-[10px] text-slate-400">{a.time}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Selected Task Detail Modal/Panel */}
      {selectedTask && (
        <Card className="p-6 bg-[#DCEBF4]/30 border border-[#0066FF]/20 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#16212B]">Détails de la tâche: {selectedTask.task}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)} className="h-7 w-7 p-0 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Responsable</span>
              <p className="font-bold text-[#16212B] mt-0.5">{selectedTask.assignee}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Échéance</span>
              <p className="font-bold text-[#16212B] font-mono mt-0.5">{selectedTask.date}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Statut actuel</span>
              <div className="mt-0.5">{renderBadge(selectedTask.status)}</div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" className="h-8 text-xs rounded-xl bg-[#0066FF] text-white">Marquer comme terminé</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
