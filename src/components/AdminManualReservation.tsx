import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es, enUS, ca } from "date-fns/locale";
import { CalendarIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ONLINE_TABLE_NAMES } from "@/lib/availability";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const timeSlots = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"];
const dateFnsLocales: Record<string, typeof es> = { es, en: enUS, ca };

interface Props { onCreated: () => void; }

const AdminManualReservation = ({ onCreated }: Props) => {
  const { t, i18n } = useTranslation();
  const dfLocale = dateFnsLocales[i18n.language] || es;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ location: "arrabassada", guest_name: "", email: "", phone: "", guests: "2", time: "20:00", notes: "", source: "phone" });
  const [date, setDate] = useState<Date>(new Date());
  const [maxCapacity, setMaxCapacity] = useState(48);

  useEffect(() => {
    const fetchCapacity = async () => {
      const { data } = await supabase
        .from("tables")
        .select("name, capacity")
        .eq("location", form.location)
        .eq("is_active", true);
      if (data) {
        const online = data.filter((t) => ONLINE_TABLE_NAMES.includes(t.name));
        const total = online.reduce((sum, t) => sum + t.capacity, 0);
        if (total > 0) setMaxCapacity(total);
      }
    };
    fetchCapacity();
  }, [form.location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.guest_name.trim() || !form.phone.trim()) { toast.error(t("admin.namePhoneRequired")); return; }
    setSubmitting(true);

    const sourceNoteKey = form.source === "phone" ? "sourceNotePhone" : form.source === "walkin" ? "sourceNoteWalkin" : "sourceNoteOther";
    const sourceNote = `[${t(`admin.${sourceNoteKey}`)}]`;
    const fullNotes = form.notes ? `${sourceNote} ${form.notes}` : sourceNote;

    const { data, error } = await supabase.functions.invoke("auto-assign-reservation", {
      body: {
        location: form.location, guest_name: form.guest_name,
        phone: form.phone, reservation_date: format(date, "yyyy-MM-dd"),
        reservation_time: form.time + ":00", guests: form.guests, notes: fullNotes, user_id: null, is_admin: true,
      },
    });
    setSubmitting(false);
    if (error || !data?.success) {
      toast.error(data?.message || t("admin.manualError"));
      if (error) console.error(error);
      return;
    }

    toast.success(t("admin.manualCreated"));
    setForm({ location: "arrabassada", guest_name: "", email: "", phone: "", guests: "2", time: "20:00", notes: "", source: "phone" });
    setDate(new Date()); setOpen(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />{t("admin.manualReservation")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("admin.newManualRes")}</DialogTitle>
          <p className="text-muted-foreground font-body text-sm">{t("admin.manualResDesc")}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("admin.source")}</label>
            <select name="source" value={form.source} onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="phone">{t("admin.sourcePhone")}</option>
              <option value="walkin">{t("admin.sourceWalkin")}</option>
              <option value="other">{t("admin.sourceOther")}</option>
            </select>
          </div>
          <div>
            <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("admin.location")} *</label>
            <select name="location" value={form.location} onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="arrabassada">Lo Zio Arrabassada</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("reservation.date")} *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal font-body text-sm")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(date, "EEE d MMM", { locale: dfLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={dfLocale} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("admin.time")} *</label>
              <select name="time" value={form.time} onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {timeSlots.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-body text-sm font-bold text-foreground mb-1.5">
              {t("admin.guestsLabel")} * <span className="text-muted-foreground font-normal text-xs">(máx. {maxCapacity})</span>
            </label>
            <input
              type="number"
              name="guests"
              min={1}
              max={maxCapacity}
              value={form.guests}
              onChange={(e) => {
                const val = Math.max(1, Math.min(maxCapacity, parseInt(e.target.value) || 1));
                setForm((prev) => ({ ...prev, guests: String(val) }));
              }}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("admin.customerName")} *</label>
              <input type="text" name="guest_name" required value={form.guest_name} onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t("admin.customerNamePlaceholder")} />
            </div>
            <div>
              <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("reservation.phone")} *</label>
              <input type="tel" name="phone" required value={form.phone} onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t("admin.phonePlaceholder")} />
            </div>
          </div>
          <div>
            <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("admin.emailOptional")} <span className="text-muted-foreground font-normal">{t("admin.emailOptionalHint")}</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t("admin.emailPlaceholder")} />
          </div>
          <div>
            <label className="block font-body text-sm font-bold text-foreground mb-1.5">{t("admin.notesLabel")}</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder={t("admin.notesPlaceholder")} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full font-bold uppercase tracking-widest">
            {submitting ? t("admin.creating") : t("admin.createReservation")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminManualReservation;
