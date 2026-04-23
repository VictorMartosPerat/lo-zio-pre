import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Settings, Plus, CalendarDays, LayoutGrid, BarChart3, X } from "lucide-react";

const AdminFAB = () => {
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAdmin || location.pathname === "/admin") return null;

  const actions = [
    { label: t("admin.fab.newReservation"), icon: Plus, action: () => navigate("/admin?tab=reservations&action=new") },
    { label: t("admin.fab.todayReservations"), icon: CalendarDays, action: () => navigate("/admin?tab=reservations") },
    { label: t("admin.fab.floorPlan"), icon: LayoutGrid, action: () => navigate("/admin?tab=floorplan") },
    { label: t("admin.fab.reports"), icon: BarChart3, action: () => navigate("/admin?tab=reports") },
  ];

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50">
      {open && (
        <div className="mb-3 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { a.action(); setOpen(false); }}
              className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-full pl-4 pr-5 py-2.5 min-h-[44px] w-full hover:bg-muted transition-colors"
            >
              <a.icon className="w-4 h-4 text-primary" />
              <span className="font-body text-sm text-foreground whitespace-nowrap">{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl hover:opacity-90 transition-all"
        aria-label="Admin menu"
      >
        {open ? <X className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default AdminFAB;
