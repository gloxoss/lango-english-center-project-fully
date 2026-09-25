'use client';

import { useParams, useRouter } from 'next/navigation';
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
  ArrowLeft, User, Phone, Mail, Briefcase, MapPin,
  Users, Star, AlertCircle, Pencil, Trash2, ShieldCheck, CheckCircle2,
  Wallet, Clock, KeyRound, UserPlus, ExternalLink, Unlink, CreditCard, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';

type CoGuardian = { guardianId: string; name: string; relationshipType: string };

type LinkedStudent = {
  linkId: string;
  studentId: string;
  studentName: string;
  studentMatricule: string | null;
  relationshipType: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  emergencyPriority: number | null;
  canPickup: boolean;
  isFinanciallyResponsible: boolean;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  coGuardians: CoGuardian[];
};

type GuardianDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  address: string | null;
  defaultRelation: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  preferredLanguage: string | null;
  createdAt: string;
  updatedAt: string;
  linkedStudents: LinkedStudent[];
};

type PaymentEntry = {
  type: 'invoice' | 'payment';
  id: string;
  reference?: string;
  studentId: string;
  studentName: string;
  amount: number;
  status: string;
  date: string;
};

type PaymentSummary = {
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  unpaidInvoicesCount: number;
  hasFinancialResponsibility?: boolean;
};

type ActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  actorName: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
};

type TabId = 'children' | 'info' | 'payments' | 'activity';

