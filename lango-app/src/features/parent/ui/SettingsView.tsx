'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Settings as SettingsIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Preference = { key: string; value: unknown };

const CONSENTS: { key: string; label: string; hint: string }[] = [
  { key: 'contactConsent', label: 'Contact par téléphone', hint: "Autorisez l'établissement à vous contacter par téléphone." },
  { key: 'mediaConsent', label: 'Photos / médias', hint: "Autorisez la publication de photos de votre enfant (événements)." },
  { key: 'transportConsent', label: 'Transport scolaire', hint: "Autorisez la communication sur le transport scolaire." },
  { key: 'hostelConsent', label: 'Internat', hint: "Autorisez la communication sur l'internat." },
  { key: 'eventConsent', label: 'Événements', hint: "Autorisez la communication sur les événements de l'établissement." },
];

const OTHER_KEYS: { key: string; label: string }[] = [
  { key: 'locale', label: 'Langue préférée' },
  { key: 'theme', label: 'Thème' },
  { key: 'navCollapsed', label: 'Menu réduit' },
  { key: 'notificationsEnabled', label: 'Notifications activées' },
];

export function SettingsView() {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guardian/me/preferences');
      const json = await res.json();
      if (json.success) {
        setPrefs(json.data as Preference[]);
      } else {
        setError(json.error?.message ?? 'Erreur lors du chargement des préférences.');
      }
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const valueOf = (key: string) => prefs.find((p) => p.key === key)?.value;

  const patch = useCallback(async (key: string, value: unknown) => {
    setFlash(null);
    try {
      const res = await fetch('/api/guardian/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (json.success) {
        setPrefs(json.data as Preference[]);
        setFlash('Préférence enregistrée.');
      } else {
        setFlash(json.error?.message ?? "Erreur lors de l'enregistrement.");
      }
    } catch {
      setFlash('Impossible de se connecter au serveur.');
    }
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="w-11 h-11 rounded-2xl bg-[#0066FF]/10 border border-[#0066FF]/30 flex items-center justify-center text-[#0066FF]">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Paramètres</h1>
          <p className="text-sm text-slate-500">Préférences de contact et consentements.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {flash && (
        <div className={`p-4 rounded-lg text-sm flex items-center gap-2 ${flash.includes('enregistrée') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{flash}</span>
        </div>
      )}

      {loading ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Consentements</h2>
              <p className="text-xs text-slate-500 mt-0.5">Vous pouvez retirer chaque consentement à tout moment.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {CONSENTS.map((c) => (
                <div key={c.key} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{c.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.hint}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={valueOf(c.key) === true}
                      onChange={(e) => patch(c.key, e.target.checked)}
                      aria-label={c.label}
                    />
                    <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-[#0066FF] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[#0066FF] peer-focus-visible:ring-offset-2 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-fit">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Préférences générales</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {OTHER_KEYS.map((k) => (
                <div key={k.key} className="px-5 py-4 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-800">{k.label}</span>
                  <span className="text-sm text-slate-500">
                    {valueOf(k.key) === undefined ? '—' : String(valueOf(k.key))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
