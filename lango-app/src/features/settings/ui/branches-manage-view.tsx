'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Building2,
  CheckCircle2,
  Edit2,
  Globe,
  Lock,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';

export type BranchItem = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
};

export function BranchesManageView() {
  const locale = useLocale();
  const t = useTranslations('BranchesSettings');
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addonDisabled, setAddonDisabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings/branches');
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.error?.code === 'ADDON_REQUIRED') {
          setAddonDisabled(true);
        }
        setError(json.error?.message || t('loadError'));
        return;
      }

      setBranches(json.data || []);
    } catch {
      setError(t('connectError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;

    try {
      setSubmitting(true);
      setError(null);

      const url = editingId ? `/api/settings/branches/${editingId}` : '/api/settings/branches';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || t('saveError'));
        return;
      }

      setFormData({ name: '', code: '', city: '', address: '', phone: '', email: '' });
      setEditingId(null);
      setActiveTab('list');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await fetchBranches();
    } catch {
      setError(t('saveNetworkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (branch: BranchItem) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      code: branch.code,
      city: branch.city || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
    });
    setActiveTab('create');
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm(t('confirmDeactivate'))) return;

    try {
      const res = await fetch(`/api/settings/branches/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || t('deactivateError'));
        return;
      }
      await fetchBranches();
    } catch {
      alert(t('networkError'));
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', city: '', address: '', phone: '', email: '' });
    setActiveTab('list');
  };

  // Derived stats
  const activeBranches = branches.filter(b => b.isActive);
  const inactiveBranches = branches.filter(b => !b.isActive);
  const citiesSet = new Set(branches.map(b => b.city).filter(Boolean));

  // Filtered list
  const filteredBranches = branches.filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q)
      || b.code.toLowerCase().includes(q)
      || (b.city && b.city.toLowerCase().includes(q))
      || (b.email && b.email.toLowerCase().includes(q))
    );
  });

  // Addon gated — upsell view
  if (addonDisabled) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
        </div>

        <Card className="p-10 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center space-y-5 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-[#16212B]">{t('addonTitle')}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {t('addonBody')}
            </p>
          </div>
          <Button asChild className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl px-6 h-10">
            <Link href={`/${locale}/dashboard/settings/entitlements`}>{t('addonCta')}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={resetForm}
            className={`gap-2 h-9 text-xs rounded-xl ${activeTab === 'list' ? 'bg-white border-slate-300 text-[#16212B]' : 'text-slate-500'}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t('listTab', { count: branches.length })}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', code: '', city: '', address: '', phone: '', email: '' });
              setActiveTab('create');
            }}
            className="gap-2 h-9 text-xs rounded-xl px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>{editingId ? t('edit') : t('newBranch')}</span>
          </Button>
        </div>
      </div>

      {/* ─── Success Banner ─── */}
      {savedSuccess && (
        <div className="p-4 bg-[#D1F5E8] border border-[#17A673]/30 rounded-2xl flex items-center gap-3 text-xs font-bold text-[#17A673]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{t('saved')}</span>
        </div>
      )}

      {/* ─── Error Banner ─── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-rose-700">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statActive')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{activeBranches.length}</p>
            <p className="text-[11px] font-bold text-[#2487B8]">
              {branches.length > 0 ? t('percentOfTotal', { percent: Math.round((activeBranches.length / branches.length) * 100) }) : t('none')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statInactive')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{inactiveBranches.length}</p>
            <p className="text-[11px] font-bold text-slate-400">
              {inactiveBranches.length === 0 ? t('allOperational') : t('needAttention')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">{t('statCities')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{citiesSet.size}</p>
            <p className="text-[11px] font-bold text-emerald-600">
              {citiesSet.size > 0 ? Array.from(citiesSet).slice(0, 2).join(', ') : t('noCity')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* ─── TAB: BRANCH LIST ─── */}
      {activeTab === 'list' && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
            <Badge variant="neutral" className="text-[10px] font-bold text-slate-500 border-slate-200 px-2.5 py-1">
              {t('results', { count: filteredBranches.length })}
            </Badge>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-semibold">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-[#2487B8] rounded-full animate-spin" />
                {t('loading')}
              </div>
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Building2}
                title={branches.length === 0 ? t('emptyTitle') : t('noResultsTitle')}
                description={
                  branches.length === 0
                    ? t('emptyBody')
                    : t('noResultsBody')
                }
                actionLabel={branches.length === 0 ? t('createCta') : undefined}
                onAction={branches.length === 0 ? () => setActiveTab('create') : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('colCode')}</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('colName')}</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('colCity')}</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('colPhone')}</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('colEmail')}</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('colStatus')}</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-right">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBranches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-extrabold text-[#2487B8] bg-[#DCEBF4] px-2 py-0.5 rounded-md text-[11px]">
                          {b.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-[#16212B]">{b.name}</p>
                            {b.address && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {b.address}
                              </p>
                            )}
                          </div>
                          {b.isDefault && (
                            <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold ml-1">
                              {t('main')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{b.city || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{b.phone || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{b.email || '—'}</td>
                      <td className="py-3.5 px-4">
                        {b.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> {t('active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {t('inactive')}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {/* Always visible on touch screens and when focused; hover-reveal only with a mouse. */}
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(b)}
                            aria-label={t('editBranch', { name: b.name })}
                            title={t('editBranch', { name: b.name })}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-[#2487B8] hover:bg-[#DCEBF4] rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {!b.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(b.id)}
                              aria-label={t('deactivateBranch', { name: b.name })}
                              title={t('deactivateBranch', { name: b.name })}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── TAB: CREATE / EDIT FORM ─── */}
      {activeTab === 'create' && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden max-w-3xl">
          {/* Form Header */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#16212B]">
                {editingId ? t('editTitle') : t('createTitle')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {editingId
                  ? t('editSubtitle')
                  : t('createSubtitle')}
              </p>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Row 1: Name + Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('fieldName')} <span className="text-rose-500">*</span></Label>
                <Input
                  required
                  placeholder={t('namePlaceholder')}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('fieldCode')} <span className="text-rose-500">*</span></Label>
                <Input
                  required
                  placeholder={t('codePlaceholder')}
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs uppercase focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* Row 2: City + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('colCity')}</Label>
                <Input
                  placeholder={t('cityPlaceholder')}
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('fieldPhone')}</Label>
                <Input
                  placeholder={t('phonePlaceholder')}
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                />
              </div>
            </div>

            {/* Row 3: Email + Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('fieldEmail')}</Label>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('fieldAddress')}</Label>
                <Input
                  placeholder={t('addressPlaceholder')}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                />
              </div>
            </div>

            {/* Form Footer */}
            <div className="pt-5 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="rounded-xl text-xs font-bold h-10 px-5"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl text-xs font-bold px-6 h-10"
              >
                {submitting ? t('saving') : editingId ? t('update') : t('create')}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
