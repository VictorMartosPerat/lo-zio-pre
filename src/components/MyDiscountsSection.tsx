import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface MyDiscount {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  expires_at: string;
}

export const MyDiscountsSection = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<MyDiscount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("list_my_discounts");
      if (cancelled) return;
      if (error) {
        setItems([]);
        return;
      }
      setItems((data as MyDiscount[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items || items.length === 0) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="bg-card rounded-lg p-6 shadow-lg border border-border mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🏷️</span>
        <h2 className="font-display text-lg font-bold text-foreground">
          {t("profile.discounts.title")}
        </h2>
      </div>
      <ul className="space-y-3">
        {items.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 bg-menu-teal/10 border border-menu-teal/30 rounded-lg p-4"
          >
            <div className="min-w-0">
              <div className="font-display font-bold text-menu-teal">{d.code}</div>
              <div className="text-sm text-foreground font-body">{d.name}</div>
              <div className="text-xs text-muted-foreground font-body">
                {d.discount_type === "percentage"
                  ? `${d.discount_value}%`
                  : `${Number(d.discount_value).toFixed(2)} €`}
                {d.min_order_amount
                  ? ` · ${t("profile.discounts.min", { amount: Number(d.min_order_amount).toFixed(2) })}`
                  : ""}
                {" · "}
                {t("profile.discounts.expires", { date: fmt(d.expires_at) })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/pedido")}
              className="text-sm font-display font-bold text-menu-teal hover:underline whitespace-nowrap"
            >
              {t("profile.discounts.useNow")} →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
