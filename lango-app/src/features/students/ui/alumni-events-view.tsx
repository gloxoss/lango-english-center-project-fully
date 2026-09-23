'use client';

import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type EventRow = { id: string; title: string; description: string | null; location: string | null; startsAt: string; rsvpCounts: Record<string, number> };

export function AlumniEventsView() {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startsAt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/students/alumni/events?pageSize=100').then(r => r.json()).then(j => j?.success && setEvents(j.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.startsAt) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/students/alumni/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), description: form.description || undefined, location: form.location || undefined, startsAt: new Date(form.startsAt).toISOString() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Échec de la création.');
        return;
      }
      setShowForm(false);
      setForm({ title: '', description: '', location: '', startsAt: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`${tCommon('delete')} ?`)) {
      return;
    }
    await fetch(`/api/students/alumni/events?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('alumniEventsTitle')}</h1>
        <Button
          size="sm"
          onClick={() => setShowForm(v => !v)}
          className="
            h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs text-white
            hover:bg-[#1B6C93]
          "
        >
          <Plus className="size-3.5" />
          {t('newEvent')}
        </Button>
      </div>

      {showForm && (
        <Card className="
          space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        >
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <Input
            placeholder={tCommon('name')}
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="h-9 rounded-xl text-xs"
          />
          <Input
            placeholder="Lieu"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
            className="h-9 rounded-xl text-xs"
          />
          <Input
            type="datetime-local"
            value={form.startsAt}
            onChange={e => setForm({ ...form, startsAt: e.target.value })}
            className="h-9 rounded-xl text-xs"
          />
          <textarea
            placeholder={tCommon('description')}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="
              w-full resize-none rounded-xl border border-slate-200 px-3 py-2
              text-xs
            "
          />
          <Button
            size="sm"
            disabled={saving}
            onClick={handleCreate}
            className="
              h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white
              hover:bg-[#1B6C93]
            "
          >
            {saving ? tCommon('loading') : tCommon('save')}
          </Button>
        </Card>
      )}

      <div className="space-y-2">
        {events.length === 0 && (
          <Card className="
            flex flex-col items-center justify-center gap-3 rounded-2xl border
            border-slate-200/80 bg-white p-12 text-center shadow-2xs
          "
          >
            <CalendarDays className="size-10 text-slate-200" />
            <p className="text-sm font-bold text-slate-400">{tCommon('empty')}</p>
          </Card>
        )}
        {events.map(ev => (
          <Card
            key={ev.id}
            className="
              flex items-center justify-between gap-3 rounded-2xl border
              border-slate-200/80 bg-white p-4 shadow-2xs
            "
          >
            <div>
              <p className="text-sm font-extrabold text-[#16212B]">{ev.title}</p>
              <p className="text-[10px] text-slate-400">
                {new Date(ev.startsAt).toLocaleString()}
                {' '}
                {ev.location ? `· ${ev.location}` : ''}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {t('participantsCount', { count: ev.rsvpCounts.going ?? 0, maybe: ev.rsvpCounts.maybe ?? 0 })}
              </p>
            </div>
            <button
              onClick={() => handleDelete(ev.id)}
              aria-label={tCommon('delete')}
              className="
                shrink-0 rounded-lg p-1.5 text-slate-400
                hover:bg-rose-50 hover:text-rose-600
              "
            >
              <Trash2 className="size-3.5" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
