'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Clock, History, Play, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

const JOBS = [
  { id: 1, name: 'Rappels de paiement automatiques (SMS/Email)', schedule: 'Chaque lundi à 08:00', status: 'active', lastRun: '29/07/2026 08:01', result: 'success' },
  { id: 2, name: 'Sauvegarde automatique de la base de données', schedule: 'Chaque jour à 02:00', status: 'active', lastRun: '02/08/2026 02:00', result: 'success' },
  { id: 3, name: 'Calcul automatique des moyennes trimestrielles', schedule: 'Lancement manuel', status: 'paused', lastRun: '15/06/2026 10:30', result: 'success' },
  { id: 4, name: 'Synchronisation import des matricules MASSAR', schedule: 'Lancement manuel', status: 'error', lastRun: '01/08/2026 14:22', result: 'error' },
];

const AUDIT_LOG = [
  { id: 1, user: 'Yassine El Amrani', action: 'Modification du taux de TVA (20%)', time: 'Aujourd\'hui 11:34' },
  { id: 2, user: 'Salma Bennani', action: 'Création du compte enseignant Omar Tazi', time: 'Hier 09:12' },
  { id: 3, user: 'Système automatique', action: 'Backup de la base de données complété (482 Mo)', time: 'Hier 02:00' },
  { id: 4, user: 'Yassine El Amrani', action: 'Activation du portail tuteurs', time: '30/07/2026 16:45' },
];

export function JobsAuditView({ locale: _locale }: { locale: string }) {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Tâches planifiées & journal d&apos;audit</h1>
          <p className="text-xs text-slate-500 mt-1">Suivez l&apos;exécution des tâches d&apos;arrière-plan et l&apos;historique complet des actions administratives.</p>
        </div>
        <Button size="sm" className="gap-2 h-9 text-xs rounded-xl px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white">
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Exécuter une tâche</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Jobs */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">Tâches planifiées (Automatisations)</h3>
                <p className="text-[11px] text-slate-500">Tâches système programmées</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 text-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-600">Nom de la tâche</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Fréquence</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600 text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {JOBS.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-semibold text-[#16212B]">
                      {j.name}
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Dernière exécution: {j.lastRun}</p>
                    </TableCell>
                    <TableCell className="text-slate-600">{j.schedule}</TableCell>
                    <TableCell className="text-right">
                      {j.result === 'success' ? (
                        <Badge className="bg-[#D1F5E8] text-[#17A673] border-none font-bold text-[10px]">Actif</Badge>
                      ) : j.status === 'paused' ? (
                        <Badge variant="neutral" className="text-slate-500 font-bold text-[10px]">Inactif</Badge>
                      ) : (
                        <Badge className="bg-[#FCE4E2] text-[#E5544B] border-none font-bold text-[10px]">Erreur</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Real-time Audit Trail */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">Journal d&apos;audit récent</h3>
                <p className="text-[11px] text-slate-500">Traçabilité des modifications système</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {AUDIT_LOG.map((a) => (
              <div key={a.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#16212B]">{a.action}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.user} · {a.time}</p>
                </div>
                <Badge variant="neutral" className="text-[10px] font-bold text-slate-500">Audité</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
