'use client';

import React, { useEffect, useState } from 'react';

type Channel = 'sms' | 'announcement';
type RecipientType = 'all' | 'section' | 'ids';

type Section = { id: string; name: string };

type SendResult = {
  channel: Channel;
  sent: number;
  simulated?: boolean;
  warning?: string;
};

export function BroadcastSendView() {
  const [channel, setChannel] = useState<Channel>('announcement');
  const [recipientType, setRecipientType] = useState<RecipientType>('all');
  const [sections, setSections] = useState<Section[]>([]);
  const [classSectionId, setClassSectionId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch sections for the section picker
  useEffect(() => {
    if (recipientType !== 'section') return;
    fetch('/api/academics/sections?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setSections(d.data); })
      .catch(() => {});
  }, [recipientType]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (channel === 'announcement' && !title.trim()) return;
    setSending(true);
    setResult(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = { channel, body };
      if (channel === 'announcement') {
        payload.title = title;
      } else {
        payload.recipientType = recipientType;
        if (recipientType === 'section') payload.classSectionId = classSectionId;
      }

      const res = await fetch('/api/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setBody('');
        setTitle('');
      } else {
        setError(data.error?.message ?? 'Erreur lors de l\'envoi.');
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Diffusion</h2>
        <p className="text-xs text-slate-400">Envoyez des messages ou annonces à vos élèves et parents.</p>
      </div>

      {/* SMS simulation banner */}
      {channel === 'sms' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          ⚠ Mode simulation — aucun SMS réel n'est envoyé. Les messages sont enregistrés localement.
        </div>
      )}

      <form onSubmit={(e) => void handleSend(e)} className="space-y-5 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-6 backdrop-blur-md">
        {/* Channel picker */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Canal</label>
          <div className="flex gap-2">
            {(['announcement', 'sms'] as Channel[]).map(ch => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${channel === ch ? 'bg-violet-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'}`}
              >
                {ch === 'announcement' ? '📢 Annonce' : '📱 SMS'}
              </button>
            ))}
          </div>
        </div>

        {/* Announcement title */}
        {channel === 'announcement' && (
          <div>
            <label className="mb-1 block text-xs text-slate-400">Titre *</label>
            <input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
              placeholder="Titre de l'annonce"
            />
          </div>
        )}

        {/* SMS recipient picker */}
        {channel === 'sms' && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Destinataires</label>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'Tous les élèves' },
                { key: 'section', label: 'Par section' },
              ] as { key: RecipientType; label: string }[]).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRecipientType(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${recipientType === opt.key ? 'bg-indigo-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {recipientType === 'section' && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-400">Section</label>
                <select
                  required
                  value={classSectionId}
                  onChange={e => setClassSectionId(e.target.value)}
                  className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
                >
                  <option value="">-- Choisir une section --</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Message body */}
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Message *
            {channel === 'sms' && (
              <span className="ml-2 text-slate-500">({body.length}/1600)</span>
            )}
          </label>
          <textarea
            required
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={4}
            maxLength={channel === 'sms' ? 1600 : undefined}
            className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
            placeholder={channel === 'announcement' ? 'Contenu de l\'annonce…' : 'Texte du SMS…'}
          />
        </div>

        {/* Result / error feedback */}
        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
            ✓ {result.channel === 'announcement'
              ? 'Annonce publiée avec succès.'
              : `${result.sent} SMS enregistré(s)${result.simulated ? ' (simulation)' : ''}.`}
            {result.warning && <span className="ml-2 text-amber-300">{result.warning}</span>}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {sending ? 'Envoi en cours…' : channel === 'announcement' ? 'Publier l\'annonce' : 'Envoyer les SMS'}
        </button>
      </form>
    </div>
  );
}
