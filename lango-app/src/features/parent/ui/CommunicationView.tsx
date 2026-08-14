'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, MessageSquareText, CalendarClock, AlertTriangle } from 'lucide-react';
import { ParentPageShell, type ParentPageShellContext } from './ParentPageShell';

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  publishedAt: string | null;
};

type Message = {
  id: string;
  studentId: string;
  body: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string | null;
};

type Meeting = {
  id: string;
  teacherId: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');

export function CommunicationView() {
  return (
    <ParentPageShell
      title="Communication"
      subtitle="Annonces, messages et rendez-vous de votre enfant."
      icon={<Megaphone className="w-6 h-6" />}
    >
      <CommunicationContent />
    </ParentPageShell>
  );
}

function CommunicationContent({ relationshipId, loading: shellLoading }: Partial<ParentPageShellContext>) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [annRes, meetRes, msgRes] = await Promise.all([
        fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/announcements`),
        fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/meetings`),
        fetch('/api/guardian/me/messages'),
      ]);
      const [ann, meet, msg] = await Promise.all([annRes.json(), meetRes.json(), msgRes.json()]);
      if (ann.success) setAnnouncements(ann.data as Announcement[]);
      if (meet.success) setMeetings(meet.data as Meeting[]);
      if (msg.success) setMessages(msg.data as Message[]);
      if (!ann.success || !meet.success || !msg.success) {
        setError('Une partie des données est indisponible.');
      }
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (relationshipId) load(relationshipId);
  }, [relationshipId, load]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(loading || shellLoading) && announcements.length === 0 && messages.length === 0 && meetings.length === 0 ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Annonces</h2>
            </div>
            {announcements.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucune annonce pour le moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {announcements.map((a) => (
                  <div key={a.id} className="px-5 py-4">
                    <div className="text-sm font-semibold text-slate-800">{a.title}</div>
                    {a.body && <p className="mt-1 text-sm text-slate-500">{a.body}</p>}
                    <div className="mt-1 text-xs text-slate-400">{fmt(a.publishedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Messages</h2>
            </div>
            {messages.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucun message pour le moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {messages.map((m) => (
                  <div key={m.id} className="px-5 py-4">
                    <p className="text-sm text-slate-700">{m.body ?? '—'}</p>
                    <div className="mt-1 text-xs text-slate-400">
                      Statut : {m.status} · {fmt(m.sentAt ?? m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Créneaux de rendez-vous parents</h2>
            </div>
            {meetings.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucun créneau disponible actuellement.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">Début</th>
                      <th className="px-5 py-3 font-medium">Fin</th>
                      <th className="px-5 py-3 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {meetings.map((m) => (
                      <tr key={m.id}>
                        <td className="px-5 py-3">{fmt(m.startTime)}</td>
                        <td className="px-5 py-3">{fmt(m.endTime)}</td>
                        <td className="px-5 py-3 capitalize">{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
