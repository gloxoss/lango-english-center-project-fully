'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { FileText, CalendarDays, Users, HeartHandshake, Megaphone } from 'lucide-react';

type Profile = { name: string; profileCompleteness: number; cohortName: string | null };
type Announcement = { id: string; title: string; body: string; publishedAt: string | null };

const QUICK_LINKS = [
  { href: '/records', label: 'Mes dossiers', icon: FileText },
  { href: '/events', label: 'Événements', icon: CalendarDays },
  { href: '/directory', label: 'Annuaire', icon: Users },
  { href: '/mentoring', label: 'Mentorat', icon: HeartHandshake },
];

export default function AlumniHomePage() {
  const pathname = usePathname();
  const locale = pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] ?? 'fr';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    fetch('/api/alumni/me/profile').then(r => r.json()).then(j => j?.success && setProfile(j.data));
    fetch('/api/communication/announcements').then(r => r.json()).then(j => j?.success && setAnnouncements(j.data));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
          Bienvenue
          {profile ? `, ${profile.name.split(' ')[0]}` : ''}
        </h1>
        {profile?.cohortName && <p className="text-xs text-slate-500 mt-1">Promotion {profile.cohortName}</p>}
      </div>

      {profile && profile.profileCompleteness < 100 && (
        <Card className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-700">
          Votre profil est complété à
          {' '}
          {profile.profileCompleteness}
          % — complétez-le depuis l&apos;onglet Profil.
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {QUICK_LINKS.map(link => (
          <Link key={link.href} href={`/${locale}/alumni${link.href}`}>
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#2487B8] transition-colors flex flex-col items-center text-center gap-2">
              <link.icon className="w-6 h-6 text-[#2487B8]" />
              <span className="text-xs font-bold text-[#16212B]">{link.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-extrabold text-[#16212B] mb-3 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#2487B8]" />
          Annonces
        </h2>
        <div className="space-y-2">
          {announcements === null && <p className="text-xs text-slate-400">Chargement...</p>}
          {announcements !== null && announcements.length === 0 && (
            <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-xs text-slate-400">Aucune annonce pour le moment.</p>
            </Card>
          )}
          {announcements?.map(a => (
            <Card key={a.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs font-extrabold text-[#16212B]">{a.title}</p>
              <p className="text-xs text-slate-600 mt-1">{a.body}</p>
              {a.publishedAt && <p className="text-[10px] text-slate-400 mt-1.5">{new Date(a.publishedAt).toLocaleDateString('fr-FR')}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
