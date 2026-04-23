import { useState, useRef, useEffect } from "react";
import { UtensilsCrossed, Plus, Flame, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import pizzaPlaceholder from "@/assets/pizza-placeholder.jpg";
import { useCart } from "@/contexts/CartContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMedia } from "@/hooks/useMedia";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAllergenById } from "@/lib/allergens";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface MenuItemData {
  name: string;
  desc?: string;
  price: string;
  priceNum: number;
  allergens?: string[];
  category: "pizzas" | "focaccias" | "calzones";
  badge?: { key: string; emoji: string; style: "fire" | "gold" | "teal" };
}

function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",") + " €";
}

const categories = [
  { id: "pizzas" as const, icon: Flame },
  { id: "focaccias" as const, icon: UtensilsCrossed },
  { id: "calzones" as const, icon: UtensilsCrossed },
];

const AllergenBadges = ({ allergens }: { allergens?: string[] }) => {
  if (!allergens?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {allergens.map((id) => {
        const a = getAllergenById(id);
        if (!a) return null;
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-muted cursor-default">
                {a.emoji}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {a.name}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

const MenuCard = ({
  item,
  onAdd,
  showAddButton,
  imageUrl,
}: {
  item: MenuItemData;
  onAdd: () => void;
  showAddButton: boolean;
  imageUrl?: string | null;
}) => {
  const { t } = useTranslation();
  return (
    <div className="group bg-card rounded-xl shadow-sm border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col">
      {/* Image */}
      <div className="relative overflow-hidden" style={{ paddingBottom: "60%" }}>
        <img
          src={imageUrl || pizzaPlaceholder}
          alt={`Pizza artesanal ${item.name} Lo Zio Tarragona`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {item.badge && (
          <span
            className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body font-bold shadow-lg tracking-wide backdrop-blur-sm ${
              item.badge.style === "fire"
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-orange-500/50 shadow-md"
                : item.badge.style === "gold"
                ? "bg-amber-400/95 text-amber-900"
                : "bg-teal-600/90 text-white"
            }`}
          >
            <span>{item.badge.emoji}</span>
            {t(`menu.${item.badge.key}`)}
          </span>
        )}
      </div>
      {/* Body */}
      <div className="p-3 md:p-4 flex flex-col flex-1 gap-2">
        <h4 className="font-display font-bold text-foreground text-sm md:text-base leading-tight tracking-wide">
          {item.name}
        </h4>
        {item.desc && (
          <p className="text-muted-foreground text-[11px] md:text-xs leading-relaxed line-clamp-2 flex-1">
            {t(`menu.desc.${item.name}`, item.desc)}
          </p>
        )}
        <AllergenBadges allergens={item.allergens} />
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="font-display font-bold text-primary text-base md:text-lg">{item.price}</span>
        </div>
        {showAddButton && (
          <Button
            onClick={onAdd}
            className="w-full bg-primary text-primary-foreground font-body font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity mt-1"
            size="sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {t("menu.addToOrder", "Añadir")}
          </Button>
        )}
      </div>
    </div>
  );
};

const MenuSection = () => {
  const { addItem } = useCart();
  const { isAdmin } = useIsAdmin();
  const { t } = useTranslation();
  const { getImageForItem } = useMedia("menu_item");
  const [activeCategory, setActiveCategory] = useState<string>("pizzas");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);
  const menuSectionRef = useRef<HTMLElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [showCategoryNav, setShowCategoryNav] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("name, description, price, category, allergens, badge_key, badge_emoji, badge_style")
      .in("category", ["pizzas", "focaccias", "calzones"])
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) {
          setMenuItems(
            data.map((item) => ({
              name: item.name,
              desc: item.description ?? undefined,
              price: formatPrice(item.price),
              priceNum: item.price,
              allergens: (item.allergens as string[]) ?? undefined,
              category: item.category as "pizzas" | "focaccias" | "calzones",
              badge: item.badge_key
                ? { key: item.badge_key, emoji: item.badge_emoji ?? "", style: item.badge_style as "fire" | "gold" | "teal" }
                : undefined,
            })),
          );
        }
      });
  }, []);

  const handleAdd = (item: MenuItemData) => {
    addItem({
      id: item.name.toLowerCase().replace(/\s+/g, "-"),
      name: item.name,
      description: item.desc,
      price: item.priceNum,
    });
    toast.success(t("menu.addedToOrder", { name: item.name }));
  };

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      const offset = 140;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      // Update sticky state
      const nav = navRef.current;
      if (nav) {
        const rect = nav.getBoundingClientRect();
        setIsSticky(rect.top <= 64);
      }

      // Show category nav only when menu section is in viewport
      const section = menuSectionRef.current;
      if (section) {
        const sectionRect = section.getBoundingClientRect();
        const navbarHeight = 64;
        const sectionTop = sectionRect.top - navbarHeight;
        const sectionBottom = sectionRect.bottom;
        setShowCategoryNav(sectionTop < window.innerHeight && sectionBottom > navbarHeight + 60);
      }

      // Update active category based on scroll
      for (const cat of [...categories].reverse()) {
        const el = sectionRefs.current[cat.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveCategory(cat.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const categoryLabels: Record<string, string> = {
    pizzas: t("menu.pizzas", "Pizzas"),
    focaccias: t("menu.focaccias", "Focaccias"),
    calzones: t("menu.calzones", "Calzones"),
  };

  return (
    <TooltipProvider delayDuration={200}>
      <section id="menu" ref={menuSectionRef} className="py-16 md:py-24 px-4 bg-muted pb-24 md:pb-24">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-menu-teal font-body uppercase tracking-[0.25em] text-sm mb-3">{t("menu.header")}</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-2">{t("menu.title")}</h2>
            <p className="font-display text-lg tracking-[0.3em] uppercase text-muted-foreground mb-6">
              {t("menu.location")}
            </p>
          </div>

          {/* Allergen Warning */}
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 mb-8 max-w-md mx-auto py-2.5 px-3">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 font-body text-xs leading-snug">
              {t("menu.allergenWarning", "La información sobre alérgenos es orientativa. Por favor, consulta los alérgenos directamente con el restaurante.")}
            </AlertDescription>
          </Alert>


          <div
            ref={navRef}
            className={cn(
              "sticky top-[60px] z-30 -mx-4 px-4 py-3 transition-all duration-300 mb-6",
              isSticky ? "bg-muted/95 backdrop-blur-sm shadow-sm" : "",
              !showCategoryNav ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
          >
            <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-full font-body font-bold text-sm whitespace-nowrap transition-all duration-200 shrink-0",
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-card text-foreground border border-border hover:border-primary/50",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {categoryLabels[cat.id]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Sections */}
          {categories.map((cat) => {
            const items = menuItems.filter((i) => i.category === cat.id);
            if (!items.length) return null;
            return (
              <div
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
                className="mb-16 scroll-mt-40"
              >
                <div className="flex items-center gap-3 mb-6">
                  <cat.icon className="w-6 h-6 text-menu-teal" />
                  <h3 className="font-display text-2xl md:text-3xl font-bold text-menu-teal">
                    {categoryLabels[cat.id]}
                  </h3>
                  <span className="text-muted-foreground font-body text-sm">({items.length})</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                  {items.map((item) => (
                    <MenuCard key={item.name} item={item} onAdd={() => handleAdd(item)} showAddButton={isAdmin} imageUrl={getImageForItem(item.name)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </TooltipProvider>
  );
};

export default MenuSection;
