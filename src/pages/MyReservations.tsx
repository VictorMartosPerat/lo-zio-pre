import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es, enUS, ca } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarIcon, Clock, Users, X, Edit2, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getUnavailableSlots } from "@/lib/availability";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";

const CLOSED_DAYS: Record<string, number[]> = {
  tarragona: [2],
  arrabassada: [1],
};

const timeSlots = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];
const dateFnsLocales: Record<string, typeof es> = { es, en: enUS, ca };

interface Reservation {
  id: string;
  reservation_date: string;
  reservation_time: string;
  guests: string;
  location: string;
  status: string;
  notes: string | null;
  guest_name: string;
  table_id: string | null;
  table_ids: string[] | null;
  created_at: string;
}

interface GroupedReservation {
  ids: string[];
  reservation_date: string;
  reservation_time: string;
  guests: string;
  location: string;
  status: string;
  notes: string | null;
  guest_name: string;
  table_ids: (string | null)[];
}

function groupReservations(reservations: Reservation[]): GroupedReservation[] {
  const groups: GroupedReservation[] = [];
  const used = new Set<string>();

  for (const r of reservations) {
    if (used.has(r.id)) continue;

    // Find siblings: same user, date, time, location, status, created within 10s
    const siblings = reservations.filter((s) => {
      if (used.has(s.id) || s.id === r.id) return false;
      return (
        s.reservation_date === r.reservation_date &&
        s.reservation_time === r.reservation_time &&
        s.location === r.location &&
        s.status === r.status &&
        s.guest_name === r.guest_name &&
        Math.abs(new Date(s.created_at).getTime() - new Date(r.created_at).getTime()) < 10000
      );
    });

    const allIds = [r.id, ...siblings.map((s) => s.id)];
    allIds.forEach((id) => used.add(id));

    // New schema: single row with table_ids array. Legacy: multiple rows grouped.
    const resolvedTableIds: (string | null)[] = r.table_ids?.length
      ? r.table_ids
      : [r.table_id, ...siblings.map((s) => s.table_id)];

    groups.push({
      ids: allIds,
      reservation_date: r.reservation_date,
      reservation_time: r.reservation_time,
      guests: r.guests,
      location: r.location,
      status: r.status,
      notes: r.notes,
      guest_name: r.guest_name,
      table_ids: resolvedTableIds,
    });
  }

  return groups;
}

