import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getAllergenById } from "@/lib/allergens";
import { format, addMinutes, parse } from "date-fns";
import { es, enUS, ca } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight, Phone, Users, Clock, MessageSquare, AlertTriangle, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Table { id: string; name: string; capacity: number; position_x: number; position_y: number; shape: string; is_active: boolean; location: string; }
interface Reservation { id: string; table_id: string | null; table_ids: string[] | null; guest_name: string; email: string; phone: string; reservation_date: string; reservation_time: string; guests: string; notes: string | null; status: string; location: string; user_id: string | null; }
interface GuestProfile { allergies: string[] | null; food_preferences: string | null; favorite_table_area: string | null; internal_notes: string | null; visit_count: number | null; }

const ONLINE_TABLE_NAMES = ["Mesa 1","Mesa 2","Mesa 3","Mesa 4","Mesa 5","Mesa 6","Mesa 7","Mesa 8"];

const timeSlots = ["19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00"];
const FLOOR_W = 800;
const FLOOR_H = 600;
const RESERVATION_DURATION = 90;
const dateFnsLocales: Record<string, typeof es> = { es, en: enUS, ca };

const isOnlineTable = (table: Table) => ONLINE_TABLE_NAMES.includes(table.name);

const FloorPlan = () => {
  const { t, i18n } = useTranslation();
  const dfLocale = dateFnsLocales[i18n.language] || es;
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("20:00");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableReservation, setTableReservation] = useState<Reservation | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const floorRef = useRef<HTMLDivElement>(null);
  const [floorLocation, setFloorLocation] = useState("arrabassada");
  const [newResForm, setNewResForm] = useState({ guest_name: "", email: "", phone: "", guests: "2", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const fetchTables = useCallback(async () => {
    const { data } = await supabase.from("tables").select("*").eq("location", floorLocation).eq("is_active", true);
    if (data) setTables(data as Table[]);
  }, [floorLocation]);

  const fetchReservations = useCallback(async () => {
    const { data } = await supabase.from("reservations").select("*").eq("reservation_date", dateStr).eq("location", floorLocation).in("status", ["pending", "confirmed"]);
    if (data) setReservations(data as Reservation[]);
  }, [dateStr, floorLocation]);

  useEffect(() => { fetchTables(); }, [fetchTables]);
  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  useEffect(() => {
    const channel = supabase.channel("floorplan-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => fetchReservations())
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => fetchTables())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReservations, fetchTables]);

  const getTableStatus = (table: Table): "available" | "occupied" | "upcoming" | "manual" => {
    if (!isOnlineTable(table)) return "manual";
    const now = parse(selectedTime, "HH:mm", new Date());
    const soon = addMinutes(now, 30);
    for (const res of reservations) {
      if (res.table_id !== table.id && !res.table_ids?.includes(table.id)) continue;
      const resTime = parse(res.reservation_time.substring(0, 5), "HH:mm", new Date());
      const resEnd = addMinutes(resTime, RESERVATION_DURATION);
      if (now >= resTime && now < resEnd) return "occupied";
      if (resTime > now && resTime <= soon) return "upcoming";
    }
    return "available";
  };

  const getReservationForTable = (table: Table): Reservation | null => {
    const now = parse(selectedTime, "HH:mm", new Date());
    const soon = addMinutes(now, 30);
    for (const res of reservations) {
      if (res.table_id !== table.id && !res.table_ids?.includes(table.id)) continue;
      const resTime = parse(res.reservation_time.substring(0, 5), "HH:mm", new Date());
      const resEnd = addMinutes(resTime, RESERVATION_DURATION);
      if ((now >= resTime && now < resEnd) || (resTime > now && resTime <= soon)) return res;
    }
    return null;
  };

  const statusColors: Record<string, string> = {
    available: "bg-muted border-border hover:border-primary/50",
    occupied: "bg-destructive/20 border-destructive",
    upcoming: "bg-accent/30 border-accent",
    manual: "bg-blue-500/15 border-blue-500/50 hover:border-blue-500",
  };
  const statusDot: Record<string, string> = {
    available: "bg-muted-foreground/30",
    occupied: "bg-destructive",
    upcoming: "bg-accent",
    manual: "bg-blue-500",
  };

  const handleTableClick = async (table: Table) => {
    const status = getTableStatus(table);
    setSelectedTable(table);
    if (status === "occupied" || status === "upcoming") {
      const res = getReservationForTable(table);
      setTableReservation(res); setGuestProfile(null); setShowDetails(true);
      if (res?.user_id) {
        const { data } = await supabase.from("profiles").select("allergies, food_preferences, favorite_table_area, internal_notes, visit_count").eq("user_id", res.user_id).maybeSingle();
        if (data) setGuestProfile(data as GuestProfile);
      }
    } else {
      setNewResForm({ guest_name: "", email: "", phone: "", guests: String(table.capacity), notes: "" });
      setShowNewReservation(true);
    }
  };

  const cancelReservation = async (id: string) => {
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(t("floorPlan.cancelError")); } else { toast.success(t("floorPlan.cancelSuccess")); setShowDetails(false); fetchReservations(); }
  };

  const handleNewReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResForm.guest_name.trim() || !newResForm.phone.trim()) { toast.error(t("floorPlan.namePhoneRequired")); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reservations").insert({
      location: floorLocation, guest_name: newResForm.guest_name, email: newResForm.email || "manual@reserva.local",
      phone: newResForm.phone, reservation_date: dateStr, reservation_time: selectedTime,
      guests: newResForm.guests, notes: newResForm.notes || null, status: "confirmed", user_id: null, table_id: selectedTable?.id || null,
    });
    setSubmitting(false);
    if (error) { toast.error(t("floorPlan.reservationError")); } else { toast.success(t("floorPlan.reservationCreated")); setShowNewReservation(false); fetchReservations(); }
  };

  // Drag and drop
  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    e.preventDefault(); e.stopPropagation();
    if (!floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    const scaleX = FLOOR_W / rect.width; const scaleY = FLOOR_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX; const my = (e.clientY - rect.top) * scaleY;
    setDraggingTable(table.id);
    setDragOffset({ x: mx - (table.position_x / 100) * FLOOR_W, y: my - (table.position_y / 100) * FLOOR_H });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingTable || !floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    const scaleX = FLOOR_W / rect.width; const scaleY = FLOOR_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX; const my = (e.clientY - rect.top) * scaleY;
    const newX = ((mx - dragOffset.x) / FLOOR_W) * 100; const newY = ((my - dragOffset.y) / FLOOR_H) * 100;
    setTables(prev => prev.map(t => t.id === draggingTable ? { ...t, position_x: Math.max(0, Math.min(90, newX)), position_y: Math.max(0, Math.min(90, newY)) } : t));
  }, [draggingTable, dragOffset]);

  const handleMouseUp = useCallback(async () => {
    if (!draggingTable) return;
    const table = tables.find(t => t.id === draggingTable);
    if (table) { await supabase.from("tables").update({ position_x: table.position_x, position_y: table.position_y }).eq("id", table.id); }
    setDraggingTable(null);
  }, [draggingTable, tables]);

  useEffect(() => {
    if (draggingTable) {
      window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
      return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [draggingTable, handleMouseMove, handleMouseUp]);

  const timeIndex = timeSlots.indexOf(selectedTime);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg p-4 border border-border">
        <select value={floorLocation} onChange={(e) => setFloorLocation(e.target.value)}
          className="px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm font-bold">
          <option value="arrabassada">Lo Zio Arrabassada</option>
          <option value="tarragona">Lo Zio Tarragona</option>
        </select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 font-body"><CalendarIcon className="h-4 w-4" />{format(selectedDate, "EEEE d MMMM", { locale: dfLocale })}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={dfLocale} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={timeIndex <= 0} onClick={() => setSelectedTime(timeSlots[timeIndex - 1])}><ChevronLeft className="h-4 w-4" /></Button>
          <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}
            className="px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm font-bold">
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button variant="ghost" size="icon" disabled={timeIndex >= timeSlots.length - 1} onClick={() => setSelectedTime(timeSlots[timeIndex + 1])}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 ml-auto text-xs font-body text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted border border-border" /> {t("floorPlan.available")}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive" /> {t("floorPlan.occupied")}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent/30 border border-accent" /> {t("floorPlan.upcoming")}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/15 border border-blue-500/50" /> Gestión manual</span>
        </div>
      </div>

      <div className="overflow-auto touch-pan-x touch-pan-y landscape-floor-scroll">
      <div ref={floorRef} className="relative bg-card border border-border rounded-lg overflow-hidden select-none min-w-[600px]" style={{ aspectRatio: `${FLOOR_W}/${FLOOR_H}` }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "5% 5%" }} />
        <div className="absolute inset-1 border-2 border-border rounded-md pointer-events-none" />

        <div className="absolute border-2 border-border rounded-md bg-muted/30 flex items-center justify-center pointer-events-none" style={{ right: "3%", top: "35%", width: "28%", height: "45%" }}>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center">
              <span className="text-[10px] font-body font-bold text-muted-foreground">{t("floorPlan.oven")}</span>
            </div>
            <span className="text-[10px] font-body text-muted-foreground font-bold uppercase tracking-wider">{t("floorPlan.kitchen")}</span>
          </div>
        </div>

        <div className="absolute border-2 border-border rounded-sm bg-muted/20 flex items-center justify-center pointer-events-none" style={{ left: "1%", top: "28%", width: "8%", height: "14%" }}>
          <span className="text-[8px] font-body font-bold text-muted-foreground uppercase tracking-wider" style={{ writingMode: "vertical-rl" }}>{t("floorPlan.warehouse")}</span>
        </div>

        <div className="absolute border-2 border-border rounded-sm bg-muted/20 flex items-center justify-center pointer-events-none" style={{ left: "1%", top: "45%", width: "8%", height: "14%" }}>
          <span className="text-[9px] font-body font-bold text-muted-foreground uppercase">{t("floorPlan.wc")}</span>
        </div>

        <div className="absolute border-2 border-border rounded-sm bg-muted/10 flex items-center justify-center pointer-events-none" style={{ left: "35%", bottom: "0.5%", width: "12%", height: "5%" }}>
          <span className="text-[9px] font-body font-bold text-muted-foreground uppercase tracking-wider">{t("floorPlan.entrance")}</span>
        </div>

        {tables.map((table) => {
          const status = getTableStatus(table);
          const isRound = table.shape === "round";
          const size = table.capacity <= 2 ? "7%" : "9%";
            return (
              <div key={table.id}
                className={cn("absolute flex flex-col items-center justify-center border-2 cursor-pointer transition-colors shadow-sm", isRound ? "rounded-full" : "rounded-md", statusColors[status], draggingTable === table.id && "ring-2 ring-primary shadow-lg z-20")}
                style={{ left: `${table.position_x}%`, top: `${table.position_y}%`, width: size, height: size }}
                onClick={() => !draggingTable && handleTableClick(table)}
                onMouseDown={(e) => handleMouseDown(e, table)}
                onTouchStart={() => {
                  const timer = setTimeout(() => handleTableClick(table), 500);
                  (table as any)._longPressTimer = timer;
                }}
                onTouchEnd={() => clearTimeout((table as any)._longPressTimer)}
                onTouchMove={() => clearTimeout((table as any)._longPressTimer)}>
                <div className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-card", statusDot[status])} />
                <span className="text-[10px] font-body font-bold text-foreground leading-none">{table.name.replace("Mesa ", "M").replace("Barra ", "B")}</span>
                <span className="text-[8px] font-body text-muted-foreground leading-none mt-0.5">{table.capacity}p</span>
              </div>
          );
        })}

        {tables.map((table) => {
          const cx = table.position_x; const cy = table.position_y;
          const isRound = table.shape === "round";
          const halfSize = table.capacity <= 2 ? 3.5 : 4.5;
          const seatSize = "1.2%";
          const seats: { x: number; y: number }[] = [];
          if (isRound || table.capacity <= 2) {
            seats.push({ x: cx + halfSize, y: cy - 2 }); seats.push({ x: cx + halfSize, y: cy + halfSize * 2 + 0.5 });
          } else {
            seats.push({ x: cx - 1.5, y: cy + halfSize - 1 }); seats.push({ x: cx + halfSize * 2 + 0.5, y: cy + halfSize - 1 });
            seats.push({ x: cx + halfSize - 1, y: cy - 2 }); seats.push({ x: cx + halfSize - 1, y: cy + halfSize * 2 + 0.5 });
          }
          return seats.map((s, i) => (
            <div key={`${table.id}-seat-${i}`} className="absolute rounded-full border border-border bg-muted/40 pointer-events-none" style={{ left: `${s.x}%`, top: `${s.y}%`, width: seatSize, height: seatSize }} />
          ));
        })}
      </div>
      </div>

      {/* Reservation Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">{selectedTable?.name} — {t("floorPlan.reservation")}</DialogTitle>
          </DialogHeader>
          {tableReservation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm font-body">
                <div className="flex items-center gap-2 text-foreground"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-bold">{tableReservation.guest_name}</span></div>
                <div className="flex items-center gap-2 text-foreground"><Users className="h-4 w-4 text-muted-foreground" /><span>{tableReservation.guests} {t("floorPlan.persons")}</span></div>
                <div className="flex items-center gap-2 text-foreground"><Clock className="h-4 w-4 text-muted-foreground" /><span>{tableReservation.reservation_time.substring(0, 5)}</span></div>
                <div className="flex items-center gap-2 text-foreground"><Phone className="h-4 w-4 text-muted-foreground" /><span>{tableReservation.phone}</span></div>
              </div>
              {tableReservation.notes && (
                <div className="flex items-start gap-2 text-sm font-body text-muted-foreground bg-muted/50 p-3 rounded-md"><MessageSquare className="h-4 w-4 mt-0.5 shrink-0" /><span>{tableReservation.notes}</span></div>
              )}
              {guestProfile && (
                <div className="space-y-2">
                  {guestProfile.allergies && guestProfile.allergies.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                      <p className="text-[10px] font-bold text-destructive font-body flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" /> {t("floorPlan.allergiesWarning")}</p>
                      <div className="flex flex-wrap gap-1">
                        {guestProfile.allergies.map((a, i) => {
                          const allergen = getAllergenById(a);
                          return (<span key={i} className="px-1.5 py-0.5 bg-destructive/20 text-destructive rounded-sm text-[10px] font-body font-bold">{allergen ? `${allergen.emoji} ${t(`allergens.${a}`)}` : a}</span>);
                        })}
                      </div>
                    </div>
                  )}
                  {guestProfile.food_preferences && (<div className="flex items-start gap-1.5 text-xs font-body text-muted-foreground"><Heart className="h-3 w-3 mt-0.5 shrink-0 text-primary" /><span>{guestProfile.food_preferences}</span></div>)}
                  {guestProfile.internal_notes && (<div className="flex items-start gap-1.5 text-xs font-body text-accent-foreground bg-accent/10 p-2 rounded-md"><MessageSquare className="h-3 w-3 mt-0.5 shrink-0" /><span>{guestProfile.internal_notes}</span></div>)}
                  {guestProfile.visit_count ? (<p className="text-[10px] font-body text-muted-foreground">{guestProfile.visit_count} {t("floorPlan.previousVisits")}</p>) : null}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs font-body">
                <span className={cn("px-2 py-1 rounded-sm font-bold", tableReservation.status === "confirmed" ? "bg-secondary/20 text-secondary" : "bg-accent/20 text-accent-foreground")}>
                  {tableReservation.status === "confirmed" ? t("admin.statusConfirmed") : t("admin.statusPending")}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => cancelReservation(tableReservation.id)} variant="destructive" className="flex-1 font-bold">{t("floorPlan.cancelReservation")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Reservation Dialog */}
      <Dialog open={showNewReservation} onOpenChange={setShowNewReservation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{t("floorPlan.newReservation")} — {selectedTable?.name}</DialogTitle>
            <p className="text-sm font-body text-muted-foreground">{format(selectedDate, "EEEE d MMMM", { locale: dfLocale })} a les {selectedTime}</p>
          </DialogHeader>
          <form onSubmit={handleNewReservation} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1">{t("floorPlan.name")} *</label>
                <input type="text" required value={newResForm.guest_name} onChange={(e) => setNewResForm(p => ({ ...p, guest_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder={t("floorPlan.name")} />
              </div>
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1">{t("floorPlan.phone")} *</label>
                <input type="tel" required value={newResForm.phone} onChange={(e) => setNewResForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="+34 600 000 000" />
              </div>
            </div>
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1">{t("floorPlan.email")}</label>
              <input type="email" value={newResForm.email} onChange={(e) => setNewResForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="email@ejemplo.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1">{t("floorPlan.guests")}</label>
                <select value={newResForm.guests} onChange={(e) => setNewResForm(p => ({ ...p, guests: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1">{t("floorPlan.table")}</label>
                <input type="text" disabled value={selectedTable?.name || ""} className="w-full px-3 py-2 rounded-md bg-muted border border-input font-body text-foreground text-sm" />
              </div>
            </div>
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1">{t("floorPlan.notes")}</label>
              <textarea value={newResForm.notes} onChange={(e) => setNewResForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder={t("floorPlan.notesPlaceholder")} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full font-bold uppercase tracking-widest">
              {submitting ? t("floorPlan.creating") : t("floorPlan.createReservation")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FloorPlan;
