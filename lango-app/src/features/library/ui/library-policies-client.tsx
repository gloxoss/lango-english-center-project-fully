'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarX2, RefreshCw, ScrollText, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Policy = { id: string; name: string; patronCategory: string; branchId: string | null; maxLoans: number; loanDurationDays: number; renewalLimit: number; renewalDurationDays: number; finePerDay: string; gracePeriodDays: number; maxHolds: number };
type Closure = { id: string; branchId: string | null; closedOn: string; reason: string | null };

export function LibraryPoliciesClient() {
  const t = useTranslations('Library');
  const [tab, setTab] = useState<'policies' | 'closures'>('policies');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [closureForm, setClosureForm] = useState<{ closedOn: string; reason: string }>({ closedOn: '', reason: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [pr, cr] = await Promise.all([
      fetch('/api/addons/library/policies', { cache: 'no-store' }),
      fetch('/api/addons/library/closures', { cache: 'no-store' }),
    ]);
    const [pj, cj] = await Promise.all([pr.json(), cr.json()]);
    if (pj.success) setPolicies(pj.data);
    if (cj.success) setClosures(cj.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, method: string, body: object, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? t('operationFailed'));
      if (j.success) {
        setForm({});
        setClosureForm({ closedOn: '', reason: '' });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function createPolicy() {
    const body: Record<string, unknown> = { name: form.name ?? '', patronCategory: form.patronCategory ?? '' };
    if (form.maxLoans) body.maxLoans = Number(form.maxLoans);
    if (form.loanDurationDays) body.loanDurationDays = Number(form.loanDurationDays);
    if (form.renewalLimit) body.renewalLimit = Number(form.renewalLimit);
    if (form.renewalDurationDays) body.renewalDurationDays = Number(form.renewalDurationDays);
    if (form.finePerDay) body.finePerDay = form.finePerDay;
    if (form.gracePeriodDays) body.gracePeriodDays = Number(form.gracePeriodDays);
    if (form.maxHolds) body.maxHolds = Number(form.maxHolds);
    if (form.branchId) body.branchId = form.branchId;
    void post('/api/addons/library/policies', 'POST', body, t('policyCreatedMsg'));
  }

  function deletePolicy(p: Policy) {
    if (window.confirm(t('deletePolicyConfirm', { name: p.name }))) {
      void post(`/api/addons/library/policies/${p.id}`, 'DELETE', {}, t('policyDeletedMsg'));
    }
  }

  function createClosure() {
    void post('/api/addons/library/closures', 'POST', { closedOn: closureForm.closedOn, reason: closureForm.reason.trim() || null }, t('closureCreatedMsg'));
  }

  function deleteClosure(c: Closure) {
    void post(`/api/addons/library/closures/${c.id}`, 'DELETE', {}, t('closureDeletedMsg'));
  }

  const num = (key: string) => form[key] ?? '';
  const setNum = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('policiesTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('policiesSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <div className="flex gap-2">
        {([['policies', t('tabPolicies'), ScrollText], ['closures', t('tabClosures'), CalendarX2]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]' : 'bg-white text-slate-600'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {message && <p role="status" className="text-sm">{message}</p>}

      {tab === 'policies' && (
        <>
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">{t('newPolicyTitle')}</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input value={num('name')} onChange={setNum('name')} placeholder={t('policyNamePlaceholder')} />
              <Input value={num('patronCategory')} onChange={setNum('patronCategory')} placeholder={t('policyCategoryPlaceholder')} />
              <Input value={num('branchId')} onChange={setNum('branchId')} placeholder={t('policyBranchPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input type="number" value={num('maxLoans')} onChange={setNum('maxLoans')} placeholder={t('policyMaxLoans')} />
              <Input type="number" value={num('loanDurationDays')} onChange={setNum('loanDurationDays')} placeholder={t('policyLoanDuration')} />
              <Input type="number" value={num('renewalLimit')} onChange={setNum('renewalLimit')} placeholder={t('policyRenewalLimit')} />
              <Input type="number" value={num('renewalDurationDays')} onChange={setNum('renewalDurationDays')} placeholder={t('policyRenewalDuration')} />
              <Input value={num('finePerDay')} onChange={setNum('finePerDay')} placeholder={t('policyFinePerDay')} />
              <Input type="number" value={num('gracePeriodDays')} onChange={setNum('gracePeriodDays')} placeholder={t('policyGracePeriod')} />
              <Input type="number" value={num('maxHolds')} onChange={setNum('maxHolds')} placeholder={t('policyMaxHolds')} />
            </div>
            <Button disabled={busy || !form.name || !form.patronCategory} onClick={createPolicy}>
              {t('btnCreatePolicy')}
            </Button>
          </Card>

          <Card className="p-4">
            {policies.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{t('noPolicies')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('fieldName')}</th>
                      <th className="p-3">{t('typeCategory')}</th>
                      <th className="p-3">{t('policyMaxLoans')}</th>
                      <th className="p-3">{t('policyLoanDuration')}</th>
                      <th className="p-3">{t('thRenewals')}</th>
                      <th className="p-3">{t('policyFinePerDay')}</th>
                      <th className="p-3">{t('policyGracePeriod')}</th>
                      <th className="p-3">{t('policyMaxHolds')}</th>
                      <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="p-3 font-semibold">{p.name}</td>
                        <td className="p-3"><Badge variant="info">{p.patronCategory}</Badge></td>
                        <td className="p-3">{p.maxLoans}</td>
                        <td className="p-3">{t('daysShort', { count: p.loanDurationDays })}</td>
                        <td className="p-3">{p.renewalLimit} × {t('daysShort', { count: p.renewalDurationDays })}</td>
                        <td className="p-3">{Number(p.finePerDay).toFixed(2)} DH</td>
                        <td className="p-3">{t('daysShort', { count: p.gracePeriodDays })}</td>
                        <td className="p-3">{p.maxHolds}</td>
                        <td className="p-3 text-right rtl:text-left">
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => deletePolicy(p)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'closures' && (
        <>
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">{t('newClosureTitle')}</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input type="date" value={closureForm.closedOn} onChange={e => setClosureForm(prev => ({ ...prev, closedOn: e.target.value }))} />
              <Input value={closureForm.reason} onChange={e => setClosureForm(prev => ({ ...prev, reason: e.target.value }))} placeholder={t('closureReasonPlaceholder')} />
              <Button disabled={busy || !closureForm.closedOn} onClick={createClosure}>
                {t('save')}
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            {closures.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{t('noClosures')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">{t('date')}</th>
                      <th className="p-3">{t('thBranch')}</th>
                      <th className="p-3">{t('reason')}</th>
                      <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closures.map(c => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="p-3 font-semibold">{c.closedOn}</td>
                        <td className="p-3 font-mono text-xs">{c.branchId ? c.branchId.slice(0, 8) : t('allBranches')}</td>
                        <td className="p-3">{c.reason ?? '—'}</td>
                        <td className="p-3 text-right rtl:text-left">
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => deleteClosure(c)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
