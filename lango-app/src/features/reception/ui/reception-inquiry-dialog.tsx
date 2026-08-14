'use client';

import { useState } from 'react';
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
      setError('Le nom du contact est requis.');
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
      setError('Une fiche identique existe déjà pour ce contact.');
      return;
    }
    setError(res.error?.message ?? 'Création impossible.');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="inquiry-dialog-desc">
        <DialogHeader>
          <DialogTitle>Nouvelle demande de renseignements</DialogTitle>
          <DialogDescription id="inquiry-dialog-desc">
            Enregistrer un visiteur ou un appel. Les doublons (téléphone / email) sont bloqués automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inq-name">Nom complet *</Label>
              <Input id="inq-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ex. Amina El Fassi" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inq-source">Canal</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="inq-source" aria-label="Canal de provenance"><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk_in">Visite / Accueil</SelectItem>
                  <SelectItem value="phone">Téléphone</SelectItem>
                  <SelectItem value="web">Site web</SelectItem>
                  <SelectItem value="referral">Recommandation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inq-phone">Téléphone</Label>
              <Input id="inq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inq-email">Email</Label>
              <Input id="inq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@exemple.ma" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inq-interest">Intérêt</Label>
              <Select value={interestLevel} onValueChange={setInterestLevel}>
                <SelectTrigger id="inq-interest" aria-label="Niveau d'intérêt"><SelectValue placeholder="Intérêt" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Élevé</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="low">Faible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inq-notes">Notes</Label>
            <Textarea id="inq-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objet de la demande, informations complémentaires…" />
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-rose-600" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error}
                {duplicates.length > 0 && (
                  <span className="mt-1 block text-xs text-slate-500">
                    {duplicates.map((d) => `${d.contactName} (${d.phone ?? d.email ?? 'sans coordonnées'})`).join(' · ')}
                  </span>
                )}
              </span>
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
