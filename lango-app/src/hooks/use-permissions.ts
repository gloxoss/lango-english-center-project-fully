'use client';

import { useEffect, useState } from 'react';

// ponytail: same fetch-once-and-cache-in-state pattern already used inline in
// sidebar.tsx, extracted here so every page that needs to hide an action it
// can't perform doesn't re-implement the fetch.
export function usePermissions() {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/permissions')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setPermissions(new Set(json.data.permissions));
          setRole(json.data.role);
        }
      })
      .catch(() => {});
  }, []);

  const can = (permission: string) => permissions !== null && permissions.has(permission);

  return { can, role, loaded: permissions !== null };
}
