'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, CheckCircle2, Download, ExternalLink, Loader2 } from 'lucide-react';

type Definition = {
  id: string;
  title: string;
  description: string | null;
  allowedTargetType: 'student' | 'employee';
  status: string;
};

type Version = { id: string; versionNumber: number; status: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientType: 'student' | 'employee';
  recipientId: string;
  recipientLabel: string;
  recipientName: string;
};

type IssueResult = {
  rawToken: string;
  pdfBase64?: string;
};

export function IssueCertificateDialog(props: Props) {
  const { open, onOpenChange, recipientType, recipientId, recipientLabel, recipientName } = props;

  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedDefinitionId('');
    setPublishedVersionId(null);
    setError(null);
    setResult(null);
    setCopied(false);
    fetch(`/api/certificates/definitions?targetType=${recipientType}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setDefinitions(j.data.filter((d: Definition) => d.status !== 'archived'));
        }
      });
  }, [open, recipientType]);

  const selectDefinition = async (definitionId: string) => {
    setSelectedDefinitionId(definitionId);
    setPublishedVersionId(null);
    const res = await fetch(`/api/certificates/definitions/${definitionId}/versions`).then(r => r.json());
    if (res.success) {
      const active = res.data.find((v: Version) => v.status === 'active');
      setPublishedVersionId(active ? active.id : null);
    }
  };

  const handleIssue = async () => {
    if (!publishedVersionId) return;
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definitionId: selectedDefinitionId,
          definitionVersionId: publishedVersionId,
          recipientType,
          recipientId,
          ruleType: 'manual_authorized',
          ruleParams: {},
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || json.error?.message || 'Erreur lors de l\'émission.');
        return;
      }
      setResult(json.data);
    } catch {
      setError('Connexion impossible.');
    } finally {
      setIssuing(false);
    }
  };

  const copyToken = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!issuing) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Émettre un certificat</DialogTitle>
          <DialogDescription>
            {recipientLabel} : <strong>{recipientName}</strong>
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-[#DDF5EC] p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#17A673]" />
                <p className="text-sm font-extrabold text-[#17A673]">Certificat émis avec succès</p>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Le jeton de vérification ne sera affiché qu'une fois. Conservez-le pour la vérification du certificat.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 font-mono text-[10px] text-slate-700 bg-white border border-emerald-200 rounded-lg px-3 py-2 break-all">
                  {result.rawToken}
                </code>
                <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={copyToken}>
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#17A673]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copié' : 'Copier'}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {result.pdfBase64 ? (
                <a
                  href={`data:application/pdf;base64,${result.pdfBase64}`}
                  download={`certificat-${recipientId}.pdf`}
                  className="inline-flex items-center justify-center gap-1.5 h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Download className="w-4 h-4" />Télécharger le PDF
                </a>
              ) : (
                <p className="text-[11px] font-semibold text-amber-600 text-center">
                  PDF non généré automatiquement. Téléchargez-le depuis « Certificats émis ».
                </p>
              )}
              <a
                href={`/fr/verify/certificate/${result.rawToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-10 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />Tester la page de vérification
              </a>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Définition de certificat</Label>
              <Select value={selectedDefinitionId} onValueChange={selectDefinition}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choisir une définition" />
                </SelectTrigger>
                <SelectContent>
                  {definitions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">Aucune définition pour ce type.</p>
                  ) : (
                    definitions.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">{d.title}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedDefinitionId && !publishedVersionId && (
                <p className="text-[11px] font-semibold text-amber-600">
                  Cette définition n'a pas de version publiée (active). Publiez-la depuis « Définitions » avant de l'émettre.
                </p>
              )}
            </div>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-9 cursor-pointer">
              Fermer
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-9 cursor-pointer" disabled={issuing}>
                Annuler
              </Button>
              <Button
                className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer"
                onClick={handleIssue}
                disabled={issuing || !publishedVersionId}
              >
                {issuing && <Loader2 className="w-4 h-4 animate-spin" />}
                {issuing ? 'Émission...' : 'Émettre le certificat'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
