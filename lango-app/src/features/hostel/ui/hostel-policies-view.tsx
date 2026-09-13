'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { api, errMessage } from './api';

type EscalationTier = {
  tier: number;
  recipient: string;
  afterMissingRollCalls: number;
  channel: string;
};

type HostelPolicies = {
  guardianConsentRequiredForMinors: boolean;
  guardianConsentRequiredForLeave: boolean;
  majorityAge: number;
  leavePassMaxHours: number;
  leavePassRequiresReason: boolean;
  leavePassRequiresDestination: boolean;
  escalationTiers: EscalationTier[];
  rollCallGraceMinutes: number;
  visitorPreApprovalRequired: boolean;
  visitorHoursDefault: { start: string; end: string };
  safeguardingReaders: string[];
  emitChargeOnCheckIn: boolean;
  allowEmergencyDepartureOnFinanceFailure: boolean;
  retentionMonths: number;
};

type PoliciesResponse = { policies: HostelPolicies; version: number };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-5 first:pt-0 last:border-0">
      <h3 className="mb-3 text-sm font-bold text-[#16212B]">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BoolRow({ label, hint, checked, onChecked }: { label: string; hint?: string; checked: boolean; onChecked: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChecked} />
    </div>
  );
}

export function HostelPoliciesView() {
  const t = useTranslations('Hostel');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<PoliciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<PoliciesResponse>('/api/addons/hostel/policies');
    if (res.ok && res.data) setData(res.data);
    else setError(errMessage(res));
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const set = <K extends keyof HostelPolicies>(key: K, value: HostelPolicies[K]) => {
    setData(prev => prev ? { ...prev, policies: { ...prev.policies, [key]: value } } : prev);
  };

  const setTier = (index: number, patch: Partial<EscalationTier>) => {
    setData(prev => {
      if (!prev) return prev;
      const escalationTiers = prev.policies.escalationTiers.map((t, i) => i === index ? { ...t, ...patch } : t);
      return { ...prev, policies: { ...prev.policies, escalationTiers } };
    });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await api('/api/addons/hostel/policies', {
      method: 'PATCH',
      body: JSON.stringify({ policies: data.policies }),
    });
    setSaving(false);
    if (res.ok) {
      setSuccess(true);
      await load();
    } else {
      setError(errMessage(res));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('policiesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('policiesSubtitle')}</p>
        </div>
        {data && <Badge className="bg-slate-100 text-slate-600">{t('policyVersion', { version: data.version })}</Badge>}
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {success && <p className="flex items-center gap-1 text-sm text-[#0b5c3a]"><AlertCircle className="h-4 w-4" /> {t('policiesSaved')}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {tCommon('loading')}</div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">{t('failedToLoadPolicies')}</div>
      ) : (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          <Section title={t('sectionGuardianConsent')}>
            <BoolRow
              label={t('guardianConsentMinors')}
              hint={t('guardianConsentMinorsHint')}
              checked={data.policies.guardianConsentRequiredForMinors}
              onChecked={v => set('guardianConsentRequiredForMinors', v)}
            />
            <BoolRow
              label={t('guardianConsentLeave')}
              hint={t('guardianConsentLeaveHint')}
              checked={data.policies.guardianConsentRequiredForLeave}
              onChecked={v => set('guardianConsentRequiredForLeave', v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('majorityAge')}</label>
                <Input type="number" value={data.policies.majorityAge} onChange={e => set('majorityAge', Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('leavePassMaxHours')}</label>
                <Input type="number" value={data.policies.leavePassMaxHours} onChange={e => set('leavePassMaxHours', Number(e.target.value))} />
              </div>
            </div>
          </Section>

          <Section title={t('sectionLeavePasses')}>
            <BoolRow
              label={t('leavePassRequiresReason')}
              checked={data.policies.leavePassRequiresReason}
              onChecked={v => set('leavePassRequiresReason', v)}
            />
            <BoolRow
              label={t('leavePassRequiresDestination')}
              checked={data.policies.leavePassRequiresDestination}
              onChecked={v => set('leavePassRequiresDestination', v)}
            />
          </Section>

          <Section title={t('sectionRollCallEscalation')}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('rollCallGraceMinutes')}</label>
              <Input type="number" value={data.policies.rollCallGraceMinutes} onChange={e => set('rollCallGraceMinutes', Number(e.target.value))} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">{t('escalationTiersTitle')}</p>
              {data.policies.escalationTiers.map((tier, i) => (
                <div key={tier.tier} className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <Badge className="bg-slate-100 text-slate-600">{t('tierNumber', { tier: tier.tier })}</Badge>
                  <Select value={tier.recipient} onValueChange={v => setTier(i, { recipient: v })}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warden">{t('recipientWarden')}</SelectItem>
                      <SelectItem value="school_admin">{t('recipientSchoolAdmin')}</SelectItem>
                      <SelectItem value="guardian">{t('recipientGuardian')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    {t('afterRollCallsPrefix')}
                    <Input type="number" min={1} value={tier.afterMissingRollCalls} onChange={e => setTier(i, { afterMissingRollCalls: Number(e.target.value) })} className="h-8 w-16 text-xs" />
                    {t('afterRollCallsSuffix')}
                  </label>
                  <Select value={tier.channel} onValueChange={v => setTier(i, { channel: v })}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="log">{t('channelLog')}</SelectItem>
                      <SelectItem value="sms">{t('channelSms')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('sectionVisitorsSafeguarding')}>
            <BoolRow
              label={t('visitorPreApprovalRequired')}
              checked={data.policies.visitorPreApprovalRequired}
              onChecked={v => set('visitorPreApprovalRequired', v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('visitorHoursStart')}</label>
                <Input value={data.policies.visitorHoursDefault.start} onChange={e => set('visitorHoursDefault', { ...data.policies.visitorHoursDefault, start: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('visitorHoursEnd')}</label>
                <Input value={data.policies.visitorHoursDefault.end} onChange={e => set('visitorHoursDefault', { ...data.policies.visitorHoursDefault, end: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('safeguardingReaders')}</label>
              <Input value={data.policies.safeguardingReaders.join(', ')} onChange={e => set('safeguardingReaders', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </div>
          </Section>

          <Section title={t('sectionFinanceRetention')}>
            <BoolRow
              label={t('emitChargeOnCheckIn')}
              hint={t('emitChargeHint')}
              checked={data.policies.emitChargeOnCheckIn}
              onChecked={v => set('emitChargeOnCheckIn', v)}
            />
            <BoolRow
              label={t('allowEmergencyDeparture')}
              hint={t('allowEmergencyDepartureHint')}
              checked={data.policies.allowEmergencyDepartureOnFinanceFailure}
              onChecked={v => set('allowEmergencyDepartureOnFinanceFailure', v)}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('retentionMonths')}</label>
              <Input type="number" value={data.policies.retentionMonths} onChange={e => set('retentionMonths', Number(e.target.value))} />
            </div>
          </Section>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !data}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {t('btnSave')}
        </Button>
      </div>
    </div>
  );
}
