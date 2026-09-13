'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  RefreshCw,
  Database,
  Server,
  HardDrive,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
  FileText,
} from 'lucide-react';

type HealthData = {
  timestamp: string;
  maintenanceMode: boolean;
  database: { connected: boolean; version: string | null; sizeBytes: number | null };
  storage: { filesCount: number; totalBytes: number };
  backgroundJobs: { total: number; pending: number; processing: number; complete: number; failed: number };
  counts: { tenants: number; students: number; teachers: number; invoices: number };
  featureFlags: { enabled: number; disabled: number; addons: { id: string; name: string; enabled: boolean }[] };
};

const ADDON_NAMES: Record<string, { ar: string; en: string; fr: string }> = {
  'multi-branch': { ar: 'الفروع المتعددة', en: 'Multi-Branch', fr: 'Multi-Succursales' },
  'whatsapp': { ar: 'التواصل عبر واتساب', en: 'WhatsApp Communication', fr: 'WhatsApp Communication' },
  'hostel': { ar: 'إدارة القسم الداخلي / الإقامة', en: 'Hostel Management', fr: "Gestion de l'internat" },
  'transport': { ar: 'إدارة النقل المدرسي', en: 'Transport Management', fr: 'Gestion du transport' },
  'library': { ar: 'إدارة المكتبة', en: 'Library Management', fr: 'Gestion de la bibliothèque' },
  'event-management': { ar: 'إدارة الفعاليات والأنشطة', en: 'Event Management', fr: 'Gestion des événements' },
  'inventory': { ar: 'إدارة المخزون واللوازم', en: 'Inventory Management', fr: 'Gestion des stocks' },
  'human-resources': { ar: 'الموارد البشرية', en: 'Human Resources', fr: 'Ressources humaines' },
  'payroll-workforce': { ar: 'الرواتب والتعويضات', en: 'Payroll & Workforce', fr: "Paie & main-d'œuvre" },
  'card-management': { ar: 'إدارة البطاقات المدرسية', en: 'Card Management', fr: 'Gestion des cartes' },
  'certificate-management': { ar: 'إصدار الشواهد والشهادات', en: 'Certificate Management', fr: 'Émission de certificats' },
  'live-classrooms': { ar: 'الفصول الافتراضية', en: 'Live Classrooms', fr: 'Classes virtuelles' },
  'attachments-book': { ar: 'دفتر المرفقات والوثائق', en: 'Attachments Book', fr: 'Cahier de pièces jointes' },
  'online-examinations': { ar: 'الامتحانات عبر الإنترنت', en: 'Online Examinations', fr: 'Examens en ligne' },
  'lead-crm': { ar: 'إدارة المستفيدين والمسجلين الجدد', en: 'Lead CRM', fr: 'CRM des leads' },
  'broadcast-messaging': { ar: 'الرسائل الجماعية والنشرات', en: 'Broadcast Messaging', fr: 'Messagerie de diffusion' },
  'advanced-reporting': { ar: 'التقارير والإحصائيات المتقدمة', en: 'Advanced Reporting', fr: 'Rapports avancés' },
  'school-website-cms': { ar: 'الموقع الإلكتروني للمؤسسة', en: 'School Website CMS', fr: 'Site Web École' },
};

function formatBytes(bytes: number | null, locale = 'fr'): string {
  if (bytes == null) return '—';
  const units = locale === 'ar'
    ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب']
    : locale === 'en'
    ? ['B', 'KB', 'MB', 'GB']
    : ['o', 'Ko', 'Mo', 'Go'];
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ${units[1]}`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} ${units[2]}`;
  return `${(mb / 1024).toFixed(2)} ${units[3]}`;
}

