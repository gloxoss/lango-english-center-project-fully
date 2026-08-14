'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, Archive, Download, FileText, Loader2, Upload,
} from 'lucide-react';

type ApiErrorShape = { code?: string; message?: string };

type DocumentRow = {
  id: string;
  documentType: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  issuedAt: string | null;
  expiryDate: string | null;
  archivedAt: string | null;
  createdAt: string;
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contract: 'Contrat',
  cin: 'CIN',
  passport: 'Passeport',
  diploma: 'Diplôme',
  other: 'Autre',
};

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS);

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-MA');
}

export function EmployeeDocumentsView({ employeeId }: { employeeId: string }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [docType, setDocType] = useState('contract');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/employees/${employeeId}/documents`, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.data)) setDocs(json.data);
      else setError(json.error?.message ?? 'Impossible de charger les documents.');
    } catch {
      setError('Impossible de joindre le serveur.');
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Sélectionnez un fichier (JPG, PNG ou PDF, ≤ 5 Mo).');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('documentType', docType);
      if (issuedAt) fd.append('issuedAt', issuedAt);
      if (expiryDate) fd.append('expiryDate', expiryDate);
      fd.append('file', file);
      const res = await fetch(`/api/hr/employees/${employeeId}/documents`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setDocType('contract');
        setIssuedAt('');
        setExpiryDate('');
        setFile(null);
        await load();
      } else {
        setUploadError(json.error?.message ?? 'Téléversement impossible.');
      }
    } catch {
      setUploadError('Impossible de joindre le serveur.');
    }
    setUploading(false);
  };

  const toggleArchive = async (doc: DocumentRow) => {
    const res = await fetch(`/api/hr/employees/${employeeId}/documents/${doc.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: !doc.archivedAt }),
    });
    if (res.ok) await load();
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Ajouter un document</h3>
        <form onSubmit={upload} className="grid gap-4 md:grid-cols-4">
          <div>
            <Label className="mb-1 block text-sm font-medium text-slate-700">Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-slate-700">Date d&apos;émission</Label>
            <Input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-slate-700">Expiration</Label>
            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="text-sm"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="submit" disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
          </div>
          {uploadError && (
            <p className="flex items-center gap-1 text-sm text-red-600 md:col-span-4"><AlertCircle className="h-4 w-4" />{uploadError}</p>
          )}
        </form>
      </Card>

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Documents ({docs.length})</h3>
        {loading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        ) : error ? (
          <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>
        ) : docs.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">Aucun document. Utilisez le formulaire ci-dessus pour en ajouter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Document</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Émission</th>
                  <th className="py-2 pr-4 font-medium">Expiration</th>
                  <th className="py-2 pr-4 font-medium">Taille</th>
                  <th className="py-2 pr-4 font-medium">Statut</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="max-w-64 truncate py-3 pr-4 font-medium text-[#16212B]">
                      <span className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-slate-400" />{doc.originalName}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}</td>
                    <td className="py-3 pr-4 text-slate-600">{fmtDate(doc.issuedAt)}</td>
                    <td className="py-3 pr-4 text-slate-600">{fmtDate(doc.expiryDate)}</td>
                    <td className="py-3 pr-4 text-slate-600">{fmtBytes(doc.fileSize)}</td>
                    <td className="py-3 pr-4">
                      {doc.archivedAt
                        ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Archivé</span>
                        : <span className="rounded-full bg-[#D1F5E8] px-2 py-0.5 text-xs text-[#0b5c3a]">Actif</span>}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Télécharger" asChild>
                          <a href={`/api/hr/employees/${employeeId}/documents/${doc.id}`} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost" size="icon" title={doc.archivedAt ? 'Restaurer' : 'Archiver'}
                          onClick={() => toggleArchive(doc)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
