'use client';

import {
  CheckCircle2,
  Copy,
  KeyRound,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';

type ScannerDevice = {
  id: string;
  deviceLabel: string;
  branchId: string | null;
  pairedAt: string;
  lastSeenAt: string | null;
  isDisabled: boolean;
};

export function ScannerDevicesView() {
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pairOpen, setPairOpen] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pairedSecret, setPairedSecret] = useState<{ device: ScannerDevice; secretKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [renaming, setRenaming] = useState<ScannerDevice | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/scanner-devices');
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Erreur lors du chargement des dispositifs.');
        return;
      }
      setDevices(json.data || []);
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceLabel.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch('/api/scanner-devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel: deviceLabel.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Erreur lors de l\'appairage.');
        return;
      }
      setPairedSecret(json.data);
      setDeviceLabel('');
      await fetchDevices();
    } catch {
      setError('Erreur réseau lors de l\'appairage.');
    } finally {
      setSubmitting(false);
    }
  };

  const closePairDialog = () => {
    setPairOpen(false);
    setPairedSecret(null);
  };

  const copySecret = async () => {
    if (!pairedSecret) return;
    try {
      await navigator.clipboard.writeText(pairedSecret.secretKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the box stays visible for manual copy
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming || !renameValue.trim()) return;
    try {
      setSavingRename(true);
      setError(null);
      const res = await fetch(`/api/scanner-devices/${renaming.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel: renameValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Erreur lors du renommage.');
        return;
      }
      setRenaming(null);
      await fetchDevices();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSavingRename(false);
    }
  };

  const toggleDisable = async (device: ScannerDevice) => {
    try {
      setError(null);
      const res = await fetch(`/api/scanner-devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDisabled: !device.isDisabled }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Erreur lors de la mise à jour.');
        return;
      }
      await fetchDevices();
    } catch {
      setError('Erreur réseau.');
    }
  };

  const activeCount = devices.filter(d => !d.isDisabled).length;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Dispositifs de Scan</h1>
          <p className="text-xs text-slate-500 mt-1">
            Appairez les douchettes USB / scanners qui serviront au kiosque de présence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            className="gap-2 h-9 text-xs rounded-xl text-slate-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() => setPairOpen(true)}
            className="gap-2 h-9 text-xs rounded-xl px-4 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
          >
            <Plus className="w-4 h-4" />
            Appairer un dispositif
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-rose-700">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stat card */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between max-w-sm">
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-400">Dispositifs actifs</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{activeCount}</p>
          <p className="text-[11px] font-bold text-[#2487B8]">
            {devices.length > 0 ? `${devices.length} appairé${devices.length > 1 ? 's' : ''} au total` : 'Aucun dispositif'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
          <MonitorSmartphone className="w-5 h-5" />
        </div>
      </Card>

      {/* Devices table */}
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-semibold">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-[#2487B8] rounded-full animate-spin" />
              Chargement des dispositifs...
            </div>
          </div>
        ) : devices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={MonitorSmartphone}
              title="Aucun dispositif appairé"
              description="Appairez un scanner pour l'associer à une session de kiosque de présence."
              actionLabel="+ Appairer un dispositif"
              onAction={() => setPairOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Dispositif</th>
                  <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Statut</th>
                  <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Appairé le</th>
                  <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Dernière activité</th>
                  <th className="py-3 px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <MonitorSmartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-[#16212B]">{d.deviceLabel}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{d.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {d.isDisabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Désactivé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Actif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {new Date(d.pairedAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRenaming(d);
                            setRenameValue(d.deviceLabel);
                          }}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-[#2487B8] hover:bg-[#DCEBF4] rounded-lg"
                          title="Renommer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDisable(d)}
                          className={`h-8 w-8 p-0 rounded-lg ${
                            d.isDisabled
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={d.isDisabled ? 'Réactiver' : 'Désactiver'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Pair dialog */}
      <Dialog open={pairOpen} onOpenChange={(open) => {
        if (!open) closePairDialog();
      }}>
        <DialogContent>
          {pairedSecret ? (
            <>
              <DialogHeader>
                <DialogTitle>Dispositif appairé</DialogTitle>
                <DialogDescription>
                  Copiez cette clé secrète maintenant — elle ne sera plus jamais affichée.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl">
                  <code className="text-[11px] font-mono text-emerald-300 break-all leading-relaxed">
                    {pairedSecret.secretKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copySecret}
                    className="h-8 shrink-0 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copié' : 'Copier'}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400">
                  {pairedSecret.device.deviceLabel} — utilisez cette clé lors de la configuration du matériel.
                </p>
              </div>
              <DialogFooter>
                <Button
                  onClick={closePairDialog}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl text-xs font-bold h-10"
                >
                  Terminé
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handlePair}>
              <DialogHeader>
                <DialogTitle>Appairer un dispositif de scan</DialogTitle>
                <DialogDescription>
                  Nommez le scanner (ex: Douchette Entrée B). Une clé secrète sera générée.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 mt-4">
                <Label className="text-xs font-bold text-slate-700">Nom du dispositif <span className="text-rose-500">*</span></Label>
                <Input
                  required
                  placeholder="Ex: Douchette Entrée B"
                  value={deviceLabel}
                  onChange={e => setDeviceLabel(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePairDialog}
                  className="rounded-xl text-xs font-bold h-10"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl text-xs font-bold h-10"
                >
                  {submitting ? 'Appairage...' : 'Appairer'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null); }}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Renommer le dispositif</DialogTitle>
              <DialogDescription>
                Mettez à jour le libellé de ce scanner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 mt-4">
              <Label className="text-xs font-bold text-slate-700">Nom du dispositif</Label>
              <Input
                required
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(null)}
                className="rounded-xl text-xs font-bold h-10"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={savingRename}
                className="bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl text-xs font-bold h-10"
              >
                {savingRename ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