function RelationBadge({ type, t }: { type: string; t: (key: string) => string }) {
  const norm = type.trim().toLowerCase();
  const relationLabels: Record<string, string> = {
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
  const map: Record<string, string> = {
    'parent': 'bg-[#DCEBF4] text-[#1B6C93]',
    'père': 'bg-[#DCEBF4] text-[#1B6C93]',
    'pere': 'bg-[#DCEBF4] text-[#1B6C93]',
    'mère': 'bg-purple-100 text-purple-700',
    'mere': 'bg-purple-100 text-purple-700',
    'tuteur': 'bg-amber-100 text-amber-700',
    'tuteur légal': 'bg-amber-100 text-amber-700',
    'responsable légal': 'bg-amber-100 text-amber-700',
    'grand-parent': 'bg-emerald-100 text-emerald-700',
    'autre': 'bg-slate-100 text-slate-700',
  };
  const label = relationLabels[norm] ?? type;
  const cls = map[norm] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

export default function GuardianDetailPage() {
  const params = useParams();
  const router = useRouter();
  const guardianId = typeof params.id === 'string' ? params.id : '';
  const currentLocale = useLocale();
  const locale = typeof params.locale === 'string' ? params.locale : currentLocale;
  const t = useTranslations('Guardians');
  const tCommon = useTranslations('Common');
  const g = useTranslations('GuardianProfile');
  // Number/date formats follow the UI language (English used to get French formats).
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  // Relationship values are stored in French; only the labels are translated.
  const relationLabel = (value: string) => {
    const key = ({ Parent: 'parent', 'Père': 'father', 'Mère': 'mother', Tuteur: 'legalGuardian', 'Grand-parent': 'grandparent', Autre: 'other' } as Record<string, string>)[value];
    return key ? g(`relations.${key}` as 'relations.parent') : value;
  };
  const { can, role } = usePermissions();

  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('children');

  // Edit modal state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFields, setEditFields] = useState<Partial<GuardianDetail>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Link child state
  const [showLinkChildDialog, setShowLinkChildDialog] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; fullName: string; matricule: string | null; className?: string | null }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState('Parent');
  const [linkIsPrimary, setLinkIsPrimary] = useState(false);
  const [linkIsFinancial, setLinkIsFinancial] = useState(true);
  const [linkCanPickup, setLinkCanPickup] = useState(true);
  const [linkIsEmergency, setLinkIsEmergency] = useState(true);
  const [linkEmergencyPriority, setLinkEmergencyPriority] = useState(1);
  const [linkingChild, setLinkingChild] = useState(false);
  const [linkChildError, setLinkChildError] = useState<string | null>(null);

  // Unlink state
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedStudent | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Payments / activity
  const [payments, setPayments] = useState<PaymentEntry[] | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'children', label: t('tabLinkedChildren') },
    { id: 'info', label: t('tabInformation') },
    { id: 'payments', label: t('tabPayments') },
    { id: 'activity', label: t('tabActivity') },
  ];

  const fetchPaymentsData = async () => {
    if (!guardianId) return;
    try {
      const res = await fetch(`/api/students/parents/${guardianId}/payments`);
      const json = await res.json();
      if (json?.success) {
        if (json.data) setPayments(json.data);
        if (json.summary) {
          setPaymentSummary({
            ...json.summary,
            hasFinancialResponsibility: json.hasFinancialResponsibility ?? json.summary.hasFinancialResponsibility,
            financiallyResponsibleCount: json.summary.financiallyResponsibleCount ?? json.financiallyResponsibleStudents?.length ?? 0,
          });
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchActivityData = async () => {
    if (!guardianId) return;
    try {
      const res = await fetch(`/api/students/parents/${guardianId}/activity`);
      const json = await res.json();
      if (json?.success && json.data) {
        setActivity(json.data);
      }
    } catch {
      // ignore
    }
  };

  const fetchGuardian = async () => {
    if (!guardianId) return;
    try {
      const res = await fetch(`/api/students/parents/${guardianId}`);
      const json = await res.json();
      if (json.success) {
        setGuardian(json.data);
        setEditFields({
          firstName: json.data.firstName,
          lastName: json.data.lastName,
          email: json.data.email,
          phone: json.data.phone,
          occupation: json.data.occupation,
          address: json.data.address,
          emailOptIn: json.data.emailOptIn,
          smsOptIn: json.data.smsOptIn,
          preferredLanguage: json.data.preferredLanguage,
        });
      } else {
        setError(json.message ?? t('guardianNotFound'));
      }
    } catch (err) {
      console.error(err);
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardian();
    fetchPaymentsData();
    fetchActivityData();
  }, [guardianId]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityData();
    }
  }, [activeTab]);

  const loadAvailableStudents = async () => {
    try {
      const res = await fetch('/api/students?pageSize=200');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const linkedIds = new Set((guardian?.linkedStudents || []).map(s => s.studentId));
        const unlinked = json.data.filter((s: any) => !linkedIds.has(s.id));
        setAvailableStudents(unlinked.map((s: any) => ({
          id: s.id,
          fullName: s.fullName || s.name,
          matricule: s.matricule || null,
          className: s.className || null,
        })));
      }
    } catch (err) {
      console.error('Failed to load students', err);
    }
  };

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editFields.firstName?.trim() || !editFields.lastName?.trim()) {
      setSaveError(g('namesRequired'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/students/parents/${guardianId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFields.firstName.trim(),
          lastName: editFields.lastName.trim(),
          email: editFields.email?.trim() || null,
          phone: editFields.phone?.trim() || null,
          occupation: editFields.occupation?.trim() || null,
          address: editFields.address?.trim() || null,
          emailOptIn: editFields.emailOptIn ?? true,
          smsOptIn: editFields.smsOptIn ?? true,
          preferredLanguage: editFields.preferredLanguage || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSaveError(json.message ?? t('saveError'));
        return;
      }
      toast.success(g('profileSaved'));
      setGuardian(prev => prev ? { ...prev, ...json.data } : null);
      setShowEditDialog(false);
    } catch (err) {
      console.error(err);
      setSaveError(t('connectionError'));
    } finally {
      setSaving(false);
    }
  }

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setLinkingChild(true);
    setLinkChildError(null);
    try {
      const res = await fetch('/api/students/parents/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardianId,
          studentId: selectedStudentId,
          relationshipType: selectedRelationship,
          isPrimaryContact: linkIsPrimary,
          isFinanciallyResponsible: linkIsFinancial,
          canPickup: linkCanPickup,
          isEmergencyContact: linkIsEmergency,
          emergencyPriority: linkIsEmergency ? linkEmergencyPriority : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLinkChildError(json.message || g('linkError'));
        return;
      }
      toast.success('Élève rattaché avec succès');
      setShowLinkChildDialog(false);
      setSelectedStudentId('');
      await fetchGuardian();
      await fetchPaymentsData();
      // refresh activity
      fetch(`/api/students/parents/${guardianId}/activity`).then(r => r.json()).then(j => j?.success && setActivity(j.data));
    } catch {
      setLinkChildError(g('networkError'));
    } finally {
      setLinkingChild(false);
    }
  };

  async function handleUnlink() {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/students/parents/link?guardianId=${guardianId}&studentId=${unlinkTarget.studentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message ?? t('unlinkError'));
        return;
      }
      toast.success(g('unlinked'));
      setGuardian(prev => prev
        ? { ...prev, linkedStudents: prev.linkedStudents.filter(s => s.linkId !== unlinkTarget.linkId) }
        : null,
      );
      setUnlinkTarget(null);
      await fetchGuardian();
      await fetchPaymentsData();
      // refresh activity
      fetch(`/api/students/parents/${guardianId}/activity`).then(r => r.json()).then(j => j?.success && setActivity(j.data));
    } catch (err) {
      console.error(err);
      toast.error(t('connectionError'));
    } finally {
      setUnlinking(false);
    }
  }

  useEffect(() => {
    if (!guardianId) return;
    if (activeTab === 'payments' && payments === null) {
      fetch(`/api/students/parents/${guardianId}/payments`).then(r => r.json()).then(j => j?.success && setPayments(j.data));
    }
    if (activeTab === 'activity' && activity === null) {
      fetch(`/api/students/parents/${guardianId}/activity`).then(r => r.json()).then(j => j?.success && setActivity(j.data));
    }
  }, [activeTab, guardianId, payments, activity]);

  async function handleLinkFieldChange(
    student: LinkedStudent,
    patch: {
      emergencyPriority?: number | null;
      canPickup?: boolean;
      isPrimaryContact?: boolean;
      isEmergencyContact?: boolean;
      isFinanciallyResponsible?: boolean;
    },
  ) {
    setGuardian(prev => prev
      ? {
          ...prev,
          linkedStudents: prev.linkedStudents.map(s => {
            if (patch.isPrimaryContact && s.studentId === student.studentId) {
              return { ...s, ...patch };
            }
            return s.linkId === student.linkId ? { ...s, ...patch } : s;
          }),
        }
      : null);
    try {
      const res = await fetch('/api/students/parents/link', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianId, studentId: student.studentId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || g('updateError'));
        return;
      }
      toast.success(g('prefsSaved'));
      if (patch.isPrimaryContact !== undefined || patch.isFinanciallyResponsible !== undefined) {
        await fetchGuardian();
        await fetchPaymentsData();
      }
      fetch(`/api/students/parents/${guardianId}/activity`).then(r => r.json()).then(j => j?.success && setActivity(j.data));
    } catch {
      toast.error(g('updateError'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-[#2487B8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !guardian) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error ?? t('guardianNotFound')}</span>
      </div>
    );
  }

  const fullName = `${guardian.firstName} ${guardian.lastName}`;
  const initials = `${guardian.firstName[0] ?? ''}${guardian.lastName[0] ?? ''}`.toUpperCase();

  const now = Date.now();
  const activeFinancialStudents = (guardian.linkedStudents || []).filter(s => {
    if (!s.isFinanciallyResponsible) return false;
    if (s.status && s.status !== 'active') return false;
    if (s.effectiveFrom && new Date(s.effectiveFrom).getTime() > now) return false;
    if (s.effectiveTo && new Date(s.effectiveTo).getTime() <= now) return false;
    return true;
  });
  const financialCount = activeFinancialStudents.length;
  const hasFinancialResponsibility = financialCount > 0;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/${locale}/dashboard/students/parents`)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#1B6C93] font-semibold transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('backToGuardians')}
        </button>
      </div>

      {/* Header Profile card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white text-xl font-extrabold shrink-0 shadow-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{fullName}</h1>
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {t('childrenBadge', { count: guardian.linkedStudents.length })}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
                {guardian.phone && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-[#2487B8]" />
                    {guardian.phone}
                  </span>
                )}
                {guardian.email && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-[#2487B8]" />
                    {guardian.email}
                  </span>
                )}
                {guardian.occupation && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {guardian.occupation}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center w-full md:w-auto">
            {can('finance.manage') && (
              <Button
                size="sm"
                onClick={() => router.push(`/${locale}/dashboard/finance/collection-desk?parentId=${guardian.id}`)}
                className="h-9 rounded-full text-xs gap-1.5 bg-[#17A673] hover:bg-[#13885E] text-white font-bold shadow-xs transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                {t('btnCollectCash')}
              </Button>
            )}
            {can('students.guardians.manage') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditFields({
                    firstName: guardian.firstName,
                    lastName: guardian.lastName,
                    email: guardian.email,
                    phone: guardian.phone,
                    occupation: guardian.occupation,
                    address: guardian.address,
                    emailOptIn: guardian.emailOptIn,
                    smsOptIn: guardian.smsOptIn,
                    preferredLanguage: guardian.preferredLanguage,
                  });
                  setSaveError(null);
                  setShowEditDialog(true);
                }}
                className="h-9 rounded-full text-xs gap-1.5 border-slate-200 text-[#16212B] font-semibold hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5 text-[#2487B8]" />
                {t('btnEditProfile')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Financial Status Card — Truthful Responsibility */}
      {can('finance.read') && (
        <div className={`p-4 rounded-2xl border transition-all ${
          !hasFinancialResponsibility
            ? 'bg-slate-50 border-slate-200'
            : (paymentSummary?.outstandingBalance ?? 0) > 0
              ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border-amber-200 shadow-2xs'
              : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/30 to-white border-emerald-200 shadow-2xs'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                !hasFinancialResponsibility
                  ? 'bg-slate-200 text-slate-500'
                  : (paymentSummary?.outstandingBalance ?? 0) > 0
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-emerald-600 text-white shadow-xs'
              }`}>
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                {hasFinancialResponsibility ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('outstandingBalanceTitle')}
                      </span>
                      <Badge className={`text-[10px] font-extrabold px-2 py-0 ${
                        (paymentSummary?.outstandingBalance ?? 0) > 0
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {(paymentSummary?.outstandingBalance ?? 0) > 0
                          ? t('unpaidInvoices', { count: paymentSummary?.unpaidInvoicesCount ?? 0 })
                          : t('inGoodStanding')}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className={`text-2xl font-black font-mono tracking-tight ${
                        (paymentSummary?.outstandingBalance ?? 0) > 0 ? 'text-amber-900' : 'text-emerald-900'
                      }`}>
                        {(paymentSummary?.outstandingBalance ?? 0).toLocaleString(intlLocale)} MAD
                      </span>
                      <span className="text-xs text-slate-400">
                        {(paymentSummary?.outstandingBalance ?? 0) > 0 ? t('remainingDue') : t('noArrears')}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#16212B] mt-1">
                      {financialCount === 1 ? t('financialResponsibilitySingle') : t('financialResponsibilityMultiple', { count: financialCount })}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('financialResponsibilityLabel')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">
                      {t('noFinancialResponsibility')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {g('notFinanciallyResponsible')}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              {can('finance.manage') && hasFinancialResponsibility && (paymentSummary?.outstandingBalance ?? 0) > 0 && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/${locale}/dashboard/finance/collection-desk?parentId=${guardian.id}`)}
                  className="h-9 px-4 rounded-xl text-xs font-bold bg-[#17A673] hover:bg-[#13885E] text-white gap-2 shadow-xs transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  {t('btnCollectCash')}
                </Button>
              )}
              {hasFinancialResponsibility && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('payments')}
                  className="h-9 px-3 rounded-xl text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  {t('btnViewStatement')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.filter(tab => tab.id !== 'payments' || can('finance.read')).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#16212B] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Children */}
      {activeTab === 'children' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h2 className="text-sm font-extrabold text-[#16212B]">{t('linkedStudentsSectionTitle')}</h2>
              <p className="text-[11px] text-slate-500">
                {t('linkedStudentsSectionDesc')}
              </p>
            </div>
            {(role === 'school_admin' || role === 'super_admin' || can('students.guardians.manage')) && (
              <Button
                size="sm"
                onClick={() => {
                  loadAvailableStudents();
                  setShowLinkChildDialog(true);
                }}
                className="h-9 rounded-full text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 shadow-2xs self-start sm:self-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t('linkChildBtn')}
              </Button>
            )}
          </div>

          {guardian.linkedStudents.length === 0 && (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Users className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-500">{t('noLinkedChildren')}</p>
              <p className="text-xs text-slate-400">{t('linkStudentHint')}</p>
              {(role === 'school_admin' || role === 'super_admin' || can('students.guardians.manage')) && (
                <Button
                  size="sm"
                  onClick={() => {
                    loadAvailableStudents();
                    setShowLinkChildDialog(true);
                  }}
                  className="rounded-full text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white mt-2"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  {t('linkChildBtn')}
                </Button>
              )}
            </Card>
          )}

          <div className="space-y-3">
            {guardian.linkedStudents.map(student => (
              <Card key={student.linkId} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DCEBF4] to-[#BEE0F2] flex items-center justify-center text-[#1B6C93] font-black text-sm shrink-0 shadow-2xs">
                      {student.studentName?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/${locale}/dashboard/students/${student.studentId}`}
                          className="text-base font-extrabold text-[#16212B] hover:text-[#2487B8] transition-colors truncate"
                        >
                          {student.studentName}
                        </Link>
                        <RelationBadge type={student.relationshipType} t={t} />
                        <button
                          type="button"
                          onClick={() => handleLinkFieldChange(student, { isPrimaryContact: !student.isPrimaryContact })}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                            student.isPrimaryContact
                              ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-300'
                              : 'text-slate-400 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:ring-1 hover:ring-amber-300'
                          }`}
                          title={student.isPrimaryContact ? g('primaryContact') : g('makePrimary')}
                        >
                          <Star className={`w-3 h-3 ${student.isPrimaryContact ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                          {student.isPrimaryContact ? t('badgePrimary') : `+ ${t('badgePrimary')}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLinkFieldChange(student, {
                            isEmergencyContact: !student.isEmergencyContact,
                            emergencyPriority: !student.isEmergencyContact ? (student.emergencyPriority ?? 1) : null,
                          })}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                            student.isEmergencyContact
                              ? 'text-rose-800 bg-rose-100 hover:bg-rose-200 ring-1 ring-rose-300'
                              : 'text-slate-400 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:ring-1 hover:ring-rose-300'
                          }`}
                          title={student.isEmergencyContact ? g('emergencyContact') : g('makeEmergency')}
                        >
                          <ShieldCheck className={`w-3 h-3 ${student.isEmergencyContact ? 'text-rose-600' : 'text-slate-400'}`} />
                          {student.isEmergencyContact ? t('badgeEmergency') : `+ ${t('badgeEmergency')}`}
                        </button>
                        {student.isFinanciallyResponsible && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-800 bg-emerald-100 ring-1 ring-emerald-300">
                            <CreditCard className="w-2.5 h-2.5 text-emerald-700" />
                            {t('badgeFinancial')}
                          </span>
                        )}
                      </div>
                      {student.studentMatricule && (
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono flex items-center gap-1.5">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600">
                            {t('matriculeLabel')} {student.studentMatricule}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for this child */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/${locale}/dashboard/students/${student.studentId}`)}
                      className="h-8 rounded-full text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:text-[#2487B8]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#2487B8]" />
                      {t('studentRecord')}
                    </Button>
                    {can('finance.manage') && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/${locale}/dashboard/finance/collection-desk?studentId=${student.studentId}&parentId=${guardian.id}`)}
                        className="h-8 rounded-full text-xs font-bold gap-1.5 bg-[#17A673] hover:bg-[#13885E] text-white shadow-2xs"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        {t('btnCollectCash')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnlinkTarget(student)}
                      className="h-8 rounded-full text-xs font-semibold gap-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      {t('unlinkAction')}
                    </Button>
                  </div>
                </div>

                {/* Sub-card: Permissions & Pickup */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs bg-slate-50/70 p-3 rounded-xl">
                  <div className="flex flex-wrap items-center gap-5">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={student.canPickup}
                        onChange={e => handleLinkFieldChange(student, { canPickup: e.target.checked })}
                        className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8] w-4 h-4"
                      />
                      <span>{t('authorizedToPickup')}</span>
                    </label>

                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={student.isFinanciallyResponsible}
                        onChange={e => handleLinkFieldChange(student, { isFinanciallyResponsible: e.target.checked })}
                        className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8] w-4 h-4"
                      />
                      <span>{t('financialResponsibilityLabel')}</span>
                    </label>

                    <div className="flex items-center gap-2 font-semibold text-slate-700">
                      <span className="text-slate-500">{t('emergencyPriorityLabel')}</span>
                      <select
                        value={student.emergencyPriority ?? ''}
                        onChange={e => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          handleLinkFieldChange(student, {
                            emergencyPriority: val,
                            isEmergencyContact: val !== null,
                          });
                        }}
                        className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-[#16212B]"
                      >
                        <option value="">{`— ${g('notSet')} —`}</option>
                        <option value="1">{g('priority1')}</option>
                        <option value="2">{g('priorityN', { n: 2 })}</option>
                        <option value="3">{g('priorityN', { n: 3 })}</option>
                      </select>
                    </div>
                  </div>

                  {student.coGuardians && student.coGuardians.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600">{t('coGuardiansLabel')}</span>{' '}
                      <span className="font-medium text-slate-700">{student.coGuardians.map(g => g.name).join(', ')}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#16212B]">{t('personalInfoTitle')}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditFields({
                  firstName: guardian.firstName,
                  lastName: guardian.lastName,
                  email: guardian.email,
                  phone: guardian.phone,
                  occupation: guardian.occupation,
                  address: guardian.address,
                  emailOptIn: guardian.emailOptIn,
                  smsOptIn: guardian.smsOptIn,
                  preferredLanguage: guardian.preferredLanguage,
                });
                setSaveError(null);
                setShowEditDialog(true);
              }}
              className="h-8 rounded-full text-xs gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5 text-[#2487B8]" />
              {t('btnEdit')}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon: User, label: t('firstName'), value: guardian.firstName },
              { icon: User, label: t('lastName'), value: guardian.lastName },
              { icon: Mail, label: t('email'), value: guardian.email },
              { icon: Phone, label: t('phone'), value: guardian.phone },
              { icon: Briefcase, label: t('occupationField'), value: guardian.occupation },
              { icon: MapPin, label: t('addressField'), value: guardian.address, full: true },
            ].map(f => (
              f.value
                ? (
                  <div key={f.label} className={f.full ? 'sm:col-span-2' : ''}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <f.icon className="w-3 h-3" />
                      {f.label}
                    </label>
                    <p className="text-sm font-semibold text-[#16212B] mt-0.5">{f.value}</p>
                  </div>
                )
                : null
            ))}
            <div className="sm:col-span-2 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t('communicationPreferences')}</label>
              <p className="text-sm font-semibold text-[#16212B] mt-0.5">
                {[guardian.emailOptIn && g('channelEmail'), guardian.smsOptIn && 'SMS'].filter(Boolean).join(' · ') || t('langNone')}
                {guardian.preferredLanguage && ` · ${t('langPrefix')} ${guardian.preferredLanguage === 'fr' ? t('frenchLang') : guardian.preferredLanguage === 'ar' ? t('arabicLang') : guardian.preferredLanguage === 'en' ? t('englishLang') : guardian.preferredLanguage.toUpperCase()}`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Payments */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#16212B]">{t('paymentsSectionTitle')}</h3>
              <p className="text-[11px] text-slate-500">
                {t('paymentsSectionDesc')}
              </p>
            </div>
            {can('finance.manage') && (
              <Button
                size="sm"
                onClick={() => router.push(`/${locale}/dashboard/finance/collection-desk?parentId=${guardian.id}`)}
                className="h-9 rounded-full text-xs font-bold gap-1.5 bg-[#17A673] hover:bg-[#13885E] text-white shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <Wallet className="w-3.5 h-3.5" />
                {t('openCashDesk')}
              </Button>
            )}
          </div>

          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {payments === null && (
              <div className="p-12 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-4 border-[#2487B8] border-t-transparent animate-spin" />
              </div>
            )}
            {payments !== null && payments.length === 0 && (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
                <Wallet className="w-10 h-10 text-slate-200" />
                <p className="text-sm font-bold text-slate-400">{t('noPaymentsRecorded')}</p>
              </div>
            )}
            {payments !== null && payments.length > 0 && (
              <table className="w-full text-left rtl:text-right text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-4">{t('colType')}</th>
                    <th className="py-2.5 px-4">{t('colStudent')}</th>
                    <th className="py-2.5 px-4">{t('colAmount')}</th>
                    <th className="py-2.5 px-4">{t('colStatus')}</th>
                    <th className="py-2.5 px-4">{t('colDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map(p => (
                    <tr key={`${p.type}-${p.id}`}>
                      <td className="py-2.5 px-4 font-bold text-[#16212B]">{p.type === 'invoice' ? t('invoiceType') : t('paymentType')}</td>
                      <td className="py-2.5 px-4 text-slate-600">{p.studentName}</td>
                      <td className="py-2.5 px-4 font-mono">{p.amount.toLocaleString(intlLocale)} MAD</td>
                      <td className="py-2.5 px-4 text-slate-500">{p.status}</td>
                      <td className="py-2.5 px-4 text-slate-400">{new Date(p.date).toLocaleDateString(intlLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Activity */}
      {activeTab === 'activity' && (
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {activity === null && (
            <div className="p-12 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-4 border-[#2487B8] border-t-transparent animate-spin" />
            </div>
          )}
          {activity !== null && activity.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('noRecentActivity')}</p>
            </div>
          )}
          {activity !== null && activity.length > 0 && (
            <div className="divide-y divide-slate-100">
              {activity.map((a, i) => (
                <div key={i} className="p-3.5 flex items-start sm:items-center gap-3 text-xs">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#16212B]">{a.description || a.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {a.entityType.toLowerCase() === 'guardian_student'
                          ? t('entityTypeGuardianStudent')
                          : a.entityType.toLowerCase() === 'guardian'
                            ? t('entityTypeGuardian')
                            : a.entityType}
                      </span>
                      {Boolean((a.metadata as Record<string, unknown> | null)?.studentName) && (
                        <span className="text-[10px] font-semibold text-[#2487B8] bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                          Élève : {String((a.metadata as Record<string, unknown>).studentName)}
                        </span>
                      )}
                      {a.actorName && (
                        <span className="text-[10px] text-slate-500">· Par {a.actorName}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-400 text-[11px] shrink-0 font-medium">{new Date(a.createdAt).toLocaleString(intlLocale)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* EDIT PROFILE MODAL */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-xl bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#2487B8]" />
              {g('editTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 my-2 text-xs">
            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{g('firstName')}</label>
                <Input
                  required
                  value={editFields.firstName ?? ''}
                  onChange={e => setEditFields(prev => ({ ...prev, firstName: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                  placeholder={g('firstNamePlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{g('lastName')}</label>
                <Input
                  required
                  value={editFields.lastName ?? ''}
                  onChange={e => setEditFields(prev => ({ ...prev, lastName: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                  placeholder={g('lastNamePlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{g('phone')}</label>
                <Input
                  value={editFields.phone ?? ''}
                  onChange={e => setEditFields(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                  placeholder={g('phonePlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">{g('email')}</label>
                <Input
                  type="email"
                  value={editFields.email ?? ''}
                  onChange={e => setEditFields(prev => ({ ...prev, email: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                  placeholder={g('emailPlaceholder')}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 block">{g('profession')}</label>
                <Input
                  value={editFields.occupation ?? ''}
                  onChange={e => setEditFields(prev => ({ ...prev, occupation: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                  placeholder={g('professionPlaceholder')}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 block">{g('address')}</label>
                <textarea
                  rows={2}
                  value={editFields.address ?? ''}
                  onChange={e => setEditFields(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white resize-none focus:outline-none focus:border-[#2487B8]"
                  placeholder={g('addressPlaceholder')}
                />
              </div>

              <div className="space-y-2 sm:col-span-2 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">{g('commPrefs')}</label>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFields.emailOptIn ?? true}
                      onChange={e => setEditFields(prev => ({ ...prev, emailOptIn: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    {g('allowEmails')}
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFields.smsOptIn ?? true}
                      onChange={e => setEditFields(prev => ({ ...prev, smsOptIn: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    {g('allowSms')}
                  </label>
                  <select
                    value={editFields.preferredLanguage ?? ''}
                    onChange={e => setEditFields(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    <option value="">{g('defaultLanguage')}</option>
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="rounded-full text-xs h-9"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={saving || !editFields.firstName?.trim() || !editFields.lastName?.trim()}
                className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
              >
                {saving ? g('saving') : g('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* LINK CHILD MODAL */}
      <Dialog open={showLinkChildDialog} onOpenChange={setShowLinkChildDialog}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#2487B8]" />
              {g('linkTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleLinkChild} className="space-y-4 my-2 text-xs">
            {linkChildError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {linkChildError}
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">{g('selectStudent')}</label>
              <select
                required
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
              >
                <option value="">{`-- ${g('chooseStudent')} --`}</option>
                {availableStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} {s.matricule ? `(${s.matricule})` : ''} {s.className ? `· ${s.className}` : ''}
                  </option>
                ))}
              </select>
              {availableStudents.length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  {g('loadingStudents')}
                </p>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{g('relationship')}</label>
              <select
                value={selectedRelationship}
                onChange={e => setSelectedRelationship(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B]"
              >
                {(['Parent', 'Père', 'Mère', 'Tuteur', 'Grand-parent', 'Autre'] as const).map(value => (
                  <option key={value} value={value}>{relationLabel(value)}</option>
                ))}
              </select>
            </div>

            {/* Responsabilités & Permissions */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Responsabilités &amp; Droits opérationnels
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={linkIsPrimary}
                    onChange={e => setLinkIsPrimary(e.target.checked)}
                    className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8] w-4 h-4"
                  />
                  <span>{t('primaryContactLabel')}</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={linkIsFinancial}
                    onChange={e => setLinkIsFinancial(e.target.checked)}
                    className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8] w-4 h-4"
                  />
                  <span>{t('financialResponsibilityLabel')}</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={linkCanPickup}
                    onChange={e => setLinkCanPickup(e.target.checked)}
                    className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8] w-4 h-4"
                  />
                  <span>{t('authorizedToPickup')}</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={linkIsEmergency}
                    onChange={e => setLinkIsEmergency(e.target.checked)}
                    className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8] accent-[#2487B8] w-4 h-4"
                  />
                  <span>{t('emergencyContactLabel')}</span>
                </label>
              </div>

              {linkIsEmergency && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-600 font-medium">{g('emergencyPriority')}</span>
                  <select
                    value={linkEmergencyPriority}
                    onChange={e => setLinkEmergencyPriority(Number(e.target.value))}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                  >
                    <option value={1}>{g('priority1')}</option>
                    <option value={2}>{g('priorityN', { n: 2 })}</option>
                    <option value={3}>{g('priorityN', { n: 3 })}</option>
                  </select>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLinkChildDialog(false)}
                className="rounded-full text-xs h-9"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={linkingChild || !selectedStudentId}
                className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
              >
                {linkingChild ? g('linking') : g('confirmLink')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unlink confirm dialog */}
      <Dialog open={!!unlinkTarget} onOpenChange={open => !open && setUnlinkTarget(null)}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              {g('unlinkTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-slate-600 mt-2 space-y-2.5">
            <p>
              {g('unlinkQuestion')} <strong>{unlinkTarget?.studentName ?? ''}</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[11px]">
              <li>{g('unlinkNote1')}</li>
              <li>{g('unlinkNote2')}</li>
              <li>{g('unlinkNote3')}</li>
            </ul>
          </div>
          <DialogFooter className="gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setUnlinkTarget(null)} className="rounded-full text-xs h-9">
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={unlinking}
              onClick={handleUnlink}
              className="rounded-full text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white border-0 font-bold"
            >
              {unlinking ? g('unlinking') : g('confirmUnlink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
