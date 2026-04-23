import { useTranslation } from "react-i18next";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ALL_UPSELL, UPSELL_IDS, type UpsellItem } from "@/lib/upsell";

const UpsellCard = ({
  item,
  quantity,
  onAdd,
  onChangeQty,
}: {
  item: UpsellItem;
  quantity: number;
  onAdd: () => void;
  onChangeQty: (qty: number) => void;
}) => {
  const isSelected = quantity > 0;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
        isSelected ? "border-menu-teal shadow-sm" : "border-border"
      }`}
    >
      <button onClick={onAdd} className="w-full block" aria-label={`Añadir ${item.name}`}>
        <div className="aspect-square w-full flex items-center justify-center p-2 bg-white">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>
      </button>

      <div className="px-1.5 pt-1 pb-1.5 text-center bg-background">
        <p className="text-[10px] font-body font-bold leading-tight text-foreground truncate">
          {item.name}
        </p>
        <p className="text-[10px] text-menu-teal font-semibold">{item.price.toFixed(2)} €</p>
      </div>

      {isSelected && (
        <div className="absolute top-1.5 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeQty(quantity - 1);
              }}
              className="w-5 h-5 flex items-center justify-center text-white hover:text-red-300 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-white text-[11px] font-bold w-4 text-center">{quantity}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeQty(quantity + 1);
              }}
              className="w-5 h-5 flex items-center justify-center text-white hover:text-menu-teal transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CartSidebar = () => {
  const { items, updateQuantity, removeItem, addItem, totalPrice, totalItems } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const foodItems = items.filter((i) => !UPSELL_IDS.includes(i.id));
  const getQty = (id: string) => items.find((i) => i.id === id)?.quantity ?? 0;

  const handleCheckout = () => {
    if (!user) navigate("/auth", { state: { fromCart: true } });
    else navigate("/pedido");
  };

  return (
    <div className="sticky top-24 flex flex-col rounded-2xl border border-border bg-card shadow-lg overflow-hidden max-h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-menu-teal" />
          <span className="font-display font-bold text-sm text-foreground">{t("cart.title")}</span>
          <span className="ml-auto text-xs font-body text-muted-foreground">
            {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Food items */}
        <div className="px-4 py-3 space-y-2">
          {foodItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-xs text-foreground truncate">
                  {item.name}
                </p>
                <p className="text-[11px] text-menu-teal font-semibold">
                  {(item.price * item.quantity).toFixed(2)} €
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-5 h-5 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="w-4 text-center text-xs font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-5 h-5 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-destructive/40 hover:text-destructive transition-colors ml-0.5"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border" />

        {/* Upsell */}
        <div className="px-4 py-3">
          <p className="font-display font-bold text-xs text-foreground mb-2.5">
            {t("cart.upsellTitle")}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_UPSELL.map((upsell) => (
              <UpsellCard
                key={upsell.id}
                item={upsell}
                quantity={getQty(upsell.id)}
                onAdd={() => {
                  if (getQty(upsell.id) === 0) {
                    addItem({ id: upsell.id, name: upsell.name, price: upsell.price });
                  } else {
                    updateQuantity(upsell.id, getQty(upsell.id) + 1);
                  }
                }}
                onChangeQty={(qty) => updateQuantity(upsell.id, qty)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-3 bg-card">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-display text-sm font-bold text-foreground">{t("cart.total")}</span>
          <span className="font-display text-xl font-bold text-menu-teal">
            {totalPrice.toFixed(2)} €
          </span>
        </div>
        <Button
          onClick={handleCheckout}
          className="w-full bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display text-sm py-5 rounded-xl"
        >
          {t("cart.checkout")}
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Button>
      </div>
    </div>
  );
};

export default CartSidebar;
