'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Radio,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  Paperclip,
} from 'lucide-react';

type Channel = 'announcement' | 'sms' | 'whatsapp' | 'email';
type RecipientType = 'all' | 'section' | 'leads';

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
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSections(d.data);
      })
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
        setError(data.error?.message ?? "Erreur lors de l'envoi.");
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Console de Diffusion & Communication
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Diffusion multi-canal (Annonces, SMS, WhatsApp, Email) vers les élèves, parents et prospects CRM.
            </p>
          </div>
        </div>

        <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Canaux Sécurisés CNDP</span>
        </Badge>
      </div>

      {/* Simulation Banner if SMS or WhatsApp */}
      {(channel === 'sms' || channel === 'whatsapp') && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold shadow-2xs">
          <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            Mode simulation activé : les SMS et messages WhatsApp sont enregistrés dans le registre de communication de l'établissement sans surcoût.
          </span>
        </div>
      )}

      {/* Main Broadcast Form Card */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
        <form onSubmit={(e) => void handleSend(e)} className="space-y-5">
          {/* Channel Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Canal de Diffusion
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { key: 'announcement', label: '📢 Annonce', desc: 'Portail Élèves & Parents' },
                  { key: 'sms', label: '📱 SMS', desc: 'Canal Téléphone Direct' },
                  { key: 'whatsapp', label: '💬 WhatsApp', desc: 'Message WhatsApp' },
                  { key: 'email', label: '✉️ Email', desc: 'Email Officiel' },
                ] as const
              ).map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setChannel(ch.key)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    channel === ch.key
                      ? 'bg-blue-50 border-[#2487B8] text-[#1B6C93] shadow-2xs font-extrabold'
                      : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-extrabold">{ch.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{ch.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Announcement Title */}
          {channel === 'announcement' && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Titre de l'Annonce *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Information importante - Horaires des examens de Janvier"
                className="text-xs rounded-xl h-10"
              />
            </div>
          )}

          {/* Recipient Audience Selector */}
          {channel !== 'announcement' && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Cible & Destinataires
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Tous les élèves & tuteurs' },
                  { key: 'section', label: 'Par section spécifique' },
                  { key: 'leads', label: 'Prospects CRM' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRecipientType(opt.key as RecipientType)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                      recipientType === opt.key
                        ? 'bg-[#2487B8] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {recipientType === 'section' && (
                <div className="mt-3 max-w-md">
                  <label className="mb-1 block text-xs font-bold text-slate-700">Section Choisie</label>
                  <select
                    required
                    value={classSectionId}
                    onChange={(e) => setClassSectionId(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium"
                  >
                    <option value="">-- Choisir une section --</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Message Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Contenu du Message *</label>
              {channel === 'sms' && (
                <span className="text-[11px] font-mono text-slate-400">({body.length} / 1600 caractères)</span>
              )}
            </div>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={channel === 'sms' ? 1600 : undefined}
              className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8] text-slate-800 leading-relaxed"
              placeholder={
                channel === 'announcement'
                  ? "Saisissez le texte complet de l'annonce officielle..."
                  : 'Saisissez le message de diffusion...'
              }
            />
          </div>

          {/* Feedback Messages */}
          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                ✓ {result.channel === 'announcement' ? 'Annonce publiée avec succès.' : `${result.sent} message(s) transmis.`}
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={sending}
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs h-10 px-6 gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Diffusion...' : channel === 'announcement' ? 'Publier l\'Annonce' : 'Diffuser les Messages'}</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
