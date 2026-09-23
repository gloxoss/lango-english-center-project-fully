'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Search,
  Trash2,
  Loader2,
  Check,
  Copy,
  Server,
  Activity,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DnsVerificationResult } from '@/features/platform/services/dns-verification-service';

type DomainRecord = {
  domain: {
    id: string;
    domain: string;
    domainType: 'subdomain' | 'custom';
    status: 'pending' | 'verified' | 'approved' | 'rejected';
    verificationToken: string | null;
    requestedAt: string;
    approvedAt: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    planTier: string;
  };
};

export function SuperAdminDomainsView({ locale: _locale }: { locale: string }) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // DNS Verification Modal State
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [dnsResult, setDnsResult] = useState<{
    record: DomainRecord;
    result: DnsVerificationResult;
  } | null>(null);

  // Status Action Modal State
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    domain: string;
    school: string;
    action: 'approved' | 'rejected' | 'delete';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/domains');
      const json = await res.json();
      if (json.success) {
        setDomains(json.data || []);
      } else {
        toast.error(json.error?.message || 'Erreur lors du chargement des domaines.');
      }
    } catch {
      toast.error('Erreur réseau lors du chargement des domaines.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDns = async (record: DomainRecord) => {
    setVerifyingId(record.domain.id);
    try {
      const res = await fetch(`/api/super-admin/domains/${record.domain.id}/verify`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDnsResult({
          record,
          result: json.data.verification,
        });
        if (json.data.status === 'verified' && record.domain.status === 'pending') {
          toast.success('DNS validé avec succès ! Statut mis à jour.');
        }
        fetchDomains();
      } else {
        toast.error(json.error?.message || 'Échec de la vérification DNS.');
      }
    } catch {
      toast.error('Erreur réseau lors de la vérification DNS.');
    } finally {
      setVerifyingId(null);
    }
  };

  const executeStatusUpdate = async () => {
    if (!actionTarget) return;
    setActionLoading(true);

    try {
      if (actionTarget.action === 'delete') {
        const res = await fetch(`/api/super-admin/domains/${actionTarget.id}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Domaine ${actionTarget.domain} supprimé avec succès.`);
          setActionTarget(null);
          fetchDomains();
        } else {
          toast.error(json.error?.message || 'Erreur lors de la suppression.');
        }
      } else {
        const res = await fetch(`/api/super-admin/domains/${actionTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: actionTarget.action,
            reason: rejectionReason.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(
            actionTarget.action === 'approved'
              ? `Domaine ${actionTarget.domain} approuvé et activé !`
              : `Domaine ${actionTarget.domain} rejeté.`
          );
          setActionTarget(null);
          setRejectionReason('');
          fetchDomains();
        } else {
          toast.error(json.error?.message || 'Erreur lors de la mise à jour.');
        }
      }
    } catch {
      toast.error('Erreur réseau lors de la mise à jour.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered domains
  const filteredDomains = useMemo(() => {
    return domains.filter(d => {
      const matchSearch =
        !search.trim() ||
        d.domain.domain.toLowerCase().includes(search.toLowerCase()) ||
        d.tenant.name.toLowerCase().includes(search.toLowerCase()) ||
        d.tenant.slug.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'all' || d.domain.status === statusFilter;
      const matchType = typeFilter === 'all' || d.domain.domainType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [domains, search, statusFilter, typeFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    return {
      total: domains.length,
      pending: domains.filter(d => d.domain.status === 'pending').length,
      verified: domains.filter(d => d.domain.status === 'verified').length,
      approved: domains.filter(d => d.domain.status === 'approved').length,
      customCount: domains.filter(d => d.domain.domainType === 'custom').length,
    };
  }, [domains]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
    toast.success('Copié dans le presse-papier !');
  };

  const getStatusBadge = (status: DomainRecord['domain']['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            En attente
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-[#0066FF]" />
            DNS Vérifié
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approuvé (En ligne)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejeté
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0066FF] shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Domaines Personnalisés & Sous-domaines
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Validation DNS en direct, attribution de sous-domaines et gouvernance des adresses web officielles des écoles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDomains}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 px-3.5 font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0066FF]' : 'text-slate-600'}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Demandes</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">{stats.total}</div>
          <p className="text-[11px] text-slate-400 font-medium">{stats.customCount} domaines personnalisés</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Attente</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700">{stats.pending}</div>
          <p className="text-[11px] text-amber-600 font-medium">Validation ou DNS à vérifier</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">DNS Vérifiés</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0066FF]">{stats.verified}</div>
          <p className="text-[11px] text-slate-400 font-medium">Prêts pour approbation</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Domaines Actifs</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{stats.approved}</div>
          <p className="text-[11px] text-emerald-600 font-medium">En ligne & routés vers l'école</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par nom de domaine, établissement ou code école..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="verified">DNS Vérifié</option>
              <option value="approved">Approuvé</option>
              <option value="rejected">Rejeté</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">Tous les types</option>
              <option value="subdomain">Sous-domaines (.schoolos)</option>
              <option value="custom">Domaines personnalisés</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Domains Table */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#0066FF] mb-2.5" />
            <p className="text-xs font-medium">Chargement des domaines...</p>
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-[#0066FF] mb-3">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Aucun domaine correspondant</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Aucune demande de domaine ne correspond à vos critères de recherche.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[260px]">Domaine & Cible</th>
                  <th className="py-3 px-4 min-w-[220px]">Établissement</th>
                  <th className="py-3 px-4 min-w-[130px]">Type</th>
                  <th className="py-3 px-4 min-w-[150px]">Statut</th>
                  <th className="py-3 px-4 min-w-[140px]">Date de Demande</th>
                  <th className="py-3 px-4 min-w-[150px]">Test DNS Direct</th>
                  <th className="py-3 px-4 w-[200px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDomains.map((record) => {
                  const isVerifying = verifyingId === record.domain.id;

                  return (
                    <tr key={record.domain.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0F172A] font-mono text-xs">
                            {record.domain.domain}
                          </span>
                          {record.domain.status === 'approved' && (
                            <a
                              href={`https://${record.domain.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-[#0066FF] transition-colors"
                              title="Ouvrir le site"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {record.domain.domainType === 'subdomain'
                            ? 'Routage automatique vers SchoolOS'
                            : 'CNAME: schoolos.epioso.com'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0F172A]">{record.tenant.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-400 font-mono">{record.tenant.slug}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                            {record.tenant.planTier}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            record.domain.domainType === 'custom'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {record.domain.domainType === 'custom' ? 'Domaine personnalisé' : 'Sous-domaine'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(record.domain.status)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {format(new Date(record.domain.requestedAt), 'dd MMM yyyy, HH:mm', { locale: fr })}
                      </td>

                      <td className="py-3.5 px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isVerifying}
                          onClick={() => handleVerifyDns(record)}
                          className="h-7 text-[11px] rounded-lg border-slate-200 bg-white hover:bg-slate-50 gap-1 text-slate-700 font-medium px-2.5"
                        >
                          {isVerifying ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#0066FF]" />
                          ) : (
                            <Activity className="w-3 h-3 text-[#0066FF]" />
                          )}
                          Tester DNS
                        </Button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {record.domain.status !== 'approved' && (
                            <Button
                              size="sm"
                              onClick={() =>
                                setActionTarget({
                                  id: record.domain.id,
                                  domain: record.domain.domain,
                                  school: record.tenant.name,
                                  action: 'approved',
                                })
                              }
                              className="h-7 text-[11px] rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold px-2.5 shadow-2xs"
                            >
                              Approuver
                            </Button>
                          )}

                          {record.domain.status !== 'rejected' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setActionTarget({
                                  id: record.domain.id,
                                  domain: record.domain.domain,
                                  school: record.tenant.name,
                                  action: 'rejected',
                                })
                              }
                              className="h-7 text-[11px] rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 font-bold px-2"
                            >
                              Rejeter
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setActionTarget({
                                id: record.domain.id,
                                domain: record.domain.domain,
                                school: record.tenant.name,
                                action: 'delete',
                              })
                            }
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Live DNS Diagnostic Modal */}
      <Dialog open={!!dnsResult} onOpenChange={() => setDnsResult(null)}>
        <DialogContent className="max-w-xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#0F172A] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#0066FF]" />
              Diagnostic DNS en direct : {dnsResult?.record.domain.domain}
            </DialogTitle>
          </DialogHeader>

          {dnsResult && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Verdict Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  dnsResult.result.isFullyVerified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {dnsResult.result.isFullyVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{dnsResult.result.message}</p>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    Vérifié le {format(new Date(dnsResult.result.checkedAt), 'dd MMMM yyyy à HH:mm:ss', { locale: fr })}
                  </p>
                </div>
              </div>

              {/* Technical Details Cards */}
              <div className="space-y-2.5">
                {/* CNAME */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Enregistrement CNAME</span>
                    {dnsResult.result.cnameMatched ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                        Conforme
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                        Non détecté
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Cible attendue : <span className="font-mono text-slate-800 font-semibold">{dnsResult.result.expectedTarget}</span>
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    CNAME détecté :{' '}
                    <span className="font-mono text-slate-800">
                      {dnsResult.result.detectedCnames.join(', ') || 'Aucun'}
                    </span>
                  </p>
                </div>

                {/* A Record */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Enregistrement A (IPv4)</span>
                    {dnsResult.result.aRecordMatched ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                        Conforme
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[10px]">
                        Optionnel
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    IP attendue : <span className="font-mono text-slate-800 font-semibold">{dnsResult.result.expectedIp}</span>
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    IP détectée :{' '}
                    <span className="font-mono text-slate-800">
                      {dnsResult.result.detectedIps.join(', ') || 'Aucune'}
                    </span>
                  </p>
                </div>

                {/* TXT Record */}
                {dnsResult.record.domain.verificationToken && (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Jeton de propriété TXT</span>
                      {dnsResult.result.txtTokenMatched ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                          Vérifié
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                          En attente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-200 mt-1">
                      <code className="font-mono text-[10px] text-slate-700 truncate">
                        {dnsResult.record.domain.verificationToken}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(dnsResult.record.domain.verificationToken!)}
                        className="h-6 text-[10px] gap-1 px-2 text-slate-600"
                      >
                        {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        Copier
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDnsResult(null)}
              className="rounded-xl border-slate-200 text-slate-700 text-xs font-bold"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal (Approve / Reject / Delete) */}
      <Dialog open={!!actionTarget} onOpenChange={() => setActionTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#0F172A]">
              {actionTarget?.action === 'approved' && `Approuver le domaine ${actionTarget.domain} ?`}
              {actionTarget?.action === 'rejected' && `Rejeter la demande pour ${actionTarget.domain} ?`}
              {actionTarget?.action === 'delete' && `Supprimer définitivement ${actionTarget.domain} ?`}
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs text-slate-600 space-y-3">
            {actionTarget?.action === 'approved' && (
              <p>
                L'approbation activera le nom de domaine pour l'établissement{' '}
                <strong className="text-slate-900">{actionTarget.school}</strong>. Il sera ajouté aux origines de confiance
                et le routage multi-tenant sera immédiatement opérationnel.
              </p>
            )}

            {actionTarget?.action === 'rejected' && (
              <div className="space-y-2">
                <p>
                  Indiquez éventuellement le motif du rejet (ex: CNAME erroné, nom de domaine réservé) :
                </p>
                <Input
                  placeholder="Motif du rejet (optionnel)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            )}

            {actionTarget?.action === 'delete' && (
              <p className="text-rose-600 font-medium">
                Cette action supprimera définitivement l'enregistrement de ce domaine dans SchoolOS. L'établissement devra
                soumettre une nouvelle demande s'il souhaite le réutiliser.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionTarget(null)}
              disabled={actionLoading}
              className="rounded-xl border-slate-200 text-slate-700 text-xs font-bold"
            >
              Annuler
            </Button>

            <Button
              size="sm"
              disabled={actionLoading}
              onClick={executeStatusUpdate}
              className={`rounded-xl text-xs font-bold gap-1.5 shadow-xs ${
                actionTarget?.action === 'approved'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {actionTarget?.action === 'approved' && 'Confirmer l’approbation'}
              {actionTarget?.action === 'rejected' && 'Confirmer le rejet'}
              {actionTarget?.action === 'delete' && 'Supprimer le domaine'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
