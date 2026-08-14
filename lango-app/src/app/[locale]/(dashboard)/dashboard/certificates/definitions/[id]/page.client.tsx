'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { TemplateDesigner } from '@/libs/document-studio/TemplateDesigner';
import { CERTIFICATE_FIELD_ALLOWLIST } from '@/features/certificates/ui/allowlist';

export default function CertificateDefinitionDesignerPage({
  params: { locale, id }
}: {
  params: { locale: string, id: string }
}) {
  const router = useRouter();
  const [definition, setDefinition] = useState<any>(null);
  const [latestVersion, setLatestVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/certificates/definitions/${id}`).then(r => r.json()),
      fetch(`/api/certificates/definitions/${id}/versions`).then(r => r.json()),
    ])
    .then(([dRes, vRes]) => {
      if (dRes.success && vRes.success) {
        setDefinition(dRes.data);
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
      const res = await fetch(`/api/certificates/definitions/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaJson,
          fieldAllowlist: CERTIFICATE_FIELD_ALLOWLIST,
          publish,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLatestVersion(data.data);
        if (publish) {
          alert('Version publiée avec succès !');
          router.push(`/${locale}/dashboard/certificates/definitions`);
        }
      } else {
        alert(data.message || 'Erreur lors de l\'enregistrement');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Chargement...</div>;
  }

  if (!definition || !latestVersion) {
    return <div className="p-8 text-center text-red-500">Définition introuvable.</div>;
  }

  const allowlist = latestVersion.fieldAllowlist?.allowedFields?.length
    ? latestVersion.fieldAllowlist
    : CERTIFICATE_FIELD_ALLOWLIST;

  return (
    <div className="flex flex-col h-dvh bg-slate-50">
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/certificates/definitions`)}
            className="text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{definition.title}</h1>
            <p className="text-xs text-slate-500">
              Version {latestVersion.versionNumber} • {latestVersion.status === 'active' ? 'Publiée' : 'Brouillon'} •
              Bénéficiaires : {definition.allowedTargetType === 'student' ? 'Élèves' : 'Employés'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => handleSave(latestVersion.schemaJson, true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer shadow-sm rounded-xl text-xs h-9"
          >
            <CheckCircle2 className="w-4 h-4" /> Publier
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
