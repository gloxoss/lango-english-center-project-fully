'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Copy } from 'lucide-react';

export function SuperAdminSchoolsCreateView({ locale }: { locale: string }) {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');

  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planTier, setPlanTier] = useState<string>('trial');
  const [availablePlans, setAvailablePlans] = useState<Array<{ planTier: string; label: string; priceMonthly: number; currency: string }>>([
    { planTier: 'trial', label: 'Essai', priceMonthly: 0, currency: 'MAD' },
    { planTier: 'basic', label: 'Basique', priceMonthly: 490, currency: 'MAD' },
    { planTier: 'standard', label: 'Standard', priceMonthly: 990, currency: 'MAD' },
    { planTier: 'premium', label: 'Premium', priceMonthly: 1990, currency: 'MAD' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tempPassword: string; adminEmail: string } | null>(null);

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data?.plans) && j.data.plans.length > 0) {
          setAvailablePlans(j.data.plans);
        }
      })
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!name || !adminName || !adminEmail) {
      setError(t('createSchoolValidation'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, adminName, adminEmail, planTier }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || tCommon('error'));
        return;
      }
      setResult({ tempPassword: json.data.tempPassword, adminEmail: json.data.adminEmail });
    } catch (err) {
      console.error('School create failed', err);
      setError(tCommon('error'));
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <span>{t('schoolCreatedSuccess')}</span>
          </div>
          <p className="text-xs text-slate-600">
            {t('shareCredentialsNotice')}
          </p>
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
              <span className="font-bold text-[#16212B]">{result.adminEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('tempPassword')}</span>
              <span className="font-bold text-[#16212B] flex items-center gap-1.5">
                {result.tempPassword}
                <button onClick={() => navigator.clipboard.writeText(result.tempPassword)} title={tCommon('copy')}><Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" /></button>
              </span>
            </div>
          </div>
          <Button asChild variant="primary" className="w-full">
            <Link href={`/${locale}/dashboard/super-admin/schools`}>{t('backToSchools')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="pb-3 border-b border-slate-200/80">
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{t('createSchoolTitle')}</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">{t('createSchoolSubtitle')}</p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-base font-extrabold text-[#0F172A]">{t('generalInfo')}</h3>
        <div>
          <label className="text-xs font-bold text-slate-700">{t('schoolNameField')}</label>
          <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 text-xs" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700">{t('pricingPlanField')}</label>
          <Select value={planTier} onValueChange={v => setPlanTier(v)}>
            <SelectTrigger className="mt-1 text-xs">
              <SelectValue placeholder={availablePlans.find(p => p.planTier === planTier)?.label ?? planTier}>
                {availablePlans.find(p => p.planTier === planTier)?.label ?? planTier}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availablePlans.map(p => (
                <SelectItem key={p.planTier} value={p.planTier}>
                  {p.label} {p.priceMonthly > 0 ? `(${p.priceMonthly} ${p.currency}/mois)` : '(Gratuit)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <h3 className="text-base font-extrabold text-[#0F172A] pt-4 border-t border-slate-100">{t('primaryAdmin')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700">{t('fullNameField')}</label>
            <Input value={adminName} onChange={e => setAdminName(e.target.value)} className="mt-1 text-xs" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">{t('emailField')}</label>
            <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="mt-1 text-xs" />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button disabled={saving} onClick={handleCreate} className="bg-[#0066FF] text-white gap-2 text-xs font-bold px-6 h-10 rounded-xl">
            {saving ? t('creatingSchool') : t('createSchoolButton')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
