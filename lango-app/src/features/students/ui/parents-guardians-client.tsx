'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  User, Search, Phone, Plus, X, Users, AlertTriangle, MapPin,
  Star, ShieldCheck, CreditCard, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

export type LinkedStudentDetail = {
  id: string;
  name: string;
  matricule?: string | null;
  relation: string;
  isPrimaryContact: boolean;
  canPickup: boolean;
  isFinanciallyResponsible: boolean;
  isEmergencyContact: boolean;
  emergencyPriority?: number | null;
  status?: string;
};

export type GuardianDirectoryItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  portalAccess: boolean;
  isPrimaryContact: boolean;
  isFinanciallyResponsible: boolean;
  canPickup: boolean;
  isEmergencyContact: boolean;
  linkedStudents: string[];
  linkedStudentDetails: LinkedStudentDetail[];
};

export function ParentsGuardiansClient({ locale }: { locale?: string } = {}) {
  const activeLocale = useLocale();
  const currentLocale = locale || activeLocale;
  const t = useTranslations('Guardians');
  const tCommon = useTranslations('Common');
  const { can, role } = usePermissions();

  const [guardiansList, setGuardiansList] = useState<GuardianDirectoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [relationFilter, setRelationFilter] = useState('all');
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianDirectoryItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const getRelationLabel = (relation?: string | null) => {
    if (!relation) return '';
    const keyMap: Record<string, string> = {
      'parent': t('relParent'),
      'père': t('relFather'),
      'pere': t('relFather'),
      'father': t('relFather'),
      'mère': t('relMother'),
      'mere': t('relMother'),
      'mother': t('relMother'),
      'tuteur': t('relGuardian'),
      'tuteur légal': t('relLegalGuardian'),
      'tuteur legal': t('relLegalGuardian'),
      'responsable légal': t('relLegalGuardian'),
      'responsable legal': t('relLegalGuardian'),
      'legal guardian': t('relLegalGuardian'),
      'guardian': t('relGuardian'),
      'grand-parent': t('relGrandparent'),
      'grandparent': t('relGrandparent'),
      'autre': t('relOther'),
      'other': t('relOther'),
    };
    return keyMap[relation.trim().toLowerCase()] ?? relation;
  };

  // 2-Step Add Form State
  const [newGuardian, setNewGuardian] = useState({
    firstName: '',
    lastName: '',
    phone: '+212 6 ',
    email: '',
    address: 'Casablanca',
    occupation: '',
    preferredLanguage: '',
    emailOptIn: true,
    smsOptIn: true,
    relation: 'Parent',
    // Optional Link Step
    linkStudentId: '',
    isPrimaryContact: true,
    isFinanciallyResponsible: true,
    canPickup: false,
    isEmergencyContact: false,
    emergencyPriority: 1,
  });

  // Student Search for Step 2
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState<{ id: string; name: string; matricule: string | null }[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const relationOptions = [
    { value: 'all', label: t('filterAll') },
    { value: 'pere', label: t('filterFather') },
    { value: 'mere', label: t('filterMother') },
    { value: 'tuteur', label: t('filterLegalGuardian') },
    { value: 'parent', label: t('filterParent') },
  ];

  const fetchGuardians = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/students/parents?${params}`);
      const json = await res.json();
      if (json.success) {
        setGuardiansList(json.data as GuardianDirectoryItem[]);
        setTotal(json.total ?? 0);
      }
    } catch (e) {
      console.error('Failed to load guardians', e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchGuardians, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [page, pageSize, search]);

  // Student search effect for Add Modal
  useEffect(() => {
    if (!studentSearch || studentSearch.length < 2) {
      setStudentOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}&pageSize=5`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setStudentOptions(
            json.data.map((s: any) => ({
              id: s.id,
              name: s.name || `${s.firstName} ${s.lastName}`,
              matricule: s.matricule || null,
            })),
          );
        }
      } catch (err) {
        console.error('Failed searching students', err);
      } finally {
        setSearchingStudents(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  const handleAddGuardian = async () => {
    if (!newGuardian.firstName.trim() || !newGuardian.lastName.trim()) {
      setAddError('Le prénom et le nom sont requis.');
      return;
    }
    setSubmittingAdd(true);
    setAddError(null);
    try {
      const res = await fetch('/api/students/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newGuardian.firstName.trim(),
          lastName: newGuardian.lastName.trim(),
          phone: newGuardian.phone.trim() || null,
          email: newGuardian.email.trim() || null,
          address: newGuardian.address.trim() || null,
          occupation: newGuardian.occupation.trim() || null,
          preferredLanguage: newGuardian.preferredLanguage || null,
          emailOptIn: newGuardian.emailOptIn,
          smsOptIn: newGuardian.smsOptIn,
          relation: newGuardian.relation || 'Parent',
          linkStudentId: newGuardian.linkStudentId || null,
          isPrimaryContact: newGuardian.isPrimaryContact,
          isFinanciallyResponsible: newGuardian.isFinanciallyResponsible,
          canPickup: newGuardian.canPickup,
          isEmergencyContact: newGuardian.isEmergencyContact,
          emergencyPriority: newGuardian.isEmergencyContact ? newGuardian.emergencyPriority : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAddError(json.message || 'Erreur lors de la création du tuteur.');
        return;
      }
      setIsAddOpen(false);
      setNewGuardian({
        firstName: '',
        lastName: '',
        phone: '+212 6 ',
        email: '',
        address: 'Casablanca',
        occupation: '',
        preferredLanguage: '',
        emailOptIn: true,
        smsOptIn: true,
        relation: 'Parent',
        linkStudentId: '',
        isPrimaryContact: true,
        isFinanciallyResponsible: true,
        canPickup: false,
        isEmergencyContact: false,
        emergencyPriority: 1,
      });
      setStudentSearch('');
      setStudentOptions([]);
      await fetchGuardians();
    } catch (e) {
      console.error('API Error saving guardian', e);
      setAddError('Erreur de communication avec le serveur.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const filtered = guardiansList.filter((g) => {
    if (relationFilter === 'all') return true;
    const rel = (g.relation || '').toLowerCase();
    if (relationFilter === 'pere') return rel.includes('père') || rel.includes('father') || rel.includes('أب');
    if (relationFilter === 'mere') return rel.includes('mère') || rel.includes('mother') || rel.includes('أم');
    if (relationFilter === 'tuteur') return rel.includes('tuteur') || rel.includes('guardian') || rel.includes('وصي');
    return rel.includes('parent') || rel.includes('أمر');
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        {(role === 'school_admin' || role === 'super_admin' || can('guardians.manage') || can('students.guardians.manage')) && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                setAddError(null);
                setIsAddOpen(true);
              }}
              className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addGuardian')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* 4-Stat KPI Band — Truthful metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: t('activeHouseholds'),
            value: String(total),
            change: t('registeredGuardians'),
            icon: Users,
            color: 'text-[#2487B8]',
            bg: 'bg-[#DCEBF4]',
          },
          {
            label: t('withPhone'),
            value: String(guardiansList.filter(g => g.phone && g.phone !== '—').length),
            change: t('contactProvided'),
            icon: Phone,
            color: 'text-[#17A673]',
            bg: 'bg-[#DDF5EC]',
          },
          {
            label: t('linkedChildren'),
            value: String(
              new Set(guardiansList.flatMap(g => g.linkedStudentDetails?.map(s => s.id) || [])).size,
            ),
            change: t('totalRecorded'),
            icon: User,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: t('incompleteFiles'),
            value: String(guardiansList.filter(g => !g.phone || !g.email).length),
            change: t('missingPhoneEmail'),
            icon: AlertTriangle,
            color: 'text-[#E5544B]',
            bg: 'bg-[#FCE4E2]',
          },
        ].map(kpi => (
          <Card key={kpi.label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">{kpi.label}</p>
                <p className="text-xl font-extrabold text-[#16212B]">{kpi.value}</p>
                <p className="text-[10px] text-slate-400">{kpi.change}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Area: Table + Inspector */}
      <div className={`flex gap-5 ${selectedGuardian ? 'items-start' : ''}`}>
        {/* Left: Table & Mobile Cards */}
        <div className={`${selectedGuardian ? 'flex-1 min-w-0' : 'w-full'} space-y-4`}>
          {/* Filter Toolbar */}
          <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
            <select
              value={relationFilter}
              onChange={e => setRelationFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B] min-h-[44px]"
            >
              {relationOptions.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rtl:pr-9 rtl:pl-3 h-10 text-xs rounded-xl bg-slate-50 border-none min-h-[44px]"
              />
            </div>
          </Card>

          {/* Mobile View: Cards (< 768px) */}
          <div className="md:hidden space-y-3">
            {filtered.map(g => (
              <Card
                key={g.id}
                onClick={() => setSelectedGuardian(g.id === selectedGuardian?.id ? null : g)}
                className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer ${
                  g.id === selectedGuardian?.id ? 'border-[#2487B8] ring-1 ring-[#2487B8]' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xs shrink-0">
                      {g.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[#16212B]">{g.name}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{g.phone || '—'}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] font-bold ${g.portalAccess ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {g.portalAccess ? t('activePortal') : t('noAccount')}
                  </Badge>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400">{t('linkedStudentsHeader')} :</span>
                  {g.linkedStudents.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">{t('noStudents')}</span>
                  ) : (
                    g.linkedStudents.map((childName, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {childName}
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {g.isPrimaryContact && (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-bold">
                        ★ {t('badgePrimary')}
                      </Badge>
                    )}
                    {g.isFinanciallyResponsible && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                        {t('badgeFinancial')}
                      </Badge>
                    )}
                  </div>
                  <Link
                    href={`/${currentLocale}/dashboard/students/parents/${g.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs font-bold text-[#2487B8] flex items-center gap-1 min-h-[44px] px-2"
                  >
                    {t('profile')} <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <Card className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">{t('guardiansHeader')}</th>
                    <th className="py-3.5 px-4">{t('contactHeader')}</th>
                    <th className="py-3.5 px-4">{t('linkedStudentsHeader')}</th>
                    <th className="py-3.5 px-4">{t('responsibilitiesHeader')}</th>
                    <th className="py-3.5 px-4 text-center">{t('portalAccessHeader')}</th>
                    <th className="py-3.5 px-4 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(g => (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedGuardian(g.id === selectedGuardian?.id ? null : g)}
                      className={`cursor-pointer transition ${g.id === selectedGuardian?.id ? 'bg-[#DCEBF4]/40' : 'hover:bg-slate-50/80'}`}
                    >
                      {/* Guardian Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                            {g.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-[#16212B]">{g.name}</span>
                            {g.relation && (
                              <p className="text-[10px] text-slate-400 font-semibold">{getRelationLabel(g.relation)}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Column */}
                      <td className="py-3.5 px-4">
                        <p className="font-mono text-slate-700 font-bold">{g.phone || '—'}</p>
                        <p className="text-slate-400 text-[11px] truncate max-w-[180px]">{g.email || '—'}</p>
                      </td>

                      {/* Linked Students Column */}
                      <td className="py-3.5 px-4">
                        {g.linkedStudents.length === 0 ? (
                          <span className="text-slate-400 italic">{t('noStudentsLinked')}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {g.linkedStudents.map((childName, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]"
                              >
                                <User className="w-2.5 h-2.5 text-slate-400" />
                                {childName}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Responsibilities Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {g.isPrimaryContact && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              {t('badgePrimary')}
                            </span>
                          )}
                          {g.isFinanciallyResponsible && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CreditCard className="w-2.5 h-2.5 text-emerald-700" />
                              {t('badgeFinancial')}
                            </span>
                          )}
                          {g.canPickup && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              {t('badgePickup')}
                            </span>
                          )}
                          {g.isEmergencyContact && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              <ShieldCheck className="w-2.5 h-2.5 text-rose-700" />
                              {t('badgeEmergency')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Portal Access Column */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            g.portalAccess ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {g.portalAccess ? t('activePortal') : t('noAccount')}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right rtl:text-left">
                        <Link
                          href={`/${currentLocale}/dashboard/students/parents/${g.id}`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#2487B8] text-slate-700 hover:text-white font-bold text-xs transition-colors"
                        >
                          {t('profile')}
                          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{t('show')}</span>
                <select
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#16212B]"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>{t('ofHouseholds', { total })}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  {tCommon('previous')}
                </button>
                <span>{t('pageOf', { page, totalPages: Math.max(1, Math.ceil(total / pageSize)) })}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  {tCommon('next')}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Quick Inspector Panel */}
        {selectedGuardian && (
          <div className="w-80 xl:w-96 shrink-0 space-y-3 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
            <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-extrabold text-[#16212B] truncate">{selectedGuardian.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      selectedGuardian.portalAccess ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {selectedGuardian.portalAccess ? t('portalAccessActive') : t('noAccount')}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedGuardian(null)}
                  className="text-slate-400 hover:text-slate-600 transition p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Contact Coordinates */}
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xs shrink-0">
                      {selectedGuardian.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-[#16212B]">{selectedGuardian.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{getRelationLabel(selectedGuardian.relation || 'Tuteur')}</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 pt-1 font-mono text-slate-600">
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {selectedGuardian.phone || '—'}
                    </p>
                    <p className="truncate text-slate-500 font-sans text-[11px]">
                      {selectedGuardian.email || '—'}
                    </p>
                  </div>
                </div>

                {/* Linked Students List */}
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    {t('linkedChildrenCount', { count: selectedGuardian.linkedStudents.length })}
                  </p>
                  {selectedGuardian.linkedStudents.length === 0 ? (
                    <p className="text-[11px] text-slate-400">{t('noStudentsLinked')}</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedGuardian.linkedStudentDetails?.map(child => (
                        <div key={child.id} className="p-2.5 rounded-xl border border-slate-100 bg-white space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-[#16212B]">{child.name}</span>
                            <Badge variant="neutral" className="text-[10px] font-bold text-slate-500">
                              {getRelationLabel(child.relation) || (currentLocale === 'ar' ? 'تلميذ' : 'Élève')}
                            </Badge>
                          </div>
                          {child.matricule && (
                            <p className="text-[10px] font-mono text-slate-400">Matricule: {child.matricule}</p>
                          )}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {child.isPrimaryContact && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                {t('badgePrimary')}
                              </span>
                            )}
                            {child.isFinanciallyResponsible && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                {t('badgeFinancial')}
                              </span>
                            )}
                            {child.canPickup && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                {t('badgePickup')}
                              </span>
                            )}
                            {child.isEmergencyContact && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                {t('badgeEmergency')} (P{child.emergencyPriority ?? 1})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Address */}
                {selectedGuardian.address && selectedGuardian.address !== '—' && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {t('address')}
                    </p>
                    <p className="text-xs text-slate-600">{selectedGuardian.address}</p>
                  </div>
                )}

                {/* Profile link */}
                <Link
                  href={`/${currentLocale}/dashboard/students/parents/${selectedGuardian.id}`}
                  className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold transition-colors min-h-[44px]"
                >
                  {t('viewFullProfile')}
                </Link>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* 2-Step Structured Add Guardian Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <User className="w-5 h-5 text-[#2487B8]" />
              {t('registerNewHousehold')}
            </DialogTitle>
          </DialogHeader>

          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {addError}
            </div>
          )}

          <div className="space-y-5 my-2 text-xs">
            {/* Step 1: Personal Details */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#2487B8] text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                {t('step1Title')}
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t('primaryGuardianNameLabel')}</label>
                  <Input
                    placeholder={t('primaryGuardianNamePlaceholder')}
                    value={newGuardian.firstName}
                    onChange={e => setNewGuardian({ ...newGuardian, firstName: e.target.value })}
                    className="h-10 text-xs rounded-xl min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t('familyNameLabel')}</label>
                  <Input
                    placeholder={t('familyNamePlaceholder')}
                    value={newGuardian.lastName}
                    onChange={e => setNewGuardian({ ...newGuardian, lastName: e.target.value })}
                    className="h-10 text-xs rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t('phoneLabel')}</label>
                  <Input
                    value={newGuardian.phone}
                    onChange={e => setNewGuardian({ ...newGuardian, phone: e.target.value })}
                    className="h-10 text-xs rounded-xl font-mono min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t('emailLabel')}</label>
                  <Input
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={newGuardian.email}
                    onChange={e => setNewGuardian({ ...newGuardian, email: e.target.value })}
                    className="h-10 text-xs rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t('occupation')}</label>
                  <Input
                    value={newGuardian.occupation}
                    onChange={e => setNewGuardian({ ...newGuardian, occupation: e.target.value })}
                    className="h-10 text-xs rounded-xl min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t('residentialAddress')}</label>
                  <Input
                    value={newGuardian.address}
                    onChange={e => setNewGuardian({ ...newGuardian, address: e.target.value })}
                    className="h-10 text-xs rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newGuardian.emailOptIn}
                    onChange={e => setNewGuardian({ ...newGuardian, emailOptIn: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8]"
                  />
                  {t('emailOptIn')}
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newGuardian.smsOptIn}
                    onChange={e => setNewGuardian({ ...newGuardian, smsOptIn: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8]"
                  />
                  {t('smsOptIn')}
                </label>
              </div>
            </div>

            {/* Step 2: Link an Existing Student */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px]">
                  2
                </span>
                {t('step2Title')}
              </h4>

              {/* Student Search & Select */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={t('selectStudentPlaceholder')}
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="pl-9 h-10 text-xs rounded-xl bg-slate-50 border-slate-200 min-h-[44px]"
                  />
                </div>

                {searchingStudents && (
                  <p className="text-[11px] text-slate-400 italic">Recherche en cours...</p>
                )}

                {studentOptions.length > 0 && (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto bg-white">
                    {studentOptions.map(st => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setNewGuardian({ ...newGuardian, linkStudentId: st.id });
                          setStudentSearch(`${st.name} (${st.matricule || 'Sans matricule'})`);
                          setStudentOptions([]);
                        }}
                        className={`w-full text-left p-2.5 hover:bg-slate-50 text-xs flex items-center justify-between transition-colors ${
                          newGuardian.linkStudentId === st.id ? 'bg-[#DCEBF4]/40 font-bold' : ''
                        }`}
                      >
                        <span className="font-bold text-[#16212B]">{st.name}</span>
                        {st.matricule && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {st.matricule}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {newGuardian.linkStudentId && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Élève sélectionné pour le rattachement
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewGuardian({ ...newGuardian, linkStudentId: '' });
                        setStudentSearch('');
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px]"
                    >
                      Désélectionner
                    </button>
                  </div>
                )}
              </div>

              {/* Responsibilities Options (only if an existing student is chosen) */}
              {newGuardian.linkStudentId && (
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Relation avec l'élève</label>
                      <select
                        value={newGuardian.relation}
                        onChange={e => setNewGuardian({ ...newGuardian, relation: e.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 px-2 text-xs bg-white min-h-[44px]"
                      >
                        <option value="Parent">{t('relParent')}</option>
                        <option value="Père">{t('relFather')}</option>
                        <option value="Mère">{t('relMother')}</option>
                        <option value="Tuteur légal">{t('relLegalGuardian')}</option>
                        <option value="Grand-parent">{t('relGrandparent')}</option>
                        <option value="Autre">{t('relOther')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGuardian.isPrimaryContact}
                        onChange={e => setNewGuardian({ ...newGuardian, isPrimaryContact: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8]"
                      />
                      {t('primaryContactLabel')}
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGuardian.isFinanciallyResponsible}
                        onChange={e => setNewGuardian({ ...newGuardian, isFinanciallyResponsible: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8]"
                      />
                      {t('financialResponsibilityLabel')}
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGuardian.canPickup}
                        onChange={e => setNewGuardian({ ...newGuardian, canPickup: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8]"
                      />
                      {t('authorizedToPickup')}
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGuardian.isEmergencyContact}
                        onChange={e => setNewGuardian({ ...newGuardian, isEmergencyContact: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8]"
                      />
                      {t('emergencyContactLabel')}
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl text-xs h-10 min-h-[44px]"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleAddGuardian}
              disabled={submittingAdd}
              className="rounded-xl text-xs h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold min-h-[44px]"
            >
              {submittingAdd ? 'Enregistrement...' : t('createHousehold')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