const MyReservations = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dfLocale = dateFnsLocales[i18n.language] || es;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<GroupedReservation | null>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState<string>("");
  const [editGuests, setEditGuests] = useState<string>("2");
  const [editNotes, setEditNotes] = useState<string>("");
  const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string[] | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<GroupedReservation | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const { pullDistance, refreshing, translateY, isAnimating } = usePullToRefresh(async () => {
    await fetchReservations();
  });

  const fetchReservations = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("user_id", user.id)
      .order("reservation_date", { ascending: false });
    if (!error && data) setReservations(data as Reservation[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchReservations();
  }, [user]);

  const grouped = groupReservations(reservations);

  const canModify = (r: GroupedReservation) => {
    if (r.status === "cancelled") return false;
    const now = new Date();
    const resDate = new Date(`${r.reservation_date}T${r.reservation_time}`);
    return resDate > now;
  };

  const handleCancel = async (group: GroupedReservation) => {
    setCancelling(group.ids);
    // Cancel all reservation rows in the group
    for (const id of group.ids) {
      await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("user_id", user!.id);
    }
    toast.success(t("myReservations.cancelSuccess", "Reserva cancelada"));
    fetchReservations();
    setCancelling(null);
    setCancelConfirm(null);
  };

  const openEdit = async (r: GroupedReservation) => {
    setEditDialog(r);
    const d = new Date(r.reservation_date + "T00:00:00");
    setEditDate(d);
    setEditTime(r.reservation_time.substring(0, 5));
    setEditGuests(r.guests);
    // Strip auto-generated group tags like "[Grupo 8p: Mesa 1 + Mesa 2]" from notes
    const cleanNotes = (r.notes || "").replace(/\[Grupo \d+p:[^\]]*\]/g, "").trim();
    setEditNotes(cleanNotes);
    await loadAvailability(r.location, d, parseInt(r.guests) || 2, r.ids);
  };

  const loadAvailability = async (location: string, date: Date, guests: number, excludeIds: string[]) => {
    const query = supabase
      .from("reservations")
      .select("reservation_time, guests, table_id, table_ids")
      .eq("location", location)
      .eq("reservation_date", format(date, "yyyy-MM-dd"))
      .in("status", ["pending", "confirmed"]);

    // Exclude all IDs from the group
    for (const id of excludeIds) {
      query.neq("id", id);
    }

    const [resResult, tablesResult] = await Promise.all([
      query,
      supabase.from("tables").select("id, name, capacity").eq("location", location).eq("is_active", true),
    ]);
    if (!resResult.error) {
      const unavailable = getUnavailableSlots(resResult.data || [], timeSlots, guests, tablesResult.data || undefined);
      setUnavailableSlots(unavailable);
    }
  };

  const handleEditDateChange = async (d: Date | undefined) => {
    if (!d || !editDialog) return;
    setEditDate(d);
    await loadAvailability(editDialog.location, d, parseInt(editGuests) || 2, editDialog.ids);
  };

  const handleSaveEdit = async () => {
    if (!editDialog || !user) return;
    setSaving(true);

    const primaryId = editDialog.ids[0];
    const originalStatus = editDialog.status;
    const newDate = format(editDate, "yyyy-MM-dd");
    const newGuests = parseInt(editGuests) || 2;

    // Temporarily cancel all rows so the RPC doesn't count this
    // reservation's own tables as occupied when recalculating.
    for (const id of editDialog.ids) {
      await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id).eq("user_id", user.id);
    }

    // Find tables for the new configuration.
    const { data: tableIds, error: rpcError } = await supabase.rpc("find_available_tables_multi", {
      _location: editDialog.location,
      _date: newDate,
      _time: editTime + ":00",
      _guests: newGuests,
    });

    if (rpcError || !tableIds || tableIds.length === 0) {
      // Revert: restore original status so the reservation is not lost.
      for (const id of editDialog.ids) {
        await supabase.from("reservations").update({ status: originalStatus }).eq("id", id).eq("user_id", user.id);
      }
      toast.error(t("myReservations.editError", "No hay disponibilidad para esa fecha/hora"));
      setSaving(false);
      return;
    }

    // Build notes: re-add group tag only if multi-table, without duplicating.
    const { data: tablesData } = await supabase.from("tables").select("id, name").in("id", tableIds);
    const tableNames = tablesData?.map((t: any) => t.name).join(" + ") || "";
    const notesValue = tableIds.length > 1
      ? `[Grupo ${newGuests}p: ${tableNames}]${editNotes ? " " + editNotes : ""}`.trim()
      : editNotes.trim() || null;

    // Update the primary row in-place — no new reservation created.
    await supabase.from("reservations").update({
      reservation_date: newDate,
      reservation_time: editTime + ":00",
      guests: editGuests,
      notes: notesValue,
      table_id: tableIds[0],
      table_ids: tableIds,
      status: originalStatus,
    }).eq("id", primaryId).eq("user_id", user.id);

    // Legacy extra rows (2-row old bookings) remain cancelled — primary row has all info.

    toast.success(t("myReservations.editSuccess", "Reserva modificada correctamente"));
    setEditDialog(null);
    fetchReservations();
    setSaving(false);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      confirmed: { label: t("myReservations.statusConfirmed", "Confirmada"), class: "bg-green-500/20 text-green-400" },
      pending: { label: t("myReservations.statusPending", "Pendiente"), class: "bg-yellow-500/20 text-yellow-400" },
      cancelled: { label: t("myReservations.statusCancelled", "Cancelada"), class: "bg-red-500/20 text-red-400" },
    };
    return map[status] || { label: status, class: "bg-muted text-muted-foreground" };
  };

  const locationName = (loc: string) => {
    const map: Record<string, string> = {
      tarragona: "Lo Zio Tarragona",
      arrabassada: "Lo Zio Arrabassada",
    };
    return map[loc] || loc;
  };

  if (authLoading) return null;

  return (
    <div className="relative overflow-hidden">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div
        className="min-h-screen bg-background"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isAnimating ? "transform 0.3s ease" : "none",
        }}
      >
      <Navbar forceSolid />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-32">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-primary font-body text-sm mb-6 hover:opacity-80">
          <ChevronLeft className="w-4 h-4" />
          {t("myReservations.back", "Volver")}
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground mb-8">
          {t("myReservations.title", "Mis Reservas")}
        </h1>

        {loading ? (
          <p className="text-muted-foreground font-body">{t("myReservations.loading", "Cargando...")}</p>
        ) : grouped.length === 0 ? (
          <p className="text-muted-foreground font-body">{t("myReservations.empty", "No tienes reservas.")}</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((r) => {
              const st = statusLabel(r.status);
              const modifiable = canModify(r);
              return (
                <div key={r.ids.join("-")} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-foreground">{locationName(r.location)}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-body font-semibold ${st.class}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm font-body text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4" />
                      {format(new Date(r.reservation_date + "T00:00:00"), "d MMM yyyy", { locale: dfLocale })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {r.reservation_time.substring(0, 5)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      {r.guests} {parseInt(r.guests) === 1 ? t("reservation.person") : t("reservation.persons")}
                    </div>
                  </div>
                  {r.notes && (
                    <p className="text-xs text-muted-foreground/70 font-body italic">"{r.notes}"</p>
                  )}
                  {modifiable && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="font-body text-xs gap-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                        {t("myReservations.edit", "Modificar")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelConfirm(r)}
                        disabled={cancelling !== null && cancelling.some((id) => r.ids.includes(id))}
                        className="font-body text-xs gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        {cancelling !== null && cancelling.some((id) => r.ids.includes(id))
                          ? t("myReservations.cancelling", "Cancelando...")
                          : t("myReservations.cancel", "Cancelar")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={(o) => !o && setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {t("myReservations.cancelConfirmTitle", "¿Cancelar reserva?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {cancelConfirm && t("myReservations.cancelConfirmDesc", "¿Estás seguro de que quieres cancelar tu reserva en {{location}} el {{date}} a las {{time}}?", {
                location: locationName(cancelConfirm.location),
                date: format(new Date(cancelConfirm.reservation_date + "T00:00:00"), "d MMM yyyy", { locale: dfLocale }),
                time: cancelConfirm.reservation_time.substring(0, 5),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">{t("myReservations.cancelConfirmNo", "No, mantener")}</AlertDialogCancel>
            <AlertDialogAction
              className="font-body bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelConfirm && handleCancel(cancelConfirm)}
            >
              {t("myReservations.cancelConfirmYes", "Sí, cancelar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t("myReservations.editTitle", "Modificar Reserva")}</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("reservation.date")}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal font-body text-sm")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(editDate, "EEE d MMM", { locale: dfLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={handleEditDateChange}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const maxDate = new Date(today);
                        maxDate.setDate(today.getDate() + 30);
                        const closedDays = CLOSED_DAYS[editDialog.location] || [];
                        return d < today || d > maxDate || closedDays.includes(d.getDay());
                      }}
                      locale={dfLocale}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("reservation.selectTime")}</label>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((slot) => {
                    const isUnavailable = unavailableSlots.has(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setEditTime(slot)}
                        disabled={isUnavailable}
                        className={`py-2 px-2 rounded-lg font-body text-xs font-medium transition-all ${
                          isUnavailable
                            ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed line-through"
                            : editTime === slot
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground hover:bg-primary/10"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("reservation.guests")}</label>
                <select
                  value={editGuests}
                  onChange={(e) => setEditGuests(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("reservation.notes")}</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-input font-body text-foreground resize-none"
                />
              </div>

              <Button
                onClick={handleSaveEdit}
                disabled={saving || !editTime}
                className="w-full font-body font-bold"
              >
                {saving ? t("myReservations.saving", "Guardando...") : t("myReservations.saveChanges", "Guardar Cambios")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default MyReservations;
