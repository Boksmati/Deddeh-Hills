"use client";

import { useState, useEffect } from "react";

export type Role = "admin" | "investor" | "customer" | null;

/**
 * Returns the current user's role by reading the httpOnly dh_role cookie
 * via the /api/me endpoint. Returns null while loading.
 */
export function useRole(): Role {
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRole(d.role ?? null))
      .catch(() => setRole(null));
  }, []);

  return role;
}
