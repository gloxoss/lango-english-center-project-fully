'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Send,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  Bell,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Users,
  ShieldCheck,
  Sparkles,
  Loader2,
  Clock,
  CreditCard,
  MessageCircle,
  Search,
  Check,
  Flame,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  analyzeSmsText,
  sanitizeToGsm7,
  isValidMoroccanMobile,
  formatMoroccanE164,
} from '@/libs/sms/gsm7';

type ApiTemplate = { id: string; name: string; body: string };
type ApiClassSection = { id: string; className: string; sectionName: string };

type Recipient = {
  studentId: string;
  studentName: string;
  className: string;
  phone: string;
  phoneOwner: 'parent' | 'student';
  guardianName: string;
  riskLevel?: string;
};

type Connection = {
  id: string;
  channel: string;
  name: string;
  provider: string;
  status: string;
  lastTestedAt: string | null;
};

type ChannelType = 'whatsapp' | 'sms' | 'simulation';

const QUICK_PRESETS = [
  {
    id: 'absence',
    label: 'Absence injustifiée',
    icon: Flame,
    color: 'rose',
    body: 'Bonjour {nom_parent}, nous vous informons que {nom_eleve} est absent(e) ce jour sans justification préalable. Merci de contacter la vie scolaire au plus vite.',
  },
  {
    id: 'retard',
    label: 'Retard matinal',
    icon: Clock,
    color: 'amber',
    body: 'Bonjour {nom_parent}, votre enfant {nom_eleve} est arrivé(e) en retard au cours ce matin. Merci de veiller au respect des horaires d\'établissement.',
  },
  {
    id: 'paiement',
    label: 'Rappel scolarité',
    icon: CreditCard,
    color: 'emerald',
    body: 'Bonjour {nom_parent}, l\'échéance des frais de scolarité pour {nom_eleve} arrive à terme. Merci de bien vouloir régulariser la situation auprès de la caisse.',
  },
  {
    id: 'convocation',
    label: 'Convocation parent',
    icon: Bell,
    color: 'sky',
    body: 'Bonjour {nom_parent}, vous êtes invité(e) à prendre contact avec l\'administration de l\'école concernant le parcours scolaire de {nom_eleve}.',
  },
];

