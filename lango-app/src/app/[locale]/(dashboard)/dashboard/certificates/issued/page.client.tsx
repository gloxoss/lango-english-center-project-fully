'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileCheck2, RefreshCw, Download, Ban, Repeat2, Eye, Loader2 } from 'lucide-react';

type IssuedCert = {
  id: string;
  serialNumber: string;
  definitionId: string;
  versionId: string;
  recipientId: string;
  status: 'valid' | 'replaced' | 'revoked';
  issuedAt: string;
  issuedBy: string;
  definitionTitle: string;
  recipientName: string | null;
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' | 'warning' }> = {
  valid: { label: 'Valide', variant: 'success' },
  revoked: { label: 'Révoqué', variant: 'danger' },
  replaced: { label: 'Remplacé', variant: 'neutral' },
};

export default function CertificatesIssuedPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [docs, setDocs] = useState<IssuedCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [definitions, setDefinitions] = useState<Array<{ id: string; title: string }>>([]);
  const [definitionFilter, setDefinitionFilter] = useState('all');

  const [revokeTarget, setRevokeTarget] = useState<IssuedCert | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const [replaceTarget, setReplaceTarget] = useState<IssuedCert | null>(null);
  const [replaceReason, setReplaceReason] = useState('');
  const [replacing, setReplacing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params2 = new URLSearchParams();
      if (statusFilter !== 'all') params2.set('status', statusFilter);
      if (definitionFilter !== 'all') params2.set('definitionId', definitionFilter);
      const res = await fetch(`/api/certificates/issued?${params2.toString()}`).then(r => r.json());
      if (res.success) setDocs(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch('/api/certificates/definitions').then(r => r.json())
      .then(j => { if (j.success) setDefinitions(j.data.filter((d: any) => d.status !== 'archived')); });
  }, [statusFilter, definitionFilter]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const d of docs) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    return byStatus;
  }, [docs]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/certificates/issued/${revokeTarget.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || json.error?.message || 'Erreur lors de la révocation');
      }
      setRevokeTarget(null);
      setRevokeReason('');
      await load();
    } finally {
      setRevoking(false);
    }
  };

  const handleReplace = async () => {
    if (!replaceTarget) return;
    setReplacing(true);
    try {
      const res = await fetch(`/api/certificates/issued/${replaceTarget.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: replaceReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || json.error?.message || 'Erreur lors du remplacement');
      }
      setReplaceTarget(null);
      setReplaceReason('');
      await load();
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Certificats émis</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Téléchargez, remplacez et révoquez les certificats émis.</p>
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{docs.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valides</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{counts.valid ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Révoqués</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{counts.revoked ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Ban className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remplacés</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{counts.replaced ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><Repeat2 className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Filters + table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tous les statuts</SelectItem>
              <SelectItem value="valid" className="text-xs">Valide</SelectItem>
              <SelectItem value="revoked" className="text-xs">Révoqué</SelectItem>
              <SelectItem value="replaced" className="text-xs">Remplacé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={definitionFilter} onValueChange={setDefinitionFilter}>
            <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder="Toutes les définitions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Toutes les définitions</SelectItem>
              {definitions.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs">{d.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Bénéficiaire</th>
                <th className="p-3">Définition</th>
                <th className="p-3">N° série</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Émis le</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun certificat émis.</td></tr>
              ) : (
                docs.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 pl-4 font-semibold text-slate-700">{doc.recipientName ?? '—'}</td>
                    <td className="p-3 text-slate-600">{doc.definitionTitle}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{doc.serialNumber}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[doc.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[doc.status]?.label || doc.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-500">{new Date(doc.issuedAt).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                      <a
                        href={`/api/certificates/issued/${doc.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />PDF
                      </a>
                      <Link
                        href={`/${locale}/dashboard/certificates/issued/${doc.id}`}
                        className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />Détail
                      </Link>
                      {doc.status === 'valid' && (
                        <>
                          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => { setReplaceTarget(doc); setReplaceReason(''); }}>
                            <Repeat2 className="w-3.5 h-3.5 mr-1.5" />Remplacer
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { setRevokeTarget(doc); setRevokeReason(''); }}>
                            <Ban className="w-3.5 h-3.5 mr-1.5" />Révoquer
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Revoke dialog */}
      <Dialog open={revokeTarget !== null} onOpenChange={(o) => { if (!o && !revoking) setRevokeTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Révoquer le certificat</DialogTitle>
            <DialogDescription>
              Un certificat révoqué n'est plus vérifiable. Cette action est immédiate et tracée.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-bold text-slate-700">Motif de la révocation (optionnel)</Label>
            <textarea
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Perte, erreur d'impression, annulation..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} className="text-xs h-9 cursor-pointer" disabled={revoking}>Annuler</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 className="w-4 h-4 animate-spin" />}
              {revoking ? 'Révocation...' : 'Révoquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace dialog */}
      <Dialog open={replaceTarget !== null} onOpenChange={(o) => { if (!o && !replacing) setReplaceTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Remplacer le certificat</DialogTitle>
            <DialogDescription>
              Un nouveau certificat sera émis et l'original marqué « remplacé ». La vérification de l'original échouera.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-bold text-slate-700">Motif du remplacement (optionnel)</Label>
            <textarea
              value={replaceReason}
              onChange={e => setReplaceReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Données à corriger, nouvelle délivrance..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceTarget(null)} className="text-xs h-9 cursor-pointer" disabled={replacing}>Annuler</Button>
            <Button className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleReplace} disabled={replacing}>
              {replacing && <Loader2 className="w-4 h-4 animate-spin" />}
              {replacing ? 'Remplacement...' : 'Remplacer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
