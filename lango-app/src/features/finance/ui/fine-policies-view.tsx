'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil, Play, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type FinePolicy = {
  id: string;
  name: string;
  description: string | null;
  graceDays: number;
  formula: 'flat' | 'per_day' | 'tiered';
  flatAmount: number;
  perDayAmount: number;
  maxAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'active' | 'archived';
};

type FineAssessment = {
  id: string;
  studentName: string | null;
  policyName: string | null;
  amount: number;
  reason: string | null;
  status: string;
  billingState: 'billed' | 'legacy_unbilled' | 'waived' | 'superseded';
  assessedAt: string;
};

export function FinePoliciesView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const formulaLabel: Record<FinePolicy['formula'], string> = {
    flat: t('formulaFlat'),
    per_day: t('formulaPerDay'),
    tiered: t('formulaTiered'),
  };

  const { role } = usePermissions();
  const canManage = role === 'school_admin' || role === 'accountant';
  const [policies, setPolicies] = useState<FinePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<FineAssessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    graceDays: '0',
    formula: 'flat' as FinePolicy['formula'],
    flatAmount: '',
    perDayAmount: '',
    maxAmount: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    status: 'active' as FinePolicy['status'],
  });

  const load = () => {
    setLoading(true);
    fetch('/api/finance/fine-policies')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setPolicies(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadAssessments();
  }, []);

  const loadAssessments = () => {
    setAssessmentsLoading(true);
    fetch('/api/finance/fine-assessments')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) setAssessments(json.data);
      })
      .catch(() => {})
      .finally(() => setAssessmentsLoading(false));
  };

  const handleWaive = async (a: FineAssessment) => {
    const reason = window.prompt(t('waiveReasonPrompt'), '');
    if (!reason) return;
    setWaivingId(a.id);
    try {
      const res = await fetch('/api/finance/fine-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, waiveReason: reason }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRunResult(json.message ?? null);
        loadAssessments();
      } else {
        setRunResult(json.error?.message ?? json.message ?? t('runAssessmentFailure'));
      }
    } catch (err) {
      console.error('Failed to waive fine', err);
      setRunResult(t('runAssessmentError'));
    } finally {
      setWaivingId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      graceDays: '0',
      formula: 'flat',
      flatAmount: '',
      perDayAmount: '',
      maxAmount: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      status: 'active',
    });
    setShowForm(true);
  };

  const openEdit = (p: FinePolicy) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? '',
      graceDays: String(p.graceDays),
      formula: p.formula,
      flatAmount: String(p.flatAmount),
      perDayAmount: String(p.perDayAmount),
      maxAmount: p.maxAmount != null ? String(p.maxAmount) : '',
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo ?? '',
      status: p.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.flatAmount) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        graceDays: Number(form.graceDays) || 0,
        formula: form.formula,
        flatAmount: Number(form.flatAmount),
        perDayAmount: Number(form.perDayAmount) || 0,
        maxAmount: form.maxAmount ? Number(form.maxAmount) : undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        status: form.status,
      };
      const res = await fetch('/api/finance/fine-policies', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        load();
      } else {
        console.error('API error saving fine policy', json.message);
      }
    } catch (err) {
      console.error('Failed to save fine policy', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/finance/fine-runs', { method: 'POST' });
      const json = await res.json();
      setRunResult(json?.message ?? (json?.success ? t('runAssessmentSuccess') : t('runAssessmentFailure')));
      if (json?.success) load();
    } catch (_err) {
      setRunResult(t('runAssessmentError'));
    } finally {
      setRunning(false);
    }
  };

  const filtered = policies.filter(p => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('finePoliciesTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('finePoliciesSubtitle', { count: policies.length })}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={running} onClick={handleRun} className="h-9 text-xs rounded-xl gap-1.5 font-bold">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 rtl:rotate-180" />}
              {running ? t('runningAssessment') : t('runAssessmentBtn')}
            </Button>
            <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {t('newPolicyBtn')}
            </Button>
          </div>
        )}
      </div>

      {runResult && (
        <Card className="p-3 bg-[#F6F9FC] rounded-2xl border border-[#2487B8]/20 text-xs font-bold text-[#16212B]">
          {runResult}
        </Card>
      )}

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('searchPolicyPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </Card>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-[#16212B]">{editing ? t('editPolicyTitle') : t('newPolicyTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('nameLabel')}</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('formulaLabel')}</label>
              <select value={form.formula} onChange={e => setForm({ ...form, formula: e.target.value as FinePolicy['formula'] })} className="h-9 w-full rounded-xl border border-slate-200 px-3 bg-white">
                <option value="flat">{t('formulaFlat')}</option>
                <option value="per_day">{t('formulaPerDay')}</option>
                <option value="tiered">{t('formulaTiered')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('graceDaysLabel')}</label>
              <Input type="number" value={form.graceDays} onChange={e => setForm({ ...form, graceDays: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('flatAmountLabel')}</label>
              <Input type="number" value={form.flatAmount} onChange={e => setForm({ ...form, flatAmount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('perDayAmountLabel')}</label>
              <Input type="number" value={form.perDayAmount} onChange={e => setForm({ ...form, perDayAmount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('maxAmountOptionalLabel')}</label>
              <Input type="number" value={form.maxAmount} onChange={e => setForm({ ...form, maxAmount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('effectiveFromLabel')}</label>
              <Input type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('effectiveToOptionalLabel')}</label>
              <Input type="date" value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tCommon('status')}</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FinePolicy['status'] })} className="h-9 w-full rounded-xl border border-slate-200 px-3 bg-white">
                <option value="active">{t('statusActive')}</option>
                <option value="archived">{t('statusArchived')}</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="font-bold text-slate-600">{t('descriptionOptionalLabel')}</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? tCommon('loading') : tCommon('save')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      )}

      {assessments.some(a => a.billingState === 'legacy_unbilled') && (
        <Card className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-900" role="status">
          {t('legacyFinesNeedReview', { count: assessments.filter(a => a.billingState === 'legacy_unbilled').length })}
        </Card>
      )}
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-start text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4 text-start">{t('nameLabel')}</th>
              <th className="py-3.5 px-4 text-start">{t('formulaLabel')}</th>
              <th className="py-3.5 px-4 text-end">{t('formulaFlat')}</th>
              <th className="py-3.5 px-4 text-end">{t('perDayAmountLabel')}</th>
              <th className="py-3.5 px-4 text-end">{t('maxAmountOptionalLabel')}</th>
              <th className="py-3.5 px-4 text-center">{t('graceDaysLabel')}</th>
              <th className="py-3.5 px-4 text-center">{tCommon('status')}</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canManage ? 8 : 7} className="py-8 text-center text-slate-400">{t('noPoliciesConfigured')}</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">
                  {p.name}
                  <div className="text-[10px] font-medium text-slate-400">{p.description ?? '—'}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-500">{formulaLabel[p.formula]}</td>
                <td className="py-3.5 px-4 text-end font-extrabold text-[#16212B]">{p.flatAmount.toFixed(2)} {tCommon('currency')}</td>
                <td className="py-3.5 px-4 text-end text-slate-500">{p.perDayAmount.toFixed(2)} {tCommon('currency')}</td>
                <td className="py-3.5 px-4 text-end text-slate-500">{p.maxAmount != null ? `${p.maxAmount.toFixed(2)} ${tCommon('currency')}` : '—'}</td>
                <td className="py-3.5 px-4 text-center text-slate-500">{p.graceDays} {t('daysUnit')}</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${p.status === 'active' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status === 'active' ? t('statusActive') : t('statusArchived')}
                  </Badge>
                </td>
                {canManage && (
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]" title={tCommon('edit')}>
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

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-[#16212B]">{t('fineAssessmentsTitle')}</h3>
          <span className="text-[10px] font-bold text-slate-400">{t('assessmentsCountSub', { count: assessments.length })}</span>
        </div>
        <table className="w-full text-start text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4 text-start">{t('studentCol')}</th>
              <th className="py-3.5 px-4 text-start">{t('policyCol')}</th>
              <th className="py-3.5 px-4 text-end">{t('amountCol')}</th>
              <th className="py-3.5 px-4 text-start">{t('reasonCol')}</th>
              <th className="py-3.5 px-4 text-center">{tCommon('status')}</th>
              {canManage && <th className="py-3.5 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!assessmentsLoading && assessments.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400">{t('noAssessmentsFound')}</td></tr>
            )}
            {assessments.map(a => (
              <tr key={a.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{a.studentName ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-500">{a.policyName ?? '—'}</td>
                <td className="py-3.5 px-4 text-end font-extrabold text-[#16212B]">{a.amount.toFixed(2)} {tCommon('currency')}</td>
                <td className="py-3.5 px-4 text-slate-500">{a.reason ?? '—'}</td>
                <td className="py-3.5 px-4 text-center">
                  <Badge className={`text-[10px] border-none font-bold ${a.billingState === 'superseded' ? 'bg-slate-100 text-slate-600' : a.billingState === 'legacy_unbilled' ? 'bg-red-100 text-red-700' : a.status === 'waived' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                    {a.billingState === 'superseded' ? t('assessmentSuperseded')
                      : a.billingState === 'legacy_unbilled' ? t('assessmentUnbilled')
                        : a.status === 'waived' ? t('assessmentWaived') : t('assessmentAssessed')}
                  </Badge>
                </td>
                {canManage && (
                  <td className="py-3.5 px-4">
                    {a.status === 'assessed' && a.billingState !== 'superseded' && (
                      <button
                        onClick={() => handleWaive(a)}
                        disabled={waivingId === a.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8] disabled:opacity-50"
                        title={t('waiveBtn')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
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
