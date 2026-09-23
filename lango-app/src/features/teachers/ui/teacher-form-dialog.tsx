'use client';

import type { TeacherDetail, TeacherDirectoryItem, TeacherFilterOptions, TeacherFormValues, TeacherProvisioning } from '../model/types';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTeacherRequest, updateTeacherRequest } from '../data/directory-api';
import {
  EMPTY_TEACHER_FORM,

} from '../model/types';

type EditableTeacher = TeacherDirectoryItem | TeacherDetail;

function isDetail(teacher: EditableTeacher): teacher is TeacherDetail {
  return 'documents' in teacher;
}

function toForm(teacher: EditableTeacher): TeacherFormValues {
  const detail = isDetail(teacher) ? teacher : null;
  const hasDocument = (type: string) => !teacher.dossier.missingDocuments.includes(type);
  return {
    fullName: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    employeeId: teacher.employeeId,
    specialization: teacher.specialization,
    cycle: detail?.cycle ?? '',
    hireDate: detail?.hireDate ?? '',
    dateOfBirth: detail?.sensitiveHr?.dateOfBirth ?? '',
    gender: '',
    nationalId: detail?.sensitiveHr?.nationalId ?? '',
    address: detail?.sensitiveHr?.address ?? '',
    city: detail?.sensitiveHr?.city ?? '',
    qualification: detail?.qualification ?? '',
    salary: detail?.sensitiveHr?.salary ?? '',
    branchId: teacher.branchId ?? '',
    contract: hasDocument('contract'),
    cin: hasDocument('cin'),
    diploma: hasDocument('diploma'),
  };
}

/**
 * Create / edit teacher dialog.
 *
 * Creation goes through the authoritative onboarding path: branch assignment,
 * tenant-scoped employee id, HR profile link when one exists, and an account
 * activation token + queued SMS when a phone number is provided (the one-time
 * setup link is shown once so the admin can copy it).
 *
 * Failures keep the dialog open and display the API message — the dialog never
 * closes optimistically.
 */
