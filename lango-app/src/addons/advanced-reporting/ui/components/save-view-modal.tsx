'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bookmark, Loader2 } from 'lucide-react';

export function SaveViewModal({
  reportKey,
  currentParameters,
  onSaved,
}: {
  reportKey: string;
  currentParameters: Record<string, any>;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/addons/reporting/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportKey, name: name.trim(), parameterPreset: currentParameters }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Échec de l\'enregistrement.');
        return;
      }
      setOpen(false);
      setName('');
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 font-bold border-slate-200 rounded-xl">
          <Bookmark className="h-3.5 w-3.5 text-[#2487B8]" />
          <span>Enregistrer cette vue</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer cette vue</DialogTitle>
          <DialogDescription>
            Sauvegardez les filtres actuels de ce rapport sous un nom pour les réutiliser plus tard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="save-view-name">Nom de la vue</Label>
          <Input
            id="save-view-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Impayés du trimestre en cours"
            maxLength={255}
          />
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Enregistrer</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
