import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, MessageSquare, ShoppingBag, Wine, CakeSlice, X, ChevronRight, ChevronLeft } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";
import { extraCategories } from "@/lib/extras";
import type { CartItemExtra } from "@/contexts/CartContext";
import pizzaPlaceholder from "@/assets/pizza-placeholder.jpg";
import cocaColaImg from "@/assets/coca-cola.png";
import cocaColaZeroImg from "@/assets/coca-cola-zero.png";
import fantaNaranjaImg from "@/assets/fanta-naranja.png";
import fantaLimonImg from "@/assets/fanta-limon.png";
import fuzeTeaImg from "@/assets/fuze-tea-limon.png";
import aquariusImg from "@/assets/aquarius-limon.png";
import aguaImg from "@/assets/agua-logo.png";
import cervezaImg from "@/assets/estrella-damm.png";
import vinoImg from "@/assets/botella-vino.png";

interface MenuItem {
  name: string;
  desc?: string;
  price: string;
  priceNum: number;
}

interface AddToCartDialogProps {
  item: MenuItem | null;
  imageUrl?: string | null;
  open: boolean;
  freeExtras?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (extras: CartItemExtra[], note: string) => void;
}

// ─── Drink data ──────────────────────────────────────────────────────────────

interface DrinkDef {
  id: string;
  name: string;
  emoji: string;
  price: number;
  image?: string;
  bg?: string;
}

const SODA_PRICE = 2.5;

const ALL_DRINKS: DrinkDef[] = [
  { id: "soda_coca-cola",       name: "Coca-Cola",       emoji: "🥤", price: SODA_PRICE, image: cocaColaImg },
  { id: "soda_coca-cola-zero",  name: "Coca-Cola Zero",  emoji: "⬛", price: SODA_PRICE, image: cocaColaZeroImg },
  { id: "soda_fanta-naranja",   name: "Fanta Naranja",   emoji: "🍊", price: SODA_PRICE, image: fantaNaranjaImg },
  { id: "soda_fanta-limon",     name: "Fanta Limón",     emoji: "🍋", price: SODA_PRICE, image: fantaLimonImg },
  { id: "soda_fuze-tea",        name: "Fuze Tea Limón",  emoji: "🫖", price: SODA_PRICE, image: fuzeTeaImg },
  { id: "soda_aquarius",        name: "Aquarius Limón",  emoji: "💛", price: SODA_PRICE, image: aquariusImg },
  { id: "drink_agua",           name: "Agua",            emoji: "💧", price: 2.5,        image: aguaImg },
  { id: "drink_cerveza",        name: "Cerveza",         emoji: "🍺", price: 3,          image: cervezaImg },
  { id: "drink_vino",           name: "Vino botella",    emoji: "🍷", price: 20,         image: vinoImg },
];

