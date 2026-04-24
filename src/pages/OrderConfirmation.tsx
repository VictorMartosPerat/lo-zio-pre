import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  CreditCard,
  Banknote,
  Home,
  Loader2,
  User,
  Info,
} from "lucide-react";

interface Order {
  id: string;
  guest_name: string;
  guest_email: string;
  order_type: string;
  delivery_address: string | null;
  delivery_city: string | null;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const OrderConfirmation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      // If we came back from a Stripe redirect (Apple Pay / Google Pay / 3DS),
      // mark the order as paid based on the payment_intent in the URL.
      const paymentIntentId = searchParams.get("payment_intent");
      const redirectStatus = searchParams.get("redirect_status");
      if (paymentIntentId && redirectStatus === "succeeded") {
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntentId,
          })
          .eq("id", orderId);
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      setOrder(orderData as Order);
      setItems((itemsData as OrderItem[]) || []);
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="w-8 h-8 animate-spin text-menu-teal" />
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 pb-24 px-4 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground mb-4">
            {t("confirmation.notFound")}
          </h1>
          <Button onClick={() => navigate("/")} className="bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display">
            <Home className="w-4 h-4 mr-2" /> {t("confirmation.backHome")}
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";
  const isCash = order.payment_method === "cash";
  const isDelivery = order.order_type === "delivery";
  const estimatedMinutes = isDelivery ? 30 : 20;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <div className="pt-24 md:pt-28 pb-24 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-menu-teal/10 mb-4 animate-fade-in-up">
              <CheckCircle2 className="w-10 h-10 text-menu-teal" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              {t("confirmation.title")}
            </h1>
            <p className="text-muted-foreground font-body">
              {t("confirmation.subtitle")}
            </p>
          </div>

          {/* Estimated time */}
          <div className="bg-menu-teal/5 border border-menu-teal/20 rounded-xl p-5 mb-6 flex items-center gap-4">
            <div className="bg-menu-teal/10 rounded-full p-3 shrink-0">
              <Clock className="w-6 h-6 text-menu-teal" />
            </div>
            <div>
              <p className="font-display font-bold text-foreground">
                {t("confirmation.estimatedTime", { minutes: estimatedMinutes })}
              </p>
              <p className="text-sm text-muted-foreground font-body">
                {isDelivery ? t("confirmation.deliveryNote") : t("confirmation.pickupNote")}
              </p>
            </div>
          </div>

          {/* Order details */}
          <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-bold text-foreground">
                {t("confirmation.orderDetails")}
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                #{order.id.split("-")[0].toUpperCase()}
              </span>
            </div>

            {/* Items */}
            <div className="px-6 py-4 space-y-3 border-b border-border">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="font-body text-sm text-foreground">
                    <span className="font-bold text-menu-teal mr-2">×{item.quantity}</span>
                    {item.item_name}
                  </span>
                  <span className="font-display font-bold text-sm text-foreground shrink-0">
                    {item.total_price.toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-border">
              <span className="font-display font-bold text-foreground">{t("cart.total")}</span>
              <span className="font-display text-xl font-bold text-menu-teal">
                {order.total_amount.toFixed(2)} €
              </span>
            </div>

            {/* Type + Payment row */}
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                {isDelivery ? (
                  <MapPin className="w-4 h-4 text-menu-teal mt-0.5 shrink-0" />
                ) : (
                  <Store className="w-4 h-4 text-menu-teal mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground font-body">
                    {t("confirmation.orderType")}
                  </p>
                  <p className="font-display font-bold text-sm text-foreground">
                    {isDelivery ? t("checkout.delivery") : t("checkout.pickup")}
                  </p>
                  {isDelivery && order.delivery_address && (
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      {order.delivery_address}
                      {order.delivery_city ? `, ${order.delivery_city}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                {isCash ? (
                  <Banknote className="w-4 h-4 text-menu-teal mt-0.5 shrink-0" />
                ) : (
                  <CreditCard className="w-4 h-4 text-menu-teal mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground font-body">
                    {t("confirmation.payment")}
                  </p>
                  <p className="font-display font-bold text-sm text-foreground">
                    {isCash ? t("checkout.cashPayment") : t("checkout.onlinePayment")}
                  </p>
                  {!isCash && (
                    <p
                      className={`text-xs font-body mt-0.5 ${
                        isPaid ? "text-green-600" : "text-amber-500"
                      }`}
                    >
                      {isPaid ? t("confirmation.paid") : t("confirmation.pendingPayment")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="px-6 pb-4">
                <p className="text-xs text-muted-foreground font-body">{t("checkout.notesTitle")}</p>
                <p className="text-sm text-foreground font-body mt-0.5">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Contact info reminder */}
          <p className="text-center text-sm text-muted-foreground font-body mb-8">
            {t("confirmation.contactReminder", { email: order.guest_email })}
          </p>

          <div className="flex justify-center">
            <Button
              onClick={() => navigate("/")}
              className="bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display px-8 py-6 text-base"
            >
              <Home className="w-4 h-4 mr-2" />
              {t("confirmation.backHome")}
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default OrderConfirmation;
