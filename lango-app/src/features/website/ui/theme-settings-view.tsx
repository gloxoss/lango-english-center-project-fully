'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Globe, Loader2, Palette, Save } from 'lucide-react';

type ThemeData = {
  enabled: boolean;
  siteTitle: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  workingHours: string | null;
  footerAboutText: string | null;
  copyrightText: string | null;
  socialFacebook: string | null;
  socialTwitter: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;
  socialInstagram: string | null;
  socialPinterest: string | null;
  colorPrimary: string;
  colorMenuBackground: string;
  colorButtonHover: string;
  colorText: string;
  colorTextSecondary: string;
  colorFooterBackground: string;
  colorFooterText: string;
  colorCopyrightBackground: string;
  colorCopyrightText: string;
  borderRadius: number;
};

const DEFAULT_THEME: ThemeData = {
  enabled: true,
  siteTitle: '',
  address: '',
  phone: '',
  email: '',
  workingHours: '',
  footerAboutText: '',
  copyrightText: '',
  socialFacebook: '',
  socialTwitter: '',
  socialYoutube: '',
  socialLinkedin: '',
  socialInstagram: '',
  socialPinterest: '',
  colorPrimary: '#2487B8',
  colorMenuBackground: '#16212B',
  colorButtonHover: '#1B6C93',
  colorText: '#16212B',
  colorTextSecondary: '#64748B',
  colorFooterBackground: '#16212B',
  colorFooterText: '#FFFFFF',
  colorCopyrightBackground: '#0F172A',
  colorCopyrightText: '#94A3B8',
  borderRadius: 8,
};

const COLOR_FIELDS: { key: keyof ThemeData; label: string }[] = [
  { key: 'colorPrimary', label: 'Couleur primaire' },
  { key: 'colorMenuBackground', label: 'Fond du menu' },
  { key: 'colorButtonHover', label: 'Survol des boutons' },
  { key: 'colorText', label: 'Texte principal' },
  { key: 'colorTextSecondary', label: 'Texte secondaire' },
  { key: 'colorFooterBackground', label: 'Fond du pied de page' },
  { key: 'colorFooterText', label: 'Texte du pied de page' },
  { key: 'colorCopyrightBackground', label: 'Fond de la barre copyright' },
  { key: 'colorCopyrightText', label: 'Texte de la barre copyright' },
];

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-slate-700">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </div>
  );
}

export function ThemeSettingsView() {
  const [theme, setTheme] = useState<ThemeData>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/website/theme')
      .then(r => r.json())
      .then((j) => {
        if (j.success && j.data) {
          setTheme({ ...DEFAULT_THEME, ...j.data });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof ThemeData>(key: K, value: ThemeData[K]) => setTheme(t => ({ ...t, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/website/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      });
      const j = await res.json();
      if (!j.success) {
        throw new Error(j.error?.message ?? 'Échec de l\'enregistrement');
      }
      setTheme({ ...DEFAULT_THEME, ...j.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Site Web — Thème & Identité</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Identité, coordonnées et couleurs du site public de l&apos;école.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Switch checked={theme.enabled} onCheckedChange={v => set('enabled', v)} />
            <span className="text-xs font-bold text-slate-700">{theme.enabled ? 'Site activé' : 'Site désactivé'}</span>
          </div>
          <Button onClick={save} disabled={saving} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Enregistrer</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl p-3">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#16212B]">Identité du site</h2>
            <TextField label="Titre du site (CMS)" value={theme.siteTitle} onChange={v => set('siteTitle', v)} placeholder="École XYZ" />
          </Card>

          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#16212B]">Contact & pied de page</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="Adresse" value={theme.address ?? ''} onChange={v => set('address', v)} />
              <TextField label="Téléphone" value={theme.phone ?? ''} onChange={v => set('phone', v)} />
              <TextField label="Email" value={theme.email ?? ''} onChange={v => set('email', v)} />
              <TextField label="Horaires d'ouverture" value={theme.workingHours ?? ''} onChange={v => set('workingHours', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Texte "À propos" (pied de page)</Label>
              <Textarea value={theme.footerAboutText ?? ''} onChange={e => set('footerAboutText', e.target.value)} rows={3} className="text-sm" />
            </div>
            <TextField label="Texte de copyright" value={theme.copyrightText ?? ''} onChange={v => set('copyrightText', v)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Facebook" value={theme.socialFacebook ?? ''} onChange={v => set('socialFacebook', v)} />
              <TextField label="Twitter / X" value={theme.socialTwitter ?? ''} onChange={v => set('socialTwitter', v)} />
              <TextField label="YouTube" value={theme.socialYoutube ?? ''} onChange={v => set('socialYoutube', v)} />
              <TextField label="LinkedIn" value={theme.socialLinkedin ?? ''} onChange={v => set('socialLinkedin', v)} />
              <TextField label="Instagram" value={theme.socialInstagram ?? ''} onChange={v => set('socialInstagram', v)} />
              <TextField label="Pinterest" value={theme.socialPinterest ?? ''} onChange={v => set('socialPinterest', v)} />
            </div>
          </Card>

          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2"><Palette className="w-4 h-4 text-[#2487B8]" /> Couleurs du thème</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COLOR_FIELDS.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">{f.label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme[f.key] as string}
                      onChange={e => set(f.key, e.target.value as ThemeData[typeof f.key])}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                    />
                    <Input
                      value={theme[f.key] as string}
                      onChange={e => set(f.key, e.target.value as ThemeData[typeof f.key])}
                      className="text-sm font-mono"
                    />
                  </div>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Arrondi des bordures (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={48}
                  value={theme.borderRadius}
                  onChange={e => set('borderRadius', Number(e.target.value) || 0)}
                  className="text-sm"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Live preview pane - updates instantly from local state, no save needed to see the effect. */}
        <div className="xl:col-span-1">
          <div className="sticky top-6">
            <Card className="p-0 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aperçu en direct</div>
              <div style={{ borderRadius: `${theme.borderRadius}px` }} className="m-4 overflow-hidden border border-slate-200">
                <div style={{ backgroundColor: theme.colorMenuBackground }} className="px-4 py-3 flex items-center justify-between">
                  <span style={{ color: theme.colorFooterText }} className="text-sm font-extrabold">{theme.siteTitle || 'Nom de l\'école'}</span>
                  <span style={{ color: theme.colorFooterText }} className="text-[10px] opacity-70">Accueil · À propos · Contact</span>
                </div>
                <div className="p-5 bg-white space-y-3">
                  <h3 style={{ color: theme.colorText }} className="text-base font-extrabold">Bienvenue</h3>
                  <p style={{ color: theme.colorTextSecondary }} className="text-xs">Texte secondaire d&apos;exemple pour visualiser le contraste.</p>
                  <button
                    type="button"
                    style={{ backgroundColor: theme.colorPrimary, borderRadius: `${theme.borderRadius}px` }}
                    className="text-white text-xs font-bold px-4 py-2 cursor-default"
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.colorButtonHover; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = theme.colorPrimary; }}
                  >
                    Bouton d&apos;action
                  </button>
                </div>
                <div style={{ backgroundColor: theme.colorFooterBackground, color: theme.colorFooterText }} className="px-4 py-3 text-xs">
                  {theme.footerAboutText || 'Texte du pied de page...'}
                </div>
                <div style={{ backgroundColor: theme.colorCopyrightBackground, color: theme.colorCopyrightText }} className="px-4 py-2 text-[10px]">
                  {theme.copyrightText || '© École — Tous droits réservés'}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
