'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
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
  Clock,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Trash2,
  Server,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DnsVerificationResult } from '@/features/platform/services/dns-verification-service';

type DomainRecord = {
  id: string;
  domain: string;
  domainType: 'subdomain' | 'custom';
  status: 'pending' | 'verified' | 'approved' | 'rejected';
  verificationToken: string | null;
  requestedAt: string;
  approvedAt: string | null;
};

export function SchoolAdminDomainsView({ locale: _locale }: { locale: string }) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [domainType, setDomainType] = useState<'subdomain' | 'custom'>('subdomain');
  const [domainInput, setDomainInput] = useState('');

  // DNS Check state
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [dnsCheckResult, setDnsCheckResult] = useState<{
    domain: string;
    result: DnsVerificationResult;
  } | null>(null);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/domains');
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

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = domainInput.trim().toLowerCase();
    if (!clean) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/settings/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: clean,
          domainType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Demande enregistrée avec succès !');
        setDomainInput('');
        fetchDomains();
      } else {
        toast.error(json.error?.message || 'Erreur lors de la soumission de la demande.');
      }
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckDns = async (record: DomainRecord) => {
    setCheckingId(record.id);
    try {
      const res = await fetch(`/api/settings/domains/${record.id}/verify`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDnsCheckResult({
          domain: record.domain,
          result: json.data.verification,
        });
        if (json.data.status === 'verified') {
          toast.success('DNS validé avec succès ! Statut mis à jour.');
        }
        fetchDomains();
      } else {
        toast.error(json.error?.message || 'Échec du test DNS.');
      }
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setCheckingId(null);
    }
  };

  const handleDeleteDomain = async (id: string, domainName: string) => {
    if (!confirm(`Supprimer la demande pour ${domainName} ?`)) return;
    try {
      const res = await fetch('/api/settings/domains', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId: id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Demande supprimée.');
        fetchDomains();
      } else {
        toast.error(json.error?.message || 'Erreur lors de la suppression.');
      }
    } catch {
      toast.error('Erreur réseau.');
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
    toast.success('Copié dans le presse-papier !');
  };

  const activeApprovedDomain = domains.find((d) => d.status === 'approved');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0066FF] shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Domaine Personnalisé & Sous-domaine
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Associez une adresse web personnalisée à votre établissement pour vos élèves, parents et professeurs.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchDomains}
          disabled={loading}
          className="h-9 text-xs rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 px-3 font-bold self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0066FF]' : 'text-slate-600'}`} />
          Rafraîchir
        </Button>
      </div>

      {/* Active Domain Highlight Banner */}
      {activeApprovedDomain && (
        <Card className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">Domaine Actif en Production</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-emerald-950">
                    https://{activeApprovedDomain.domain}
                  </span>
                  <a
                    href={`https://${activeApprovedDomain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 text-xs font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white text-emerald-700 border border-emerald-200 shadow-2xs self-start sm:self-auto">
              Routage Opérationnel
            </span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-[#0F172A]">Nouvelle Demande de Domaine</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choisissez un sous-domaine SchoolOS ou votre propre nom de domaine.
              </p>
            </div>

            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Type de Domaine</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDomainType('subdomain');
                      setDomainInput('');
                    }}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      domainType === 'subdomain'
                        ? 'border-[#0066FF] bg-blue-50/60 text-[#0066FF] font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="font-bold">Sous-domaine</p>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">.schoolos.ma (Inclus)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDomainType('custom');
                      setDomainInput('');
                    }}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      domainType === 'custom'
                        ? 'border-[#0066FF] bg-blue-50/60 text-[#0066FF] font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="font-bold">Personnalisé</p>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">www.mon-ecole.ma</p>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {domainType === 'subdomain' ? 'Nom du sous-domaine souhaité' : 'Votre nom de domaine complet'}
                </label>
                <Input
                  placeholder={domainType === 'subdomain' ? 'atlas' : 'www.groupe-atlas.ma'}
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-slate-50/60 border-slate-200"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  {domainType === 'subdomain' ? (
                    <span>
                      Adresse finale :{' '}
                      <strong className="text-slate-700 font-mono">
                        {domainInput.trim() ? `${domainInput.trim().toLowerCase()}.schoolos.ma` : 'votre-ecole.schoolos.ma'}
                      </strong>
                    </span>
                  ) : (
                    <span>Exemple : www.monetablissement.ma ou portail.ecole.com</span>
                  )}
                </p>
              </div>

              {domainType === 'custom' && (
                <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-[11px] text-blue-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#0066FF]" />
                    Configuration DNS requise
                  </p>
                  <p className="opacity-90">
                    Pour lier votre domaine personnalisé, vous devrez ajouter un enregistrement CNAME et un jeton TXT
                    chez votre hébergeur de domaine (OVH, GoDaddy, Hostinger, Genious).
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !domainInput.trim()}
                className="w-full h-9 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold shadow-xs gap-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Envoyer la demande
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Existing Domains & DNS Guidance */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-[#0F172A]">Vos Demandes & Domaines Enregistrés</h2>
              <p className="text-xs text-slate-500 mt-0.5">Historique et statut de vos adresses web.</p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0066FF] mb-2" />
                <p className="text-xs font-medium">Chargement...</p>
              </div>
            ) : domains.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto text-[#0066FF] mb-2">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold text-[#0F172A]">Aucun domaine configuré</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Utilisez le formulaire pour faire votre première demande.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {domains.map((record) => {
                  const isChecking = checkingId === record.id;

                  return (
                    <div key={record.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#0F172A] font-mono">{record.domain}</span>
                            <span
                              className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                record.domainType === 'custom'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {record.domainType === 'custom' ? 'Personnalisé' : 'Sous-domaine'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Demandé le {format(new Date(record.requestedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {record.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              En attente
                            </span>
                          )}
                          {record.status === 'verified' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <ShieldCheck className="w-3 h-3 text-[#0066FF]" />
                              DNS Vérifié
                            </span>
                          )}
                          {record.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Approuvé
                            </span>
                          )}
                          {record.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Rejeté
                            </span>
                          )}

                          {record.status !== 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDomain(record.id, record.domain)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              title="Annuler la demande"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* DNS Setup Guide for Custom Domains */}
                      {record.domainType === 'custom' && record.status !== 'approved' && (
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                              <Server className="w-3.5 h-3.5 text-[#0066FF]" />
                              Configuration DNS requise chez votre registrar
                            </span>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isChecking}
                              onClick={() => handleCheckDns(record)}
                              className="h-7 text-[11px] rounded-lg border-slate-200 bg-white hover:bg-slate-50 gap-1 font-bold text-slate-700 px-2.5"
                            >
                              {isChecking ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#0066FF]" />
                              ) : (
                                <Activity className="w-3 h-3 text-[#0066FF]" />
                              )}
                              Tester le DNS
                            </Button>
                          </div>

                          <div className="space-y-1.5 text-[11px]">
                            {/* Record 1 CNAME */}
                            <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                              <div>
                                <span className="font-bold text-slate-700 font-mono mr-2">CNAME</span>
                                <span className="text-slate-500">Cible : </span>
                                <code className="font-bold text-[#0F172A]">schoolos.epioso.com</code>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard('schoolos.epioso.com', `${record.id}-cname`)}
                                className="h-6 text-[10px] gap-1 px-2 text-slate-600"
                              >
                                {copiedField === `${record.id}-cname` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                Copier
                              </Button>
                            </div>

                            {/* Record 2 TXT */}
                            {record.verificationToken && (
                              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                                <div className="truncate mr-2">
                                  <span className="font-bold text-slate-700 font-mono mr-2">TXT</span>
                                  <span className="text-slate-500">Valeur : </span>
                                  <code className="font-bold text-[#0F172A] truncate">
                                    {record.verificationToken}
                                  </code>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(record.verificationToken!, `${record.id}-txt`)}
                                  className="h-6 text-[10px] gap-1 px-2 text-slate-600 shrink-0"
                                >
                                  {copiedField === `${record.id}-txt` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  Copier
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* DNS Diagnostic Result Modal for School Admin */}
      <Dialog open={!!dnsCheckResult} onOpenChange={() => setDnsCheckResult(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#0066FF]" />
              Résultat du test DNS : {dnsCheckResult?.domain}
            </DialogTitle>
          </DialogHeader>

          {dnsCheckResult && (
            <div className="space-y-3.5 py-2 text-xs">
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  dnsCheckResult.result.isFullyVerified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {dnsCheckResult.result.isFullyVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{dnsCheckResult.result.message}</p>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    CNAME détecté : {dnsCheckResult.result.detectedCnames.join(', ') || 'Aucun'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDnsCheckResult(null)}
              className="rounded-xl border-slate-200 text-slate-700 text-xs font-bold"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
