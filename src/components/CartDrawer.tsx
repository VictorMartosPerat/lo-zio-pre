import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { extraCategories } from "@/lib/extras";
import { ALL_UPSELL, UPSELL_IDS, type UpsellItem } from "@/lib/upsell";

// Extras picker with category tabs
const ExtrasPicker = ({
  onAdd,
}: {
  onAdd: (extra: { id: string; label: string; emoji: string; price: number }) => void;
}) => {
  const [activeCategory, setActiveCategory] = useState(extraCategories[0].id);
  const category = extraCategories.find((c) => c.id === activeCategory)!;

  return (
    <div className="mt-2 rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex overflow-x-auto no-scrollbar border-b border-border">
        {extraCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-body font-bold whitespace-nowrap shrink-0 transition-colors border-b-2 ${
              activeCategory === cat.id
                ? "border-menu-teal text-menu-teal bg-menu-teal/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{cat.emoji}</span>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 p-2">
        {category.items.map((item) => (
          <button
            key={item.id}
            onClick={() =>
              onAdd({ id: item.id, label: item.name, emoji: category.emoji, price: item.price })
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-background hover:border-menu-teal hover:bg-menu-teal/5 transition-all text-[10px] font-body font-semibold text-foreground"
          >
            {item.name}
            <span className="text-menu-teal">+{item.price} €</span>
          </button>
        ))}
      </div>
    </div>
  );
};

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

const CartDrawer = () => {
  const {
    items,
    isOpen,
    setIsOpen,
    updateQuantity,
    updateNote,
    removeItem,
    addItem,
    addExtra,
    updateExtraQuantity,
    totalPrice,
    totalItems,
  } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [showExtras, setShowExtras] = useState<Record<string, boolean>>({});

  const handleCheckout = () => {
    setIsOpen(false);
    if (!user) {
      navigate("/auth", { state: { fromCart: true } });
    } else {
      navigate("/pedido");
    }
  };

  const foodItems = items.filter((i) => !UPSELL_IDS.includes(i.id));

  const getQty = (id: string) => items.find((i) => i.id === id)?.quantity ?? 0;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <ShoppingBag className="w-5 h-5 text-menu-teal" />
            {t("cart.title")}
            {totalItems > 0 && (
              <span className="ml-auto mr-8 text-sm font-body text-muted-foreground font-normal">
                {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground font-body px-5">
            <ShoppingBag className="w-12 h-12 text-border" />
            <p>{t("cart.empty")}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Food items */}
            <div className="px-5 py-4 space-y-3">
              {foodItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-muted/40 rounded-xl border border-border overflow-hidden"
                >
                  <div className="p-3">
                    {/* Pizza name + controls */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm text-foreground leading-tight">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors ml-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold text-menu-teal">
                        {(item.price * item.quantity).toFixed(2)} €
                      </span>
                      <span className="text-[10px] text-muted-foreground font-body">
                        {item.price.toFixed(2)} € / ud
                      </span>
                    </div>

                    {/* Extras already added */}
                    {(item.extras || []).length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-menu-teal/30 space-y-1.5">
                        {(item.extras || []).map((extra) => (
                          <div key={extra.id} className="flex items-center justify-between">
                            <span className="text-[11px] font-body text-foreground flex items-center gap-1.5">
                              <span>{extra.emoji}</span>
                              {extra.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  updateExtraQuantity(item.id, extra.id, extra.quantity - 1)
                                }
                                className="w-5 h-5 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-xs font-bold w-4 text-center">
                                {extra.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateExtraQuantity(item.id, extra.id, extra.quantity + 1)
                                }
                                className="w-5 h-5 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-[11px] font-bold text-menu-teal ml-1 w-12 text-right">
                                +{(extra.price * extra.quantity).toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add extras toggle */}
                    <button
                      onClick={() =>
                        setShowExtras((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="flex items-center gap-1 text-[10px] font-body text-muted-foreground hover:text-menu-teal transition-colors mt-2"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Añadir ingrediente extra</span>
                      {showExtras[item.id] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {showExtras[item.id] && (
                      <ExtrasPicker
                        onAdd={(extra) => addExtra(item.id, extra)}
                      />
                    )}

                    {/* Note */}
                    <button
                      onClick={() =>
                        setOpenNotes((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="flex items-center gap-1 text-[10px] font-body text-muted-foreground hover:text-menu-teal transition-colors mt-1.5"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{item.note ? "Editar nota" : "Añadir nota"}</span>
                      {openNotes[item.id] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    {item.note && !openNotes[item.id] && (
                      <p className="text-[10px] text-muted-foreground italic mt-0.5 line-clamp-1">
                        "{item.note}"
                      </p>
                    )}
                    {openNotes[item.id] && (
                      <textarea
                        autoFocus
                        value={item.note || ""}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                        placeholder="Ej: sin cebolla, muy hecho, poco tomate..."
                        rows={2}
                        maxLength={120}
                        className="mt-1.5 w-full text-xs font-body rounded-lg border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-menu-teal placeholder:text-muted-foreground/50"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-5 border-t border-border" />

            {/* Back to menu button */}
            <div className="px-5 pt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-menu-teal/40 text-menu-teal hover:bg-menu-teal/5 hover:border-menu-teal transition-all font-display font-bold text-sm"
              >
                <span className="text-base">🍕</span>
                {t("cart.addMorePizza")}
              </button>
            </div>

            {/* Upsell: bebidas + tiramisú */}
            <div className="px-5 py-4">
              <p className="font-display font-bold text-sm text-foreground mb-3">
                {t("cart.upsellTitle")}
              </p>
              <div className="grid grid-cols-3 gap-2">
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
        )}

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="border-t border-border px-5 py-4 mt-auto">
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-display text-base font-bold text-foreground">
                  {t("cart.total")}
                </span>
                <span className="font-display text-2xl font-bold text-menu-teal">
                  {totalPrice.toFixed(2)} €
                </span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display text-base py-6 rounded-xl"
              >
                {t("cart.checkout")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
