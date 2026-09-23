'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type PaymentMethod = {
  id: string;
  methodCode: string;
  labelFr: string;
  labelAr: string | null;
  requiresReference: boolean;
  requiresBank: boolean;
  requiresDate: boolean;
  requiresProof: boolean;
  refundable: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  provider: string | null;
  gatewayMode: string | null;
  credentialSecretKey: string | null;
  webhookSecretKey: string | null;
};

// Payment methods — configurable payment_method_configurations (Payment Type
// screen). Provider-backed online methods remain integrations; these are the
// offline method definitions with required-proof flags.
export function PaymentMethodsView() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const { role } = usePermissions();
  const canManage = role === 'school_admin' || role === 'accountant';
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    methodCode: '',
    labelFr: '',
    labelAr: '',
    requiresReference: false,
    requiresBank: false,
    requiresDate: false,
    requiresProof: false,
    refundable: true,
    isActive: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    provider: '',
    gatewayMode: 'sandbox',
    credentialSecretKey: '',
    webhookSecretKey: '',
  });

  const load = () => {
    setLoading(true);
    fetch('/api/finance/payment-methods')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setMethods(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setForm({
      methodCode: '',
      labelFr: '',
      labelAr: '',
      requiresReference: false,
      requiresBank: false,
      requiresDate: false,
      requiresProof: false,
      refundable: true,
      isActive: true,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      provider: '',
      gatewayMode: 'sandbox',
      credentialSecretKey: '',
      webhookSecretKey: '',
    });
    setShowForm(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setError(null);
    setForm({
      methodCode: m.methodCode,
      labelFr: m.labelFr,
      labelAr: m.labelAr ?? '',
      requiresReference: m.requiresReference,
      requiresBank: m.requiresBank,
      requiresDate: m.requiresDate,
      requiresProof: m.requiresProof,
      refundable: m.refundable,
      isActive: m.isActive,
      effectiveFrom: m.effectiveFrom,
      effectiveTo: m.effectiveTo ?? '',
      provider: m.provider ?? '',
      gatewayMode: m.gatewayMode ?? 'sandbox',
      credentialSecretKey: m.credentialSecretKey ?? '',
      webhookSecretKey: m.webhookSecretKey ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.methodCode || !form.labelFr) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        methodCode: form.methodCode,
        labelFr: form.labelFr,
        labelAr: form.labelAr || undefined,
        requiresReference: form.requiresReference,
        requiresBank: form.requiresBank,
        requiresDate: form.requiresDate,
        requiresProof: form.requiresProof,
        refundable: form.refundable,
        isActive: form.isActive,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        provider: form.provider || null,
        gatewayMode: form.gatewayMode,
        credentialSecretKey: form.credentialSecretKey || null,
        webhookSecretKey: form.webhookSecretKey || null,
      };
      const res = await fetch('/api/finance/payment-methods', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        load();
      } else {
        setError(json.message ?? tCommon('error'));
      }
    } catch {
      setError(t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = methods.filter(m => `${m.methodCode} ${m.labelFr} ${m.labelAr ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const Flag = ({ on, label }: { on: boolean; label: string }) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-[#2487B8]/10 text-[#2487B8]' : 'bg-slate-100 text-slate-400'}`}>
      {label}
    </span>
  );

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('paymentMethodsTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('paymentMethodsSubtitle', { count: methods.length })}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t('newPaymentMethodBtn')}
          </Button>
        )}
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder={t('searchMethodPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editing ? t('editMethodTitle') : t('newMethodTitle')}</h3>
          {error && <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tCommon('code')}</label>
              <Input value={form.methodCode} disabled={!!editing} onChange={e => setForm({ ...form, methodCode: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('labelFr')}</label>
              <Input value={form.labelFr} onChange={e => setForm({ ...form, labelFr: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('labelAr')}</label>
              <Input value={form.labelAr} onChange={e => setForm({ ...form, labelAr: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('effectiveFromLabel')}</label>
              <Input type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('effectiveToOptionalLabel')}</label>
              <Input type="date" value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('onlineGatewayLabel')}</label>
              <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs">
                <option value="">{t('noGatewayOffline')}</option>
                {/* Audit P0-C: CMI live is not implemented (provider throws 501) —
                    offered for sandbox testing only, labelled as such. */}
                <option value="cmi-naps">CMI NAPS (sandbox uniquement)</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('gatewayModeLabel')}</label>
              <select
                value={form.gatewayMode}
                onChange={e => setForm({ ...form, gatewayMode: e.target.value })}
                disabled={form.provider === 'cmi-naps'}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs disabled:opacity-60"
              >
                <option value="sandbox">Sandbox</option>
                {form.provider !== 'cmi-naps' && <option value="live">Production</option>}
              </select>
              {form.provider === 'cmi-naps' && (
                <p className="text-[10px] text-amber-700 font-semibold">CMI production n'est pas encore disponible : la passerelle reste en mode test.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('credentialSecretKeyLabel')}</label>
              <Input value={form.credentialSecretKey} onChange={e => setForm({ ...form, credentialSecretKey: e.target.value })} className="h-9 rounded-xl" placeholder="ex. payments.cmi_naps.store_key" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('webhookSecretKeyLabel')}</label>
              <Input value={form.webhookSecretKey} onChange={e => setForm({ ...form, webhookSecretKey: e.target.value })} className="h-9 rounded-xl" placeholder="ex. payments.cmi_naps.webhook_secret" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {([
              ['requiresReference', t('requiresReference')],
              ['requiresBank', t('requiresBank')],
              ['requiresDate', t('requiresDate')],
              ['requiresProof', t('requiresProof')],
              ['refundable', t('refundableLabel')],
              ['isActive', t('statusActive')],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? t('saving') : tCommon('save')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      )}

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-start text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4 text-start">{tCommon('code')}</th>
              <th className="py-3.5 px-4 text-start">{tCommon('name')}</th>
              <th className="py-3.5 px-4 text-start">{t('requirementsCol')}</th>
              <th className="py-3.5 px-4 text-center">{t('refundableCol')}</th>
              <th className="py-3.5 px-4 text-center">{tCommon('status')}</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400">{t('noPaymentMethodsConfigured')}</td></tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-extrabold text-[#2487B8]">{m.methodCode}</td>
                <td className="py-3.5 px-4 text-start">
                  <div className="font-bold text-[#16212B]">{m.labelFr}</div>
                  {m.labelAr && <div className="text-[10px] text-slate-400">{m.labelAr}</div>}
                  {m.provider && <div className="text-[10px] font-bold text-[#2487B8] mt-0.5">{m.provider}{m.gatewayMode === 'live' ? ' · production' : ' · sandbox'}</div>}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap gap-1">
                    <Flag on={m.requiresReference} label={t('refBadge')} />
                    <Flag on={m.requiresBank} label={t('bankBadge')} />
                    <Flag on={m.requiresDate} label={t('dateBadge')} />
                    <Flag on={m.requiresProof} label={t('proofBadge')} />
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-slate-500">{m.refundable ? tCommon('yes') : tCommon('no')}</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${m.isActive ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {m.isActive ? t('statusActive') : t('statusInactive')}
                  </Badge>
                </td>
                {canManage && (
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]" title={tCommon('edit')}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
