import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OrderStatusAnimation from "@/components/OrderStatusAnimation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  Clock,
  Store,
  Truck,
  CreditCard,
  Banknote,
  ChevronDown,
  ChevronUp,
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
  guest_phone: string;
  order_type: string;
  pickup_store: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  payment_method: string;
  payment_status: string;
  status: string;
  notes: string | null;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

const PROGRESS_STEPS = [
  { key: "pending",   label: "Recibido" },
  { key: "confirmed", label: "Confirmado" },
  { key: "preparing", label: "Preparando" },
  { key: "ready",     label: "Listo" },
  { key: "delivered", label: "Entregado" },
];

const STATUS_LABELS: Record<string, string> = {
  pending:   "Recibido",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready:     "Listo para recoger",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const getStatusLabel = (status: string, orderType: string) => {
  if (status === "ready"     && orderType === "delivery") return "En camino";
  if (status === "delivered" && orderType === "delivery") return "Entregado";
  return STATUS_LABELS[status] ?? status;
};

const getStepLabel = (key: string, orderType: string) => {
  if (orderType === "delivery") {
    if (key === "ready") return "En camino";
  }
  return PROGRESS_STEPS.find((s) => s.key === key)?.label ?? key;
};

const STORE_NAMES: Record<string, string> = {
  tarragona:   "Lo Zio Tarragona",
  arrabassada: "Lo Zio Arrabassada",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid:    "bg-green-100 text-green-800 border-green-200",
  failed:  "bg-red-100 text-red-800 border-red-200",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Sin cobrar",
  paid:    "Pagado",
  failed:  "Fallido",
};

const MyOrders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchOrders();

    const channel = supabase
      .channel("my-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Error al cargar los pedidos");
    else setOrders((data as Order[]) || []);
    setLoading(false);
  };

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const shortId = (id: string) => id.slice(0, 8).toUpperCase();

  const activeStep = (status: string) => {
    if (status === "cancelled") return -1;
    return PROGRESS_STEPS.findIndex((s) => s.key === status);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-menu-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar forceSolid />
      <div className="pt-24 md:pt-28 pb-16 px-3 md:px-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Mis pedidos
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {orders.length} pedido{orders.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchOrders}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="font-display font-bold text-lg text-foreground mb-2">Sin pedidos aún</p>
            <p className="text-muted-foreground text-sm mb-6">
              Cuando realices un pedido aparecerá aquí.
            </p>
            <Button
              onClick={() => navigate("/#menu")}
              className="bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display"
            >
              Ver menú
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const step = activeStep(order.status);
              const cancelled = order.status === "cancelled";
              const expanded = expandedIds.has(order.id);

              return (
                <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => toggle(order.id)}
                    className="w-full text-left px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{shortId(order.id)}
                          </span>
                          <Badge
                            className={`text-[10px] border ${
                              cancelled
                                ? "bg-red-100 text-red-800 border-red-200"
                                : order.status === "ready"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : order.status === "delivered"
                                ? "bg-gray-100 text-gray-600 border-gray-200"
                                : "bg-orange-100 text-orange-800 border-orange-200"
                            }`}
                          >
                            {getStatusLabel(order.status, order.order_type)}
                          </Badge>
                          <Badge
                            className={`text-[10px] border ${PAYMENT_STATUS_STYLES[order.payment_status]}`}
                          >
                            {PAYMENT_STATUS_LABELS[order.payment_status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(order.created_at), "d MMM · HH:mm", { locale: es })}
                          </span>
                          <span className="flex items-center gap-1">
                            {order.order_type === "delivery" ? (
                              <><Truck className="w-3 h-3" /> Reparto</>
                            ) : (
                              <><Store className="w-3 h-3" />
                                {order.pickup_store ? STORE_NAMES[order.pickup_store] : "Recogida"}
                              </>
                            )}
                          </span>
                          <span className="font-semibold text-foreground ml-auto">
                            {order.total_amount.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 shrink-0">
                        {expanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {/* Status animation */}
                    {!cancelled && (
                      <div className="mt-4">
                        <OrderStatusAnimation
                          status={order.status}
                          orderType={order.order_type}
                        />
                      </div>
                    )}

                    {/* Progress bar */}
                    {!cancelled && (
                      <div className="mt-4">
                        <div className="flex items-center gap-0">
                          {PROGRESS_STEPS.map((s, i) => {
                            const done = i <= step;
                            const isLast = i === PROGRESS_STEPS.length - 1;
                            return (
                              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1">
                                  <div
                                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                                      done
                                        ? "bg-menu-teal border-menu-teal"
                                        : "bg-background border-border"
                                    } ${i === step ? "ring-2 ring-menu-teal/30" : ""}`}
                                  />
                                  <span
                                    className={`text-[9px] leading-tight text-center w-12 ${
                                      done ? "text-menu-teal font-semibold" : "text-muted-foreground"
                                    }`}
                                  >
                                    {getStepLabel(s.key, order.order_type)}
                                  </span>
                                </div>
                                {!isLast && (
                                  <div
                                    className={`flex-1 h-0.5 mb-3 mx-0.5 transition-all ${
                                      i < step ? "bg-menu-teal" : "bg-border"
                                    }`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {cancelled && (
                      <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        Este pedido fue cancelado.
                      </div>
                    )}
                  </button>

                  {/* Expanded */}
                  {expanded && (
                    <div className="border-t border-border px-4 py-4 space-y-4">
                      {/* Items */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Artículos
                        </p>
                        <div className="space-y-1.5">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex justify-between gap-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-foreground">
                                  {item.quantity}× {item.item_name}
                                </span>
                                {item.item_description && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.item_description}
                                  </p>
                                )}
                              </div>
                              <span className="text-muted-foreground shrink-0">
                                {item.total_price.toFixed(2)} €
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Nota: </span>{order.notes}
                        </div>
                      )}

                      {/* Footer info */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                        <span className="flex items-center gap-1">
                          {order.payment_method === "cash"
                            ? <><Banknote className="w-3 h-3" /> Efectivo</>
                            : <><CreditCard className="w-3 h-3" /> Tarjeta</>
                          }
                        </span>
                        <span className="font-display font-bold text-base text-foreground">
                          {order.total_amount.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default MyOrders;
