'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Globe, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

type DomainRecord = {
  domain: {
    id: string;
    domain: string;
    domainType: 'subdomain' | 'custom';
    status: 'pending' | 'verified' | 'approved' | 'rejected';
    requestedAt: string;
    approvedAt: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
};

export function SuperAdminDomainsView({ locale }: { locale: string }) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/domains');
      const json = await res.json();
      if (json.success) {
        setDomains(json.data);
      } else {
        toast.error(json.error?.message || 'Erreur lors du chargement des domaines');
      }
    } catch (e) {
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/super-admin/domains/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Domaine ${status === 'approved' ? 'approuvé' : 'rejeté'}`);
        fetchDomains();
      } else {
        toast.error(json.error?.message || 'Erreur lors de la mise à jour');
      }
    } catch (e) {
      toast.error('Erreur réseau');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="warning" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="mr-1 size-3" /> En attente</Badge>;
      case 'approved': return <Badge variant="success" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="mr-1 size-3" /> Approuvé</Badge>;
      case 'rejected': return <Badge variant="danger" className="bg-red-50 text-red-700 border-red-200"><XCircle className="mr-1 size-3" /> Rejeté</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Domaines Personnalisés</h1>
        <p className="text-sm text-slate-500 mt-1">Gérez les demandes de sous-domaines et domaines personnalisés des écoles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="size-5 text-slate-400" />
            Demandes de domaines
          </CardTitle>
          <CardDescription>
            Toutes les demandes de domaines par les écoles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Chargement...</div>
          ) : domains.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Aucune demande trouvée.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domaine</TableHead>
                    <TableHead>École</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((record) => (
                    <TableRow key={record.domain.id}>
                      <TableCell className="font-medium text-slate-900">
                        {record.domain.domain}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{record.tenant.name}</div>
                        <div className="text-xs text-slate-500">{record.tenant.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="capitalize">
                          {record.domain.domainType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.domain.status)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(record.domain.requestedAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.domain.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus(record.domain.id, 'rejected')}>
                              Rejeter
                            </Button>
                            <Button size="sm" className="bg-[#0066FF] hover:bg-[#0066FF]/90" onClick={() => updateStatus(record.domain.id, 'approved')}>
                              Approuver
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
