'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2 } from 'lucide-react';
import { api } from './reception-api';

type DuplicateCandidate = { id: string; contactName: string; phone: string | null; email: string | null; status: string };

type Inquiry = {
  id: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
};

export function ReceptionInquiryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (inquiry: Inquiry) => void;
}) {
  const t = useTranslations('Reception');

  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('walk_in');
  const [interestLevel, setInterestLevel] = useState('medium');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);

  const reset = () => {
    setContactName('');
    setPhone('');
    setEmail('');
    setSource('walk_in');
    setInterestLevel('medium');
    setNotes('');
    setError(null);
    setDuplicates([]);
  };

  const submit = async () => {
    if (contactName.trim().length === 0) {
      setError(t('errContactNameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api<Inquiry & { candidates?: DuplicateCandidate[] }>('/api/reception/inquiries', {
      method: 'POST',
      body: {
        contactName: contactName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source,
        interestLevel,
        notes: notes.trim() || null,
      },
    });
    setSubmitting(false);
    if (res.ok && res.data) {
      onCreated(res.data);
      reset();
      onOpenChange(false);
      return;
    }
    if (res.status === 409 && res.error && (res.error as { candidates?: DuplicateCandidate[] }).candidates) {
      setDuplicates((res.error as { candidates?: DuplicateCandidate[] }).candidates ?? []);
      setError(t('duplicateInquiryNotice'));
      return;
    }
    setError(res.error?.message ?? t('actionFailed'));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="inquiry-dialog-desc">
        <DialogHeader>
          <DialogTitle>{t('newInquiryTitle')}</DialogTitle>
          <DialogDescription id="inquiry-dialog-desc">
            {t('newInquiryDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inq-name">{t('labelFullName')}</Label>
              <Input id="inq-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t('phContactName')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inq-source">{t('labelSource')}</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="inq-source" aria-label={t('labelSource')}><SelectValue placeholder={t('labelSource')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk_in">{t('sourceWalkIn')}</SelectItem>
                  <SelectItem value="phone">{t('sourcePhone')}</SelectItem>
                  <SelectItem value="web">{t('sourceWeb')}</SelectItem>
                  <SelectItem value="referral">{t('sourceReferral')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inq-phone">{t('labelPhone')}</Label>
              <Input id="inq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phPhone')} inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inq-email">{t('labelEmail')}</Label>
              <Input id="inq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('phContactEmail')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inq-interest">{t('labelInterestLevel')}</Label>
              <Select value={interestLevel} onValueChange={setInterestLevel}>
                <SelectTrigger id="inq-interest" aria-label={t('labelInterestLevel')}><SelectValue placeholder={t('labelInterestLevel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t('interestHigh')}</SelectItem>
                  <SelectItem value="medium">{t('interestMedium')}</SelectItem>
                  <SelectItem value="low">{t('interestLow')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inq-notes">{t('labelNotes')}</Label>
            <Textarea id="inq-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('phInquiryNotes')} />
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-rose-600" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error}
                {duplicates.length > 0 && (
                  <span className="mt-1 block text-xs text-slate-500">
                    {duplicates.map((d) => `${d.contactName} (${d.phone ?? d.email ?? '—'})`).join(' · ')}
                  </span>
                )}
              </span>
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('btnCancel')}</Button>
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t('btnRegister')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
