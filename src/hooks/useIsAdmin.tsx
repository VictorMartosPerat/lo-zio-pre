import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_CACHE_KEY = 'lozio_is_admin';

export const useIsAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  // Read cache immediately — subscription starts without waiting for the DB round-trip
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return localStorage.getItem(ADMIN_CACHE_KEY) === 'true'; } catch { return false; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      try { localStorage.removeItem(ADMIN_CACHE_KEY); } catch { /* ignore */ }
      setLoading(false);
      return;
    }

    // If already cached as admin, unblock loading immediately so realtime subscribes now
    const cached = localStorage.getItem(ADMIN_CACHE_KEY) === 'true';
    if (cached) setLoading(false);

    const check = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      const result = !!data;
      setIsAdmin(result);
      try {
        if (result) {
          localStorage.setItem(ADMIN_CACHE_KEY, 'true');
        } else {
          localStorage.removeItem(ADMIN_CACHE_KEY);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };

    check();
  }, [user, authLoading]);

  return { isAdmin, loading };
};
