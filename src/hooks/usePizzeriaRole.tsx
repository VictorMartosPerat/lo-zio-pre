import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PizzeriaSlug = "tarragona" | "arrabassada";

interface PizzeriaRoleState {
  pizzeria: PizzeriaSlug | null;
  loading: boolean;
}

const CACHE_KEY = "lozio_pizzeria_role";

/**
 * Returns which pizzeria the current user is staff of, if any.
 * Powered by the user_roles table — pizzeriaTarragona / pizzeriaArrabassada.
 * Cached in localStorage so the realtime subscription fires immediately on reload.
 */
export const usePizzeriaRole = (): PizzeriaRoleState => {
  const { user, loading: authLoading } = useAuth();
  const [pizzeria, setPizzeria] = useState<PizzeriaSlug | null>(() => {
    try {
      const v = localStorage.getItem(CACHE_KEY);
      return v === "tarragona" || v === "arrabassada" ? v : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setPizzeria(null);
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }

    if (pizzeria) setLoading(false); // unblock instantly when cached

    const check = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["pizzeriaTarragona", "pizzeriaArrabassada"] as const);

      const roles = (data ?? []).map((r) => r.role as string);
      let next: PizzeriaSlug | null = null;
      if (roles.includes("pizzeriaTarragona")) next = "tarragona";
      else if (roles.includes("pizzeriaArrabassada")) next = "arrabassada";

      setPizzeria(next);
      try {
        if (next) localStorage.setItem(CACHE_KEY, next);
        else localStorage.removeItem(CACHE_KEY);
      } catch {
        /* ignore */
      }
      setLoading(false);
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  return { pizzeria, loading };
};
