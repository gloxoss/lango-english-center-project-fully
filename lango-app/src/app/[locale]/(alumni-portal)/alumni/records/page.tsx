'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { FileText, Download, Copy } from 'lucide-react';

type Doc = { id: string; documentType: string; verificationCode: string; issuedAt: string };

const DOCUMENT_LABELS: Record<string, string> = {
  transcript: 'Relevé de notes',
  certificate: 'Certificat',
  attestation: 'Attestation',
};

export default function AlumniRecordsPage() {
  const pathname = usePathname();
  const locale = pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] ?? 'fr';
  const [docs, setDocs] = useState<Doc[] | null>(null);

  useEffect(() => {
    fetch('/api/alumni/me/records').then(r => r.json()).then(j => j?.success && setDocs(j.data));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Mes dossiers</h1>
        <p className="text-xs text-slate-500 mt-1">Vos documents officiels réels, avec code de vérification.</p>
      </div>

      <div className="space-y-2">
        {docs === null && <p className="text-xs text-slate-400">Chargement...</p>}
        {docs !== null && docs.length === 0 && (
          <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
            <FileText className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucun document pour le moment</p>
          </Card>
        )}
        {docs?.map(doc => (
          <Card key={doc.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#16212B]">{DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Délivré le {new Date(doc.issuedAt).toLocaleDateString('fr-FR')}</p>
              <p className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                <Copy className="w-3 h-3" />
                {doc.verificationCode}
              </p>
            </div>
            <a href={`/api/alumni/me/records/${doc.id}/download`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shrink-0">
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Besoin d&apos;une correction ou d&apos;une réémission ?
        {' '}
        <Link href={`/${locale}/alumni/requests`} className="text-[#2487B8] font-bold hover:underline">
          Faire une demande
        </Link>
      </p>
    </div>
  );
}
