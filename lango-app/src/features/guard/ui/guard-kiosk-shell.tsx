'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authClient } from '@/libs/auth-client';
import { Lock, LockKeyhole, LogOut, ScanLine, ShieldCheck } from 'lucide-react';
import { GuardScannerView } from '@/features/guard/ui/guard-scanner-view';

// Owner decision §15.2 — the kiosk locks itself after a minute of inactivity.
// The lock is enforced server-side (session status -> locked); the only way
// back is a brand-new session, which re-validates the guard's active
// assignment (fail-closed). Nothing is ever written to browser storage.
export const GUARD_KIOSK_IDLE_LOCK_MS = 60_000;

export function GuardKioskShell() {
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'fr';
  const router = useRouter();

  const [kioskSessionId, setKioskSessionId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const sessionRef = useRef<string | null>(null);
  sessionRef.current = kioskSessionId;

  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdle = useCallback(() => {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
  }, []);

  const lockNow = useCallback(async () => {
    const id = sessionRef.current;
    if (!id) return;
    try {
      await fetch(`/api/guard/kiosk-sessions/${id}/lock`, { method: 'POST' });
    } catch {
      // best-effort — a dead session fails closed server-side anyway
    }
    setKioskSessionId(null);
    setLocked(true);
  }, []);

  const armIdle = useCallback(() => {
    clearIdle();
    if (!sessionRef.current) return;
    idleRef.current = setTimeout(() => { void lockNow(); }, GUARD_KIOSK_IDLE_LOCK_MS);
  }, [clearIdle, lockNow]);

  // Reset the idle timer on any user activity while a session is live.
  useEffect(() => {
    const onActivity = () => armIdle();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('mousemove', onActivity);
    return () => {
      clearIdle();
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('mousemove', onActivity);
    };
  }, [armIdle, clearIdle]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push(`/${locale}/login`);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
      {/* Header banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] text-white shadow-2xs">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Kiosque Gardien</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Vérification des badges à l&apos;entrée/sortie — aucune donnée conservée dans ce navigateur.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {locked || !kioskSessionId ? (
            <Badge variant="neutral" className="gap-1 px-3 py-1.5 text-xs font-bold">
              <LockKeyhole className="h-3.5 w-3.5" /> Kiosque sécurisé
            </Badge>
          ) : (
            <Badge variant="success" className="gap-1 px-3 py-1.5 text-xs font-bold">
              <ShieldCheck className="h-3.5 w-3.5" /> Session active
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void handleSignOut()} className="h-9 gap-2 rounded-xl text-xs font-bold">
            <LogOut className="h-3.5 w-3.5" /> Se déconnecter
          </Button>
        </div>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 shadow-2xs">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
            <Lock className="h-9 w-9" />
          </div>
          <div className="mt-6 text-center">
            <h2 className="text-xl font-extrabold text-[#16212B]">Kiosque verrouillé</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              La session a été verrouillée après inactivité. Pour reprendre le scan, démarrez une nouvelle session —
              votre affectation active sera revérifiée côté serveur.
            </p>
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => setLocked(false)}
              className="h-12 gap-2 rounded-2xl bg-[#2487B8] px-6 font-bold text-white hover:bg-[#1B6C93]"
            >
              <ScanLine className="h-4 w-4" /> Démarrer une nouvelle session
            </Button>
            <Button variant="outline" onClick={() => void handleSignOut()} className="h-12 gap-2 rounded-2xl px-6 font-bold">
              <LogOut className="h-4 w-4" /> Se déconnecter
            </Button>
          </div>
        </div>
      ) : (
        <GuardScannerView
          kioskSessionId={kioskSessionId}
          onSessionChange={id => {
            setKioskSessionId(id);
            armIdle();
          }}
          onForceLock={lockNow}
        />
      )}
    </div>
  );
}
