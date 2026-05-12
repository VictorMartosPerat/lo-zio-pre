import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePizzeriaRole } from "@/hooks/usePizzeriaRole";
import { toast } from "sonner";
import { CalendarIcon, ChevronDown, ChevronUp, Pencil, Settings, BarChart3, Star, Users, Image as ImageIcon, Package, MapPin, ArrowRight, ShieldCheck, Tag } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/Navbar";
import AdminManualReservation from "@/components/AdminManualReservation";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import FloorPlan from "@/components/FloorPlan";
import AdminCustomers from "@/components/AdminCustomers";
import AdminReports from "@/components/AdminReports";
import AdminReviews from "@/components/AdminReviews";
import AdminMedia from "@/components/AdminMedia";
import AdminProducts from "@/components/AdminProducts";
import AdminUserRoles from "@/components/AdminUserRoles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { locationsData } from "@/lib/locations";
import { getUnavailableSlots } from "@/lib/availability";

const TIME_SLOTS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

interface Reservation {
  id: string; location: string; guest_name: string; email: string; phone: string;
  reservation_date: string; reservation_time: string; guests: string;
  notes: string | null; status: string; created_at: string; user_id: string | null;
  table_id: string | null; table_ids: string[] | null;
}

const locationNames: Record<string, string> = {
  tarragona: "Lo Zio Tarragona",
  arrabassada: "Lo Zio Arrabassada",
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { pizzeria } = usePizzeriaRole();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [tableNames, setTableNames] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(!isMobile);
  const [reservationsEnabled, setReservationsEnabled] = useState(true);
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [pendingToggleValue, setPendingToggleValue] = useState(false);
  const [showCancelledToday, setShowCancelledToday] = useState(false);
  const [cancelIds, setCancelIds] = useState<string[] | null>(null);
  const [cancelName, setCancelName] = useState("");
  const [activeTab, setActiveTab] = useState("reservations");
  const [reservationSubTab, setReservationSubTab] = useState("lista");

  // Edit reservation state
  const [editReservation, setEditReservation] = useState<GroupedReservation | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState("");
  const [editGuests, setEditGuests] = useState("2");
  const [editNotes, setEditNotes] = useState("");
  const [editUnavailable, setEditUnavailable] = useState<Set<string>>(new Set());
  const [editSaving, setEditSaving] = useState(false);

  const statusLabels: Record<string, { label: string; className: string }> = {
    pending: { label: t("admin.statusPending"), className: "bg-accent/20 text-accent-foreground" },
    confirmed: { label: t("admin.statusConfirmed"), className: "bg-secondary/20 text-secondary" },
    cancelled: { label: t("admin.statusCancelled"), className: "bg-destructive/20 text-destructive" },
  };

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  useEffect(() => {
    if (!adminLoading && isAdmin) {
      fetchReservations();
      fetchTableNames();
      fetchReservationsEnabled();
    } else if (!adminLoading) {
      setLoading(false);
    }
  }, [isAdmin, adminLoading]);

  const fetchReservationsEnabled = async () => {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "reservations_enabled").single();
    if (data) setReservationsEnabled(data.value === true);
  };

  const handleToggleReservations = (checked: boolean) => {
    setPendingToggleValue(checked);
    setShowToggleDialog(true);
  };

  const confirmToggleReservations = async () => {
    const { error } = await supabase.from("site_settings").update({ value: pendingToggleValue, updated_at: new Date().toISOString() }).eq("key", "reservations_enabled");
    if (error) {
      toast.error("Error al actualizar el estado de las reservas");
    } else {
      setReservationsEnabled(pendingToggleValue);
      toast.success(pendingToggleValue ? "Reservas activadas" : "Reservas desactivadas");
    }
    setShowToggleDialog(false);
  };

  const fetchReservations = async () => {
    const { data, error } = await supabase.from("reservations").select("*").order("reservation_date", { ascending: true }).order("reservation_time", { ascending: true });
    if (error) { toast.error(t("admin.loadError")); } else { setReservations((data as Reservation[]) || []); }
    setLoading(false);
  };

  const fetchTableNames = async () => {
    const { data } = await supabase.from("tables").select("id, name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((t: any) => { map[t.id] = t.name; });
      setTableNames(map);
    }
  };

  const updateStatus = async (ids: string | string[], status: string) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const { error } = await supabase.from("reservations").update({ status }).in("id", idArray);
    if (error) { toast.error(t("admin.statusError")); } else { toast.success(t("admin.statusUpdated")); fetchReservations(); }
  };

  const loadEditAvailability = async (location: string, date: Date, guests: number, excludeIds: string[]) => {
    const { data: resData } = await supabase
      .from("reservations")
      .select("reservation_time, guests, table_id, table_ids")
      .eq("location", location)
      .eq("reservation_date", format(date, "yyyy-MM-dd"))
      .in("status", ["pending", "confirmed"])
      .not("id", "in", `(${excludeIds.join(",")})`);
    const { data: tablesData } = await supabase
      .from("tables")
      .select("id, name, capacity")
      .eq("location", location)
      .eq("is_active", true);
    const unavailable = getUnavailableSlots(resData || [], TIME_SLOTS, guests, tablesData || undefined);
    setEditUnavailable(unavailable);
  };

  const openEditDialog = async (r: GroupedReservation) => {
    setEditReservation(r);
    setEditName(r.guest_name);
    setEditPhone(r.phone);
    setEditEmail(r.email || "");
    setEditGuests(r.guests);
    const cleanNotes = (r.notes || "").replace(/\[Grupo \d+p:[^\]]*\]/g, "").trim();
    setEditNotes(cleanNotes);
    const d = new Date(r.reservation_date + "T00:00:00");
    setEditDate(d);
    setEditTime(r.reservation_time.substring(0, 5));
    await loadEditAvailability(r.location, d, parseInt(r.guests) || 2, r.allIds);
  };

  const handleSaveEdit = async () => {
    if (!editReservation) return;
    setEditSaving(true);

    const primaryId = editReservation.allIds[0];
    const originalStatus = editReservation.status;
    const newDate = format(editDate, "yyyy-MM-dd");
    const newGuests = parseInt(editGuests) || 2;

    // Temporarily cancel all rows so find_available_tables_multi
    // doesn't count this reservation's own tables as occupied.
    await supabase.from("reservations").update({ status: "cancelled" }).in("id", editReservation.allIds);

    // Find the right tables for the new configuration.
    const { data: tableIds, error: rpcError } = await supabase.rpc("find_available_tables_multi", {
      _location: editReservation.location,
      _date: newDate,
      _time: editTime + ":00",
      _guests: newGuests,
    });

    if (rpcError || !tableIds || tableIds.length === 0) {
      // Revert: restore original status so the reservation is not lost.
      await supabase.from("reservations").update({ status: originalStatus }).in("id", editReservation.allIds);
      toast.error("No hay disponibilidad para esa fecha/hora");
      setEditSaving(false);
      return;
    }

    // Get table names for the notes field.
    const { data: tablesData } = await supabase.from("tables").select("id, name").in("id", tableIds);
    const tableNames = tablesData?.map((t: any) => t.name).join(" + ") || "";
    const notesValue = tableIds.length > 1
      ? `[Grupo ${newGuests}p: ${tableNames}]${editNotes.trim() ? " " + editNotes.trim() : ""}`.trim()
      : editNotes.trim() || null;

    // Update the primary row in-place — no new reservation is created.
    await supabase.from("reservations").update({
      guest_name: editName.trim(),
      phone: editPhone.trim(),
      reservation_date: newDate,
      reservation_time: editTime + ":00",
      guests: editGuests,
      notes: notesValue,
      table_id: tableIds[0],
      table_ids: tableIds,
      status: originalStatus,
    }).eq("id", primaryId);

    // If this was a legacy 2-row booking, keep the extra rows cancelled.
    // (they are already cancelled from the temp step above)

    toast.success("Reserva modificada correctamente");
    setEditReservation(null);
    fetchReservations();
    setEditSaving(false);
  };

  // Dates that have reservations (for calendar dots)
  const reservationDates = useMemo(() => {
    const dates = new Set<string>();
    reservations.forEach((r) => {
      if (r.status !== "cancelled") dates.add(r.reservation_date);
    });
    return dates;
  }, [reservations]);

  // Group key for multi-table reservations
  const getGroupKey = (r: Reservation) =>
    `${r.guest_name}|${r.reservation_date}|${r.reservation_time}|${r.location}|${r.phone}`;

  interface GroupedReservation extends Reservation {
    tableIds: string[];
    allIds: string[];
  }

  // Filtered and grouped reservations for selected date
  const filteredForDate = useMemo(() => {
    const selStr = format(selectedDate, "yyyy-MM-dd");
    const isTodaySelected = selStr === format(new Date(), "yyyy-MM-dd");
    const filtered = reservations.filter((r) => {
      if (r.reservation_date !== selStr) return false;
      if (filterLocation !== "all" && r.location !== filterLocation) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (isTodaySelected && !showCancelledToday && r.status === "cancelled") return false;
      return true;
    });

    // Group by guest+date+time+location+phone, but only if created within 10s of each other (multi-table)
    const groups = new Map<string, GroupedReservation>();
    filtered.forEach((r) => {
      const key = getGroupKey(r);
      const existing = groups.get(key);
      if (existing) {
        // Legacy: group rows created within 10 seconds (old multi-table 2-row bookings)
        const existingTime = new Date(existing.created_at).getTime();
        const currentTime = new Date(r.created_at).getTime();
        if (Math.abs(existingTime - currentTime) <= 10000) {
          if (r.table_id) existing.tableIds.push(r.table_id);
          existing.allIds.push(r.id);
        } else {
          const uniqueKey = `${key}|${r.id}`;
          groups.set(uniqueKey, {
            ...r,
            // New schema: use table_ids array; fallback to table_id for old rows
            tableIds: r.table_ids?.length ? r.table_ids : (r.table_id ? [r.table_id] : []),
            allIds: [r.id],
          });
        }
      } else {
        groups.set(key, {
          ...r,
          tableIds: r.table_ids?.length ? r.table_ids : (r.table_id ? [r.table_id] : []),
          allIds: [r.id],
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.reservation_time.localeCompare(b.reservation_time));
  }, [reservations, selectedDate, filterLocation, filterStatus, showCancelledToday]);

  const cancelledTodayCount = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return reservations.filter((r) => r.reservation_date === todayStr && r.status === "cancelled" &&
      (filterLocation === "all" || r.location === filterLocation)).length;
  }, [reservations, filterLocation]);

  const handleDateSelect = (d: Date | undefined) => {
    if (d) setSelectedDate(d);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  if (authLoading || adminLoading || loading) {
    return (<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground font-body">{t("profile.loadingText")}</p></div>);
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-foreground mb-4">{t("admin.accessDenied")}</h1>
          <p className="text-muted-foreground font-body mb-6">{t("admin.noPermission")}</p>
          <a href="/" className="text-primary font-body hover:underline">{t("admin.backHome")}</a>
        </div>
      </div>
    );
  }

  const formatDateHeader = (dateStr: string) => {
    const d = parseISO(dateStr);
    return format(d, "EEEE d 'de' MMMM", { locale: es });
  };

  const renderReservationCard = (r: GroupedReservation) => {
    const st = statusLabels[r.status] || statusLabels.pending;
    const tableLabel = r.tableIds
      .map((id) => tableNames[id])
      .filter(Boolean)
      .join(" + ");
    return (
      <div key={r.allIds.join("-")} className="bg-card rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-center shrink-0 w-14">
            <p className="font-display text-lg font-bold text-foreground leading-none">{r.reservation_time.substring(0, 5)}</p>
          </div>
          <div className="h-8 w-px bg-border shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-body font-bold text-foreground truncate">{r.guest_name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body mt-0.5">
              <span>{r.guests} 👤</span>
              {tableLabel && <span>🪑 {tableLabel}</span>}
              <span>{r.phone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-1 rounded-sm text-xs font-bold font-body ${st.className}`}>{st.label}</span>
          {r.status !== "cancelled" && (
            <>
              <button
                onClick={() => openEditDialog(r)}
                className="px-2 py-1 text-xs font-body font-bold bg-primary/10 text-primary rounded-sm hover:bg-primary/20 transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Editar
              </button>
              <button onClick={() => { setCancelIds(r.allIds); setCancelName(r.guest_name); }}
                className="px-2 py-1 text-xs font-body font-bold bg-destructive/20 text-destructive rounded-sm hover:bg-destructive/30 transition-colors">
                {t("admin.cancel")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDateGroup = (dateStr: string, items: GroupedReservation[], isHighlighted = false) => {
    const dateLabel = formatDateHeader(dateStr);
    const isTodayDate = dateStr === format(new Date(), "yyyy-MM-dd");
    return (
      <div key={dateStr} className="space-y-2">
        <div className={`flex items-center gap-3 py-2 px-1 ${isHighlighted ? '' : ''}`}>
          <h3 className={`font-display text-sm font-bold uppercase tracking-wider ${isTodayDate ? 'text-primary' : 'text-foreground'}`}>
            {isTodayDate ? 'Hoy' : ''} — {dateLabel}
          </h3>
          <Badge variant={isTodayDate ? "default" : "secondary"} className="text-xs">
            {items.length} {items.length === 1 ? 'reserva' : 'reservas'}
          </Badge>
        </div>
        <div className="space-y-2">
          {items.map(renderReservationCard)}
        </div>
      </div>
    );
  };

  const totalActive = filteredForDate.filter(r => r.status !== "cancelled").length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar forceSolid />
      <div className="pt-24 md:pt-28 pb-16 px-3 md:px-4 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground">
              {t("admin.title")}
              {pizzeria && (
                <span className="block md:inline md:ml-3 text-base md:text-2xl font-display font-semibold text-menu-teal mt-1 md:mt-0">
                  · {pizzeria === "tarragona" ? "Pizzería Tarragona" : "Pizzería Arrabassada"}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground font-body mt-1 md:mt-2 text-sm">{t("admin.subtitle")}</p>
          </div>
          <AdminManualReservation onCreated={fetchReservations} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList className="font-body">
              <TabsTrigger value="reservations" className="font-bold">Reservas</TabsTrigger>
              <TabsTrigger value="orders" className="font-bold">Pedidos</TabsTrigger>
            </TabsList>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-body gap-2">
                  <Settings className="w-4 h-4" />
                  Configuración
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuLabel>Gestión</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("products")}>
                  <Package className="w-4 h-4 mr-2" /> Productos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("media")}>
                  <ImageIcon className="w-4 h-4 mr-2" /> Media
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("customers")}>
                  <Users className="w-4 h-4 mr-2" /> Clientes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("roles")}>
                  <ShieldCheck className="w-4 h-4 mr-2" /> Roles de usuario
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("discounts")}>
                  <Tag className="w-4 h-4 mr-2" /> Descuentos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Análisis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("reports")}>
                  <BarChart3 className="w-4 h-4 mr-2" /> Reportes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("reviews")}>
                  <Star className="w-4 h-4 mr-2" /> Reseñas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {activeTab !== "reservations" && activeTab !== "orders" && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveTab("reservations")} className="font-body text-xs">
                ← Volver
              </Button>
              <Badge variant="secondary" className="font-body capitalize">
                {activeTab === "products" ? "Productos" : activeTab === "media" ? "Media" : activeTab === "customers" ? "Clientes" : activeTab === "reports" ? "Reportes" : activeTab === "reviews" ? "Reseñas" : activeTab}
              </Badge>
            </div>
          )}

          <TabsContent value="reservations" className="space-y-6">
            <Tabs value={reservationSubTab} onValueChange={setReservationSubTab}>
              <TabsList className="font-body">
                <TabsTrigger value="lista" className="font-bold">Lista</TabsTrigger>
                <TabsTrigger value="plano" className="font-bold">Plano</TabsTrigger>
              </TabsList>

              <TabsContent value="lista" className="space-y-6 mt-4">
                {/* Push notifications toggle (admin device) */}
                <PushNotificationToggle />

                {/* Toggle reservas */}
                <div className="flex items-center justify-between bg-card rounded-lg p-4 border border-border shadow-sm">
                  <div>
                    <p className="font-body font-bold text-foreground text-sm">
                      {reservationsEnabled ? "Reservas activas" : "Reservas desactivadas"}
                    </p>
                    <p className="text-muted-foreground font-body text-xs mt-0.5">
                      {reservationsEnabled ? "Los usuarios pueden hacer reservas online" : "Las reservas online están pausadas"}
                    </p>
                  </div>
                  <Switch
                    checked={reservationsEnabled}
                    onCheckedChange={handleToggleReservations}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t("admin.total"), count: totalActive },
                    { label: t("admin.pending"), count: filteredForDate.filter((r) => r.status === "pending").length },
                    { label: t("admin.confirmed"), count: filteredForDate.filter((r) => r.status === "confirmed").length },
                    { label: t("admin.cancelled"), count: filteredForDate.filter((r) => r.status === "cancelled").length },
                  ].map((s) => (
                    <div key={s.label} className="bg-card rounded-lg p-5 border border-border shadow-sm">
                      <p className="text-muted-foreground font-body text-sm">{s.label}</p>
                      <p className="font-display text-3xl font-bold text-foreground">{s.count}</p>
                    </div>
                  ))}
                </div>

                {/* Calendar + Filters */}
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Calendar */}
                  <div className="lg:w-auto shrink-0">
                    {isMobile ? (
                      <Collapsible open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-body text-sm">
                            <span className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" />
                              {format(selectedDate, "EEE d MMM", { locale: es })}
                            </span>
                            {calendarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="bg-card border border-border rounded-lg p-2">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={handleDateSelect}
                              locale={es}
                              className={cn("p-3 pointer-events-auto")}
                              modifiers={{ hasReservation: (d) => reservationDates.has(format(d, "yyyy-MM-dd")) }}
                              modifiersClassNames={{ hasReservation: "reservation-dot", today: "!bg-primary !text-primary-foreground" }}
                            />
                            <div className="px-3 pb-2">
                              <Button size="sm" variant="outline" onClick={handleGoToToday} className="w-full font-body font-bold text-xs">
                                Hoy
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <div className="bg-card border border-border rounded-lg p-2">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          locale={es}
                          className={cn("p-3 pointer-events-auto")}
                          modifiers={{ hasReservation: (d) => reservationDates.has(format(d, "yyyy-MM-dd")) }}
                          modifiersClassNames={{ hasReservation: "reservation-dot", today: "!bg-primary !text-primary-foreground" }}
                        />
                        <div className="px-3 pb-2">
                          <Button size="sm" variant="outline" onClick={handleGoToToday} className="w-full font-body font-bold text-xs">
                            Hoy
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reservation list */}
                  <div className="flex-1 space-y-6 min-w-0">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3">
                      <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}
                        className="px-4 py-2 rounded-sm bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="all">{t("admin.allLocations")}</option>
                        <option value="tarragona">Lo Zio Tarragona</option>
                        <option value="arrabassada">Lo Zio Arrabassada</option>
                      </select>
                      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2 rounded-sm bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="all">{t("admin.allStatuses")}</option>
                        <option value="pending">{t("admin.pending")}</option>
                        <option value="confirmed">{t("admin.confirmed")}</option>
                        <option value="cancelled">{t("admin.cancelled")}</option>
                      </select>
                      {format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && cancelledTodayCount > 0 && filterStatus === "all" && (
                        <Button
                          size="sm"
                          variant={showCancelledToday ? "secondary" : "outline"}
                          onClick={() => setShowCancelledToday(!showCancelledToday)}
                          className="font-body text-xs"
                        >
                          {showCancelledToday ? "Ocultar canceladas" : `Mostrar canceladas (${cancelledTodayCount})`}
                        </Button>
                      )}
                      {format(selectedDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
                        <Button size="sm" variant="ghost" onClick={handleGoToToday} className="font-body text-xs text-primary">
                          ✕ Volver a hoy
                        </Button>
                      )}
                    </div>

                    {/* Reservations for selected date */}
                    {filteredForDate.length > 0 ? (
                      renderDateGroup(format(selectedDate, "yyyy-MM-dd"), filteredForDate, format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))
                    ) : (
                      <div className="bg-card rounded-lg p-12 border border-border text-center">
                        <p className="text-muted-foreground font-body text-lg">{t("admin.noReservations")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="plano" className="mt-4">
                <FloorPlan />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Pedidos por local</h2>
              <p className="font-body text-sm text-muted-foreground mt-1">Gestiona los pedidos de cada restaurante.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { slug: "tarragona", name: "Lo Zio Tarragona", address: "Tarragona" },
                { slug: "arrabassada", name: "Lo Zio Arrabassada", address: "Playa Arrabassada" },
              ].map((loc) => (
                <button
                  key={loc.slug}
                  onClick={() => navigate(`/admin/pedidos/${loc.slug}`)}
                  className="bg-card border border-border rounded-xl p-6 text-left hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <h3 className="font-display text-lg text-foreground">{loc.name}</h3>
                      </div>
                      <p className="font-body text-sm text-muted-foreground pl-6">{loc.address}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reports"><AdminReports /></TabsContent>
          <TabsContent value="reviews"><AdminReviews /></TabsContent>
          <TabsContent value="customers"><AdminCustomers /></TabsContent>
          <TabsContent value="media"><AdminMedia /></TabsContent>
          <TabsContent value="products"><AdminProducts /></TabsContent>
          <TabsContent value="roles"><AdminUserRoles /></TabsContent>
        </Tabs>
      </div>
      <AlertDialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggleValue ? "¿Activar reservas?" : "¿Desactivar reservas?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggleValue
                ? "Los usuarios podrán volver a hacer reservas online."
                : "Los usuarios no podrán hacer nuevas reservas hasta que las reactives."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleReservations}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!cancelIds} onOpenChange={(open) => { if (!open) setCancelIds(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reserva de {cancelName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la reserva. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (cancelIds) updateStatus(cancelIds, "cancelled"); setCancelIds(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit reservation dialog */}
      <Dialog open={!!editReservation} onOpenChange={(open) => { if (!open) setEditReservation(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Editar reserva</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body font-bold text-sm">Nombre</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="font-body" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body font-bold text-sm">Teléfono</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="font-body" />
              </div>
            </div>

            {/* Guests */}
            <div className="space-y-1.5">
              <Label className="font-body font-bold text-sm">Personas</Label>
              <select
                value={editGuests}
                onChange={async (e) => {
                  setEditGuests(e.target.value);
                  if (editReservation) {
                    await loadEditAvailability(editReservation.location, editDate, parseInt(e.target.value) || 2, editReservation.allIds);
                    if (editUnavailable.has(editTime)) setEditTime("");
                  }
                }}
                className="w-full px-3 py-2 rounded-sm bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>{n} {n === 1 ? "persona" : "personas"}</option>
                ))}
              </select>
              {parseInt(editGuests) > 6 && (
                <p className="text-xs text-muted-foreground font-body">
                  Se asignarán 2 mesas automáticamente ({editGuests} personas)
                </p>
              )}
              {parseInt(editGuests) <= 6 && editReservation && editReservation.tableIds.length > 1 && (
                <p className="text-xs text-menu-teal font-body">
                  Al bajar a {editGuests} personas se liberará 1 mesa
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="font-body font-bold text-sm">Fecha</Label>
              <div className="border border-input rounded-sm overflow-hidden">
                <Calendar
                  mode="single"
                  selected={editDate}
                  onSelect={async (d) => {
                    if (!d || !editReservation) return;
                    setEditDate(d);
                    setEditTime("");
                    await loadEditAvailability(editReservation.location, d, parseInt(editGuests) || 2, editReservation.allIds);
                  }}
                  locale={es}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="p-3"
                />
              </div>
            </div>

            {/* Time slots */}
            <div className="space-y-1.5">
              <Label className="font-body font-bold text-sm">Hora</Label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const unavailable = editUnavailable.has(slot);
                  const selected = editTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={unavailable}
                      onClick={() => setEditTime(slot)}
                      className={cn(
                        "py-2 rounded-sm text-sm font-body font-bold border transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : unavailable
                            ? "bg-muted text-muted-foreground border-muted cursor-not-allowed line-through opacity-50"
                            : "bg-background text-foreground border-input hover:border-primary hover:bg-primary/5"
                      )}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="font-body font-bold text-sm">Notas</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="font-body resize-none"
                placeholder="Alergias, preferencias, ocasión especial…"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditReservation(null)} className="font-body">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editSaving || !editTime || !editName.trim()}
              className="font-body font-bold"
            >
              {editSaving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
