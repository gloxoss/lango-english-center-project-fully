'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LinkedChildOption } from '@/components/parent/ChildContextSwitcher';

export type ActiveChild = {
  relationshipId: string;
  studentId: string;
  name: string | null;
  rights: {
    academic: boolean;
    attendance: boolean;
    finance: boolean;
    medical: boolean;
    communication: boolean;
  };
  isPrimaryContact: boolean;
};

type HomeData = {
  children: LinkedChildOption[];
  activeChild: ActiveChild | null;
};

// Shared parent child-context: fetches the household home once, exposes the
// active child + children for the switcher. `child` is reauthorized
// server-side (a non-owned relationship is a uniform 404), so the client id is
// never trusted as authorization.
export function useParentChildContext() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (child?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = child ? `/api/guardian/me/home?child=${encodeURIComponent(child)}` : '/api/guardian/me/home';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data as HomeData);
      } else {
        setError(json.error?.message ?? 'Erreur lors du chargement.');
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

  const switchTo = useCallback(
    (relationshipId: string) => {
      if (relationshipId === data?.activeChild?.relationshipId) return;
      load(relationshipId);
    },
    [data?.activeChild?.relationshipId, load],
  );

  return { data, loading, error, switchTo, reload: load };
}
