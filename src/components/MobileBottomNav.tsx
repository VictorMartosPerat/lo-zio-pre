import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  UtensilsCrossed,
  CalendarDays,
  ShoppingCart,
  User,
  Settings,
  LogOut,
  CalendarCheck,
  MapPin,
  Globe,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MobileBottomNav = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItems, setIsOpen } = useCart();
  const { isAdmin } = useIsAdmin();
  const { user, signOut } = useAuth();

  const isProfileActive = location.pathname === "/perfil" || location.pathname === "/mis-reservas";

  const tabs = [
    { label: t("nav.menu"), icon: UtensilsCrossed, href: "/#menu" },
    { label: t("nav.reserve"), icon: CalendarDays, href: "/#reservar" },
    { label: t("nav.locations", "Locales"), icon: MapPin, href: "/locales" },
    { label: t("nav.order"), icon: ShoppingCart, href: null, badge: totalItems, action: () => setIsOpen(true) },
    ...(isAdmin ? [{ label: "Admin", icon: Settings, href: "/admin" }] : []),
  ];

  const tabClassName = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 min-h-[56px] flex-1 transition-colors ${
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border md:hidden landscape-hide-bottom-nav">
      <div className="flex items-stretch justify-around">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive =
            (tab.href === "/admin" && location.pathname === "/admin") ||
            (tab.href === "/locales" && location.pathname.startsWith("/locales"));

          const content = (
            <>
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-body font-medium leading-tight">{tab.label}</span>
            </>
          );

          if (tab.action) {
            return (
              <button key={idx} onClick={tab.action} className={tabClassName(false)}>
                {content}
              </button>
            );
          }

          return (
            <a key={tab.href} href={tab.href!} className={tabClassName(isActive)}>
              {content}
            </a>
          );
        })}

        {/* Profile dropdown or login link */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={tabClassName(isProfileActive)}>
                <User className="w-5 h-5" />
                <span className="text-[10px] font-body font-medium leading-tight">{t("nav.profile")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="mb-2">
              <DropdownMenuItem onClick={() => navigate("/perfil")}>
                <User className="mr-2 h-4 w-4" />
                {t("nav.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/mis-reservas")}>
                <CalendarCheck className="mr-2 h-4 w-4" />
                {t("nav.myReservations", "Mis reservas")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/mis-pedidos")}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Mis pedidos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t("nav.signOut", "Cerrar sesión")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <a href="/auth" className={tabClassName(location.pathname === "/auth")}>
            <User className="w-5 h-5" />
            <span className="text-[10px] font-body font-medium leading-tight">{t("nav.login", "Login")}</span>
          </a>
        )}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default MobileBottomNav;
