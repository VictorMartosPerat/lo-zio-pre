import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { locationsData } from "@/lib/locations";
import { toast } from "sonner";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  MapPin,
  Phone,
  User,
  CreditCard,
  Banknote,
  ChevronDown,
  ChevronUp,
  Truck,
  Store,
  MoreVertical,
  ArrowRight,
  XCircle,
  PhoneCall,
  CalendarClock,
} from "lucide-react";

interface OrderItem {
  id: string;
  item_name: string;
  item_description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  order_type: string;
  pickup_store: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  payment_method: string;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  status: string;
  notes: string | null;
  total_amount: number;
  created_at: string;
  scheduled_for: string | null;
  order_items: OrderItem[];
}

const ORDER_STATUSES = [
  { value: "pending", label: "Pendiente", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "confirmed", label: "Confirmado", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "preparing", label: "Preparando", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "ready", label: "Listo", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "delivered", label: "Entregado", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "cancelled", label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200" },
];

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  refunded: "bg-purple-100 text-purple-800 border-purple-200",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Sin cobrar",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
};

const AdminOrders = () => {
  const { store } = useParams<{ store: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const location = store ? locationsData[store] : null;

  const fetchOrders = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("pickup_store", store)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar los pedidos");
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  }, [store]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && !authLoading) navigate("/");
  }, [isAdmin, adminLoading, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin && store) {
      fetchOrders();

      // Real-time subscription
      const channel = supabase
        .channel(`orders-${store}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `pickup_store=eq.${store}` },
          () => fetchOrders(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin, store, fetchOrders]);

  if (!location) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Local no encontrado</p>
      </div>
    );
  }

  const sendOrderStatusEmail = async (
    order: Order,
    status: "confirmed" | "cancelled",
    extras: { estimatedMinutes?: number; rejectionReason?: string; refunded?: boolean } = {},
  ) => {
    if (!order.guest_email) return;
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
            refunded: extras.refunded ?? false,
          },
        },
      });
    } catch (e) {
      console.error("send-transactional-email failed", e);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "confirmed") {
      updates.accepted_at = new Date().toISOString();
    }
    const { error } = await supabase.from("orders").update(updates).eq("id", orderId);

    if (error) {
      toast.error("Error al actualizar el estado");
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      toast.success("Estado actualizado");
      if (newStatus === "confirmed" || newStatus === "cancelled") {
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          void sendOrderStatusEmail(order, newStatus as "confirmed" | "cancelled");
        }
      }
    }
    setUpdatingId(null);
  };

  const cancelAndRefund = async (order: Order) => {
    setUpdatingId(order.id);
    try {
      // 1. If paid by card, issue Stripe refund first
      if (order.payment_status === "paid" && order.stripe_payment_intent_id) {
        const { error: refundError } = await supabase.functions.invoke("refund-order", {
          body: { orderId: order.id },
        });
        if (refundError) throw new Error(refundError.message);
        toast.success("Reembolso emitido correctamente. El cliente lo recibirá en 5–10 días hábiles.");
      }

      // 2. Cancel order
      const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);

      if (error) throw new Error(error.message);

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                status: "cancelled",
                payment_status: order.payment_status === "paid" ? "refunded" : o.payment_status,
              }
            : o,
        ),
      );
      toast.success("Pedido cancelado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al cancelar: ${msg}`);
    }
    setUpdatingId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredOrders = orders.filter((o) => (filterStatus === "all" ? true : o.status === filterStatus));

  const todayOrders = filteredOrders.filter((o) => isToday(new Date(o.created_at)));
  const olderOrders = filteredOrders.filter((o) => !isToday(new Date(o.created_at)));

  const statusInfo = (value: string) => ORDER_STATUSES.find((s) => s.value === value) ?? ORDER_STATUSES[0];

  const shortId = (id: string) => id.slice(0, 8).toUpperCase();

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-menu-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar forceSolid />
      <div className="pt-24 md:pt-28 px-3 md:px-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="mt-0.5 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{location.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {location.address}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {location.phone}
              </span>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={fetchOrders} className="shrink-0">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Hoy", value: orders.filter((o) => isToday(new Date(o.created_at))).length },
            {
              label: "Pendientes",
              value: orders.filter((o) => ["pending", "confirmed", "preparing"].includes(o.status)).length,
            },
            { label: "Listos", value: orders.filter((o) => o.status === "ready").length },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="font-display text-2xl font-bold text-menu-teal">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-muted-foreground shrink-0">Filtrar:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {filteredOrders.length} pedido{filteredOrders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-display font-semibold">No hay pedidos</p>
          </div>
        )}

        {/* Today */}
        {todayOrders.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display font-bold text-sm text-menu-teal uppercase tracking-wider mb-3">
              Hoy — {format(new Date(), "d 'de' MMMM", { locale: es })}
            </h2>
            <div className="space-y-3">
              {todayOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedIds.has(order.id)}
                  onToggle={() => toggleExpand(order.id)}
                  onStatusChange={updateOrderStatus}
                  onCancelAndRefund={cancelAndRefund}
                  updating={updatingId === order.id}
                  shortId={shortId}
                  statusInfo={statusInfo}
                />
              ))}
            </div>
          </section>
        )}

        {/* Older */}
        {olderOrders.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">
              Anteriores
            </h2>
            <div className="space-y-3">
              {olderOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedIds.has(order.id)}
                  onToggle={() => toggleExpand(order.id)}
                  onStatusChange={updateOrderStatus}
                  onCancelAndRefund={cancelAndRefund}
                  updating={updatingId === order.id}
                  shortId={shortId}
                  statusInfo={statusInfo}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
};

