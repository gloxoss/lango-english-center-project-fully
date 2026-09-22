'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

type Template = { id: string; name: string; type: string; status: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectType: 'student' | 'employee' | 'exam_candidate';
  templateType: 'student_id' | 'employee_id' | 'admit_card';
  subjectId: string;
  subjectLabel: string;
  subjectName: string;
};

type IssueResult = {
  rawToken: string;
  pdfBase64?: string;
};

export function IssueCardDialog(props: Props) {
  const { open, onOpenChange, subjectType, templateType, subjectId, subjectLabel, subjectName } = props;
  const t = useTranslations('Cards');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canReissue, setCanReissue] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedTemplateId('');
    setPublishedVersionId(null);
    setError(null);
    setCanReissue(false);
    setResult(null);
    setCopied(false);
    fetch(`/api/cards/templates?type=${templateType}`)
      .then(r => r.json())
      .then(j => { if (j.success) setTemplates(j.data); });
  }, [open, templateType]);

  const selectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPublishedVersionId(null);
    setCanReissue(false);
    const res = await fetch(`/api/cards/templates/${templateId}/versions`).then(r => r.json());
    if (res.success) {
      const published = res.data.find((v: any) => v.publishedById);
      setPublishedVersionId(published ? published.id : null);
    }
  };

  const handleIssue = async (isReissue = false) => {
    if (!publishedVersionId) return;
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch('/api/cards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateVersionId: publishedVersionId,
          subjectType,
          subjectId,
          reissue: isReissue,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        if (res.status === 409 || json.error?.code === 'ACTIVE_CARD_EXISTS') {
          setCanReissue(true);
        }
        setError(json.message || json.error?.message || t('errorIssueCard'));
        return;
      }
      setCanReissue(false);
      setResult(json.data);
    } catch {
      setError(t('connectionFailed'));
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('dialogIssueCardTitle')}</DialogTitle>
          <DialogDescription>
            {subjectLabel} : <strong>{subjectName}</strong>
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-[#DDF5EC] p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#17A673]" />
                <p className="text-sm font-extrabold text-[#17A673]">{t('cardIssuedSuccess')}</p>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {t('tokenSingleViewNotice')}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 font-mono text-[10px] text-slate-700 bg-white border border-emerald-200 rounded-lg px-3 py-2 break-all">
                  {result.rawToken}
                </code>
                <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={copyToken}>
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#17A673]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? t('btnCopied') : t('btnCopy')}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {result.pdfBase64 ? (
                <a
                  href={`data:application/pdf;base64,${result.pdfBase64}`}
                  download={`carte-${subjectId}.pdf`}
                  className="inline-flex items-center justify-center gap-1.5 h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Download className="w-4 h-4" />{t('btnDownloadPdfFull')}
                </a>
              ) : (
                <p className="text-[11px] font-semibold text-amber-600 text-center">
                  {t('pdfNotGeneratedWarning')}
                </p>
              )}
              <a
                href={`/${locale}/verify/card/${result.rawToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-10 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />{t('btnTestVerification')}
              </a>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">{t('selectTemplateLabel')}</Label>
              <Select value={selectedTemplateId} onValueChange={selectTemplate}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('chooseTemplatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">{t('noTemplateOfType')}</p>
                  ) : (
                    templates.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.id} className="text-xs">{tpl.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedTemplateId && !publishedVersionId && (
                <p className="text-[11px] font-semibold text-amber-600">
                  {t('noPublishedVersionWarning')}
                </p>
              )}
            </div>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-9 cursor-pointer">
              {t('btnClose')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-9 cursor-pointer" disabled={issuing}>
                {t('btnCancel')}
              </Button>
              {canReissue ? (
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer"
                  onClick={() => handleIssue(true)}
                  disabled={issuing || !publishedVersionId}
                >
                  {issuing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {issuing ? t('btnIssuing') : 'Réémettre la carte'}
                </Button>
              ) : (
                <Button
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer"
                  onClick={() => handleIssue(false)}
                  disabled={issuing || !publishedVersionId}
                >
                  {issuing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {issuing ? t('btnIssuing') : t('btnIssueCard')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
