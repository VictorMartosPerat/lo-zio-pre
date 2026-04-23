import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getAllergenById } from "@/lib/allergens";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, User, Phone, MapPin, AlertTriangle, MessageSquare, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Profile {
  id: string; user_id: string; full_name: string | null; phone: string | null;
  address: string | null; city: string | null; postal_code: string | null;
  allergies: string[] | null; food_preferences: string | null;
  favorite_table_area: string | null; special_dates: any;
  internal_notes: string | null; visit_count: number | null;
  avg_spend: number | null; created_at: string;
}

interface Reservation {
  id: string; reservation_date: string; reservation_time: string;
  guests: string; location: string; status: string; notes: string | null;
}

const AdminCustomers = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data && !error) setProfiles(data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.full_name || "").toLowerCase().includes(q) || (p.phone || "").includes(q);
  });

  const openProfile = async (profile: Profile) => {
    setSelectedProfile(profile); setNotesValue(profile.internal_notes || ""); setEditingNotes(false);
    const { data } = await supabase.from("reservations")
      .select("id, reservation_date, reservation_time, guests, location, status, notes")
      .eq("user_id", profile.user_id).order("reservation_date", { ascending: false }).limit(20);
    setReservations((data as Reservation[]) || []);
  };

  const saveNotes = async () => {
    if (!selectedProfile) return;
    setSavingNotes(true);
    const { error } = await supabase.from("profiles").update({ internal_notes: notesValue }).eq("id", selectedProfile.id);
    setSavingNotes(false);
    if (error) { toast.error(t("customers.notesSaveError")); } else {
      toast.success(t("customers.notesSaved"));
      setSelectedProfile({ ...selectedProfile, internal_notes: notesValue });
      setProfiles((prev) => prev.map((p) => (p.id === selectedProfile.id ? { ...p, internal_notes: notesValue } : p)));
      setEditingNotes(false);
    }
  };

  const statusLabels: Record<string, { label: string; cls: string }> = {
    pending: { label: t("admin.statusPending"), cls: "bg-accent/20 text-accent-foreground" },
    confirmed: { label: t("admin.statusConfirmed"), cls: "bg-secondary/20 text-secondary" },
    cancelled: { label: t("admin.statusCancelled"), cls: "bg-destructive/20 text-destructive" },
  };

  if (loading) {
    return <div className="flex justify-center py-12"><p className="text-muted-foreground font-body">{t("customers.loading")}</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("customers.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <p className="text-sm text-muted-foreground font-body">
        {filtered.length} {filtered.length !== 1 ? t("customers.count_plural", { count: filtered.length }) : t("customers.count", { count: filtered.length })}
      </p>

      <div className="grid gap-3">
        {filtered.map((p) => (
          <div key={p.id} onClick={() => openProfile(p)}
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="h-5 w-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-body font-bold text-foreground truncate">{p.full_name || t("customers.noName")}</p>
              <p className="text-sm text-muted-foreground font-body">{p.phone || t("customers.noPhone")}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-body shrink-0">
              {p.allergies && p.allergies.length > 0 && (<span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {t("customers.allergiesLabel")}</span>)}
              {p.visit_count ? (<span>{p.visit_count} {t("customers.visits")}</span>) : null}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center"><p className="text-muted-foreground font-body">{t("customers.notFound")}</p></div>
        )}
      </div>

      <Dialog open={!!selectedProfile} onOpenChange={(open) => !open && setSelectedProfile(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-xl">{selectedProfile?.full_name || t("customers.client")}</DialogTitle></DialogHeader>
          {selectedProfile && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm font-body">
                <div className="flex items-center gap-2 text-foreground"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedProfile.phone || "—"}</span></div>
                <div className="flex items-center gap-2 text-foreground"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{selectedProfile.city || "—"}</span></div>
              </div>

              {selectedProfile.allergies && selectedProfile.allergies.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                  <p className="text-xs font-bold text-destructive font-body flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {t("customers.allergiesLabel").toUpperCase()}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProfile.allergies.map((a, i) => {
                      const allergen = getAllergenById(a);
                      return (<span key={i} className="px-2 py-0.5 bg-destructive/20 text-destructive rounded-sm text-xs font-body font-bold">{allergen ? `${allergen.emoji} ${t(`allergens.${a}`)}` : a}</span>);
                    })}
                  </div>
                </div>
              )}

              {selectedProfile.food_preferences && (<div className="text-sm font-body"><p className="font-bold text-foreground mb-1">{t("customers.preferences")}</p><p className="text-muted-foreground">{selectedProfile.food_preferences}</p></div>)}
              {selectedProfile.favorite_table_area && (<div className="text-sm font-body"><p className="font-bold text-foreground mb-1">{t("customers.preferredArea")}</p><p className="text-muted-foreground">{selectedProfile.favorite_table_area}</p></div>)}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-md p-3 text-center">
                  <p className="font-display text-2xl font-bold text-foreground">{selectedProfile.visit_count || 0}</p>
                  <p className="text-xs text-muted-foreground font-body">{t("customers.visits")}</p>
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-center">
                  <p className="font-display text-2xl font-bold text-foreground">{selectedProfile.avg_spend ? `${selectedProfile.avg_spend}€` : "—"}</p>
                  <p className="text-xs text-muted-foreground font-body">{t("customers.avgSpend")}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-foreground font-body flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> {t("customers.internalNotes")}</p>
                  {!editingNotes && (<button onClick={() => setEditingNotes(true)} className="text-xs text-primary font-body font-bold hover:underline">{t("customers.edit")}</button>)}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={3}
                      className="w-full px-3 py-2 rounded-md bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder={t("customers.notesPlaceholder")} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="font-bold text-xs">{savingNotes ? t("customers.saving") : t("customers.save")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)} className="text-xs">{t("customers.cancelEdit")}</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-body bg-muted/50 p-3 rounded-md">{selectedProfile.internal_notes || t("customers.noNotes")}</p>
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-foreground font-body flex items-center gap-1.5 mb-2"><CalendarDays className="h-4 w-4" /> {t("customers.reservationHistory")}</p>
                {reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-body">{t("customers.noReservations")}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reservations.map((r) => {
                      const st = statusLabels[r.status] || statusLabels.pending;
                      return (
                        <div key={r.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 text-xs font-body">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-foreground">{r.reservation_date}</span>
                            <span className="text-muted-foreground">{r.reservation_time.substring(0, 5)}</span>
                            <span className="text-muted-foreground">{r.guests}p</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-sm font-bold ${st.cls}`}>{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;
