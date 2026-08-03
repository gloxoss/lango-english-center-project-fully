'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shield, ShieldAlert, Monitor, Smartphone, Laptop, Trash2, CheckCircle2, Lock } from 'lucide-react';

const SESSIONS = [
  { id: 1, device: 'Chrome sur Windows 11', type: 'desktop', ip: '196.202.12.34', location: 'Casablanca, Maroc', lastActive: 'En ce moment', isCurrent: true },
  { id: 2, device: 'Safari sur iPhone 15', type: 'mobile', ip: '196.202.12.35', location: 'Casablanca, Maroc', lastActive: 'Il y a 3h', isCurrent: false },
  { id: 3, device: 'Firefox sur macOS', type: 'desktop', ip: '41.248.77.12', location: 'Rabat, Maroc', lastActive: 'Il y a 2 jours', isCurrent: false },
];

export function SecuritySessionsView({ locale: _locale }: { locale: string }) {
  const [twoFa, setTwoFa] = useState(false);
  const [strongPassword, setStrongPassword] = useState(true);
  const [sessions, setSessions] = useState(SESSIONS);

  const handleRevoke = (id: number) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRevokeAll = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Sécurité & sessions actives</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez la double authentification (2FA) et révoquez les appareils connectés.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2FA Card */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D1F5E8] text-[#17A673] flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">Authentification à deux facteurs (2FA)</h3>
              <p className="text-[11px] text-slate-500">Protection renforcée pour le compte administratif</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <label className="font-bold text-slate-700">Activer l&apos;authentification 2FA</label>
                <p className="text-[10px] text-slate-500">Exige un code temporaire lors de la connexion</p>
              </div>
              <Switch checked={twoFa} onCheckedChange={setTwoFa} />
            </div>

            {twoFa && (
              <div className="p-4 bg-[#D1F5E8]/40 border border-[#17A673]/30 rounded-xl space-y-2 text-[#17A673]">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>2FA Active</span>
                </div>
                <p className="text-[11px] text-slate-600">Application TOTP (Google Authenticator / Authy) associée.</p>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <label className="font-bold text-slate-700">Politique de mots de passe stricts</label>
                <p className="text-[10px] text-slate-500">Exiger au moins 12 caractères et symboles spéciaux</p>
              </div>
              <Switch checked={strongPassword} onCheckedChange={setStrongPassword} />
            </div>
          </div>
        </Card>

        {/* Sessions Card */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">Sessions actives</h3>
                <p className="text-[11px] text-slate-500">Appareils autorisés à utiliser votre compte</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              className="h-8 text-[11px] font-bold text-red-600 border-red-200 hover:bg-red-50 rounded-xl"
            >
              Déconnecter tout
            </Button>
          </div>

          <div className="space-y-3 text-xs">
            {sessions.map((s) => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {s.type === 'mobile' ? <Smartphone className="w-4 h-4 text-slate-500" /> : <Laptop className="w-4 h-4 text-slate-500" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#16212B]">{s.device}</span>
                      {s.isCurrent && <Badge className="bg-[#D1F5E8] text-[#17A673] border-none text-[10px] font-bold">Actuelle</Badge>}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{s.ip} · {s.location} · {s.lastActive}</p>
                  </div>
                </div>

                {!s.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(s.id)}
                    className="h-7 text-[11px] text-red-600 hover:bg-red-50 p-2 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
