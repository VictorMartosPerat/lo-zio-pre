import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DiscountReason =
  | "not_logged_in"
  | "unknown_code"
  | "inactive"
  | "expired"
  | "usage_limit_reached"
  | "min_order_not_met"
  | "already_used"
  | "not_assigned"
  | "rate_limited";

export interface AppliedDiscount {
  discount_id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  discount_amount: number;
  /** True when the user typed the code manually; false when auto-applied. */
  manual: boolean;
}

interface UseDiscountOptions {
  subtotal: number;
  /** Minimum subtotal required before any auto-apply lookup. */
  enabled?: boolean;
}

export function useDiscount({ subtotal, enabled = true }: UseDiscountOptions) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DiscountReason | null>(null);
  const autoTriedSubtotalRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    setApplied(null);
    setError(null);
    setCode("");
  }, []);

  const apply = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (!user) {
        setError("not_logged_in");
        return;
      }
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc(
        "validate_discount_preview",
        { p_code: trimmed, p_subtotal: subtotal },
      );
      setLoading(false);
      if (rpcError) {
        setError("unknown_code");
        return;
      }
      const result = data as {
        valid: boolean;
        reason?: DiscountReason;
        discount_id?: string;
        code?: string;
        name?: string;
        description?: string | null;
        discount_type?: "percentage" | "fixed_amount";
        discount_value?: number;
        discount_amount?: number;
      };
      if (!result.valid) {
        setError(result.reason || "unknown_code");
        return;
      }
      setApplied({
        discount_id: result.discount_id!,
        code: result.code!,
        name: result.name!,
        description: result.description ?? null,
        discount_type: result.discount_type!,
        discount_value: Number(result.discount_value),
        discount_amount: Number(result.discount_amount),
        manual: true,
      });
    },
    [user, subtotal],
  );

  // Auto-apply best assigned discount on mount (and when subtotal changes
  // significantly enough that it could re-qualify).
  useEffect(() => {
    if (!enabled || !user || subtotal <= 0) return;
    if (applied) return; // don't override an existing applied discount
    if (autoTriedSubtotalRef.current === subtotal) return;
    autoTriedSubtotalRef.current = subtotal;

    let cancelled = false;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "get_best_assigned_discount",
        { p_subtotal: subtotal },
      );
      if (cancelled || rpcError || !data) return;
      const r = data as {
        discount_id: string;
        code: string;
        name: string;
        description: string | null;
        discount_type: "percentage" | "fixed_amount";
        discount_value: number;
        discount_amount: number;
      };
      setApplied({
        discount_id: r.discount_id,
        code: r.code,
        name: r.name,
        description: r.description,
        discount_type: r.discount_type,
        discount_value: Number(r.discount_value),
        discount_amount: Number(r.discount_amount),
        manual: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subtotal, enabled, applied]);

  // If subtotal changes and an applied discount is now invalid (e.g. below
  // min_order_amount), recompute amount; in this v1 just keep the percentage
  // recalculation path simple.
  useEffect(() => {
    if (!applied) return;
    if (applied.discount_type === "percentage") {
      const recomputed = Math.round((subtotal * applied.discount_value) / 100 * 100) / 100;
      const clamped = Math.min(recomputed, subtotal);
      if (Math.abs(clamped - applied.discount_amount) > 0.005) {
        setApplied({ ...applied, discount_amount: clamped });
      }
    } else {
      const clamped = Math.min(applied.discount_value, subtotal);
      if (Math.abs(clamped - applied.discount_amount) > 0.005) {
        setApplied({ ...applied, discount_amount: clamped });
      }
    }
  }, [subtotal, applied]);

  return { code, setCode, apply, clear, applied, error, loading };
}