interface OrderCardProps {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onCancelAndRefund: (order: Order) => void;
  updating: boolean;
  shortId: (id: string) => string;
  statusInfo: (value: string) => { value: string; label: string; color: string };
}

const OrderCard = ({
  order,
  expanded,
  onToggle,
  onStatusChange,
  onCancelAndRefund,
  updating,
  shortId,
  statusInfo,
}: OrderCardProps) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const info = statusInfo(order.status);
  const nextStatus = NEXT_STATUS[order.status];
  const nextInfo = nextStatus ? ORDER_STATUSES.find((s) => s.value === nextStatus) : null;
  const isDone = order.status === "delivered" || order.status === "cancelled";
  const otherStatuses = ORDER_STATUSES.filter((s) => s.value !== order.status && s.value !== nextStatus);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Card header — always visible */}
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{shortId(order.id)}</span>
            <span className="font-display font-bold text-sm text-foreground truncate">{order.guest_name}</span>
            <Badge className={`text-[10px] border ${info.color}`}>{info.label}</Badge>
            <Badge className={`text-[10px] border ${PAYMENT_STATUS_STYLES[order.payment_status]}`}>
              {PAYMENT_STATUS_LABELS[order.payment_status]}
            </Badge>
            {order.scheduled_for && (
              <Badge className="text-[10px] border bg-purple-100 text-purple-800 border-purple-200 gap-1">
                <CalendarClock className="w-3 h-3" />
                Programado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(order.created_at), "HH:mm")}
            </span>
            {order.scheduled_for && (
              <span className="flex items-center gap-1 font-semibold text-purple-700">
                <CalendarClock className="w-3 h-3" />
                {format(new Date(order.scheduled_for), "d MMM HH:mm", { locale: es })}
              </span>
            )}
            <span className="flex items-center gap-1">
              {order.order_type === "delivery" ? (
                <>
                  <Truck className="w-3 h-3" /> Reparto
                </>
              ) : (
                <>
                  <Store className="w-3 h-3" /> Recogida
                </>
              )}
            </span>
            <span className="flex items-center gap-1">
              {order.payment_method === "cash" ? (
                <>
                  <Banknote className="w-3 h-3" /> Efectivo
                </>
              ) : (
                <>
                  <CreditCard className="w-3 h-3" /> Tarjeta
                </>
              )}
            </span>
            <span className="font-semibold text-foreground ml-auto">{order.total_amount.toFixed(2)} €</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Contact */}
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>{order.guest_name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <a href={/^[+\d\s\-().]{1,20}$/.test(order.guest_phone) ? `tel:${order.guest_phone}` : '#'} className="hover:text-foreground">
                {order.guest_phone}
              </a>
            </div>
            {order.order_type === "delivery" && order.delivery_address && (
              <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {order.delivery_address}
                  {order.delivery_city ? `, ${order.delivery_city}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Artículos</p>
            <div className="space-y-1.5">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">
                      {item.quantity}× {item.item_name}
                    </span>
                    {item.item_description && (
                      <p className="text-xs text-muted-foreground truncate">{item.item_description}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{item.total_price.toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold">Nota: </span>
              {order.notes}
            </div>
          )}

          {/* Status actions */}
          <div className="flex items-center gap-2 pt-1">
            {!isDone && nextInfo ? (
              <Button
                className="flex-1 bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display"
                disabled={updating}
                onClick={() => onStatusChange(order.id, nextInfo.value)}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {nextInfo.label}
              </Button>
            ) : (
              <div className={`flex-1 text-center text-sm font-semibold px-3 py-2 rounded-lg border ${info.color}`}>
                {info.label}
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={updating}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {otherStatuses
                  .filter((s) => s.value !== "cancelled")
                  .map((s) => (
                    <DropdownMenuItem key={s.value} onClick={() => onStatusChange(order.id, s.value)}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                {order.status !== "cancelled" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar pedido
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar el pedido?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás a punto de cancelar el pedido de <strong>{order.guest_name}</strong> por{" "}
                  <strong>{order.total_amount.toFixed(2)} €</strong>.
                </p>

                {order.payment_status === "paid" && (
                  <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                    <span className="text-base leading-none mt-0.5">💳</span>
                    <p>
                      Este pedido fue pagado con tarjeta. Al confirmar la cancelación se emitirá un{" "}
                      <strong>reembolso automático</strong>. El cliente lo recibirá en 5–10 días hábiles.
                    </p>
                  </div>
                )}

                <a
                  href={/^[+\d\s\-().]{1,20}$/.test(order.guest_phone) ? `tel:${order.guest_phone}` : '#'}
                  className="flex items-center gap-2 w-full justify-center rounded-lg border border-border bg-muted/50 hover:bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-colors"
                >
                  <PhoneCall className="w-4 h-4 text-menu-teal" />
                  Llamar a {order.guest_name} — {order.guest_phone}
                </a>
                <p className="text-xs text-muted-foreground">Se recomienda avisar al cliente antes de cancelar.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                onCancelAndRefund(order);
                setShowCancelDialog(false);
              }}
            >
              {order.payment_status === "paid" ? "Cancelar y reembolsar" : "Confirmar cancelación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOrders;