export function SuperAdminSettingsView({ locale: propLocale }: { locale?: string } = {}) {
  const currentLocale = useLocale();
  const locale = propLocale || currentLocale;
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/health');
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error?.message || t('healthLoadError'));
    } catch (e) {
      console.error('Failed to load platform health', e);
      setError(locale === 'ar' ? 'تعذر الاتصال بالخادم.' : locale === 'en' ? 'Unable to connect to server.' : 'Connexion au serveur impossible.');
    } finally {
      setLoading(false);
    }
  }, [t, locale]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const dbConnected = data?.database.connected ?? false;
  const jobs = data?.backgroundJobs ?? { total: 0, pending: 0, processing: 0, complete: 0, failed: 0 };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#0066FF]" />
            {t('healthInfrastructureTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('healthInfrastructureSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('databaseKpi')}</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${dbConnected ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-rose-100 text-rose-600'}`}>
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${dbConnected ? 'text-[#17A673]' : 'text-rose-600'}`}>
            {dbConnected ? t('statusConnected') : t('statusOffline')}
          </div>
          <p className="text-[11px] text-slate-400">
            {data?.database.version ? `PostgreSQL ${data.database.version}` : t('dbConnectionStatus')}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('maintenanceModeKpi')}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${data?.maintenanceMode ? 'text-amber-700' : 'text-[#16212B]'}`}>
            {data?.maintenanceMode ? t('statusActive') : t('inactive')}
          </div>
          <p className="text-[11px] text-slate-400">{t('maintenanceModeDesc')}</p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('activeModulesKpi')}</span>
            <div className="w-8 h-8 rounded-xl bg-[#DCEBF4] flex items-center justify-center text-[#0066FF]">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0066FF]">{data?.featureFlags.enabled ?? 0}</div>
          <p className="text-[11px] text-slate-400">
            {t('modulesComingSoonDesc', {
              disabled: data?.featureFlags.disabled ?? 0,
              total: (data?.featureFlags.enabled ?? 0) + (data?.featureFlags.disabled ?? 0),
            })}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('fileStorageKpi')}</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-violet-700">{formatBytes(data?.storage.totalBytes ?? null, locale)}</div>
          <p className="text-[11px] text-slate-400">{t('filesStoredDesc', { count: data?.storage.filesCount ?? 0 })}</p>
        </Card>
      </div>

      {/* Infrastructure details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-sm font-extrabold text-[#16212B]">{t('dbDetailsTitle')}</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-500 font-medium">{t('dbStateLabel')}</span>
              <Badge className={dbConnected ? 'bg-[#DDF5EC] text-[#17A673] border-none font-bold' : 'bg-rose-100 text-rose-600 border-none font-bold'}>
                {dbConnected ? t('dbOperational') : t('dbUnavailable')}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-500 font-medium">{t('dbVersionLabel')}</span>
              <span className="font-mono font-bold text-slate-700">{data?.database.version ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-500 font-medium">{t('dbSizeLabel')}</span>
              <span className="font-bold text-slate-700">{formatBytes(data?.database.sizeBytes ?? null, locale)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-500 font-medium">{t('dbLastCheckLabel')}</span>
              <span className="font-mono text-slate-500">
                {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR') : '—'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-sm font-extrabold text-[#16212B]">{t('backgroundJobsTitle')}</h3>
          </div>
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0066FF] mb-2" />
              {t('loadingJobs')}
            </div>
          ) : jobs.total === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">{t('noExportJobs')}</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500 font-medium">{t('jobsCompleted')}</span>
                <span className="font-bold text-emerald-600">{jobs.complete}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500 font-medium">{t('jobsProcessing')}</span>
                <span className="font-bold text-blue-600">{jobs.processing}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500 font-medium">{t('jobsPending')}</span>
                <span className="font-bold text-amber-600">{jobs.pending}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-500 font-medium">{t('jobsFailed')}</span>
                <span className={`font-bold ${jobs.failed > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{jobs.failed}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Volume indicators */}
      <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0066FF]" />
          <h3 className="text-sm font-extrabold text-[#16212B]">{t('volumeIndicatorsTitle')}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x rtl:divide-x-reverse divide-y md:divide-y-0 divide-slate-100 text-center">
          {[
            { label: t('institutionsVol'), value: data?.counts.tenants ?? 0 },
            { label: t('studentsVol'), value: data?.counts.students ?? 0 },
            { label: t('teachersVol'), value: data?.counts.teachers ?? 0 },
            { label: t('invoicesVol'), value: data?.counts.invoices ?? 0 },
          ].map(stat => (
            <div key={stat.label} className="p-4">
              <p className="text-2xl font-extrabold text-[#16212B]">{stat.value.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Feature flags */}
      <Card className="rounded-2xl border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0066FF]" />
          <h3 className="text-sm font-extrabold text-[#16212B]">{t('featureFlagsTitle')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 text-start">{t('moduleCol')}</th>
                <th className="py-3 px-4 text-start">{t('identifierCol')}</th>
                <th className="py-3 px-4 text-start">{t('statusCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0066FF] mb-2" />
                    {t('loadingModules')}
                  </td>
                </tr>
              ) : (data?.featureFlags.addons.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400">{t('noModulesFound')}</td>
                </tr>
              ) : (
                data?.featureFlags.addons.map(a => {
                  const displayName = ADDON_NAMES[a.id]?.[(locale as 'ar' | 'en' | 'fr')] || a.name;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#16212B]">{displayName}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{a.id}</td>
                      <td className="py-3 px-4">
                        {a.enabled ? (
                          <Badge className="bg-[#DDF5EC] text-[#17A673] border-none font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 me-1" /> {t('statusColBuilt')}
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[11px]">
                            {t('statusColUpcoming')}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