export function TeacherFormDialog({
  open,
  onOpenChange,
  editing,
  options,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EditableTeacher | null;
  options: TeacherFilterOptions | null;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const [form, setForm] = useState<TeacherFormValues>(EMPTY_TEACHER_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState<TeacherProvisioning | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? toForm(editing) : EMPTY_TEACHER_FORM);
      setError(null);
      setProvisioning(null);
      setCopied(false);
    }
  }, [open, editing]);

  const set = <K extends keyof TeacherFormValues>(key: K, value: TeacherFormValues[K]) =>
    setForm(previous => ({ ...previous, [key]: value }));

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      setError(t('fullNameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = editing
      ? await updateTeacherRequest(editing.id, form)
      : await createTeacherRequest(form);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (editing) {
      onSaved(t('updateSuccess'));
      onOpenChange(false);
      return;
    }

    const created = result.data as { teacher: TeacherDirectoryItem; provisioning: TeacherProvisioning };
    onSaved(t('createSuccess'));
    if (created.provisioning.setupUrl) {
      // Keep the dialog open so the one-time activation link can be copied.
      setProvisioning(created.provisioning);
    } else {
      onOpenChange(false);
    }
  };

  const copySetupUrl = async () => {
    if (!provisioning?.setupUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${provisioning.setupUrl}`);
      setCopied(true);
      setTimeout(setCopied, 2000, false);
    } catch {
      setCopied(false);
    }
  };

  const showBranchSelect = (options?.branches.length ?? 0) > 0;
  // Sensitive HR fields (CIN, birth date, salary) only when creating (the
  // caller is school_admin) or when the server actually included them in the
  // detail payload (hr.sensitive.read present).
  const canSeeSensitive = !editing || (isDetail(editing) && editing.sensitiveHr !== null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="
        max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6
      "
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold text-[#16212B]">
            {editing ? t('editTeacher') : t('createTeacher')}
          </DialogTitle>
        </DialogHeader>

        {provisioning
          ? (
              <div className="my-2 space-y-3">
                <p className="
                  rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold
                  text-emerald-700
                "
                >
                  {t('createSuccessProvisioned')}
                </p>
                <div className="
                  rounded-xl border border-slate-200 bg-slate-50 p-3
                "
                >
                  <p className="text-[11px] font-bold text-slate-600">{t('setupLinkLabel')}</p>
                  <p className="
                    mt-1 font-mono text-[10px] break-all text-slate-500
                  "
                  >
                    {window.location.origin}
                    {provisioning.setupUrl}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-9 gap-1.5 rounded-full text-xs"
                    onClick={copySetupUrl}
                  >
                    {copied
                      ? <Check className="size-3.5" />
                      : (
                          <Copy className="size-3.5" />
                        )}
                    {copied ? t('copied') : t('copySetupLink')}
                  </Button>
                </div>
              </div>
            )
          : (
              <div className="
                my-2 grid grid-cols-1 gap-3 text-xs
                sm:grid-cols-2
              "
              >
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-bold text-slate-700">{t('fullNameRequired')}</label>
                  <Input
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                {!editing && (
                  <>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">{t('email')}</label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => set('email', e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">{t('employeeIdLabel')}</label>
                      <Input
                        value={form.employeeId}
                        onChange={e => set('employeeId', e.target.value)}
                        placeholder={t('employeeIdAuto')}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('phone')}</label>
                  <Input
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                  {!editing && <p className="mt-1 text-[10px] text-slate-400">{t('phoneInviteHint')}</p>}
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('specialty')}</label>
                  <Input
                    value={form.specialization}
                    onChange={e => set('specialization', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                {showBranchSelect && (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">{t('filterBranch')}</label>
                    <Select value={form.branchId || '__none__'} onValueChange={value => set('branchId', value === '__none__' ? '' : value)}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue placeholder={t('filterBranch')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('branchUnassigned')}</SelectItem>
                        {(options?.branches ?? []).map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('hireDate')}</label>
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={e => set('hireDate', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('cycle')}</label>
                  <Input
                    value={form.cycle}
                    onChange={e => set('cycle', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('qualification')}</label>
                  <Input
                    value={form.qualification}
                    onChange={e => set('qualification', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                {!editing && (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">{t('gender')}</label>
                    <Select value={form.gender || '__none__'} onValueChange={value => set('gender', value === '__none__' ? '' : value)}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('notSpecified')}</SelectItem>
                        <SelectItem value="female">{t('genderFemale')}</SelectItem>
                        <SelectItem value="male">{t('genderMale')}</SelectItem>
                        <SelectItem value="other">{t('genderOther')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('city')}</label>
                  <Input
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-bold text-slate-700">{t('address')}</label>
                  <Input
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                {canSeeSensitive && (
                  <>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">{t('cin')}</label>
                      <Input
                        value={form.nationalId}
                        onChange={e => set('nationalId', e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">{t('dateOfBirth')}</label>
                      <Input
                        type="date"
                        value={form.dateOfBirth}
                        onChange={e => set('dateOfBirth', e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">{t('salaryMad')}</label>
                      <Input
                        type="number"
                        value={form.salary}
                        onChange={e => set('salary', e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </>
                )}

                <div className="
                  rounded-xl border border-slate-100 bg-slate-50 p-3
                  sm:col-span-2
                "
                >
                  <p className="mb-2 font-bold text-slate-700">{t('providedDocs')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['contract', t('docContract')],
                      ['cin', t('docCin')],
                      ['diploma', t('docDiploma')],
                    ] as const).map(([key, label]) => (
                      <label
                        key={key}
                        className="
                          flex items-center gap-2 font-medium text-slate-600
                        "
                      >
                        <input
                          type="checkbox"
                          checked={form[key]}
                          onChange={e => set(key, e.target.checked)}
                          className="size-4 accent-[#0066FF]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

        {error && (
          <p
            role="alert"
            className="
              rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs
              font-semibold text-rose-700
            "
          >
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          {provisioning
            ? (
                <Button
                  variant="primary"
                  onClick={() => onOpenChange(false)}
                  className="h-9 rounded-full bg-[#0066FF] text-xs text-white"
                >
                  {tCommon('close')}
                </Button>
              )
            : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="h-9 rounded-full text-xs"
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={submitting || !form.fullName.trim()}
                    onClick={handleSubmit}
                    className="h-9 rounded-full bg-[#0066FF] text-xs text-white"
                  >
                    {submitting
                      ? (
                          <Loader2 className="me-1 size-3.5 animate-spin" />
                        )
                      : null}
                    {editing ? tCommon('save') : t('createTeacher')}
                  </Button>
                </>
              )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
