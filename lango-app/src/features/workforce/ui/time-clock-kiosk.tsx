'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Clock,
  LogIn,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  QrCode,
  UserCheck,
} from 'lucide-react';

interface PunchItem {
  id: string;
  employeeName?: string | null;
  employeeId: string;
  punchType: 'in' | 'out';
  scannedAt: string;
}

export function TimeClockKiosk() {
  const [punchMode, setPunchMode] = useState<'in' | 'out'>('in');
  const [rawTokenInput, setRawTokenInput] = useState('');
  const [punches, setPunches] = useState<PunchItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastPunch, setLastPunch] = useState<{ name: string; type: 'in' | 'out' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPunches = async () => {
    try {
      const res = await fetch('/api/workforce/punches');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPunches(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPunches();
  }, []);

  const handlePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTokenInput.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/workforce/punches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawToken: rawTokenInput.trim(),
          punchType: punchMode,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setLastPunch({ name: json.data.employeeName || 'Employé', type: punchMode });
        setRawTokenInput('');
        fetchPunches();
      } else {
        setError(json.error?.message || 'Pointage échoué.');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur de pointage.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs text-center sm:text-left">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0 mx-auto sm:mx-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Pointeuse Kiosque Employés & Personnel
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Horodatage certifié des arrivées et départs sur le registre des heures de travail.
            </p>
          </div>
        </div>

        <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs mx-auto sm:mx-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Pointage Certifié</span>
        </Badge>
      </div>

      {/* Mode Selector & Punch Form */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPunchMode('in')}
            className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
              punchMode === 'in'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs font-extrabold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LogIn className="w-6 h-6 mx-auto mb-1.5 text-emerald-600" />
            <span className="text-xs font-extrabold uppercase tracking-wider block">Entrée / Arrivée</span>
          </button>

          <button
            type="button"
            onClick={() => setPunchMode('out')}
            className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
              punchMode === 'out'
                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs font-extrabold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LogOut className="w-6 h-6 mx-auto mb-1.5 text-amber-600" />
            <span className="text-xs font-extrabold uppercase tracking-wider block">Sortie / Départ</span>
          </button>
        </div>

        <form onSubmit={handlePunch} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Scanner ou Saisir le Badge QR</label>
            <Input
              type="password"
              required
              value={rawTokenInput}
              onChange={(e) => setRawTokenInput(e.target.value)}
              placeholder="Scannez votre badge devant la caméra du kiosque..."
              className="text-xs rounded-xl h-11 border-slate-200 focus:ring-2 focus:ring-[#2487B8] font-mono text-center text-sm"
              autoFocus
            />
          </div>

          {lastPunch && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                Pointage {lastPunch.type === 'in' ? "d'entrée" : 'de sortie'} enregistré pour {lastPunch.name} !
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className={`w-full h-11 font-bold text-xs rounded-xl shadow-2xs gap-2 ${
              punchMode === 'in' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{submitting ? 'Validation...' : `Valider Pointage ${punchMode === 'in' ? 'Entrée' : 'Sortie'}`}</span>
          </Button>
        </form>
      </Card>

      {/* Recent Punches Journal Card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          Derniers Pointages du Personnel
        </h3>

        <div className="space-y-2">
          {punches.map((p) => (
            <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Badge variant={p.punchType === 'in' ? 'success' : 'warning'} className="text-[10px] font-bold uppercase">
                  {p.punchType === 'in' ? 'Entrée' : 'Sortie'}
                </Badge>
                <span className="font-extrabold text-[#16212B]">{p.employeeName || p.employeeId}</span>
              </div>
              <span className="font-mono text-slate-500">{new Date(p.scannedAt).toLocaleTimeString('fr-FR')}</span>
            </div>
          ))}

          {punches.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Aucun pointage aujourd'hui.</p>}
        </div>
      </Card>
    </div>
  );
}
