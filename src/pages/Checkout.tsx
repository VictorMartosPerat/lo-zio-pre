import { useState } from "react";
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
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { z } from "zod";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const Checkout = () => {
  const { items, totalPrice, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const checkoutSchema = z
    .object({
      name: z.string().trim().min(1, t("checkout.nameRequired")).max(100),
      email: z.string().trim().email(t("checkout.emailInvalid")).max(255),
      phone: z.string().trim().min(9, t("checkout.phoneInvalid")).max(20),
      orderType: z.enum(["pickup", "delivery"]),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      paymentMethod: z.enum(["cash", "stripe"]),
      notes: z.string().max(500).optional(),
    })
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
    address: "",
    city: "",
    postalCode: "",
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
      // 1. Create order in Supabase
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id || null,
          guest_name: form.name,
          guest_email: form.email,
          guest_phone: form.phone,
          order_type: form.orderType,
          delivery_address: form.orderType === "delivery" ? form.address : null,
          delivery_city: form.orderType === "delivery" ? form.city : null,
          delivery_postal_code: form.orderType === "delivery" ? form.postalCode : null,
          payment_method: form.paymentMethod,
          payment_status: form.paymentMethod === "stripe" ? "pending_payment" : "pending",
          notes: form.notes || null,
          total_amount: totalPrice,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        item_name: item.name,
        item_description: item.description || null,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));
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
            .update({ payment_status: "payment_failed" })
            .eq("id", order.id);
          throw new Error(stripeError.message || t("checkout.stripeError"));
        }

        if (paymentIntent?.status === "succeeded") {
          await supabase
            .from("orders")
            .update({ payment_status: "paid" })
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
                  onValueChange={(v) => updateField("orderType", v)}
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

                {form.orderType === "delivery" && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="address">{t("checkout.address")} *</Label>
                      <Input
                        id="address"
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        placeholder={t("checkout.addressPlaceholder")}
                      />
                      {errors.address && (
                        <p className="text-destructive text-xs mt-1">{errors.address}</p>
                      )}
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
              <div className="bg-card rounded-xl p-6 border border-border sticky top-28">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  {t("checkout.yourOrder")}
                </h2>
                <div className="space-y-3 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.price.toFixed(2)} € {t("checkout.perUnit")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-5 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold text-foreground w-16 text-right">
                        {(item.price * item.quantity).toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-display text-lg font-bold">{t("cart.total")}</span>
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
