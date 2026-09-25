'use client';

import {
  AlertCircle,
  Check,
  Download,
  Lock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

const PLAN_TIERS = ['trial', 'basic', 'standard', 'premium'] as const;
const SUB_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'cancelled', 'suspended'] as const;

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-[#DDF5EC] text-[#17A673]',
  trialing: 'bg-blue-50 text-[#1B6C93]',
  past_due: 'bg-amber-50 text-amber-700',
  unpaid: 'bg-amber-50 text-amber-700',
  suspended: 'bg-amber-50 text-amber-700',
  canceled: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

type ModuleStatus = 'active' | 'expired' | 'available' | 'upcoming';

function moduleStatus(m: AddonModule): ModuleStatus {
  if (m.active) {
    return 'active';
  }
  if (m.expiresAt) {
    return 'expired';
  }
  if (m.built) {
    return 'available';
  }
  return 'upcoming';
}

const STATUS_CARD_CLS: Record<ModuleStatus, string> = {
  active: 'bg-[#DDF5EC] text-[#17A673]',
  expired: 'bg-rose-50 text-rose-500',
  available: 'bg-blue-50 text-[#1B6C93]',
  upcoming: 'bg-slate-100 text-slate-500',
};

// Addon names come from the catalog table; escape them before writing the print window.
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!);

