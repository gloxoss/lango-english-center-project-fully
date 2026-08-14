'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Globe, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

type DomainRecord = {
  id: string;
  domain: string;
  domainType: 'subdomain' | 'custom';
  status: 'pending' | 'verified' | 'approved' | 'rejected';
  requestedAt: string;
  approvedAt: string | null;
};

export function SchoolAdminDomainsView({ locale }: { locale: string }) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [domainType, setDomainType] = useState<'subdomain' | 'custom'>('subdomain');
  const [domainInput, setDomainInput] = useState('');

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/domains');
      const json = await res.json();
      if (json.success) {
        setDomains(json.data);
      } else {
        toast.error(json.error?.message || 'Erreur de chargement');
      }
    } catch (e) {
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/settings/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainInput.trim().toLowerCase(),
          domainType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Demande envoyée avec succès');
        setDomainInput('');
        fetchDomains();
      } else {
        toast.error(json.error?.message || 'Erreur lors de la demande');
      }
    } catch (e) {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
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
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Domaine Personnalisé</h1>
        <p className="text-sm text-slate-500 mt-1">Configurez une adresse web personnalisée pour votre établissement.</p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Chargement...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Form Card */}
          <Card className="h-fit">
            <form onSubmit={handleRequest}>
              <CardHeader>
                <CardTitle className="text-lg">Nouvelle demande</CardTitle>
                <CardDescription>
                  Demandez un sous-domaine ou votre propre nom de domaine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Type de domaine</Label>
                  <Select value={domainType} onValueChange={(val: any) => setDomainType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subdomain">Sous-domaine (.schoolos.ma)</SelectItem>
                      <SelectItem value="custom">Domaine personnalisé (www.monecole.com)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nom de domaine souhaité</Label>
                  <Input 
                    placeholder={domainType === 'subdomain' ? 'monecole' : 'monecole.com'}
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    required
                  />
                  {domainType === 'subdomain' && (
                    <p className="text-xs text-slate-500">
                      Votre adresse sera : <span className="font-medium text-slate-900">{domainInput || 'monecole'}.schoolos.ma</span>
                    </p>
                  )}
                </div>
                
                {domainType === 'custom' && (
                  <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-md flex items-start gap-2 border border-blue-100">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <p>Pour un domaine personnalisé, vous devrez configurer les enregistrements DNS après approbation. (Fonctionnalité Premium)</p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={submitting || !domainInput}>
                  {submitting ? 'Envoi...' : 'Soumettre la demande'}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* List Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="size-5 text-slate-400" />
                Vos Domaines
              </CardTitle>
              <CardDescription>Historique de vos demandes de domaines.</CardDescription>
            </CardHeader>
            <CardContent>
              {domains.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">
                  Vous n'avez pas encore demandé de domaine.
                </div>
              ) : (
                <div className="space-y-4">
                  {domains.map((record) => (
                    <div key={record.id} className="border rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">
                          {record.domainType === 'subdomain' ? `${record.domain}.schoolos.ma` : record.domain}
                        </div>
                        {getStatusBadge(record.status)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="capitalize">{record.domainType}</span>
                        <span>{format(new Date(record.requestedAt), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
