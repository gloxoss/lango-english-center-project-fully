'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  TrendingUp,
  PlusCircle,
  CreditCard,
  Radio,
  Loader2,
} from 'lucide-react';

interface SmsLog {
  id: string;
  tenantId: string;
  schoolName: string | null;
  recipientPhone: string;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  sentAt: string | null;
  createdAt: string;
}

interface SmsStats {
  total: number;
  sent: number;
  queued: number;
  failed: number;
  successRate: number;
}

interface SchoolOption {
  id: string;
  name: string;
  slug: string;
}

export function SuperAdminSmsView() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [stats, setStats] = useState<SmsStats>({ total: 0, sent: 0, queued: 0, failed: 0, successRate: 100 });
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Top-up modal state
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupSchoolId, setTopupSchoolId] = useState('');
  const [topupCredits, setTopupCredits] = useState('500');
  const [topupNote, setTopupNote] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSmsData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSchool !== 'all') params.set('tenantId', selectedSchool);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/super-admin/sms?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs || []);
        setStats(json.data.stats || { total: 0, sent: 0, queued: 0, failed: 0, successRate: 100 });
        if (json.data.schools) setSchools(json.data.schools);
      }
    } catch (e) {
      console.error('Failed to load platform SMS logs', e);
    } finally {
      setLoading(false);
    }
  }, [selectedSchool, selectedStatus, search]);

  useEffect(() => {
    fetchSmsData();
  }, [fetchSmsData]);

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupSchoolId || !topupCredits) return;
    setTopupLoading(true);
    try {
      const res = await fetch('/api/super-admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: topupSchoolId,
          credits: Number(topupCredits),
          note: topupNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.data.message || 'Crédits alloués avec succès.');
        setTopupOpen(false);
        setTopupNote('');
        fetchSmsData();
      }
    } catch (e) {
      console.error('Failed to topup credits', e);
    } finally {
      setTopupLoading(false);
    }
  };

  const statusBadge = (status: SmsLog['status']) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-[#DDF5EC] text-[#17A673] border-none font-bold text-[11px]">Envoyé</Badge>;
      case 'queued':
        return <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[11px]">En attente</Badge>;
      case 'failed':
        return <Badge className="bg-rose-100 text-rose-600 border-none font-bold text-[11px]">Échoué</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-[#0066FF]" />
            Plateforme SMS & Passerelles Télécom
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervision globale des flux SMS, consommation de crédits et passerelles Maroc Télécom / Inwi / Orange.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSmsData}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (schools.length > 0 && schools[0]) setTopupSchoolId(schools[0].id);
              setTopupOpen(true);
            }}
            className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Allouer des crédits SMS
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">
            Fermer
          </button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volume Total</span>
            <div className="w-8 h-8 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#0066FF]">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#16212B]">{stats.total.toLocaleString('fr-FR')}</div>
          <p className="text-[11px] text-slate-400">Messages enregistrés sur la plateforme</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux de Délivrabilité</span>
            <div className="w-8 h-8 rounded-xl bg-[#DDF5EC] flex items-center justify-center text-[#17A673]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#17A673]">{stats.successRate}%</div>
          <p className="text-[11px] text-slate-400">{stats.sent.toLocaleString('fr-FR')} délivrés avec succès</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">En file d'attente</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700">{stats.queued}</div>
          <p className="text-[11px] text-slate-400">En cours de routage opérateur</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Écoles Connectées</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-violet-700">{schools.length}</div>
          <p className="text-[11px] text-slate-400">Établissements avec passerelle active</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par numéro ou texte..."
              className="pl-9 h-9 text-xs rounded-xl border-slate-200"
            />
          </div>
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">Toutes les écoles ({schools.length})</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">Tous les statuts</option>
            <option value="sent">Envoyés</option>
            <option value="queued">En attente</option>
            <option value="failed">Échoués</option>
          </select>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Établissement</th>
                <th className="py-3 px-4">Destinataire</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Date d'envoi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0066FF] mb-2" />
                    Chargement des journaux SMS...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Aucun message SMS trouvé pour les filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#16212B]">{log.schoolName || 'Atlas International'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.tenantId.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {log.recipientPhone}
                    </td>
                    <td className="py-3 px-4 max-w-md truncate text-slate-600" title={log.body}>
                      {log.body}
                    </td>
                    <td className="py-3 px-4">{statusBadge(log.status)}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top-up Dialog */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              Allouer des crédits SMS à un établissement
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTopup} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Établissement scolaire</label>
              <select
                value={topupSchoolId}
                onChange={(e) => setTopupSchoolId(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white"
                required
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Nombre de crédits SMS</label>
              <Input
                type="number"
                min="100"
                step="100"
                value={topupCredits}
                onChange={(e) => setTopupCredits(e.target.value)}
                className="h-9 text-xs rounded-xl border-slate-200"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">1 crédit = 1 segment SMS (160 caractères GSM)</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Note ou référence de facture (optionnel)</label>
              <Input
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Ex: Rechargement pack annuel 2026 / Facture F-9921"
                className="h-9 text-xs rounded-xl border-slate-200"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTopupOpen(false)}
                className="h-9 text-xs rounded-xl border-slate-200"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={topupLoading}
                className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
              >
                {topupLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Valider l'allocation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
