'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { TemplateDesigner } from '@/libs/document-studio/TemplateDesigner';

// Field allowlists based on document type
const ALLOWLISTS: Record<string, { allowedFields: string[] }> = {
  student_id: { allowedFields: ['photo', 'firstName', 'lastName', 'dateOfBirth', 'qrCode', 'matricule', 'program', 'validUntil', 'title', 'subtitle'] },
  employee_id: { allowedFields: ['photo', 'firstName', 'lastName', 'department', 'role', 'qrCode', 'validUntil', 'title', 'subtitle'] },
  admit_card: { allowedFields: ['photo', 'firstName', 'lastName', 'dateOfBirth', 'matricule', 'barcode', 'examName', 'date', 'seatNumber', 'hall', 'title', 'subtitle', 'instructions'] },
};

export default function TemplateDesignerPage() {
  const t = useTranslations('Cards');
  const router = useRouter();
  const params = useParams<{ locale?: string; id?: string }>();
  const locale = params?.locale ?? 'fr';
  const id = params?.id ?? '';
  const [template, setTemplate] = useState<any>(null);
  const [latestVersion, setLatestVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cards/templates/${id}`).then(r => r.json()),
      fetch(`/api/cards/templates/${id}/versions`).then(r => r.json()),
    ])
    .then(([tRes, vRes]) => {
      if (tRes.success && vRes.success) {
        setTemplate(tRes.data);
        if (vRes.data.length > 0) {
          setLatestVersion(vRes.data[0]);
        }
      }
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (schemaJson: any, publish: boolean = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/templates/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaJson, publish }),
      });
      const data = await res.json();
      if (data.success) {
        setLatestVersion(data.data);
        if (publish) {
          alert(t('publishSuccess'));
          router.push(`/${locale}/dashboard/cards/templates`);
        }
      } else {
        alert(data.message || t('errorSaveTemplate'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">{t('loadingTemplates')}</div>;
  }

  if (!template || !latestVersion) {
    return <div className="p-8 text-center text-red-500">{t('templateNotFound')}</div>;
  }

  const allowlist = ALLOWLISTS[template.type] || { allowedFields: [] };

  return (
    <div className="flex flex-col h-dvh bg-slate-50">
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/cards/templates`)}
            className="text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" /> {t('btnBack')}
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{template.name}</h1>
            <p className="text-xs text-slate-500">
              {t('versionLabel', { 
                version: latestVersion.versionNumber, 
                status: template.status === 'draft' ? t('statusDraft') : t('statusPublished') 
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <Button 
            onClick={() => handleSave(latestVersion.schemaJson, true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer shadow-sm rounded-xl text-xs h-9"
          >
            <CheckCircle2 className="w-4 h-4" /> {t('btnPublish')}
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        <TemplateDesigner
          initialTemplate={latestVersion.schemaJson}
          allowlist={allowlist}
          onSave={(schema) => handleSave(schema, false)}
          isSaving={saving}
        />
      </div>
    </div>
  );
}
