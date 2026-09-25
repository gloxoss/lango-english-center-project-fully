'use client';

import type { ApiErrorShape } from './broadcast-ui';
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, fmtCount, fmtDate, isAddonNotActivated } from './broadcast-ui';

type SegmentDefinition = {
  kind: string;
  filters?: Record<string, unknown>;
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  memberCount: number | null;
  lastComputedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const KINDS = ['inquiry', 'student', 'guardian', 'staff', 'alumni', 'external'];

export function SegmentsView() {
  const t = useTranslations('Broadcast');
  const tCRM = useTranslations('CRM');
  const tCommon = useTranslations('Common');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [rows, setRows] = useState<Segment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('inquiry');
  const [tag, setTag] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const getRecipientKindLabel = (k: string) => {
    switch (k) {
      case 'inquiry': return t('kindInquiry');
      case 'student': return t('kindStudent');
      case 'guardian': return t('kindGuardian');
      case 'staff': return t('kindStaff');
      case 'alumni': return t('kindAlumni');
      case 'external': return t('kindExternal');
      default: return k;
    }
  };

  const getFilterLabel = (k: string) => {
    switch (k) {
      case 'status': return t('colStatus');
      case 'source': return tCRM('filterSource');
      case 'interestLevel': return tCRM('interestLevel');
      case 'assignedToId': return tCRM('filterOwner');
      case 'tag': return tCRM('tags');
      case 'role': return 'Rôle';
      case 'userStatus': return t('colStatus');
      case 'branchId': return 'Succursale';
      case 'hasPhone': return t('phone');
      case 'hasEmail': return t('email');
      case 'contactByGuardian': return t('kindGuardian');
      default: return k;
    }
  };

  const getFilterValueLabel = (filterKey: string, v: string) => {
    if (filterKey === 'status' && kind === 'inquiry') {
      switch (v) {
        case 'new': return tCRM('stageNew');
        case 'contacted': return tCRM('stageContacted');
        case 'qualified': return tCRM('stageQualified');
        case 'converted': return tCRM('stageConverted');
        case 'lost': return tCRM('stageLost');
        default: return v;
      }
    }
    if (filterKey === 'source') {
      switch (v) {
        case 'walk_in': return tCRM('sourceWalkIn');
        case 'phone': return tCRM('sourcePhone');
        case 'web': return tCRM('sourceWeb');
        case 'referral': return tCRM('sourceReferral');
        case 'facebook_ads': return tCRM('sourceFacebookAds');
        case 'google_ads': return tCRM('sourceGoogleAds');
        default: return v;
      }
    }
    if (filterKey === 'interestLevel') {
      switch (v) {
        case 'low': return tCRM('interestLow');
        case 'medium': return tCRM('interestMedium');
        case 'high': return tCRM('interestHigh');
        default: return v;
      }
    }
    return v;
  };

  const KIND_FILTERS: Record<string, { key: string; label: string; values: string[] }[]> = {
    inquiry: [
      { key: 'status', label: t('colStatus'), values: ['new', 'contacted', 'qualified', 'converted', 'lost'] },
      { key: 'source', label: tCRM('filterSource'), values: ['walk_in', 'phone', 'web', 'referral', 'facebook_ads', 'google_ads'] },
      { key: 'interestLevel', label: tCRM('interestLevel'), values: ['low', 'medium', 'high'] },
    ],
    student: [
      { key: 'role', label: 'Rôle', values: ['student'] },
      { key: 'userStatus', label: t('colStatus'), values: ['active', 'inactive', 'archived'] },
      { key: 'contactByGuardian', label: t('kindGuardian'), values: ['guardian'] },
    ],
    staff: [
      { key: 'userStatus', label: t('colStatus'), values: ['active', 'inactive', 'archived'] },
    ],
    guardian: [
      { key: 'hasPhone', label: t('phone'), values: ['yes', 'no'] },
      { key: 'hasEmail', label: t('email'), values: ['yes', 'no'] },
    ],
    alumni: [
      { key: 'userStatus', label: t('colStatus'), values: ['active', 'inactive', 'archived'] },
    ],
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Segment[]>('/api/addons/broadcast/segments');
    if (res.ok && res.data) {
      setRows(res.data);
    } else {
      setError(res.error ?? { message: t('addonNotActivated') });
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async (s: Segment) => {
    await api(`/api/addons/broadcast/segments/${s.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: s.name, description: s.description, definition: s.definition }),
    });
    load();
  };

  const del = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(tCommon('confirmDeleteGeneric'))) {
      return;
    }
    const res = await api(`/api/addons/broadcast/segments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(res.error?.message ?? tCommon('error'));
    }
    load();
  };

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const definition: SegmentDefinition = { kind, filters: { ...filters } };
    if (tag.trim()) {
      definition.filters = { ...definition.filters, tag: tag.trim() };
    }
    if (kind === 'student') {
      definition.filters = { ...definition.filters, role: 'student', contactByGuardian: filters.contactByGuardian === 'guardian' };
    }
    const res = await api<Segment>('/api/addons/broadcast/segments', {
      method: 'POST',
      body: JSON.stringify({ name, description, definition }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName(''); setDescription(''); setTag(''); setFilters({}); setKind('inquiry');
      load();
    } else {
      setFormError(res.error?.message ?? t('addonNotActivated'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-slate-500">
        <Loader2 className="size-5 animate-spin" />
        {' '}
        {tCommon('loading')}
      </div>
    );
  }

  if (error && !rows) {
    if (isAddonNotActivated(error)) {
      return (
        <div className="
          flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50
          px-4 py-3 text-amber-700
        "
        >
          <AlertCircle className="size-5 shrink-0" />
          {' '}
          {error.message ?? t('addonNotActivated')}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="size-5" />
        {' '}
        {error.message ?? tCommon('error')}
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="cursor-pointer"
        >
          <RefreshCw className="mr-1 size-4" />
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const activeFilters = KIND_FILTERS[kind] ?? [];

  return (
    <div className="space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">{t('segmentsTitle')}</h1>
          <p className="text-sm text-slate-500">{t('segmentsSubtitle')}</p>
        </div>
        <Button
          onClick={() => setShowForm(v => !v)}
          className="cursor-pointer"
        >
          <Plus className="me-2 size-4" />
          {' '}
          {t('btnNewSegment')}
        </Button>
      </div>

      {showForm && (
        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">{t('btnNewSegment')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="cursor-pointer"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="
            grid gap-4
            sm:grid-cols-2
          "
          >
            <div>
              <Label>{t('colName')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('segmentName')} />
            </div>
            <div>
              <Label>{t('audienceType')}</Label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value)}
                className="
                  h-9 w-full cursor-pointer rounded-md border border-slate-200
                  bg-white px-3 text-sm
                "
              >
                {KINDS.map(k => <option key={k} value={k}>{getRecipientKindLabel(k)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>{t('tagOptional')}</Label>
              <Input value={tag} onChange={e => setTag(e.target.value)} placeholder={tCRM('tagsPlaceholder')} />
            </div>
            {activeFilters.map(f => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <select
                  value={filters[f.key] ?? ''}
                  onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}
                  className="
                    h-9 w-full cursor-pointer rounded-md border border-slate-200
                    bg-white px-3 text-sm
                  "
                >
                  <option value="">{t('filterAll')}</option>
                  {f.values.map(v => (
                    <option key={v} value={v}>
                      {getFilterValueLabel(f.key, v)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={submit}
              disabled={saving || !name.trim()}
              className="cursor-pointer"
            >
              {saving
                ? <Loader2 className="me-2 size-4 animate-spin" />
                : (
                    <Users className="me-2 size-4" />
                  )}
              {' '}
              {t('btnCreate')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="cursor-pointer"
            >
              {t('btnCancel')}
            </Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0)
        ? (
            <Card className="
              rounded-2xl border border-dashed border-slate-300 bg-white p-10
              text-center text-slate-500
            "
            >
              {t('noSegments')}
            </Card>
          )
        : (
            <div className="
              overflow-hidden rounded-2xl border border-slate-200/80 bg-white
              shadow-2xs
            "
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="
                    bg-slate-50 text-start text-xs tracking-wide text-slate-500
                    uppercase
                  "
                  >
                    <tr>
                      <th className="px-4 py-3 text-start">{t('colName')}</th>
                      <th className="px-4 py-3 text-start">{t('audienceType')}</th>
                      <th className="px-4 py-3 text-start">{t('filters')}</th>
                      <th className="px-4 py-3 text-start">{t('members')}</th>
                      <th className="px-4 py-3 text-start">{t('computed')}</th>
                      <th className="px-4 py-3 text-end" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="
                          px-4 py-3 text-start font-medium text-[#16212B]
                        "
                        >
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-start">
                          <Badge className="
                            border border-slate-200 bg-slate-50 text-slate-700
                          "
                          >
                            {getRecipientKindLabel(s.definition?.kind ?? '')}
                          </Badge>
                        </td>
                        <td className="
                          px-4 py-3 text-start text-xs text-slate-500
                        "
                        >
                          {Object.entries(s.definition?.filters ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${getFilterLabel(k)}: ${getFilterValueLabel(k, String(v))}`).join(' · ') || '—'}
                        </td>
                        <td className="
                          px-4 py-3 text-start font-semibold text-[#16212B]
                        "
                        >
                          {fmtCount(s.memberCount, locale)}
                        </td>
                        <td className="px-4 py-3 text-start text-slate-500">{fmtDate(s.lastComputedAt, locale)}</td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refresh(s)}
                              className="cursor-pointer"
                            >
                              <RefreshCw className="me-1 size-3.5" />
                              {' '}
                              {t('btnRecalculate')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="
                                cursor-pointer text-slate-400
                                hover:text-rose-600
                              "
                              onClick={() => del(s.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
    </div>
  );
}