const TIRAMISU = {
  id: "dessert_tiramisu",
  name: "Tiramisú",
  emoji: "🍮",
  price: 6,
  image: "https://lnrnyahzkqqnvlpzrdlv.supabase.co/storage/v1/object/public/media/videos/TIRAMISU.jpg",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ExtrasPicker = ({
  extras,
  onAdd,
  onRemove,
  freeExtras,
}: {
  extras: CartItemExtra[];
  onAdd: (extra: Omit<CartItemExtra, "quantity">) => void;
  onRemove: (id: string) => void;
  freeExtras?: number;
}) => {
  const [activeCategory, setActiveCategory] = useState(extraCategories[0].id);
  const category = extraCategories.find((c) => c.id === activeCategory)!;
  const selectedCount = extras.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      {freeExtras && (
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
          <div className="flex gap-1">
            {Array.from({ length: freeExtras }).map((_, i) => (
              <span
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  i < selectedCount
                    ? "bg-menu-teal border-menu-teal"
                    : "border-muted-foreground/30 bg-transparent"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-body text-muted-foreground">
            {selectedCount < freeExtras
              ? `${freeExtras - selectedCount} gratis restante${freeExtras - selectedCount !== 1 ? "s" : ""}`
              : selectedCount === freeExtras
              ? "✓ 4 ingredientes seleccionados"
              : `+${selectedCount - freeExtras} con coste adicional`}
          </span>
        </div>
      )}
      <div className="flex overflow-x-auto no-scrollbar border-b border-border bg-background">
        {extraCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1 px-3 py-2 text-[11px] font-body font-bold whitespace-nowrap shrink-0 transition-colors border-b-2 ${
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
      <div className="flex flex-wrap gap-1.5 p-3">
        {category.items.map((item) => {
          const existing = extras.find((e) => e.id === item.id);
          const qtyBefore = existing
            ? extras.slice(0, extras.findIndex((e) => e.id === item.id)).reduce((s, e) => s + e.quantity, 0)
            : 0;
          const isFree = freeExtras
            ? existing
              ? qtyBefore < freeExtras
              : selectedCount < freeExtras
            : false;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (existing) {
                  onRemove(item.id);
                } else {
                  onAdd({ id: item.id, label: item.name, emoji: category.emoji, price: item.price });
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border transition-all text-[11px] font-body font-semibold ${
                existing
                  ? "border-menu-teal bg-menu-teal/10 text-menu-teal"
                  : "border-border bg-background hover:border-menu-teal hover:bg-menu-teal/5 text-foreground"
              }`}
            >
              {existing && <span className="font-bold">{existing.quantity}×</span>}
              {item.name}
              <span className={existing ? "text-menu-teal/70" : isFree ? "text-green-600 font-bold" : "text-menu-teal"}>
                {isFree
                  ? "Gratis"
                  : existing
                  ? `+${(item.price * existing.quantity).toFixed(2)} €`
                  : `+${item.price} €`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Image card button for a drink */
const DrinkCard = ({
  drink,
  quantity,
  onAdd,
  onChangeQty,
}: {
  drink: DrinkDef;
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
      {/* Image / emoji area */}
      <button
        onClick={onAdd}
        className="w-full block"
        aria-label={`Añadir ${drink.name}`}
      >
        <div className={`aspect-square w-full flex items-center justify-center p-3 ${drink.image ? "bg-white" : drink.bg}`}>
          {drink.image ? (
            <img
              src={drink.image}
              alt={drink.name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-4xl select-none">{drink.emoji}</span>
          )}
        </div>
      </button>

      {/* Name + price */}
      <div className="px-1.5 pt-1 pb-1.5 text-center bg-background">
        <p className="text-[10px] font-body font-bold leading-tight text-foreground truncate">{drink.name}</p>
        <p className="text-[10px] text-menu-teal font-semibold">{drink.price.toFixed(2)} €</p>
      </div>

      {/* Quantity controls overlay (shown when selected) */}
      {isSelected && (
        <div className="absolute top-1.5 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onChangeQty(quantity - 1); }}
              className="w-5 h-5 flex items-center justify-center text-white hover:text-red-300 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-white text-[11px] font-bold w-4 text-center">{quantity}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeQty(quantity + 1); }}
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

// ─── Main dialog ─────────────────────────────────────────────────────────────

const AddToCartDialog = ({
  item,
  imageUrl,
  open,
  freeExtras,
  onOpenChange,
  onConfirm,
}: AddToCartDialogProps) => {
  const { t } = useTranslation();

  const [extras, setExtras] = useState<CartItemExtra[]>([]);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setExtras([]);
      setNote("");
      setShowNote(false);
      setStep(1);
    }
  }, [open]);

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
  };

  const goToStep = (s: 1 | 2 | 3) => {
    setStep(s);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // ── extras helpers ──
  const handleAddExtra = (extra: Omit<CartItemExtra, "quantity">) => {
    setExtras((prev) => {
      const existing = prev.find((e) => e.id === extra.id);
      if (existing) return prev.map((e) => e.id === extra.id ? { ...e, quantity: e.quantity + 1 } : e);
      return [...prev, { ...extra, quantity: 1 }];
    });
  };

  const handleRemoveExtra = (id: string) => {
    setExtras((prev) => {
      const existing = prev.find((e) => e.id === id);
      if (!existing) return prev;
      if (existing.quantity > 1) return prev.map((e) => e.id === id ? { ...e, quantity: e.quantity - 1 } : e);
      return prev.filter((e) => e.id !== id);
    });
  };

  const handleUpdateQty = (id: string, qty: number) => {
    if (qty <= 0) setExtras((prev) => prev.filter((e) => e.id !== id));
    else setExtras((prev) => prev.map((e) => e.id === id ? { ...e, quantity: qty } : e));
  };

  const getQty = (id: string) => extras.find((e) => e.id === id)?.quantity ?? 0;

  const addUpsell = (id: string, label: string, emoji: string, price: number) => {
    handleAddExtra({ id, label, emoji, price });
  };

  const ingredientExtras = extras.filter(
    (e) => !e.id.startsWith("drink_") && !e.id.startsWith("soda_") && !e.id.startsWith("dessert_")
  );

  const ingredientExtrasTotal = (): number => {
    let slotsUsed = 0;
    let total = 0;
    for (const extra of ingredientExtras) {
      for (let u = 0; u < extra.quantity; u++) {
        if (!freeExtras || slotsUsed >= freeExtras) total += extra.price;
        slotsUsed++;
      }
    }
    return total;
  };

  const extrasWithEffectivePrices = (): CartItemExtra[] => {
    let slotsUsed = 0;
    return extras.map((extra) => {
      const isIngredient = !extra.id.startsWith("drink_") && !extra.id.startsWith("soda_") && !extra.id.startsWith("dessert_");
      if (!isIngredient || !freeExtras) return extra;
      const freeUnits = Math.max(0, freeExtras - slotsUsed);
      const paidUnits = Math.max(0, extra.quantity - freeUnits);
      slotsUsed += extra.quantity;
      const effectiveUnitPrice = paidUnits > 0 && extra.quantity > 0
        ? (paidUnits * extra.price) / extra.quantity
        : 0;
      return { ...extra, price: effectiveUnitPrice };
    });
  };

  const extrasTotal =
    ingredientExtrasTotal() +
    extras
      .filter((e) => e.id.startsWith("drink_") || e.id.startsWith("soda_") || e.id.startsWith("dessert_"))
      .reduce((sum, e) => sum + e.price * e.quantity, 0);

  const totalPrice = item ? item.priceNum + extrasTotal : 0;

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col [&>button:first-of-type]:hidden">

        {/* ── Image header ── */}
        <div className="relative shrink-0" style={{ paddingBottom: "45%" }}>
          <img
            src={imageUrl || pizzaPlaceholder}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <DialogClose className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
            <X className="w-4 h-4" />
          </DialogClose>
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <DialogHeader>
              <DialogTitle className="font-display font-bold text-white text-xl leading-tight drop-shadow">
                {item.name}
              </DialogTitle>
              {item.desc && (
                <p className="text-white/80 text-xs font-body leading-snug line-clamp-2 mt-0.5">
                  {item.desc}
                </p>
              )}
            </DialogHeader>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex justify-center gap-1.5 pt-3 pb-1 shrink-0">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? "w-6 bg-menu-teal" : s < step ? "w-3 bg-menu-teal/40" : "w-3 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-4">

          {/* Step 1: Extras */}
          {step === 1 && (
            <>
              <p className="font-display font-bold text-sm text-foreground">
                {freeExtras ? t("dialog.addExtrasCustom") : t("dialog.addExtras")}
              </p>
              <ExtrasPicker
                extras={ingredientExtras}
                onAdd={handleAddExtra}
                onRemove={handleRemoveExtra}
                freeExtras={freeExtras}
              />
              {ingredientExtras.length > 0 && (
                <div className="pl-2 border-l-2 border-menu-teal/40 space-y-1.5">
                  {(() => {
                    let slotsUsed = 0;
                    return ingredientExtras.map((extra) => {
                      const freeUnits = freeExtras ? Math.max(0, freeExtras - slotsUsed) : 0;
                      const paidUnits = Math.max(0, extra.quantity - freeUnits);
                      slotsUsed += extra.quantity;
                      const label =
                        !freeExtras || paidUnits === 0
                          ? freeExtras ? "Gratis" : `+${(extra.price * extra.quantity).toFixed(2)} €`
                          : freeUnits === 0
                          ? `+${(extra.price * extra.quantity).toFixed(2)} €`
                          : `${freeUnits} gratis · +${(extra.price * paidUnits).toFixed(2)} €`;
                      const isAllFree = freeExtras !== undefined && paidUnits === 0;
                      return (
                        <div key={extra.id} className="flex items-center justify-between">
                          <span className="text-xs font-body text-foreground flex items-center gap-1.5">
                            <span>{extra.emoji}</span>
                            {extra.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUpdateQty(extra.id, extra.quantity - 1)}
                              className="w-5 h-5 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{extra.quantity}</span>
                            <button
                              onClick={() => handleUpdateQty(extra.id, extra.quantity + 1)}
                              className="w-5 h-5 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <span className={`text-xs font-bold ml-1 w-28 text-right ${isAllFree ? "text-green-600" : "text-menu-teal"}`}>
                              {label}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}

          {/* Step 2: Bebidas */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2">
                <Wine className="w-4 h-4 text-menu-teal" />
                <p className="font-display font-bold text-sm text-foreground">
                  No te quedes con sed
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ALL_DRINKS.map((drink) => (
                  <DrinkCard
                    key={drink.id}
                    drink={drink}
                    quantity={getQty(drink.id)}
                    onAdd={() => addUpsell(drink.id, drink.name, drink.emoji, drink.price)}
                    onChangeQty={(qty) => handleUpdateQty(drink.id, qty)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Step 3: Postre + Nota */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2">
                <CakeSlice className="w-4 h-4 text-menu-teal" />
                <p className="font-display font-bold text-sm text-foreground">
                  El toque dulce que no falte
                </p>
              </div>

              {/* Tiramisu card with image */}
              <div
                className={`rounded-xl border-2 overflow-hidden transition-all ${
                  getQty(TIRAMISU.id) > 0 ? "border-menu-teal" : "border-border"
                }`}
              >
                {/* Image */}
                <div className="relative w-full" style={{ paddingBottom: "50%" }}>
                  <img
                    src={TIRAMISU.image}
                    alt={TIRAMISU.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <div>
                      <p className="font-display font-bold text-white text-base leading-tight">{TIRAMISU.name}</p>
                      <p className="text-white/80 text-[11px] font-body">{t("dialog.tiramisuDesc")}</p>
                    </div>
                    <span className="font-display font-bold text-white text-sm shrink-0 ml-2">
                      {TIRAMISU.price.toFixed(2)} €
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between px-3 py-2 bg-background">
                  {getQty(TIRAMISU.id) > 0 ? (
                    <div className="flex items-center gap-2 mx-auto">
                      <button
                        onClick={() => handleUpdateQty(TIRAMISU.id, getQty(TIRAMISU.id) - 1)}
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{getQty(TIRAMISU.id)}</span>
                      <button
                        onClick={() => handleUpdateQty(TIRAMISU.id, getQty(TIRAMISU.id) + 1)}
                        className="w-7 h-7 rounded-full bg-menu-teal text-white flex items-center justify-center hover:bg-menu-teal/90 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addUpsell(TIRAMISU.id, TIRAMISU.name, TIRAMISU.emoji, TIRAMISU.price)}
                      className="mx-auto flex items-center gap-2 text-xs font-body font-semibold text-menu-teal hover:text-menu-teal/80 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir tiramisú
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Note */}
              <div>
                <button
                  onClick={() => setShowNote((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-menu-teal transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{note ? t("dialog.editNote") : t("dialog.addNote")}</span>
                </button>
                {note && !showNote && (
                  <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-1">"{note}"</p>
                )}
                {showNote && (
                  <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("dialog.notePlaceholder")}
                    rows={2}
                    maxLength={120}
                    className="mt-2 w-full text-xs font-body rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-menu-teal placeholder:text-muted-foreground/50"
                  />
                )}
              </div>
            </>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border px-4 py-3 bg-background flex gap-2">
          {step > 1 && (
            <button
              onClick={() => goToStep((step - 1) as 1 | 2 | 3)}
              className="flex items-center justify-center w-11 h-11 rounded-xl border border-border hover:bg-muted transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => goToStep((step + 1) as 1 | 2 | 3)}
              className="flex-1 bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display font-bold text-sm py-5 rounded-xl"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          ) : (
            <Button
              onClick={() => onConfirm(extrasWithEffectivePrices(), note)}
              className="flex-1 bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display font-bold text-sm py-5 rounded-xl"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              {t("dialog.addToCart")}
              <span className="ml-auto font-body font-bold">
                {totalPrice.toFixed(2)} €
              </span>
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default AddToCartDialog;
