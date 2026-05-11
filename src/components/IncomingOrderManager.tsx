import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Truck, Store, Phone, User, Minus, Plus, Check, Repeat, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { telHref } from "@/lib/validators";
import { usePizzeriaRole, type PizzeriaSlug } from "@/hooks/usePizzeriaRole";
import { useDoorbellAlarm } from "@/hooks/useDoorbellAlarm";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IncomingOrder {
  id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  order_type: string;
  pickup_store: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  total_amount: number;
  notes: string | null;
  assigned_to: string | null;
  transferred_from: string | null;
  payment_status?: string | null;
}

interface OrderItem {
  id: string;
  item_name: string;
  item_description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const STORE_PHONES: Record<PizzeriaSlug, string> = {
  tarragona: "+34 687 605 647",
  arrabassada: "+34 682 239 035",
};

const STORE_LABELS: Record<PizzeriaSlug, string> = {
  tarragona: "Tarragona",
  arrabassada: "Arrabassada",
};

const TIME_MIN = 15;
const TIME_MAX = 90;
const TIME_STEP = 15;
const TIME_DEFAULT_PICKUP = 15;
const TIME_DEFAULT_DELIVERY = 45;
const defaultTimeFor = (orderType?: string) =>
  orderType === "delivery" ? TIME_DEFAULT_DELIVERY : TIME_DEFAULT_PICKUP;

const IncomingOrderManager = () => {
  const { t, i18n } = useTranslation();
  const { pizzeria } = usePizzeriaRole();
  const { start: startAlarm, stop: stopAlarm } = useDoorbellAlarm();

  const [queue, setQueue] = useState<IncomingOrder[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [estimatedTime, setEstimatedTime] = useState(TIME_DEFAULT_PICKUP);
  const [busy, setBusy] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const current = queue[0] ?? null;

  // Subscribe to new orders for this pizzeria
  useEffect(() => {
    if (!pizzeria) return;

    const channel = supabase
      .channel(`new-orders-${pizzeria}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `assigned_to=eq.${pizzeria}`,
        },
        (payload) => {
          const order = payload.new as IncomingOrder;
          if (seenIdsRef.current.has(order.id)) return;
          seenIdsRef.current.add(order.id);
          setQueue((q) => [...q, order]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const order = payload.new as IncomingOrder & { status?: string };
          const prev = payload.old as Partial<IncomingOrder & { status?: string }>;

          // Case A: order was transferred TO us and is still pending → enqueue
          const becameOurs =
            order.assigned_to === pizzeria && prev.assigned_to !== pizzeria;
          if (becameOurs && order.status === "pending") {
            if (!seenIdsRef.current.has(order.id)) {
              seenIdsRef.current.add(order.id);
              setQueue((q) => [...q, order]);
            }
            return;
          }

          // Case B: order is no longer pending OR was transferred AWAY from us
          // → remove from queue on every device so alarm/popup stops everywhere
          const noLongerPending = prev.status === "pending" && order.status !== "pending";
          const transferredAway =
            prev.assigned_to === pizzeria && order.assigned_to !== pizzeria;
          if (noLongerPending || transferredAway) {
            setQueue((q) => q.filter((o) => o.id !== order.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pizzeria]);

  // Whenever the head of the queue changes, load items + start alarm + reset time
  useEffect(() => {
    if (!current) {
      stopAlarm();
      return;
    }
    setEstimatedTime(defaultTimeFor(current.order_type));
    setItems([]);
    startAlarm();

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", current.id);
      if (!cancelled) setItems((data as OrderItem[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [current, startAlarm, stopAlarm]);

  const dequeue = useCallback(() => {
    stopAlarm();
    setQueue((q) => q.slice(1));
  }, [stopAlarm]);

  const sendStatusEmail = async (
    order: IncomingOrder,
    status: "confirmed" | "cancelled",
    extras: { estimatedMinutes?: number; rejectionReason?: string } = {},
  ) => {
    try {
      const minutes = extras.estimatedMinutes ?? 45;
      let readyTime: string | undefined;
      if (status === "confirmed") {
        const ready = new Date(Date.now() + minutes * 60_000);
        readyTime = `${String(ready.getHours()).padStart(2, "0")}:${String(ready.getMinutes()).padStart(2, "0")}`;
      }
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "order-status-update",
          recipientEmail: order.guest_email,
          idempotencyKey: `order-status-${order.id}-${status}`,
          templateData: {
            guestName: order.guest_name,
            shortId: String(order.id).slice(0, 8).toUpperCase(),
            totalAmount: Number(order.total_amount) || 0,
            status,
            estimatedMinutes: minutes,
            readyTime,
            rejectionReason: extras.rejectionReason,
            pickupStore: order.pickup_store ?? null,
            refunded: status === "cancelled" && order.payment_status === "refunded",
          },
        },
      });
    } catch (e) {
      console.error("send-transactional-email failed", e);
    }
  };

  const handleAccept = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          estimated_time: estimatedTime,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      if (error) throw error;
      void sendStatusEmail(current, "confirmed", { estimatedMinutes: estimatedTime });
      dequeue();
    } catch (e) {
      toast.error(t("incomingOrder.actionError"));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!current || !pizzeria) return;
    const target: PizzeriaSlug = pizzeria === "tarragona" ? "arrabassada" : "tarragona";
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          assigned_to: target,
          transferred_from: pizzeria,
        })
        .eq("id", current.id);
      if (error) throw error;
      dequeue();
    } catch (e) {
      toast.error(t("incomingOrder.actionError"));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!current || !pizzeria) return;
    const rejectionReason = t("incomingOrder.customerRejectedMessage", { phone: STORE_PHONES[pizzeria] });
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          rejection_reason: rejectionReason,
        })
        .eq("id", current.id);
      if (error) throw error;
      void sendStatusEmail(current, "cancelled", { rejectionReason });
      setShowRejectConfirm(false);
      dequeue();
    } catch (e) {
      toast.error(t("incomingOrder.actionError"));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (!pizzeria || !current) return null;

  const isTransferred = !!current.transferred_from;
  const fromLabel = current.transferred_from
    ? STORE_LABELS[current.transferred_from as PizzeriaSlug] ?? current.transferred_from
    : "";
  const otherLabel = pizzeria === "tarragona" ? "Arrabassada" : "Tarragona";
  const transferKey = pizzeria === "tarragona"
    ? "incomingOrder.transferToArrabassada"
    : "incomingOrder.transferToTarragona";

  return (
    <>
      <div
        className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        style={{ zIndex: 9999 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-card text-card-foreground border-2 border-primary rounded-2xl shadow-2xl w-full max-w-lg my-auto overflow-hidden">
          {isTransferred && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-sm font-medium text-center">
              {t("incomingOrder.transferredBanner", { from: fromLabel })}
            </div>
          )}
          {/* Pulsing header */}
          <div className="bg-primary text-primary-foreground px-5 py-4 flex items-center gap-3">
            <Bell className="h-6 w-6 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-bold flex-1">
              🔔 {t("incomingOrder.title")}
            </h2>
            {queue.length > 1 && (
              <span className="text-xs bg-primary-foreground/20 px-2 py-1 rounded-full">
                {t("incomingOrder.queueBadge", { count: queue.length - 1 })}
              </span>
            )}
          </div>

          {/* Compact header: customer, phone, type — always visible, no scroll */}
          <div className="px-4 pt-3 pb-2 space-y-1.5 border-b border-border/40">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">{current.guest_name}</span>
              </div>
              <a
                href={telHref(current.guest_phone)}
                className="flex items-center gap-1 text-sm text-primary shrink-0"
              >
                <Phone className="h-4 w-4" />
                <span className="tabular-nums">{current.guest_phone}</span>
              </a>
            </div>
            {current.order_type === "delivery" ? (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="leading-tight">
                  <span className="font-medium text-foreground">{t("incomingOrder.delivery")}</span>
                  {current.delivery_address && (
                    <> — {current.delivery_address}{current.delivery_city ? `, ${current.delivery_city}` : ""}</>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{t("incomingOrder.pickup")}</span>
              </div>
            )}
          </div>

          {/* Items — prioritized: gets the bulk of the scrollable space */}
          <div className="px-4 py-3 max-h-[40vh] sm:max-h-[45vh] overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {t("incomingOrder.items")}
            </div>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {it.quantity}× {it.item_name}
                    </div>
                    {it.item_description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{it.item_description}</div>
                    )}
                  </div>
                  <div className="font-semibold tabular-nums shrink-0">
                    {it.total_price.toFixed(2)}€
                  </div>
                </li>
              ))}
            </ul>
            {current.notes && (
              <div className="mt-3 text-xs italic text-muted-foreground border-l-2 border-primary pl-2">
                {current.notes}
              </div>
            )}
          </div>

          {/* Total + estimated time — pinned, never scrolled away */}
          <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm uppercase tracking-wide text-muted-foreground">
                {t("incomingOrder.total")}
              </span>
              <span className="text-2xl font-bold text-primary">
                {Number(current.total_amount).toFixed(2)}€
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                {t("incomingOrder.estimatedTime")}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12"
                  onClick={() => setEstimatedTime((v) => Math.max(TIME_MIN, v - TIME_STEP))}
                  disabled={estimatedTime <= TIME_MIN || busy}
                  aria-label="-15"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums">
                  {estimatedTime}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {t("incomingOrder.minutes")}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12"
                  onClick={() => setEstimatedTime((v) => Math.min(TIME_MAX, v + TIME_STEP))}
                  disabled={estimatedTime >= TIME_MAX || busy}
                  aria-label="+15"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="border-t border-border p-3 sm:p-4 flex flex-col gap-2 bg-muted/30">
            <Button
              onClick={handleAccept}
              disabled={busy}
              className="w-full min-h-[56px] text-base font-semibold"
              size="lg"
            >
              <Check className="h-5 w-5" />
              {t("incomingOrder.accept", { minutes: estimatedTime })}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleTransfer}
                disabled={busy}
                variant="secondary"
                className="min-h-[56px] px-2 text-xs sm:text-sm leading-tight whitespace-normal"
              >
                <Repeat className="h-4 w-4" />
                <span className="hidden sm:inline">{t(transferKey)}</span>
                <span className="sm:hidden">→ {otherLabel}</span>
              </Button>
              <Button
                onClick={() => setShowRejectConfirm(true)}
                disabled={busy}
                variant="destructive"
                className="min-h-[56px] px-2 text-xs sm:text-sm leading-tight whitespace-normal"
              >
                <X className="h-4 w-4" />
                {t("incomingOrder.reject")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent style={{ zIndex: 10000 }}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("incomingOrder.confirmRejectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("incomingOrder.confirmRejectDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("incomingOrder.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReject(); }}
              disabled={busy}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("incomingOrder.confirmReject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default IncomingOrderManager;