export function SmsRemindersView({ locale }: { locale?: string } = {}) {
  const t = useTranslations('Communication');
  const tCommon = useTranslations('Common');

  // Channel Selection: WhatsApp vs SMS vs Simulation
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('simulation');

  // Filter modes: 'atRisk' (absences/impayés) vs 'all' (tous les élèves de la classe/école)
  const [filterMode, setFilterMode] = useState<'atRisk' | 'all'>('atRisk');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [audiencePage, setAudiencePage] = useState(1);
  const [audienceTotal, setAudienceTotal] = useState(0);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [audienceRevision, setAudienceRevision] = useState(0);
  const [loadedAudienceKey, setLoadedAudienceKey] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  // Content
  const [customBody, setCustomBody] = useState<string>('');
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testPhone, setTestPhone] = useState<string>('');
  const [testingMsg, setTestingMsg] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active Gateway & Credit status
  const [smsConnection, setSmsConnection] = useState<Connection | null>(null);
  const [whatsappConnection, setWhatsappConnection] = useState<Connection | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balanceStatus, setBalanceStatus] = useState<string | null>(null);
  const [balanceInfo, setBalanceInfo] = useState<{
    sms?: { configured: boolean; id?: string; name: string; provider: string; status: string; mode: string; quotaRemaining?: string; lastTestedAt?: string | null };
    whatsapp?: {
      configured: boolean;
      id?: string;
      name: string;
      provider: string;
      status: string;
      mode?: string;
      dailyLimit?: number;
      usedToday?: number;
      remainingToday?: number;
      antiBanDelayMs?: number;
    } | null;
  } | null>(null);

  const [balanceError, setBalanceError] = useState<string | null>(null);

  const refreshBalance = async () => {
    setBalanceError(null);
    try {
      const res = await fetch('/api/communication/balance');
      const json = await res.json();
      if (json.success && json.data) {
        setBalanceInfo(json.data);
        if (json.data.sms?.configured && json.data.sms.status === 'connected' && json.data.sms.id) {
          setSmsConnection({
            id: json.data.sms.id,
            channel: 'sms',
            name: json.data.sms.name,
            provider: json.data.sms.provider,
            status: json.data.sms.status,
            lastTestedAt: json.data.sms.lastTestedAt ?? null,
          });
        } else {
          setSmsConnection(null);
        }
        if (json.data.whatsapp?.configured && json.data.whatsapp.status === 'connected' && json.data.whatsapp.id) {
          setWhatsappConnection({
            id: json.data.whatsapp.id,
            channel: 'whatsapp',
            name: json.data.whatsapp.name,
            provider: json.data.whatsapp.provider,
            status: json.data.whatsapp.status,
            lastTestedAt: null,
          });
        } else {
          setWhatsappConnection(null);
        }
      } else {
        setBalanceError(json?.error?.message || 'Impossible de charger le solde et les connexions.');
      }
    } catch {
      setBalanceError('Erreur réseau : impossible de charger le solde et les connexions.');
    }
  };

  // Load class sections & Gateway connections
  useEffect(() => {
    void (async () => {
      try {
        const all: ApiClassSection[] = [];
        for (let page = 1; ; page++) {
          const res = await fetch(`/api/academics/class-sections?page=${page}&pageSize=100`);
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error?.message || 'Impossible de charger les classes.');
          all.push(...json.data);
          if (all.length >= json.total) break;
        }
        setClassSections(all);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossible de charger les classes.');
      }
    })();

    refreshBalance();
  }, []);

  useEffect(() => {
    fetch('/api/communication/templates')
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) setTemplates(json.data);
      })
      .catch(() => setError('Impossible de charger les modèles de message.'));
  }, []);

  const audienceKey = `${filterMode}:${selectedClassSectionId}:${audiencePage}:${audienceRevision}`;
  const audienceReady = loadedAudienceKey === audienceKey && !audienceLoading && !audienceError;

  // The server owns the risk rules, consent, branch scope and complete page count.
  useEffect(() => {
    let cancelled = false;
    setAudienceLoading(true);
    setAudienceError(null);
    const params = new URLSearchParams({ mode: filterMode, page: String(audiencePage), pageSize: '100' });
    if (selectedClassSectionId) params.set('classSectionId', selectedClassSectionId);
    fetch(`/api/communication/reminder-audience?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          throw new Error(json.error?.message || 'Impossible de charger les destinataires.');
        }
        if (cancelled) return;
        setRecipients(json.data);
        setAudienceTotal(json.total);
        setEligibleCount(json.eligibleCount);
        setSelectedIds(new Set());
        setLoadedAudienceKey(audienceKey);
      })
      .catch((err) => {
        if (!cancelled) {
          setRecipients([]);
          setSelectedIds(new Set());
          setAudienceError(err instanceof Error ? err.message : 'Impossible de charger les destinataires.');
        }
      })
      .finally(() => { if (!cancelled) setAudienceLoading(false); });
    return () => { cancelled = true; };
  }, [audienceKey, filterMode, selectedClassSectionId, audiencePage]);

  // Filtered recipients by search term
  const displayedRecipients = useMemo(() => {
    if (!audienceReady) return [];
    if (!searchQuery.trim()) return recipients;
    const q = searchQuery.toLowerCase();
    return recipients.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.guardianName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.className.toLowerCase().includes(q)
    );
  }, [recipients, searchQuery, audienceReady]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function checkLiveBalance() {
    if (!smsConnection) return;
    setCheckingBalance(true);
    setBalanceStatus(null);
    try {
      const res = await fetch(`/api/addons/broadcast/connections/${smsConnection.id}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.data?.message) {
        setBalanceStatus(data.data.message);
      } else {
        setBalanceStatus(data.error?.message || 'Passerelle joignable.');
      }
    } catch {
      setBalanceStatus('Erreur de vérification du solde.');
    } finally {
      setCheckingBalance(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (selectedTemplate) {
      setCustomBody(selectedTemplate.body);
    }
  }, [selectedTemplateId, selectedTemplate]);

  const activeBody = customBody || (selectedTemplate?.body ?? '');
  const smsAnalysis = analyzeSmsText(activeBody);

  async function handleSendTest() {
    if (selectedChannel === 'simulation') {
      setTestResult({ success: true, message: 'Aperçu préparé localement. Aucun message envoyé ni enregistré.' });
      return;
    }
    if ((selectedChannel === 'sms' && !smsConnection) || (selectedChannel === 'whatsapp' && !whatsappConnection)) {
      setTestResult({ success: false, message: 'Aucune passerelle connectée pour ce canal.' });
      return;
    }
    if (!testPhone.trim() || !isValidMoroccanMobile(testPhone)) {
      setTestResult({
        success: false,
        message: 'Veuillez saisir un numéro mobile marocain valide (ex: 0612345678 ou +2126XXXXXXXX).',
      });
      return;
    }
    setTestingMsg(true);
    setTestResult(null);
    try {
      const formatted = formatMoroccanE164(testPhone);
      const testMsg = (activeBody || 'Test Rappels SchoolOS')
        .replace(/\{nom_parent\}/g, 'Parent Test')
        .replace(/\{nom_eleve\}/g, 'Élève Test')
        .replace(/\{ecole\}/g, 'École Atlas');

      const res = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: formatted,
          body: testMsg,
          channel: selectedChannel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && ['sent', 'delivered'].includes(data.data?.delivery)) {
        await refreshBalance();
        setTestResult({
          success: true,
          message: `${selectedChannel === 'whatsapp' ? 'Message WhatsApp' : 'SMS'} transmis vers ${formatted}.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || data.error?.message || "Le message n'a pas été transmis.",
        });
      }
    } catch {
      setTestResult({ success: false, message: "Erreur de connexion à l'API d'envoi." });
    } finally {
      setTestingMsg(false);
    }
  }

  async function handleSend() {
    if (!audienceReady) {
      setError('Actualisez les destinataires avant de préparer un envoi.');
      return;
    }
    if ((selectedChannel === 'sms' && !smsConnection) || (selectedChannel === 'whatsapp' && !whatsappConnection)) {
      setError('Aucune passerelle connectée pour ce canal. Utilisez la simulation ou configurez une passerelle.');
      return;
    }
    if (!activeBody.trim()) {
      setError('Veuillez sélectionner un modèle ou saisir le texte du message.');
      return;
    }
    const targets = recipients.filter((r) => selectedIds.has(r.studentId));
    if (targets.length === 0) {
      setError(t('selectAtLeastOne'));
      return;
    }

    if (selectedChannel === 'simulation') {
      setError(null);
      setSuccess(`Aperçu de ${targets.length} rappel(s) préparé localement. Aucun message envoyé ni enregistré.`);
      return;
    }

    // Protection Anti-Ban Meta : vérification préventive du quota restant
    if (selectedChannel === 'whatsapp') {
      const remaining = balanceInfo?.whatsapp?.remainingToday ?? 0;
      if (targets.length > remaining) {
        setError(
          `Protection Anti-Ban Meta : Quota quotidien insuffisant (${targets.length} élèves sélectionnés mais seulement ${remaining} message(s) restant(s) aujourd'hui). Réduisez la sélection ou basculez sur le canal SMS Direct.`
        );
        return;
      }
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    setSentCount(0);
    let sent = 0;

    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      if (!r) continue;

      // Pacing anti-spam : espacement de sécurité (1.2s) pour simuler un comportement humain
      if (selectedChannel === 'whatsapp' && i > 0) {
        const delay = balanceInfo?.whatsapp?.antiBanDelayMs || 1200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const body = activeBody
        .replace(/\{nom_parent\}/g, r.guardianName)
        .replace(/\{nom_eleve\}/g, r.studentName)
        .replace(/\{classe\}/g, r.className)
        .replace(/\{ecole\}/g, '');
      try {
        const res = await fetch('/api/communication/reminder-audience', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientPhone: r.phone,
            studentId: r.studentId,
            body,
            channel: selectedChannel,
          }),
        });
        const json = await res.json();
        if (res.ok && json.success && ['sent', 'delivered'].includes(json.data?.delivery)) {
          sent += 1;
          setSentCount(sent);
        } else if (res.status === 429) {
          setError(
            json.error?.message ||
              'Quota quotidien WhatsApp atteint. Envois suspendus automatiquement pour protéger le numéro contre le bannissement Meta.'
          );
          break;
        } else if (res.status === 409) {
          setError(json.error?.message || 'Le droit de contact a changé. Actualisez les destinataires.');
        } else if (res.ok && json.success) {
          setError('Certains messages ont été simulés ou ont échoué. Vérifiez la passerelle et le journal avant de continuer.');
        } else {
          setError(json.error?.message || "Le rappel n'a pas été transmis.");
        }
      } catch (err) {
        console.error('Reminder send failed', err);
      }
    }

    await refreshBalance();

    if (sent > 0) {
      setSuccess(
        `${sent} rappel(s) transmis sur ${targets.length} via ${selectedChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.`
      );
    }
    setSending(false);
  }

  const selectedCount = audienceReady ? selectedIds.size : 0;
  const estimatedCostInCredits = selectedChannel === 'sms' ? selectedCount * smsAnalysis.segments : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Top Header & Connectors Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {t('remindersTitle')}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Diffusion ciblée des alertes d&apos;absences, retards, impayés et convocations
            </p>
          </div>
        </div>

        {/* Live Active Gateways Overview Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* SMS Badge */}
          {smsConnection ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SMS : {smsConnection.name}</span>
              <button
                type="button"
                onClick={checkLiveBalance}
                disabled={checkingBalance}
                className="ms-1 text-[11px] text-emerald-700 hover:text-emerald-900 underline font-bold cursor-pointer"
              >
                {checkingBalance ? '...' : 'Solde'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>SMS : aucune passerelle active vérifiée</span>
            </div>
          )}

          {/* Balance / connection load failure — visible with retry (audit 2026-09-22 P2) */}
          {balanceError && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{balanceError}</span>
              <button
                type="button"
                onClick={() => void refreshBalance()}
                className="shrink-0 px-2 py-0.5 rounded-lg bg-white border border-amber-300 font-bold hover:bg-amber-50 transition-colors cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* WhatsApp Badge */}
          {whatsappConnection ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp : Connecté</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                {balanceInfo?.whatsapp?.remainingToday !== undefined
                  ? `🛡️ ${balanceInfo.whatsapp.remainingToday}/${balanceInfo.whatsapp.dailyLimit} auj.`
                  : 'Anti-Ban Actif'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <MessageCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>WhatsApp : aucune passerelle active vérifiée</span>
            </div>
          )}

          {/* Manage Connectors Link */}
          <Link href="/dashboard/broadcast/connections">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 text-slate-700 shadow-2xs cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#2487B8]" />
              <span>Gérer les Passerelles</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Live balance feedback banner */}
      {balanceStatus && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-blue-900 text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{balanceStatus}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBalanceStatus(null)}
            className="h-6 text-[11px] text-blue-700 hover:bg-blue-100"
          >
            Fermer
          </Button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recipients Directory & Filter (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {/* Filter Tabs & Class Selector */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Segments: At Risk vs All Students */}
                <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl text-xs font-bold gap-1">
                  <button
                    type="button"
                    onClick={() => { setFilterMode('atRisk'); setAudiencePage(1); }}
                    className={`px-3.5 py-2 rounded-xl transition-all flex flex-col items-start gap-0.5 cursor-pointer ${
                      filterMode === 'atRisk'
                        ? 'bg-white text-[#0F172A] shadow-xs ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Élèves à risque{filterMode === 'atRisk' && audienceReady ? ` (${eligibleCount})` : ''}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Absences répétées ou impayés</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterMode('all'); setAudiencePage(1); }}
                    className={`px-3.5 py-2 rounded-xl transition-all flex flex-col items-start gap-0.5 cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-white text-[#0F172A] shadow-xs ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Users className="w-3.5 h-3.5 text-[#2487B8]" />
                      <span>Tous les élèves{filterMode === 'all' && audienceReady ? ` (${eligibleCount})` : ''}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Annonces générales & réunions</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={selectedClassSectionId || 'all'}
                    onValueChange={(v) => { setSelectedClassSectionId(v === 'all' ? '' : v); setAudiencePage(1); }}
                  >
                    <SelectTrigger className="w-44 h-9 text-xs rounded-xl border-slate-200 font-semibold">
                      <SelectValue placeholder={t('allClasses')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allClasses')}</SelectItem>
                      {classSections.map((cs) => (
                        <SelectItem key={cs.id} value={cs.id}>
                          {cs.className} {cs.sectionName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search & Select All Bar */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par nom ou tél..."
                    className="h-8 pl-8 text-xs rounded-lg border-slate-200"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    <strong className="text-[#0F172A]">{audienceReady ? audienceTotal : '—'}</strong> destinataire(s) joignables
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#2487B8] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={!audienceReady}
                      checked={displayedRecipients.length > 0 && displayedRecipients.every((r) => selectedIds.has(r.studentId))}
                      onChange={() =>
                        setSelectedIds(
                          displayedRecipients.every((r) => selectedIds.has(r.studentId))
                            ? new Set([...selectedIds].filter((id) => !displayedRecipients.some((r) => r.studentId === id)))
                            : new Set([...selectedIds, ...displayedRecipients.map((r) => r.studentId)])
                        )
                      }
                      className="w-4 h-4 accent-[#2487B8] rounded cursor-pointer"
                    />
                    <span>{t('selectAll')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Directory Table or High-Standard Empty State */}
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F8FAFC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center"></th>
                    <th className="py-3 px-4 text-start">{t('colStudent')}</th>
                    <th className="py-3 px-4 text-start">{t('colGuardian')}</th>
                    <th className="py-3 px-4 text-start">{t('colPhone')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        {audienceLoading || !audienceReady && !audienceError ? (
                          <div className="py-10 px-4 text-center text-slate-500 font-medium">Chargement des destinataires…</div>
                        ) : audienceError ? (
                          <div className="py-10 px-4 text-center text-rose-700 font-medium">
                            <p>{audienceError}</p>
                            <Button type="button" variant="outline" className="mt-3" onClick={() => setAudienceRevision((v) => v + 1)}>Réessayer</Button>
                          </div>
                        ) : searchQuery.trim() ? (
                          <div className="py-10 px-4 text-center text-slate-500 font-medium">Aucun destinataire ne correspond à cette recherche sur la page {audiencePage}.</div>
                        ) : filterMode === 'atRisk' && eligibleCount === 0 ? (
                          <div className="py-12 px-6 flex flex-col items-center text-center space-y-3 bg-gradient-to-b from-emerald-50/20 to-white">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-extrabold text-[#0F172A]">
                              Aucun risque détecté dans cette sélection
                            </h4>
                            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                              Aucun élève actif ne présente au moins deux jours d&apos;absence non justifiée sur 30 jours ou une facture échue impayée.
                            </p>
                            <Button
                              type="button"
                              onClick={() => { setFilterMode('all'); setAudiencePage(1); }}
                              className="mt-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl h-9 px-4 cursor-pointer shadow-2xs"
                            >
                              <Users className="w-3.5 h-3.5 mr-2" />
                              Basculer sur « Tous les élèves »
                            </Button>
                          </div>
                        ) : (
                          <div className="py-10 px-4 text-center text-slate-400 font-medium">
                            {eligibleCount > 0 ? `${eligibleCount} élève(s) concerné(s), mais aucun parent joignable avec consentement SMS actif.` : 'Aucun élève actif dans cette sélection.'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    displayedRecipients.map((r) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.studentId)}
                            onChange={() => toggle(r.studentId)}
                            className="w-4 h-4 accent-[#2487B8] rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-start">
                          <div className="flex items-center gap-2">
                            <p className="font-extrabold text-[#0F172A]">{r.studentName}</p>
                            {r.riskLevel && (
                              <Badge
                                variant={r.riskLevel.includes('élevé') ? 'danger' : 'warning'}
                                className="text-[9px] font-bold px-1.5 py-0"
                              >
                                {r.riskLevel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-semibold">{r.className}</p>
                        </td>
                        <td className="py-3 px-4 text-start text-slate-700 font-medium">
                          {r.guardianName}
                        </td>
                        <td className="py-3 px-4 text-start">
                          <div className="flex items-center gap-2 font-mono font-bold text-slate-700">
                            <span>{r.phone}</span>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                r.phoneOwner === 'parent'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {r.phoneOwner === 'parent' ? 'Parent' : 'Élève'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {audienceReady && audienceTotal > 100 && (
              <div className="flex items-center justify-between gap-3 p-3 border-t border-slate-100 text-xs text-slate-600">
                <span>Page {audiencePage} sur {Math.ceil(audienceTotal / 100)}. La sélection concerne cette page uniquement.</span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={audiencePage <= 1} onClick={() => setAudiencePage((p) => p - 1)}>Précédent</Button>
                  <Button type="button" size="sm" variant="outline" disabled={audiencePage >= Math.ceil(audienceTotal / 100)} onClick={() => setAudiencePage((p) => p + 1)}>Suivant</Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Dispatch Hub & Channel Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
            {/* Step 1: Channel Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  1. Canal de transmission
                </Label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {selectedChannel === 'whatsapp'
                    ? 'Inclus • Quota sécurisé Anti-Ban Meta'
                    : selectedChannel === 'sms'
                    ? 'Opérateur SMS direct'
                    : 'Mode simulation'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* WhatsApp Option */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('whatsapp')}
                  className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'whatsapp'
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-400'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <MessageCircle className={`w-4 h-4 ${selectedChannel === 'whatsapp' ? 'text-emerald-600' : 'text-slate-500'}`} />
                    {selectedChannel === 'whatsapp' && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-extrabold text-[#0F172A]">WhatsApp</p>
                    <p className="text-[10px] text-emerald-700 font-bold">
                      {balanceInfo?.whatsapp?.remainingToday !== undefined
                        ? `Inclus (${balanceInfo.whatsapp.remainingToday}/${balanceInfo.whatsapp.dailyLimit} auj.)`
                        : 'Inclus (Quota sécurisé)'}
                    </p>
                    <span className="inline-block mt-0.5 text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded">
                      🛡️ Anti-Ban Meta
                    </span>
                  </div>
                </button>

                {/* SMS Direct Option */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('sms')}
                  className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'sms'
                      ? 'border-[#2487B8] bg-blue-50/50 shadow-xs ring-1 ring-[#2487B8]'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Smartphone className={`w-4 h-4 ${selectedChannel === 'sms' ? 'text-[#2487B8]' : 'text-slate-500'}`} />
                    {selectedChannel === 'sms' && <Check className="w-3.5 h-3.5 text-[#2487B8] font-bold" />}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-extrabold text-[#0F172A]">SMS Direct</p>
                    <p className="text-[10px] text-slate-500 font-medium">{smsConnection?.name ?? 'Passerelle non configurée'}</p>
                  </div>
                </button>

                {/* Simulation Option */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('simulation')}
                  className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'simulation'
                      ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-1 ring-amber-400'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ShieldCheck className={`w-4 h-4 ${selectedChannel === 'simulation' ? 'text-amber-600' : 'text-slate-500'}`} />
                    {selectedChannel === 'simulation' && <Check className="w-3.5 h-3.5 text-amber-600 font-bold" />}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-extrabold text-[#0F172A]">Simulation</p>
                    <p className="text-[10px] text-amber-700 font-medium">Aucun envoi</p>
                  </div>
                </button>
              </div>

              {/* WhatsApp Anti-Spam Safety Banner */}
              {selectedChannel === 'whatsapp' && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Protection Anti-Spam & Anti-Ban Meta
                    </span>
                    <Badge variant="success" className="font-extrabold text-[10px]">
                      {balanceInfo?.whatsapp?.remainingToday ?? 0} / {balanceInfo?.whatsapp?.dailyLimit ?? 50} restants auj.
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Pour préserver le compte WhatsApp de l&apos;école contre tout blocage par Meta (WhatsApp), les diffusions massives abusives sont strictement bridées. Les envois sont cadencés (1,2s de délai de sécurité) et limités à un quota quotidien sécurisé.
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Quick Presets & Templates */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                2. Modèles rapides en 1 clic
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PRESETS.map((qp) => {
                  const Icon = qp.icon;
                  return (
                    <button
                      key={qp.id}
                      type="button"
                      onClick={() => setCustomBody(qp.body)}
                      className="p-2 text-start rounded-xl border border-slate-200 hover:border-[#2487B8] hover:bg-blue-50/30 transition-all text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="font-bold text-[#0F172A] truncate">{qp.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Template dropdown selector */}
              {templates.length > 0 && (
                <div className="pt-2">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="w-full h-9 text-xs rounded-xl border-slate-200 font-medium">
                      <SelectValue placeholder="Ou charger un modèle d'établissement..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tItem) => (
                        <SelectItem key={tItem.id} value={tItem.id}>
                          {tItem.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Step 3: Message Body Editor */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  3. Texte du message
                </Label>
                {customBody && (
                  <button
                    type="button"
                    onClick={() => setCustomBody('')}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </div>

              <textarea
                rows={4}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="w-full p-3 bg-slate-50/70 rounded-xl border border-slate-200 text-xs text-[#0F172A] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 focus:border-[#2487B8]"
                placeholder="Rédigez votre message... Variables disponibles : {nom_parent}, {nom_eleve}, {classe}"
              />

              {/* Channel-Aware Live Analysis */}
              {selectedChannel === 'sms' ? (
                smsAnalysis.encoding === 'gsm7' ? (
                  <div className="flex items-center justify-between text-[11px] p-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      GSM-7 Standard ({smsAnalysis.charCount} car. = {smsAnalysis.segments} SMS)
                    </span>
                    <span className="font-mono text-emerald-700 font-bold">
                      Reste : {smsAnalysis.remainingInSegment} car.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 p-2.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 text-[11px]">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Format UCS-2 ({smsAnalysis.charCount} car. = {smsAnalysis.segments} SMS)
                      </span>
                      <span className="text-amber-800 text-[10px] bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                        Caractères non standard
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCustomBody(sanitizeToGsm7(customBody))}
                      className="w-full h-7 text-[10px] font-bold border-amber-300 text-amber-900 bg-white hover:bg-amber-100 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" /> Convertir en GSM-7 économique
                    </Button>
                  </div>
                )
              ) : selectedChannel === 'whatsapp' ? (
                <div className="flex items-center justify-between text-[11px] p-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    WhatsApp Direct : Texte libre illimité & gratuit
                  </span>
                  <span className="text-[10px] text-emerald-600 font-mono">*gras* _italique_</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                    Simulation locale : aucun message envoyé ou enregistré
                  </span>
                </div>
              )}
            </div>

            {/* Step 4: Summary & Dispatch Action */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="bg-slate-50/80 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Destinataires sélectionnés :</span>
                  <strong className="text-[#0F172A] font-extrabold">{selectedCount}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Canal d&apos;envoi :</span>
                  <strong className="text-[#0F172A] font-extrabold uppercase">
                    {selectedChannel === 'whatsapp' ? 'WhatsApp (WAHA)' : selectedChannel === 'sms' ? 'SMS Direct' : 'Simulation interne'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600 border-t border-slate-200/60 pt-1.5">
                  <span>Coût estimé :</span>
                  <strong
                    className={
                      selectedChannel === 'whatsapp' || selectedChannel === 'simulation'
                        ? 'text-emerald-700 font-extrabold'
                        : 'text-[#2487B8] font-extrabold'
                    }
                  >
                    {selectedChannel === 'whatsapp'
                      ? `Inclus (${balanceInfo?.whatsapp?.remainingToday ?? '—'} restants auj.)`
                      : selectedChannel === 'simulation'
                      ? '0 DH (aperçu local)'
                      : `${estimatedCostInCredits} crédit(s) SMS`}
                  </strong>
                </div>
              </div>

              {/* WhatsApp Over-Quota Safety Barrier */}
              {selectedChannel === 'whatsapp' &&
                balanceInfo?.whatsapp &&
                selectedCount > (balanceInfo.whatsapp.remainingToday ?? 0) && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Quota quotidien WhatsApp dépassé</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Vous avez sélectionné <strong>{selectedCount}</strong> destinataire(s), mais votre quota de sécurité restant est de <strong>{balanceInfo.whatsapp.remainingToday}</strong> message(s) aujourd&apos;hui.
                      L&apos;envoi est bloqué pour protéger votre ligne contre un bannissement Meta pour spam. Réduisez la sélection ou basculez sur <strong>SMS Direct</strong>.
                    </p>
                  </div>
                )}

              {sending && (
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>Progression de l&apos;envoi :</span>
                  <span className="font-extrabold text-[#0F172A]">
                    {sentCount} / {selectedCount}
                  </span>
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={
                  sending ||
                  !audienceReady ||
                  (selectedChannel === 'sms' && !smsConnection) ||
                  (selectedChannel === 'whatsapp' && !whatsappConnection) ||
                  !activeBody.trim() ||
                  selectedCount === 0 ||
                  (selectedChannel === 'whatsapp' &&
                    Boolean(balanceInfo?.whatsapp && selectedCount > (balanceInfo.whatsapp.remainingToday ?? 0)))
                }
                className={`w-full h-11 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer ${
                  selectedChannel === 'whatsapp'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#2487B8] hover:bg-[#1B6C93]'
                }`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {selectedChannel === 'whatsapp'
                        ? `Envoyer ${selectedCount} rappel(s) via WhatsApp`
                        : selectedChannel === 'sms'
                        ? `Envoyer ${selectedCount} SMS (${estimatedCostInCredits} crédits)`
                        : `Simuler l'envoi (${selectedCount} rappels)`}
                    </span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTestModal(true);
                  setTestResult(null);
                }}
                className="w-full h-9 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 rounded-xl cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#2487B8]" />
                <span>Tester l&apos;envoi sur mon numéro mobile personnel</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Interactive Mobile Test Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
              {selectedChannel === 'whatsapp' ? (
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <Smartphone className="w-5 h-5 text-[#2487B8]" />
              )}
              Tester l&apos;envoi ({selectedChannel.toUpperCase()})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Canal actif : {selectedChannel === 'whatsapp' ? 'WhatsApp WAHA' : selectedChannel === 'sms' ? (smsConnection?.name ?? 'Simulation') : 'Mode Simulation'}
              </p>
              <p className="text-[11px] mt-0.5">
                Vérifiez la bonne réception du formatage et du texte sur votre smartphone.
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Numéro de mobile (Format Marocain)</Label>
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="06XXXXXXXX ou +2126XXXXXXXX"
                className="mt-1 text-xs font-mono rounded-xl h-10"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Exemple : 0612345678 (Maroc Telecom, Orange, Inwi)
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Aperçu du texte</Label>
              <div className="mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-[#0F172A] whitespace-pre-wrap max-h-28 overflow-y-auto font-sans">
                {(activeBody || 'Test Rappels SchoolOS')
                  .replace(/\{nom_parent\}/g, 'Parent Test')
                  .replace(/\{nom_eleve\}/g, 'Élève Test')
                  .replace(/\{classe\}/g, '3ème Année Collège')}
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              onClick={handleSendTest}
              disabled={testingMsg || !testPhone.trim()}
              className={`text-white text-xs font-bold h-9 rounded-xl cursor-pointer ${
                selectedChannel === 'whatsapp'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-[#2487B8] hover:bg-[#1B6C93]'
              }`}
            >
              {testingMsg ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 me-1.5" /> Envoyer le test
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTestModal(false)}
              className="text-xs h-9 rounded-xl cursor-pointer"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
