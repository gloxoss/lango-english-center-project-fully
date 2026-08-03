'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Mail, Database, CreditCard, CheckCircle2, Settings, ExternalLink } from 'lucide-react';

const PROVIDERS = [
  { id: 'sms', name: 'Fournisseur SMS (Passerelle Maroc)', icon: MessageSquare, status: 'connected', provider: 'OrangeAPI Morocco', detail: '2 347 SMS envoyés ce mois · Solde: 653 SMS' },
  { id: 'email', name: 'Serveur d\'envoi email (SMTP)', icon: Mail, status: 'connected', provider: 'Google Workspace SMTP', detail: 'direction@atlas.ma (Port 587 TLS)' },
  { id: 'storage', name: 'Stockage cloud des documents', icon: Database, status: 'connected', provider: 'Supabase Storage', detail: '4,2 Go utilisés sur 10 Go disponibles' },
  { id: 'payment', name: 'Paiement en ligne (Paiement Scolarité)', icon: CreditCard, status: 'disconnected', provider: 'Centre Monétique Interbancaire (CMI)', detail: 'Compte marchand non configuré' },
];

export function ProvidersView({ locale: _locale }: { locale: string }) {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Fournisseurs & connexions externes</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les intégrations avec l&apos;API SMS, le serveur Email, le stockage et la passerelle CMI.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PROVIDERS.map((p) => {
          const IconComp = p.icon;
          const isConn = p.status === 'connected';
          return (
            <Card key={p.id} className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#16212B]">{p.name}</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">{p.provider}</p>
                  </div>
                </div>
                <Badge
                  className={
                    isConn
                      ? 'bg-[#D1F5E8] text-[#17A673] border-none font-bold text-[10px]'
                      : 'bg-slate-100 text-slate-500 border-none font-bold text-[10px]'
                  }
                >
                  {isConn ? 'Connecté' : 'Non configuré'}
                </Badge>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 font-medium">
                {p.detail}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurer</span>
                </Button>
                {isConn && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs rounded-xl text-[#0066FF]">
                    Tester la connexion
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
