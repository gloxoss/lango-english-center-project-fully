'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, RefreshCw, ScrollText, Loader2 } from 'lucide-react';
import { IssueCertificateDialog } from '@/features/certificates/ui/issue-certificate-dialog';

type Recipient = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  matricule: string | null;
  employeeId: string | null;
  phone: string | null;
};

type IssuedCert = {
  id: string;
  recipientId: string;
  status: string;
};

export default function CertificatesIssueStudentsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [issued, setIssued] = useState<IssuedCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialog, setDialog] = useState<Recipient | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, iRes] = await Promise.all([
        fetch('/api/certificates/recipients?type=student'),
        fetch('/api/certificates/issued?status=valid'),
      ]);
      const r = await rRes.json();
      const i = await iRes.json();
      if (r.success) setRecipients(r.data);
      if (i.success) setIssued(i.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusByRecipient = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of issued) map.set(doc.recipientId, doc.status);
    return map;
  }, [issued]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recipients.filter(s =>
      (s.name?.toLowerCase().includes(q) ?? false) ||
      (s.matricule?.toLowerCase().includes(q) ?? false)
    );
  }, [recipients, search]);

  const withCert = recipients.filter(s => statusByRecipient.get(s.id) === 'valid').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Émettre — Élèves</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Émettez des certificats pour les élèves de l'établissement.</p>
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Élèves</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{recipients.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><Users className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Certificats valides</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{withCert}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sans certificat</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{recipients.length - withCert}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Recipients table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher par nom ou matricule..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl" />
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Actualiser
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 pl-4">Élève</th>
                <th className="p-3">Matricule</th>
                <th className="p-3">Téléphone</th>
                <th className="p-3">Statut certificat</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun élève trouvé.</td></tr>
              ) : (
                filtered.map(s => {
                  const certStatus = statusByRecipient.get(s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 pl-4 font-semibold text-slate-700">{s.name}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{s.matricule ?? '-'}</td>
                      <td className="p-3 text-slate-600">{s.phone ?? '-'}</td>
                      <td className="p-3">
                        {certStatus ? (
                          <Badge variant={certStatus === 'valid' ? 'success' : 'danger'}>
                            {certStatus === 'valid' ? 'Valide' : 'Révoqué'}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Aucun</Badge>
                        )}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                          onClick={() => setDialog(s)}
                        >
                          <ScrollText className="w-3.5 h-3.5 mr-1.5" />Émettre
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <IssueCertificateDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        recipientType="student"
        recipientId={dialog?.id ?? ''}
        recipientLabel="Élève"
        recipientName={dialog?.name ?? ''}
      />
    </div>
  );
}
