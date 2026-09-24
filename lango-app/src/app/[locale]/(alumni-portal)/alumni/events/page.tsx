'use client';

import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  MapPin,
  Paperclip,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  targetCohortName: string | null;
  targetBranchName: string | null;
  attachmentUrl: string | null;
  isCancelled: boolean;
  cancellationReason: string | null;
  myRsvpStatus: string | null;
  myIsWaitlisted: boolean;
  myWaitlistPosition: number | null;
  myCheckedIn: boolean;
  totalConfirmed: number;
  totalWaitlist: number;
  isFull: boolean;
};

const RSVP_OPTIONS: { value: string; label: string }[] = [
  { value: 'going', label: 'Je participe' },
  { value: 'maybe', label: 'Peut-être' },
  { value: 'not_going', label: 'Je ne participe pas' },
];

export default function AlumniEventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError?: boolean } | null>(null);

  const load = () => {
    fetch('/api/alumni/me/events')
      .then(r => r.json())
      .then(j => j?.success && setEvents(j.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRsvp = async (eventId: string, status: string) => {
    setUpdating(eventId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/alumni/me/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ id: eventId, message: json.message || 'Statut mis à jour.' });
        load();
      } else {
        setFeedback({ id: eventId, message: json.error?.message || json.message || 'Erreur lors de la mise à jour.', isError: true });
      }
    } catch {
      setFeedback({ id: eventId, message: 'Erreur réseau.', isError: true });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Événements & Rencontres</h1>
        <p className="mt-1 text-xs text-slate-500">
          Retrouvez les événements organisés pour les anciens élèves de votre promotion et établissement.
        </p>
      </div>

      <div className="space-y-4">
        {events === null && (
          <div className="
            animate-pulse p-12 text-center text-xs font-semibold text-slate-400
          "
          >
            Chargement des événements...
          </div>
        )}

        {events !== null && events.length === 0 && (
          <Card className="
            flex flex-col items-center justify-center gap-3 rounded-2xl border
            border-slate-200/80 bg-white p-12 text-center shadow-xs
          "
          >
            <CalendarDays className="size-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">Aucun événement à venir pour le moment.</p>
          </Card>
        )}

        {events?.map((ev) => {
          const isCapacityConfigured = ev.capacity != null;
          const spotsRemaining = isCapacityConfigured ? Math.max(0, ev.capacity! - ev.totalConfirmed) : null;

          return (
            <Card
              key={ev.id}
              className={`
                rounded-2xl border bg-white p-5 shadow-xs transition-all
                ${
            ev.isCancelled
              ? 'border-rose-200 bg-rose-50/10'
              : ev.myRsvpStatus === 'going'
                ? 'border-[#2487B8]/40 bg-[#2487B8]/5'
                : 'border-slate-200/80'
            }
              `}
            >
              <div className="
                flex flex-col justify-between gap-3
                sm:flex-row sm:items-start
              "
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-[#16212B]">{ev.title}</span>

                    {/* Cancelled badge */}
                    {ev.isCancelled && (
                      <span className="
                        flex items-center gap-1 rounded-full bg-rose-100 px-2.5
                        py-0.5 text-[10px] font-extrabold text-rose-700
                      "
                      >
                        <Ban className="size-3" />
                        Annulé
                      </span>
                    )}

                    {/* Scope badges */}
                    {ev.targetCohortName && (
                      <span className="
                        flex items-center gap-1 rounded-full bg-slate-100 px-2
                        py-0.5 text-[10px] font-semibold text-slate-700
                      "
                      >
                        <GraduationCap className="size-3 text-slate-400" />
                        {ev.targetCohortName}
                      </span>
                    )}
                    {ev.targetBranchName && (
                      <span className="
                        rounded-full bg-slate-100 px-2 py-0.5 text-[10px]
                        font-semibold text-slate-700
                      "
                      >
                        {ev.targetBranchName}
                      </span>
                    )}

                    {/* Capacity badge */}
                    {isCapacityConfigured && !ev.isCancelled && (
                      <span
                        className={`
                          rounded-full px-2 py-0.5 text-[10px] font-bold
                          ${
                      ev.isFull
                        ? 'bg-amber-100 text-amber-800'
                        : `bg-slate-100 text-slate-600`
                      }
                        `}
                      >
                        {ev.isFull ? 'Complet (Liste d\'attente)' : `${spotsRemaining} place(s) restante(s)`}
                      </span>
                    )}
                  </div>

                  {/* Cancellation alert */}
                  {ev.isCancelled && (
                    <div className="
                      flex items-center gap-2 rounded-xl border border-rose-200
                      bg-rose-50 p-3 text-xs font-semibold text-rose-700
                    "
                    >
                      <AlertTriangle className="size-4 shrink-0 text-rose-500" />
                      <span>
                        Événement annulé
                        {ev.cancellationReason ? ` : ${ev.cancellationReason}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="
                    flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs
                    text-slate-500
                  "
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-slate-400" />
                      {new Date(ev.startsAt).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-slate-400" />
                        {ev.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-slate-400" />
                      {ev.totalConfirmed}
                      {' '}
                      participant(s)
                      {ev.totalWaitlist > 0 ? ` · ${ev.totalWaitlist} en attente` : ''}
                    </span>
                    {ev.attachmentUrl && (
                      <a
                        href={ev.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="
                          flex items-center gap-1 font-semibold text-[#2487B8]
                          hover:underline
                        "
                      >
                        <Paperclip className="size-3" />
                        Télécharger le programme
                      </a>
                    )}
                  </div>

                  {ev.description && (
                    <p className="pt-1 text-xs/relaxed text-slate-600">
                      {ev.description}
                    </p>
                  )}
                </div>
              </div>

              {/* My Status Banner */}
              {!ev.isCancelled && (ev.myRsvpStatus || ev.myCheckedIn) && (
                <div className="
                  mt-3 flex flex-wrap items-center justify-between gap-2
                  rounded-xl border bg-white p-2.5 text-xs
                "
                >
                  <div className="flex items-center gap-2">
                    {ev.myIsWaitlisted
                      ? (
                          <span className="
                            rounded-full bg-amber-100 px-2 py-0.5 text-[10px]
                            font-black text-amber-800
                          "
                          >
                            Sur liste d'attente (position #
                            {ev.myWaitlistPosition}
                            )
                          </span>
                        )
                      : ev.myRsvpStatus === 'going'
                        ? (
                            <span className="
                              flex items-center gap-1 rounded-full
                              bg-emerald-100 px-2 py-0.5 text-[10px] font-black
                              text-emerald-800
                            "
                            >
                              <CheckCircle2 className="size-3" />
                              Votre participation est confirmée
                            </span>
                          )
                        : ev.myRsvpStatus === 'maybe'
                          ? (
                              <span className="
                                rounded-full bg-slate-100 px-2 py-0.5
                                text-[10px] font-bold text-slate-700
                              "
                              >
                                Votre réponse : Peut-être
                              </span>
                            )
                          : null}

                    {ev.myCheckedIn && (
                      <span className="
                        flex items-center gap-1 rounded-full bg-emerald-600 px-2
                        py-0.5 text-[10px] font-black text-white
                      "
                      >
                        ✓ Présence validée
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Modifiable à tout moment avant l'événement
                  </p>
                </div>
              )}

              {/* RSVP Action Buttons */}
              {!ev.isCancelled && (
                <div className="
                  mt-4 flex flex-wrap items-center gap-2 border-t
                  border-slate-100 pt-3
                "
                >
                  {RSVP_OPTIONS.map((opt) => {
                    const isSelected = ev.myRsvpStatus === opt.value;
                    let label = opt.label;
                    if (opt.value === 'going' && ev.isFull && !isSelected) {
                      label = 'Rejoindre la liste d\'attente';
                    }

                    return (
                      <button
                        key={opt.value}
                        disabled={updating === ev.id}
                        onClick={() => handleRsvp(ev.id, opt.value)}
                        className={`
                          h-8 cursor-pointer rounded-lg px-3 text-xs font-bold
                          transition-all
                          ${
                      isSelected
                        ? opt.value === 'going'
                          ? ev.myIsWaitlisted
                            ? 'bg-amber-500 text-white'
                            : 'bg-[#2487B8] text-white shadow-xs'
                          : 'bg-slate-700 text-white'
                        : `
                          bg-slate-100 text-slate-600
                          hover:bg-slate-200
                        `
                      }
                        `}
                      >
                        {isSelected && opt.value === 'going' && !ev.myIsWaitlisted ? '✓ ' : ''}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Dynamic feedback message */}
              {feedback?.id === ev.id && (
                <p
                  className={`
                    mt-2 text-xs font-semibold
                    ${
                feedback.isError ? 'text-rose-600' : 'text-emerald-700'
                }
                  `}
                >
                  {feedback.message}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
