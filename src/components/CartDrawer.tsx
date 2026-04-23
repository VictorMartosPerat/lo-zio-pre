import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, Trash2, ShoppingBag, Wine, CakeSlice, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface UpsellItem {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
}

const UpsellSection = ({
  icon,
  title,
  items,
  onAdd,
}: {
  icon: React.ReactNode;
  title: string;
  items: UpsellItem[];
  onAdd: (item: UpsellItem) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-display font-bold text-xs text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1 animate-fade-in">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-foreground">{item.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.priceLabel}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 border-menu-teal/30 text-menu-teal hover:bg-menu-teal hover:text-menu-teal-foreground"
                  onClick={() => onAdd(item)}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CartDrawer = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, totalPrice, totalItems, addItem } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [drinkOptions, setDrinkOptions] = useState<UpsellItem[]>([]);
  const [extraOptions, setExtraOptions] = useState<UpsellItem[]>([]);
  const [dessertOptions, setDessertOptions] = useState<UpsellItem[]>([]);

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("id, name, price, category")
      .in("category", ["drinks", "extras", "desserts"])
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (!data) return;
        const toUpsell = (item: { id: string; name: string; price: number }): UpsellItem => ({
          id: item.id,
          name: item.name,
          price: item.price,
          priceLabel: item.price.toFixed(2).replace(".", ",") + " €",
        });
        setDrinkOptions(data.filter((i) => i.category === "drinks").map(toUpsell));
        setExtraOptions(data.filter((i) => i.category === "extras").map(toUpsell));
        setDessertOptions(data.filter((i) => i.category === "desserts").map(toUpsell));
      });
  }, []);

  const handleCheckout = () => {
    setIsOpen(false);
    navigate("/pedido");
  };

  const handleAddUpsell = (item: UpsellItem) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <ShoppingBag className="w-5 h-5 text-menu-teal" />
            {t("cart.title")} ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground font-body">
            {t("cart.empty")}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm text-foreground truncate">{item.name}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                  <p className="text-sm font-semibold text-menu-teal mt-1">{(item.price * item.quantity).toFixed(2)} €</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Upsell sections */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">{t("cart.addMore")}</p>
              <UpsellSection
                icon={<Plus className="w-4 h-4 text-menu-teal" />}
                title={t("cart.extras")}
                items={extraOptions}
                onAdd={handleAddUpsell}
              />
              <UpsellSection
                icon={<Wine className="w-4 h-4 text-menu-teal" />}
                title={t("cart.drinks")}
                items={drinkOptions}
                onAdd={handleAddUpsell}
              />
              <UpsellSection
                icon={<CakeSlice className="w-4 h-4 text-menu-teal" />}
                title={t("cart.desserts")}
                items={dessertOptions}
                onAdd={handleAddUpsell}
              />
            </div>
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="border-t border-border pt-4 mt-auto">
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-display text-lg font-bold">{t("cart.total")}</span>
                <span className="font-display text-xl font-bold text-menu-teal">{totalPrice.toFixed(2)} €</span>
              </div>
              <Button onClick={handleCheckout} className="w-full bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display text-base py-6">
                {t("cart.checkout")}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