export function EntitlementsCatalogView(_props: { locale?: string } = {}) {
  const t = useTranslations('EntitlementsCatalog');
  const locale = useLocale();
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const fmtDate = (d: string | number | Date) => new Date(d).toLocaleDateString(intlLocale);

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
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || t('loadError'));
      }
      setModules(json.data ?? []);
      setPlan(json.plan ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const planLabel = (tier?: string) =>
    tier && (PLAN_TIERS as readonly string[]).includes(tier) ? t(`plans.${tier as (typeof PLAN_TIERS)[number]}`) : t('plans.unknown');
  const statusLabel = (s?: string) =>
    s && (SUB_STATUSES as readonly string[]).includes(s) ? t(`subStatus.${s as (typeof SUB_STATUSES)[number]}`) : t('subStatus.unknown');

  const filteredModules = modules.filter((m) => {
    const s = moduleStatus(m);
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all'
      || (activeTab === 'active' && s === 'active')
      || (activeTab === 'premium' && s !== 'active');
    return matchesSearch && matchesTab;
  });

  const activeModuleCount = modules.filter(m => m.active).length;
  // The tenant has no contract end date; the nearest module expiry is the only real date we have.
  const earliestExpiry = modules
    .filter(m => m.active && m.expiresAt)
    .map(m => new Date(m.expiresAt as string).getTime())
    .sort((a, b) => a - b)[0];
  const nextExpiry = earliestExpiry ? fmtDate(earliestExpiry) : '—';

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [targetModule, setTargetModule] = useState<{ addonId?: string; name: string } | null>(null);
  const [requestSubject, setRequestSubject] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const openModuleRequest = (mod?: { addonId: string; name: string }) => {
    if (mod) {
      setTargetModule(mod);
      setRequestSubject(t('requestModuleSubject', { name: mod.name }));
      setRequestMessage(t('requestModuleMessage', { name: mod.name }));
    } else {
      setTargetModule(null);
      setRequestSubject(t('requestExtensionSubject'));
      setRequestMessage(t('requestExtensionMessage'));
    }
    setRequestModalOpen(true);
  };

  const handleSendRequest = async () => {
    if (!requestSubject.trim() || !requestMessage.trim()) {
      toast.error(t('requestMissing'));
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
        toast.success(t('requestSent'));
        setRequestModalOpen(false);
      } else {
        toast.error(json.error?.message || t('requestError'));
      }
    } catch {
      toast.error(t('requestNetworkError'));
    } finally {
      setSubmittingRequest(false);
    }
  };

  // A plain summary of what the database says. It used to call itself a certified
  // licence with a qualified e-signature, a seal and a made-up ID, and printed
  // "certified active" even for a suspended school.
  const handlePrintSummary = () => {
    const activeNames = modules.filter(m => m.active).map(m => m.name);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('popupBlocked'));
      return;
    }
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="UTF-8" />
<title>${esc(t('summary.docTitle'))}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #16212B; margin: 0; background: #fff; }
  .box { border: 1px solid #E2E8F0; padding: 28px; border-radius: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { font-size: 12px; color: #64748B; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 20px 0; }
  .label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748B; }
  .value { font-size: 14px; font-weight: 700; }
  .tag { display: inline-block; background: #DCEBF4; color: #1B6C93; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; margin: 3px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: end;">
    <button onclick="window.print()" onClick="window.print()" style="background: #2487B8; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">${esc(t('summary.print'))}</button>
  </div>
  <div class="box">
    <h1>${esc(t('summary.docTitle'))}</h1>
    <div class="muted">${esc(t('summary.generatedOn', { date: fmtDate(new Date()) }))}</div>
    <div class="grid">
      <div><div class="label">${esc(t('summary.plan'))}</div><div class="value">${esc(planLabel(plan?.planTier))}</div></div>
      <div><div class="label">${esc(t('summary.status'))}</div><div class="value">${esc(statusLabel(plan?.subscriptionStatus))}</div></div>
      <div><div class="label">${esc(t('summary.campuses'))}</div><div class="value">${plan?.branchCount ?? 0} / ${plan?.maxBranches ?? 1}</div></div>
      <div><div class="label">${esc(t('nextExpiry'))}</div><div class="value">${esc(nextExpiry)}</div></div>
    </div>
    <div class="label" style="margin-bottom: 8px;">${esc(t('summary.modules', { count: activeNames.length }))}</div>
    <div>${activeNames.map(n => `<span class="tag">${esc(n)}</span>`).join('')}</div>
    <p class="muted" style="margin-top: 28px;">${esc(t('summary.disclaimer'))}</p>
  </div>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const tabs = [
    { id: 'all', label: t('tabs.all') },
    { id: 'active', label: t('tabs.active') },
    { id: 'premium', label: t('tabs.optional') },
  ] as const;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSummary}
            disabled={loading || !!error}
            className="
              h-10 cursor-pointer gap-2 rounded-xl border-slate-200 px-4 text-xs
              font-bold
              hover:bg-slate-50
            "
          >
            <Download className="size-4 text-slate-600" />
            <span>{t('printSummary')}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => openModuleRequest()}
            className="
              h-10 cursor-pointer gap-2 rounded-xl bg-[#2487B8] px-4 text-xs
              font-bold text-white shadow-2xs
              hover:bg-[#1B6C93]
            "
          >
            <Sparkles className="size-4" />
            <span>{t('requestNewModule')}</span>
          </Button>
        </div>
      </div>

      {/* Subscription Plan Summary Band */}
      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
      "
      >
        <div className="
          flex flex-col justify-between gap-4
          md:flex-row md:items-center
        "
        >
          <div className="flex items-center gap-4">
            <div className="
              flex size-12 items-center justify-center rounded-2xl bg-[#DCEBF4]
              text-xl font-extrabold text-[#1B6C93]
            "
            >
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#16212B]">
                  {planLabel(plan?.planTier)}
                </h2>
                <span className={`
                  rounded-full px-2.5 py-0.5 text-[10px] font-bold
                  ${STATUS_BADGE[plan?.subscriptionStatus ?? ''] ?? `
                    bg-slate-100 text-slate-600
                  `}
                `}
                >
                  {statusLabel(plan?.subscriptionStatus)}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t('nextExpiry')}
                :
                <strong className="text-slate-700">{nextExpiry}</strong>
              </p>
            </div>
          </div>
          <div className="
            flex items-center gap-4 border-t border-slate-100 pt-3 text-xs
            md:border-t-0 md:border-l md:pt-0 md:pl-6
          "
          >
            <div>
              <p className="font-bold text-slate-400">{t('campusesIncluded')}</p>
              {/* Over quota used to look like a normal count (audit S-26). */}
              <p className={`
                text-sm font-extrabold
                ${(plan?.branchCount ?? 0) > (plan?.maxBranches ?? 1)
      ? `text-rose-600`
      : `text-[#16212B]`}
              `}
              >
                {plan?.branchCount ?? 0}
                {' '}
                /
                {' '}
                {plan?.maxBranches ?? 1}
              </p>
              {(plan?.branchCount ?? 0) > (plan?.maxBranches ?? 1) && (
                <p className="mt-0.5 text-[10px] font-semibold text-rose-600">{t('overQuota')}</p>
              )}
            </div>
            <div>
              <p className="font-bold text-slate-400">{t('activeModules')}</p>
              <p className="text-sm font-extrabold text-[#16212B]">{activeModuleCount}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Modules Filter & Search */}
      <div className="
        flex flex-col items-center justify-between gap-3 rounded-2xl border
        border-slate-200/80 bg-white p-3 shadow-2xs
        sm:flex-row
      "
      >
        <div className="flex items-center gap-2" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition
                ${
            activeTab === tab.id
              ? 'bg-[#2487B8] text-white'
              : `
                bg-slate-50 text-slate-600
                hover:bg-slate-100
              `
            }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="
          relative w-full
          sm:w-64
        "
        >
          <Search className="
            absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-xl border-none bg-slate-50 pl-9 text-xs"
          />
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <Card className="
          space-y-3 rounded-2xl border border-slate-200/80 bg-white p-8
          text-center
        "
        >
          <AlertCircle className="mx-auto size-8 text-rose-400" />
          <p className="text-sm font-bold text-[#16212B]">{t('loadErrorTitle')}</p>
          <p className="text-xs text-slate-500">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            className="mt-2 h-8 rounded-xl text-xs"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            {t('retry')}
          </Button>
        </Card>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="
          grid grid-cols-1 gap-4
          md:grid-cols-2
          lg:grid-cols-3
        "
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="
                space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
                shadow-2xs
              "
            >
              <div className="h-4 w-24 animate-pulse rounded-sm bg-slate-100" />
              <div className="h-4 w-3/4 animate-pulse rounded-sm bg-slate-100" />
              <div className="h-3 w-full animate-pulse rounded-sm bg-slate-50" />
              <div className="h-3 w-2/3 animate-pulse rounded-sm bg-slate-50" />
              <div className="
                h-4 w-20 animate-pulse rounded-sm border-t border-slate-100
                bg-slate-100 pt-3
              "
              />
            </Card>
          ))}
        </div>
      )}

      {/* Modules Grid */}
      {!loading && !error && (
        <div className="
          grid grid-cols-1 gap-4
          md:grid-cols-2
          lg:grid-cols-3
        "
        >
          {filteredModules.map((m) => {
            const s = moduleStatus(m);
            return (
              <Card
                key={m.addonId}
                className="
                  flex flex-col justify-between space-y-3 rounded-2xl border
                  border-slate-200/80 bg-white p-5 shadow-2xs
                "
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`
                      rounded-full px-2 py-0.5 text-[10px] font-bold
                      ${STATUS_CARD_CLS[s]}
                    `}
                    >
                      {t(`moduleStatus.${s}`)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{m.active && m.expiresAt ? fmtDate(m.expiresAt) : '—'}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#16212B]">{m.name}</h3>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>

                <div className="
                  flex items-center justify-between border-t border-slate-100
                  pt-3 text-xs
                "
                >
                  {s === 'active'
                    ? (
                        <span className="
                          flex items-center gap-1 text-[11px] font-bold
                          text-[#17A673]
                        "
                        >
                          <Check className="size-4" />
                          {' '}
                          {t('included')}
                        </span>
                      )
                    : s === 'available'
                      ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModuleRequest(m)}
                            className="
                              h-8 cursor-pointer gap-1 rounded-xl
                              border-slate-200 text-xs font-bold text-[#2487B8]
                              hover:bg-[#DCEBF4]/50
                            "
                          >
                            <Sparkles className="size-3.5" />
                            <span>{t('requestActivation')}</span>
                          </Button>
                        )
                      : s === 'expired'
                        ? (
                            <span className="
                              flex items-center gap-1 text-[11px] font-bold
                              text-rose-500
                            "
                            >
                              <AlertCircle className="size-4" />
                              {' '}
                              {t('moduleStatus.expired')}
                            </span>
                          )
                        : (
                            <span className="
                              flex items-center gap-1 text-[11px] font-bold
                              text-slate-400
                            "
                            >
                              <Lock className="size-4" />
                              {' '}
                              {t('moduleStatus.upcoming')}
                            </span>
                          )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredModules.length === 0 && (
        <Card className="
          space-y-3 rounded-2xl border border-slate-200/80 bg-white p-12
          text-center
        "
        >
          <AlertCircle className="mx-auto size-8 text-slate-300" />
          <p className="text-sm font-bold text-[#16212B]">{t('emptyTitle')}</p>
          <p className="text-xs text-slate-500">{search ? t('emptySearch', { search }) : t('emptyTab')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setActiveTab('all');
            }}
            className="mt-2 h-8 rounded-xl text-xs"
          >
            {t('resetFilters')}
          </Button>
        </Card>
      )}

      {/* Module Request Ticket Modal */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="
          max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl
        "
        >
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-base font-extrabold text-[#16212B]
            "
            >
              <Sparkles className="size-4 text-[#2487B8]" />
              {targetModule ? t('requestModuleSubject', { name: targetModule.name }) : t('requestExtensionTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label
                htmlFor="ent-req-subject"
                className="
                  text-[11px] font-bold tracking-wide text-slate-500 uppercase
                "
              >
                {t('subjectLabel')}
              </label>
              <Input
                id="ent-req-subject"
                value={requestSubject}
                onChange={e => setRequestSubject(e.target.value)}
                placeholder={t('subjectPlaceholder')}
                className="mt-1 h-9 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="ent-req-message"
                className="
                  text-[11px] font-bold tracking-wide text-slate-500 uppercase
                "
              >
                {t('messageLabel')}
              </label>
              <Textarea
                id="ent-req-message"
                rows={5}
                value={requestMessage}
                onChange={e => setRequestMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
                className="mt-1 resize-none rounded-xl text-xs font-medium"
              />
            </div>

            <p className="
              rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-[11px]
              text-slate-500
            "
            >
              {t('ticketNote')}
            </p>
          </div>

          <DialogFooter className="
            gap-2
            sm:gap-0
          "
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestModalOpen(false)}
              disabled={submittingRequest}
              className="h-9 rounded-xl text-xs font-bold"
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSendRequest}
              disabled={submittingRequest}
              className="
                h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs font-bold text-white
                shadow-2xs
                hover:bg-[#1B6C93]
              "
            >
              <Send className="size-3.5" />
              <span>{submittingRequest ? t('sending') : t('send')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
