import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Store,
  CreditCard,
  Banknote,
  Minus,
  Plus,
  Trash2,
  Clock,
  Phone,
  User,
} from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { locationsData } from "@/lib/locations";
import { getNearestStore } from "@/lib/nearestStore";
import {
  isStoreOpen,
  getScheduleStatus,
  getAvailableDays,
  getTimeSlots,
  formatDayLabel,
  formatTime,
  type ScheduleStatus,
} from "@/lib/storeHours";
import { AlertTriangle, CalendarClock, Zap } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Publishable Stripe key (safe to expose). Override via VITE_STRIPE_PUBLISHABLE_KEY if set.
const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51TKagYE97zvFrxLoMt0lKY9AQT2QGLPS3IjhH1xvZigTxwAbF7CurXX9xSmgVKqPalQKvi9wdN2fS1kG8LjtebmP00I4NCgo2w";
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Inner Stripe payment form — must be rendered inside <Elements>
const StripePaymentForm = ({
  orderId,
  totalPrice,
  customer,
  onBack,
  onSuccess,
}: {
  orderId: string;
  totalPrice: number;
  customer: { name: string; email: string; phone: string };
  onBack: () => void;
  onSuccess: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setErrorMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pedido-confirmado?id=${orderId}`,
        payment_method_data: {
          billing_details: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
          },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMsg(error.message || t("checkout.stripeError"));
      await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", orderId);
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", orderId);
      onSuccess();
      return;
    }

    // For redirect-based methods (e.g. some wallets), browser will be redirected.
    setPaying(false);
  };

  return (
    <form onSubmit={handlePay} className="space-y-6">
      <div className="bg-card rounded-xl p-6 border border-border">
        <h2 className="font-display text-xl font-bold text-foreground mb-4">
          {t("checkout.cardDetails")}
        </h2>
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "auto", googlePay: "auto" },
          }}
        />
        {errorMsg && (
          <p className="text-destructive text-sm mt-3">{errorMsg}</p>
        )}
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          {t("checkout.stripeSecure")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={paying}
          className="sm:w-auto"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("checkout.backToMenu") /* generic back label */}
        </Button>
        <Button
          type="submit"
          disabled={!stripe || paying}
          className="flex-1 bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display text-lg py-7 min-h-[56px]"
        >
          {paying
            ? t("checkout.processing")
            : `${t("checkout.confirmOrder")} · ${totalPrice.toFixed(2)} €`}
        </Button>
      </div>
    </form>
  );
};

const Checkout = () => {
  const { items, totalPrice, updateQuantity, removeItem, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileAddress, setProfileAddress] = useState<{
    address: string;
    city: string;
    postalCode: string;
  } | null>(null);

  // "asap" = as soon as possible (only when open), "scheduled" = user picks time
  const [scheduleMode, setScheduleMode] = useState<"asap" | "scheduled">(() =>
    getScheduleStatus().type === "open" ? "asap" : "scheduled"
  );
  const [scheduledDay, setScheduledDay] = useState<Date>(() => {
    const status = getScheduleStatus();
    return status.type !== "open" ? status.opensAt : new Date();
  });
  const [scheduledTime, setScheduledTime] = useState<string>(() => {
    const status = getScheduleStatus();
    if (status.type !== "open") return formatTime(status.opensAt.getHours(), status.opensAt.getMinutes());
    return "";
  });

  const isCurrentlyOpen = getScheduleStatus().type === "open";

  // Derive the final scheduledFor Date
  const scheduledFor: Date | null = (() => {
    if (scheduleMode === "asap") return null;
    if (!scheduledTime) return null;
    const [h, m] = scheduledTime.split(":").map(Number);
    const d = new Date(scheduledDay);
    d.setHours(h, m, 0, 0);
    return d;
  })();

  // Pre-fill contact info and address from user profile — wait for auth to finish loading
  useEffect(() => {
    if (authLoading || !user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, address, city, postal_code")
        .eq("user_id", user.id)
        .single();
      setForm((prev) => ({
        ...prev,
        name: data?.full_name ?? prev.name,
        phone: data?.phone ?? prev.phone,
        email: user.email ?? prev.email,
      }));
      if (data?.address) {
        setProfileAddress({
          address: data.address ?? "",
          city: data.city ?? "",
          postalCode: data.postal_code ?? "",
        });
      }
    };
    loadProfile();
  }, [user, authLoading]);

  const pickupStores = [
    { id: "tarragona", ...locationsData.tarragona },
    { id: "arrabassada", ...locationsData.arrabassada },
  ];

  const checkoutSchema = z
    .object({
      name: z.string().trim().min(1, t("checkout.nameRequired")).max(100),
      email: z.string().trim().email(t("checkout.emailInvalid")).max(255),
      phone: z.string().trim().min(9, t("checkout.phoneInvalid")).max(20),
      orderType: z.enum(["pickup", "delivery"]),
      pickupStore: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      paymentMethod: z.enum(["cash", "stripe"]),
      notes: z.string().max(500).optional(),
    })
    .refine(
      (data) => {
        if (data.orderType === "pickup") {
          return data.pickupStore && data.pickupStore.length > 0;
        }
        return true;
      },
      { message: "Debes seleccionar en qué local recoges el pedido", path: ["pickupStore"] },
    )
    .refine(
      (data) => {
        if (data.orderType === "delivery") {
          return data.address && data.address.trim().length > 0;
        }
        return true;
      },
      { message: t("checkout.addressRequired"), path: ["address"] },
    );

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    orderType: "pickup" as "pickup" | "delivery",
    pickupStore: "",
    address: "",
    city: "",
    postalCode: "",
    staircase: "",
    floor: "",
    door: "",
    paymentMethod: "cash" as "cash" | "stripe",
    notes: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (items.length === 0) {
      toast.error(t("checkout.emptyCartError"));
      return;
    }

    if (scheduleMode === "scheduled" && !scheduledFor) {
      toast.error("Selecciona una hora para programar tu pedido");
      return;
    }

    const result = checkoutSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      // Determine the fulfillment time (scheduled or now)
      const fulfillAt = scheduledFor ?? new Date();

      // For delivery orders, auto-assign the nearest OPEN store at fulfillment time
      let assignedStore = form.orderType === "pickup" ? form.pickupStore : null;
      if (form.orderType === "delivery") {
        assignedStore = await getNearestStore(form.address, form.city, form.postalCode, fulfillAt);
      }

      // 1. Create order in Supabase
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id || null,
          guest_name: form.name,
          guest_email: form.email,
          guest_phone: form.phone,
          order_type: form.orderType,
          pickup_store: assignedStore,
          delivery_address: form.orderType === "delivery"
            ? [
                form.address,
                form.staircase ? `Esc. ${form.staircase}` : null,
                form.floor ? `Piso ${form.floor}` : null,
                form.door ? `Puerta ${form.door}` : null,
              ].filter(Boolean).join(", ")
            : null,
          delivery_city: form.orderType === "delivery" ? form.city : null,
          delivery_postal_code: form.orderType === "delivery" ? form.postalCode : null,
          payment_method: form.paymentMethod,
          payment_status: "pending",
          notes: form.notes || null,
          total_amount: totalPrice,
          scheduled_for: scheduledFor ? scheduledFor.toISOString() : null,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items (including extras as part of description)
      const orderItems = items.map((item) => {
        const extrasList = (item.extras || [])
          .map((e) => `${e.emoji} ${e.label} ×${e.quantity}`)
          .join(", ");
        const extrasPrice = (item.extras || []).reduce((s, e) => s + e.price * e.quantity, 0);
        const descParts = [
          item.description,
          extrasList ? `Extras: ${extrasList}` : null,
          item.note ? `📝 ${item.note}` : null,
        ].filter(Boolean);
        return {
          order_id: order.id,
          item_name: item.name,
          item_description: descParts.join(" — ") || null,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity + extrasPrice,
        };
      });
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // 3. Stripe payment if selected
      if (form.paymentMethod === "stripe") {
        if (!stripe || !elements) {
          throw new Error(t("checkout.stripeNotLoaded"));
        }

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error(t("checkout.stripeNotLoaded"));
        }

        // Get PaymentIntent clientSecret from Edge Function
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "create-payment-intent",
          { body: { orderId: order.id } },
        );

        if (fnError || !fnData?.clientSecret) {
          throw new Error(fnError?.message || t("checkout.stripeError"));
        }

        // Confirm card payment
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          fnData.clientSecret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: form.name,
                email: form.email,
                phone: form.phone,
              },
            },
          },
        );

        if (stripeError) {
          await supabase
            .from("orders")
            .update({ payment_status: "failed" })
            .eq("id", order.id);
          throw new Error(stripeError.message || t("checkout.stripeError"));
        }

        if (paymentIntent?.status === "succeeded") {
          await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq("id", order.id);
        }
      }

      clearCart();
      navigate(`/pedido-confirmado?id=${order.id}`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : t("checkout.orderError");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 pb-24 px-4 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground mb-4">
            {t("checkout.emptyTitle")}
          </h1>
          <p className="text-muted-foreground font-body mb-8">{t("checkout.emptyDesc")}</p>
          <Button
            onClick={() => navigate("/#menu")}
            className="bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("checkout.viewMenu")}
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <div className="pt-24 md:pt-28 pb-24 px-3 md:px-4">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/#menu")}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("checkout.backToMenu")}
          </Button>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground mb-8">
            {t("checkout.title")}
          </h1>

          {/* Schedule selector */}
          {(() => {
            const storeForSlots = form.orderType === "pickup" ? form.pickupStore || undefined : undefined;
            const availableDays = getAvailableDays(storeForSlots);
            const timeSlots = scheduleMode === "scheduled"
              ? getTimeSlots(scheduledDay, storeForSlots)
              : [];

            // Auto-select first slot if day changes and current slot is no longer valid
            const ensureValidTime = (day: Date) => {
              const slots = getTimeSlots(day, storeForSlots);
              if (slots.length > 0 && !slots.includes(scheduledTime)) {
                setScheduledTime(slots[0]);
              }
            };

            return (
              <div className="mb-6 bg-card border border-border rounded-xl p-5">
                <h2 className="font-display text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-menu-teal" />
                  ¿Cuándo quieres tu pedido?
                </h2>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* ASAP option */}
                  <button
                    type="button"
                    disabled={!isCurrentlyOpen}
                    onClick={() => setScheduleMode("asap")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all ${
                      scheduleMode === "asap"
                        ? "border-menu-teal bg-menu-teal/5"
                        : isCurrentlyOpen
                        ? "border-border hover:border-menu-teal/40"
                        : "border-border opacity-40 cursor-not-allowed bg-muted/30"
                    }`}
                  >
                    <Zap className="w-4 h-4 text-menu-teal shrink-0" />
                    <div>
                      <p className="font-display font-bold text-sm">Lo antes posible</p>
                      <p className="text-xs text-muted-foreground">
                        {isCurrentlyOpen ? "Estamos abiertos" : "Cerrado ahora"}
                      </p>
                    </div>
                  </button>

                  {/* Scheduled option */}
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleMode("scheduled");
                      if (!scheduledTime && timeSlots.length === 0) {
                        const slots = getTimeSlots(availableDays[0], storeForSlots);
                        setScheduledDay(availableDays[0]);
                        setScheduledTime(slots[0] ?? "");
                      } else if (!scheduledTime && timeSlots.length > 0) {
                        setScheduledTime(timeSlots[0]);
                      }
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all ${
                      scheduleMode === "scheduled"
                        ? "border-menu-teal bg-menu-teal/5"
                        : "border-border hover:border-menu-teal/40"
                    }`}
                  >
                    <CalendarClock className="w-4 h-4 text-menu-teal shrink-0" />
                    <div>
                      <p className="font-display font-bold text-sm">Programar</p>
                      <p className="text-xs text-muted-foreground">Elige día y hora</p>
                    </div>
                  </button>
                </div>

                {/* Day + time pickers */}
                {scheduleMode === "scheduled" && (
                  <div className="space-y-3">
                    {/* Day selector */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Día</p>
                      <div className="flex gap-2 flex-wrap">
                        {availableDays.map((day, i) => {
                          const isSelected =
                            day.getFullYear() === scheduledDay.getFullYear() &&
                            day.getMonth()    === scheduledDay.getMonth() &&
                            day.getDate()     === scheduledDay.getDate();
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setScheduledDay(day);
                                ensureValidTime(day);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                                isSelected
                                  ? "bg-menu-teal text-menu-teal-foreground border-menu-teal"
                                  : "border-border hover:border-menu-teal/40 text-foreground"
                              }`}
                            >
                              {formatDayLabel(day)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time selector */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hora</p>
                      {timeSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay horarios disponibles para este día.</p>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {timeSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setScheduledTime(slot)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                                scheduledTime === slot
                                  ? "bg-menu-teal text-menu-teal-foreground border-menu-teal"
                                  : "border-border hover:border-menu-teal/40 text-foreground"
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {scheduledFor && (
                      <p className="text-xs text-menu-teal font-semibold mt-1">
                        ✓ Pedido programado para el {formatDayLabel(scheduledDay)} a las {scheduledTime}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid lg:grid-cols-5 gap-8">
            <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-8">
              {/* Contact */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  {t("checkout.contactInfo")}
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">{t("checkout.name")} *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder={t("checkout.namePlaceholder")}
                    />
                    {errors.name && (
                      <p className="text-destructive text-xs mt-1">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">{t("checkout.phone")} *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="612 345 678"
                    />
                    {errors.phone && (
                      <p className="text-destructive text-xs mt-1">{errors.phone}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="email">{t("checkout.email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="tu@email.com"
                    />
                    {errors.email && (
                      <p className="text-destructive text-xs mt-1">{errors.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order type */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  {t("checkout.orderType")}
                </h2>
                <RadioGroup
                  value={form.orderType}
                  onValueChange={(v) => {
                    updateField("orderType", v);
                    updateField("pickupStore", "");
                  }}
                  className="grid sm:grid-cols-2 gap-3"
                >
                  <label
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      form.orderType === "pickup"
                        ? "border-menu-teal bg-menu-teal/5"
                        : "border-border hover:border-menu-teal/30"
                    }`}
                  >
                    <RadioGroupItem value="pickup" />
                    <Store className="w-5 h-5 text-menu-teal" />
                    <div>
                      <p className="font-display font-bold text-sm">{t("checkout.pickup")}</p>
                      <p className="text-xs text-muted-foreground">{t("checkout.pickupDesc")}</p>
                    </div>
                  </label>
                  <label
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      form.orderType === "delivery"
                        ? "border-menu-teal bg-menu-teal/5"
                        : "border-border hover:border-menu-teal/30"
                    }`}
                  >
                    <RadioGroupItem value="delivery" />
                    <MapPin className="w-5 h-5 text-menu-teal" />
                    <div>
                      <p className="font-display font-bold text-sm">{t("checkout.delivery")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("checkout.deliveryDesc")}
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {/* Estimated time */}
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {form.orderType === "delivery"
                      ? t("checkout.estimatedDelivery")
                      : t("checkout.estimatedPickup")}
                  </span>
                </div>

                {form.orderType === "pickup" && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-display font-semibold text-foreground">
                      ¿En qué local recoges? *
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {pickupStores.map((store) => {
                        const fulfillAt = scheduledFor ?? new Date();
                        const closed = !isStoreOpen(store.id, fulfillAt);
                        return (
                        <button
                          key={store.id}
                          type="button"
                          disabled={closed}
                          onClick={() => !closed && updateField("pickupStore", store.id)}
                          className={`text-left p-4 rounded-lg border-2 transition-all relative ${
                            closed
                              ? "border-border opacity-50 cursor-not-allowed bg-muted/30"
                              : form.pickupStore === store.id
                              ? "border-menu-teal bg-menu-teal/5"
                              : "border-border hover:border-menu-teal/30"
                          }`}
                        >
                          {closed && (
                            <span className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-semibold">
                              Cerrado hoy
                            </span>
                          )}
                          <p className="font-display font-bold text-sm text-foreground mb-1">
                            {store.name}
                          </p>
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-1">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{store.address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{store.hours}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{store.phone}</span>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                    {errors.pickupStore && (
                      <p className="text-destructive text-xs">{errors.pickupStore}</p>
                    )}
                  </div>
                )}

                {form.orderType === "delivery" && (
                  <div className="mt-4 space-y-4">
                    {/* Copy address from profile */}
                    {user && profileAddress && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            address: profileAddress.address,
                            city: profileAddress.city,
                            postalCode: profileAddress.postalCode,
                          }));
                          setErrors((prev) => ({ ...prev, address: "" }));
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border-2 border-dashed border-menu-teal/50 bg-menu-teal/5 hover:bg-menu-teal/10 hover:border-menu-teal transition-all text-left"
                      >
                        <User className="w-4 h-4 text-menu-teal shrink-0" />
                        <div className="min-w-0">
                          <p className="font-display font-bold text-sm text-menu-teal">
                            Enviarme a mi dirección
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[profileAddress.address, profileAddress.postalCode, profileAddress.city]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      </button>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <Label htmlFor="address">{t("checkout.address")} *</Label>
                        <AddressAutocomplete
                          value={form.address}
                          onChange={(v) => updateField("address", v)}
                          onSelect={({ address, city, postalCode }) => {
                            setForm((prev) => ({
                              ...prev,
                              address,
                              city: city || prev.city,
                              postalCode: postalCode || prev.postalCode,
                            }));
                            setErrors((prev) => ({ ...prev, address: "" }));
                          }}
                          placeholder={t("checkout.addressPlaceholder")}
                          error={errors.address}
                        />
                      </div>

                      {/* Escalera / Piso / Puerta */}
                      <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="staircase">Escalera</Label>
                          <Input
                            id="staircase"
                            value={form.staircase}
                            onChange={(e) => updateField("staircase", e.target.value)}
                            placeholder="A, B…"
                          />
                        </div>
                        <div>
                          <Label htmlFor="floor">Piso</Label>
                          <Input
                            id="floor"
                            value={form.floor}
                            onChange={(e) => updateField("floor", e.target.value)}
                            placeholder="1º, 2º…"
                          />
                        </div>
                        <div>
                          <Label htmlFor="door">Puerta</Label>
                          <Input
                            id="door"
                            value={form.door}
                            onChange={(e) => updateField("door", e.target.value)}
                            placeholder="1, 2ª…"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="city">{t("checkout.city")}</Label>
                        <Input
                          id="city"
                          value={form.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          placeholder={t("checkout.cityPlaceholder")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="postalCode">{t("checkout.postalCode")}</Label>
                        <Input
                          id="postalCode"
                          value={form.postalCode}
                          onChange={(e) => updateField("postalCode", e.target.value)}
                          placeholder={t("checkout.postalCodePlaceholder")}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  {t("checkout.paymentMethod")}
                </h2>
                <RadioGroup
                  value={form.paymentMethod}
                  onValueChange={(v) => updateField("paymentMethod", v)}
                  className="grid sm:grid-cols-2 gap-3"
                >
                  <label
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      form.paymentMethod === "cash"
                        ? "border-menu-teal bg-menu-teal/5"
                        : "border-border hover:border-menu-teal/30"
                    }`}
                  >
                    <RadioGroupItem value="cash" />
                    <Banknote className="w-5 h-5 text-menu-teal" />
                    <div>
                      <p className="font-display font-bold text-sm">
                        {t("checkout.cashPayment")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("checkout.cashPaymentDesc")}
                      </p>
                    </div>
                  </label>
                  <label
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      form.paymentMethod === "stripe"
                        ? "border-menu-teal bg-menu-teal/5"
                        : "border-border hover:border-menu-teal/30"
                    }`}
                  >
                    <RadioGroupItem value="stripe" />
                    <CreditCard className="w-5 h-5 text-menu-teal" />
                    <div>
                      <p className="font-display font-bold text-sm">
                        {t("checkout.onlinePayment")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("checkout.onlinePaymentDesc")}
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {/* Stripe Card Element */}
                {form.paymentMethod === "stripe" && (
                  <div className="mt-4">
                    <Label>{t("checkout.cardDetails")}</Label>
                    <div className="mt-1 rounded-md border border-input bg-background px-3 py-3">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: "14px",
                              color: "hsl(var(--foreground))",
                              "::placeholder": {
                                color: "hsl(var(--muted-foreground))",
                              },
                              fontFamily: "inherit",
                            },
                            invalid: {
                              color: "hsl(var(--destructive))",
                            },
                          },
                          hidePostalCode: true,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      {t("checkout.stripeSecure")}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  {t("checkout.notesTitle")}
                </h2>
                <Textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder={t("checkout.notesPlaceholder")}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || (form.paymentMethod === "stripe" && !stripe)}
                className="w-full bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display text-lg py-7 min-h-[56px]"
              >
                {loading
                  ? t("checkout.processing")
                  : `${t("checkout.confirmOrder")} · ${totalPrice.toFixed(2)} €`}
              </Button>
            </form>

            {/* Order summary sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-xl border border-border sticky top-28 overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {t("checkout.yourOrder")}
                  </h2>
                </div>

                <div className="divide-y divide-border">
                  {items.map((item) => {
                    const extrasPrice = (item.extras || []).reduce(
                      (s, e) => s + e.price * e.quantity,
                      0,
                    );
                    const lineTotal = item.price * item.quantity + extrasPrice;
                    return (
                      <div key={item.id} className="px-5 py-4">
                        {/* Name row */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* qty badge */}
                            <span className="shrink-0 w-5 h-5 rounded-full bg-menu-teal text-menu-teal-foreground text-[10px] font-bold flex items-center justify-center">
                              {item.quantity}
                            </span>
                            <p className="font-display font-bold text-sm text-foreground leading-tight">
                              {item.name}
                            </p>
                          </div>
                          <span className="font-display font-bold text-sm text-foreground shrink-0">
                            {lineTotal.toFixed(2)} €
                          </span>
                        </div>

                        {/* Base price */}
                        <p className="text-[11px] text-muted-foreground ml-7 mb-1.5">
                          {item.price.toFixed(2)} € / ud
                        </p>

                        {/* Extras */}
                        {(item.extras || []).length > 0 && (
                          <ul className="ml-7 space-y-0.5 mb-1.5">
                            {(item.extras || []).map((extra) => (
                              <li
                                key={extra.id}
                                className="flex items-center justify-between text-[11px] text-muted-foreground"
                              >
                                <span className="flex items-center gap-1">
                                  <span>{extra.emoji}</span>
                                  {extra.quantity > 1 && (
                                    <span className="font-bold">{extra.quantity}×</span>
                                  )}
                                  {extra.label}
                                </span>
                                <span className="font-semibold text-foreground">
                                  {extra.price === 0
                                    ? "Gratis"
                                    : `+${(extra.price * extra.quantity).toFixed(2)} €`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Note */}
                        {item.note && (
                          <p className="ml-7 text-[11px] text-muted-foreground italic">
                            📝 {item.note}
                          </p>
                        )}

                        {/* qty controls + remove */}
                        <div className="flex items-center gap-1.5 mt-2 ml-7">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-destructive/50 hover:text-destructive hover:bg-destructive/5 transition-colors ml-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 py-4 border-t border-border bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="font-display font-bold text-base">{t("cart.total")}</span>
                    <span className="font-display text-2xl font-bold text-menu-teal">
                      {totalPrice.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Checkout;
