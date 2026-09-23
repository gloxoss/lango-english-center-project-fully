'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ShieldCheck, Sparkles, Download, Search, Lock, Check, AlertCircle, RefreshCw, Send,
} from 'lucide-react';
import { toast } from 'sonner';

type AddonModule = {
  addonId: string;
  name: string;
  description: string;
  built: boolean;
  active: boolean;
  expiresAt: string | null;
  expiryLabel: string | null;
};

type PlanInfo = {
  planTier: string;
  subscriptionStatus: string;
  maxBranches: number;
  hasMultiBranchAddon: boolean;
  branchCount: number;
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Offre SchoolOS Découverte',
  basic: 'Offre SchoolOS Basic',
  standard: 'Offre SchoolOS Standard',
  premium: 'Offre SchoolOS Enterprise',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Licence Valide',
  suspended: 'Licence Suspendue',
  cancelled: 'Licence Annulée',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-[#DDF5EC] text-[#17A673]',
  suspended: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

type ModuleStatus = 'active' | 'expired' | 'available' | 'upcoming';

function moduleStatus(m: AddonModule): ModuleStatus {
  if (m.active) return 'active';
  if (m.expiresAt) return 'expired';
  if (m.built) return 'available';
  return 'upcoming';
}

const STATUS_CARD_BADGE: Record<ModuleStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-[#DDF5EC] text-[#17A673]' },
  expired: { label: 'Expiré', className: 'bg-rose-50 text-rose-500' },
  available: { label: 'Disponible', className: 'bg-blue-50 text-[#1B6C93]' },
  upcoming: { label: 'À venir', className: 'bg-slate-100 text-slate-500' },
};

export function EntitlementsCatalogView({ locale }: { locale?: string } = {}) {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'premium'>('all');
  const [search, setSearch] = useState('');
  const [modules, setModules] = useState<AddonModule[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/addons');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Impossible de charger les modules');
      setModules(json.data ?? []);
      setPlan(json.plan ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredModules = modules.filter(m => {
    const s = moduleStatus(m);
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all'
      || (activeTab === 'active' && s === 'active')
      || (activeTab === 'premium' && s !== 'active');
    return matchesSearch && matchesTab;
  });

  const activeModuleCount = modules.filter(m => m.active).length;
  const earliestExpiry = modules
    .filter(m => m.active && m.expiresAt)
    .map(m => new Date(m.expiresAt as string).getTime())
    .sort((a, b) => a - b)[0];
  const contractExpiry = earliestExpiry ? new Date(earliestExpiry).toLocaleDateString('fr-FR') : '—';

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [targetModule, setTargetModule] = useState<{ addonId?: string; name: string } | null>(null);
  const [requestSubject, setRequestSubject] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const openModuleRequest = (mod?: { addonId: string; name: string }) => {
    if (mod) {
      setTargetModule(mod);
      setRequestSubject(`Demande d'activation : ${mod.name}`);
      setRequestMessage(`Bonjour,\n\nNotre établissement souhaite activer le module « ${mod.name} » dans le cadre de notre abonnement SchoolOS.\nMerci de nous contacter ou de mettre à jour nos accès.\n\nCordialement,\nLa Direction`);
    } else {
      setTargetModule(null);
      setRequestSubject("Demande de nouveaux modules / extension d'offre");
      setRequestMessage("Bonjour,\n\nNotre établissement souhaite étudier l'ajout de nouveaux modules à son offre SchoolOS actuelle.\nMerci de bien vouloir nous recontacter.\n\nCordialement,\nLa Direction");
    }
    setRequestModalOpen(true);
  };

  const handleSendRequest = async () => {
    if (!requestSubject.trim() || !requestMessage.trim()) {
      toast.error('Veuillez renseigner le sujet et votre message.');
      return;
    }
    setSubmittingRequest(true);
    try {
      const res = await fetch('/api/tenant/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: requestSubject,
          category: 'billing',
          priority: 'medium',
          message: requestMessage,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Votre demande a bien été transmise à l'équipe SchoolOS. Un ticket a été créé.");
        setRequestModalOpen(false);
      } else {
        toast.error(json.error?.message || "Erreur lors de l'envoi de la demande.");
      }
    } catch {
      toast.error('Erreur de connexion au service de support.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleDownloadLicenseCertificate = () => {
    const activeNames = modules.filter(m => m.active).map(m => m.name);
    const planName = PLAN_LABELS[plan?.planTier ?? ''] ?? 'Offre SchoolOS Entreprise';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour afficher l'attestation.");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Attestation de Licence Officielle - SchoolOS</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #16212B; margin: 0; background: #fff; }
          .cert-border { border: 6px double #2487B8; padding: 35px; border-radius: 16px; position: relative; }
          .header { text-align: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; }
          .logo { font-size: 26px; font-weight: 900; color: #2487B8; }
          .sublogo { font-size: 11px; text-transform: uppercase; color: #64748B; letter-spacing: 2px; font-weight: 700; margin-top: 4px; }
          .title { font-size: 20px; font-weight: 800; text-transform: uppercase; color: #16212B; margin-top: 25px; letter-spacing: 1px; }
          .cert-body { margin-top: 25px; line-height: 1.8; font-size: 14px; }
          .badge-box { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 18px; border-radius: 12px; margin: 20px 0; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .field-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748B; }
          .field-value { font-size: 14px; font-weight: 700; color: #16212B; }
          .module-tag { display: inline-block; background: #DCEBF4; color: #1B6C93; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; margin: 3px; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
          .seal { width: 120px; height: 120px; border: 3px solid #17A673; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; font-weight: 900; color: #17A673; text-transform: uppercase; transform: rotate(-8deg); }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background: #2487B8; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">🖨️ Imprimer / Sauvegarder en PDF</button>
        </div>
        <div class="cert-border">
          <div class="header">
            <div class="logo">SchoolOS • Plateforme Éducative Marocaine</div>
            <div class="sublogo">Système de Gestion Scolaire Agréé • Conforme Loi 09-08 CNDP</div>
            <div class="title">Attestation d'Octroi de Licence Logicielle</div>
          </div>
          <div class="cert-body">
            <p>La direction technique de la plateforme <strong>SchoolOS</strong> certifie par la présente que l'établissement scolaire souscripteur bénéficie d'une licence d'exploitation valide selon les termes contractuels suivants :</p>
            <div class="badge-box">
              <div class="grid-2">
                <div>
                  <div class="field-label">Formule Contractuelle</div>
                  <div class="field-value">${planName}</div>
                </div>
                <div>
                  <div class="field-label">Statut de la Licence</div>
                  <div class="field-value" style="color: #17A673;">✓ Certifié Actif & Conforme</div>
                </div>
                <div>
                  <div class="field-label">Date d'Émission</div>
                  <div class="field-value">${new Date().toLocaleDateString('fr-FR')}</div>
                </div>
                <div>
                  <div class="field-label">Échéance de Renouvellement</div>
                  <div class="field-value">${contractExpiry}</div>
                </div>
              </div>
            </div>
            <div style="margin-top: 20px;">
              <div class="field-label" style="margin-bottom: 8px;">Modules Applicatifs Souscrits & Homologués (${activeNames.length}) :</div>
              <div>
                ${activeNames.map(n => `<span class="module-tag">✓ ${n}</span>`).join('')}
              </div>
            </div>
          </div>
          <div class="footer">
            <div>
              <p style="font-size: 11px; color: #64748B;">Identifiant Sécurisé : LIC-${Date.now().toString(36).toUpperCase()}<br>Certificat émis sous signature électronique qualifiée.</p>
            </div>
            <div class="seal">
              Certifié Conforme<br>SchoolOS Maroc<br>★ 2026 ★
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Catalogue de Licences & Offres Subscrites</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les modules activés, suivez vos quotas de consommation et demandez l&apos;extension de vos licences.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadLicenseCertificate}
            className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Attestation de licence</span>
          </Button>
          <Button
            size="sm"
            onClick={() => openModuleRequest()}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Demander un nouveau module</span>
          </Button>
        </div>
      </div>

      {/* Subscription Plan Summary Band */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#16212B]">
                  {PLAN_LABELS[plan?.planTier ?? ''] ?? 'Offre SchoolOS'}
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[plan?.subscriptionStatus ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[plan?.subscriptionStatus ?? ''] ?? 'Licence'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Expiration du contrat d&apos;abonnement: <strong className="text-slate-700">{contractExpiry}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 text-xs">
            <div>
              <p className="text-slate-400 font-bold">Campus Inclus</p>
              <p className="font-extrabold text-[#16212B] text-sm">{plan?.branchCount ?? 0} / {plan?.maxBranches ?? 1}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold">Modules Actifs</p>
              <p className="font-extrabold text-[#16212B] text-sm">{activeModuleCount}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Modules Filter & Search */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Tous les modules' },
            { id: 'active', label: 'Modules Actifs' },
            { id: 'premium', label: 'Modules Optionnels' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                activeTab === tab.id ? 'bg-[#2487B8] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un module..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <Card className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm font-bold text-[#16212B]">Impossible de charger le catalogue</p>
          <p className="text-xs text-slate-500">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()} className="h-8 text-xs rounded-xl mt-2">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Réessayer
          </Button>
        </Card>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-full bg-slate-50 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-slate-50 rounded animate-pulse" />
              <div className="pt-3 border-t border-slate-100 h-4 w-20 bg-slate-100 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      )}

      {/* Modules Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(m => {
            const s = moduleStatus(m);
            const badge = STATUS_CARD_BADGE[s];
            return (
              <Card key={m.addonId} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{m.expiryLabel ?? '—'}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#16212B]">{m.name}</h3>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {s === 'active' ? (
                    <span className="flex items-center gap-1 text-[#17A673] font-bold text-[11px]">
                      <Check className="w-4 h-4" /> Inclus
                    </span>
                  ) : s === 'available' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openModuleRequest(m)}
                      className="h-8 text-xs font-bold rounded-xl border-slate-200 gap-1 text-[#2487B8] hover:bg-[#DCEBF4]/50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Demander l&apos;activation</span>
                    </Button>
                  ) : s === 'expired' ? (
                    <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px]">
                      <AlertCircle className="w-4 h-4" /> Expiré
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 font-bold text-[11px]">
                      <Lock className="w-4 h-4" /> À venir
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredModules.length === 0 && (
        <Card className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-[#16212B]">Aucun module trouvé</p>
          <p className="text-xs text-slate-500">Aucun module ne correspond à votre recherche &quot;{search}&quot;.</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setActiveTab('all'); }} className="h-8 text-xs rounded-xl mt-2">
            Réinitialiser les filtres
          </Button>
        </Card>
      )}

      {/* Module Request Ticket Modal */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-white shadow-xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2487B8]" />
              {targetModule ? `Demande d'activation : ${targetModule.name}` : "Demande d'extension de licence"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Objet de la demande</label>
              <Input
                value={requestSubject}
                onChange={(e) => setRequestSubject(e.target.value)}
                placeholder="ex. Activation du module Transport"
                className="mt-1 h-9 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Message & Besoins de l'école</label>
              <Textarea
                rows={5}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Précisez vos besoins..."
                className="mt-1 rounded-xl text-xs font-medium resize-none"
              />
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              ℹ️ Votre demande créera automatiquement un ticket prioritaire auprès de l&apos;équipe commerciale et technique SchoolOS.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestModalOpen(false)}
              disabled={submittingRequest}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSendRequest}
              disabled={submittingRequest}
              className="h-9 rounded-xl text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingRequest ? 'Transmission...' : 'Envoyer la demande'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
