'use client';

import { useCallback, useEffect, useState } from 'react';
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
          <h1 className="text-2xl font-bold text-[#16212B]">Politiques de l&apos;internat</h1>
          <p className="text-sm text-slate-500">Consentement, sorties, escalades, visiteurs et conservation des données.</p>
        </div>
        {data && <Badge className="bg-slate-100 text-slate-600">Version {data.version}</Badge>}
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {success && <p className="flex items-center gap-1 text-sm text-[#0b5c3a]"><AlertCircle className="h-4 w-4" /> Politiques enregistrées.</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500">Impossible de charger les politiques.</div>
      ) : (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          <Section title="Consentement du tuteur">
            <BoolRow
              label="Consentement tuteur requis pour les mineurs"
              hint="Exige l'accord du tuteur pour héberger un élève mineur."
              checked={data.policies.guardianConsentRequiredForMinors}
              onChecked={v => set('guardianConsentRequiredForMinors', v)}
            />
            <BoolRow
              label="Consentement tuteur requis pour les sorties"
              hint="Exige l'approbation du tuteur sur les permissions de sortie d'un mineur."
              checked={data.policies.guardianConsentRequiredForLeave}
              onChecked={v => set('guardianConsentRequiredForLeave', v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Âge de majorité</label>
                <Input type="number" value={data.policies.majorityAge} onChange={e => set('majorityAge', Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Sortie max (heures)</label>
                <Input type="number" value={data.policies.leavePassMaxHours} onChange={e => set('leavePassMaxHours', Number(e.target.value))} />
              </div>
            </div>
          </Section>

          <Section title="Permissions de sortie">
            <BoolRow
              label="Motif obligatoire"
              checked={data.policies.leavePassRequiresReason}
              onChecked={v => set('leavePassRequiresReason', v)}
            />
            <BoolRow
              label="Destination obligatoire"
              checked={data.policies.leavePassRequiresDestination}
              onChecked={v => set('leavePassRequiresDestination', v)}
            />
          </Section>

          <Section title="Appel du soir & escalades">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Minutes de grâce (appel)</label>
              <Input type="number" value={data.policies.rollCallGraceMinutes} onChange={e => set('rollCallGraceMinutes', Number(e.target.value))} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Palier d&apos;escalade après appels manqués</p>
              {data.policies.escalationTiers.map((tier, i) => (
                <div key={tier.tier} className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <Badge className="bg-slate-100 text-slate-600">Palier {tier.tier}</Badge>
                  <Select value={tier.recipient} onValueChange={v => setTier(i, { recipient: v })}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warden">Intendant</SelectItem>
                      <SelectItem value="school_admin">Admin établissement</SelectItem>
                      <SelectItem value="guardian">Tuteur</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    après
                    <Input type="number" min={1} value={tier.afterMissingRollCalls} onChange={e => setTier(i, { afterMissingRollCalls: Number(e.target.value) })} className="h-8 w-16 text-xs" />
                    appel(s)
                  </label>
                  <Select value={tier.channel} onValueChange={v => setTier(i, { channel: v })}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="log">Journal</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Visiteurs & sauvegarde">
            <BoolRow
              label="Pré-approbation visiteur requise"
              checked={data.policies.visitorPreApprovalRequired}
              onChecked={v => set('visitorPreApprovalRequired', v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Heures de visite (début)</label>
                <Input value={data.policies.visitorHoursDefault.start} onChange={e => set('visitorHoursDefault', { ...data.policies.visitorHoursDefault, start: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Heures de visite (fin)</label>
                <Input value={data.policies.visitorHoursDefault.end} onChange={e => set('visitorHoursDefault', { ...data.policies.visitorHoursDefault, end: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lecteurs des champs sensibles (sauvegarde)</label>
              <Input value={data.policies.safeguardingReaders.join(', ')} onChange={e => set('safeguardingReaders', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </div>
          </Section>

          <Section title="Finance & rétention">
            <BoolRow
              label="Émettre la charge à l'hébergement (check-in)"
              hint="L'adapter finance émet la redevance lors du check-in."
              checked={data.policies.emitChargeOnCheckIn}
              onChecked={v => set('emitChargeOnCheckIn', v)}
            />
            <BoolRow
              label="Départ d'urgence malgré échec finance"
              hint="Un échec de facturation ne bloque jamais le départ."
              checked={data.policies.allowEmergencyDepartureOnFinanceFailure}
              onChecked={v => set('allowEmergencyDepartureOnFinanceFailure', v)}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Conservation des données (mois)</label>
              <Input type="number" value={data.policies.retentionMonths} onChange={e => set('retentionMonths', Number(e.target.value))} />
            </div>
          </Section>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !data}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer
        </Button>
      </div>
    </div>
  );
}
