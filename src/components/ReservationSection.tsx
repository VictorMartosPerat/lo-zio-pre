import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es, enUS, ca } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, CalendarIcon, Clock, CheckCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUnavailableSlots, MAX_ONLINE_GUESTS, CALL_PHONE } from "@/lib/availability";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import location1 from "@/assets/location-1.jpg";

const COUNTRY_CODES = [
  { code: "+34", flag: "🇪🇸", name: "España" },
  { code: "+39", flag: "🇮🇹", name: "Italia" },
  { code: "+33", flag: "🇫🇷", name: "Francia" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+49", flag: "🇩🇪", name: "Alemania" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+31", flag: "🇳🇱", name: "Países Bajos" },
  { code: "+32", flag: "🇧🇪", name: "Bélgica" },
  { code: "+41", flag: "🇨🇭", name: "Suiza" },
  { code: "+1", flag: "🇺🇸", name: "USA" },
  { code: "+52", flag: "🇲🇽", name: "México" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+212", flag: "🇲🇦", name: "Marruecos" },
  { code: "+213", flag: "🇩🇿", name: "Argelia" },
  { code: "+216", flag: "🇹🇳", name: "Túnez" },
  { code: "+40", flag: "🇷🇴", name: "Rumanía" },
];

const COMING_SOON_LOCATIONS = ["tarragona"];

// Days the location is CLOSED (0=Sunday, 1=Monday, ..., 6=Saturday)
const CLOSED_DAYS: Record<string, number[]> = {
  tarragona: [2], // Closed Tuesday
  arrabassada: [1], // Closed Monday
};

const timeSlots = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

const guestOptions = Array.from({ length: 15 }, (_, i) => i + 1);

const dateFnsLocales: Record<string, typeof es> = { es, en: enUS, ca };

const ReservationSection = () => {
  const { t, i18n } = useTranslation();
  const dfLocale = dateFnsLocales[i18n.language] || es;
  const [highlight, setHighlight] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();

  const locations = [
    {
      id: "tarragona",
      name: "Lo Zio Tarragona",
      address: "Carrer Reding 32, Tarragona",
      phone: "+34 687 60 56 47",
      hours: t("reservation.locationTarragona.hours"),
      image: location1,
      alt: "Interior acogedor del restaurante Lo Zio Tarragona",
      timeSlots,
    },
    {
      id: "arrabassada",
      name: "Lo Zio Arrabassada",
      address: "Carrer Joan Fuster 28, Tarragona",
      phone: "+34 682 23 90 35",
      hours: t("reservation.locationArrabassada.hours"),
      image: "https://lnrnyahzkqqnvlpzrdlv.supabase.co/storage/v1/object/public/media/videos/LOCAL_ARRABASSADA.jpg",
      alt: "Terraza del restaurante Lo Zio Arrabassada",
      timeSlots,
    },
  ];

  const defaultLocation =
    COMING_SOON_LOCATIONS.includes(locations[0].id) && !isAdmin ? locations[1]?.id || locations[0].id : locations[0].id;

  const [selectedLocation, setSelectedLocation] = useState(defaultLocation);
  const [guests, setGuests] = useState("2");
  const [date, setDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "details" | "success">("select");
  const [formData, setFormData] = useState({ name: "", phone: "", notes: "" });
  const [phonePrefix, setPhonePrefix] = useState("+34");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [reservationsEnabled, setReservationsEnabled] = useState(true);
  const [loadingEnabled, setLoadingEnabled] = useState(true);

  useEffect(() => {
    const fetchEnabled = async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "reservations_enabled").single();
      if (data) setReservationsEnabled(data.value === true);
      setLoadingEnabled(false);
    };
    fetchEnabled();

    const channel = supabase
      .channel("site_settings_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_settings",
          filter: "key=eq.reservations_enabled",
        },
        (payload) => {
          const newVal = (payload.new as { value: boolean })?.value;
          if (typeof newVal === "boolean") setReservationsEnabled(newVal);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loc = locations.find((l) => l.id === selectedLocation)!;
  const guestsNum = parseInt(guests) || 2;

  // If selected date falls on a closed day for the location, advance to next open day
  useEffect(() => {
    const closedDays = CLOSED_DAYS[selectedLocation] || [];
    if (closedDays.length > 0 && closedDays.includes(date.getDay())) {
      const newDate = new Date(date);
      for (let i = 0; i < 7; i++) {
        newDate.setDate(newDate.getDate() + 1);
        if (!closedDays.includes(newDate.getDay())) break;
      }
      setDate(newDate);
    }
  }, [selectedLocation]);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (guests === "15+" || guestsNum > MAX_ONLINE_GUESTS) {
        setUnavailableSlots(new Set());
        return;
      }
      setLoadingSlots(true);
      const dateStr = format(date, "yyyy-MM-dd");
      // Use the same RPC the backend uses to create reservations,
      // so the UI shows EXACTLY the same availability as the booking attempt.
      const results = await Promise.all(
        loc.timeSlots.map(async (slot) => {
          const { data, error } = await supabase.rpc("find_available_tables_multi", {
            _location: selectedLocation,
            _date: dateStr,
            _time: `${slot}:00`,
            _guests: guestsNum,
          });
          if (error) {
            console.error("Availability RPC error for", slot, error);
            return { slot, available: true };
          }
          return { slot, available: Array.isArray(data) && data.length > 0 };
        }),
      );
      const unavailable = new Set<string>();
      for (const r of results) if (!r.available) unavailable.add(r.slot);
      setUnavailableSlots(unavailable);
      setLoadingSlots(false);
    };
    fetchAvailability();
  }, [selectedLocation, date, guests, loc.timeSlots, guestsNum]);

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("details");
  };

  const handleBack = () => {
    setStep("select");
    setSelectedTime(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validatePhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) return false;
    return /^\d{6,15}$/.test(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePhone(formData.phone)) {
      setPhoneError(t("reservation.phoneError", "Introduce un número de teléfono válido"));
      return;
    }
    setPhoneError("");
    setSubmitting(true);

    const fullPhone = `${phonePrefix} ${formData.phone}`;

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id || null;

      const { data, error } = await supabase.functions.invoke("auto-assign-reservation", {
        body: {
          location: selectedLocation,
          guest_name: formData.name,
          phone: fullPhone,
          reservation_date: format(date, "yyyy-MM-dd"),
          reservation_time: selectedTime,
          guests,
          notes: formData.notes || null,
          user_id: userId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const dateParts = format(date, "yyyy-MM-dd").split("-");
        const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        const formattedTime = selectedTime ? selectedTime.substring(0, 5) : "";
        setConfirmationMsg(
          user
            ? `¡Reserva confirmada! Te esperamos el ${formattedDate} a las ${formattedTime}. Recuerda que para hacer modificaciones, o anularla debes ir a Mis reservas o contactar con el restaurante via teléfono.`
            : `¡Reserva confirmada! Te esperamos el ${formattedDate} a las ${formattedTime}. Recuerda que como no tienes cuenta para hacer modificaciones, o anularla debes contactar con el restaurante via teléfono.`,
        );
        setStep("success");
        toast.success("¡Reserva confirmada!");
      } else if (data?.error === "no_tables") {
        toast.error(data.message);
      } else {
        toast.error(data?.message || t("reservation.error"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("reservation.error"));
    }

    setSubmitting(false);
  };

  const handleNewReservation = () => {
    setFormData({ name: "", phone: "", notes: "" });
    setSelectedTime(null);
    setStep("select");
    setConfirmationMsg("");
  };

  return (
    <section id="reservar" className="py-16 md:py-24 px-4 bg-background pb-24 md:pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-primary font-body uppercase tracking-[0.25em] text-sm mb-3">
            {t("reservation.sectionTitle")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">{t("reservation.title")}</h2>
          <p className="text-muted-foreground font-body text-lg max-w-xl mx-auto">{t("reservation.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {locations.map((l) => {
            const isComingSoon = COMING_SOON_LOCATIONS.includes(l.id) && !isAdmin;
            return (
              <button
                key={l.id}
                onClick={() => {
                  if (isComingSoon) return;
                  setSelectedLocation(l.id);
                  setSelectedTime(null);
                  setStep("select");
                  setTimeout(() => {
                    const el = document.getElementById("reservation-form");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    setHighlight(true);
                    setTimeout(() => setHighlight(false), 1500);
                  }, 100);
                }}
                disabled={isComingSoon}
                className={`group relative overflow-hidden rounded-lg transition-all duration-300 ${
                  isComingSoon
                    ? "opacity-80 cursor-default ring-1 ring-border"
                    : selectedLocation === l.id
                      ? "ring-4 ring-primary shadow-xl scale-[1.02]"
                      : "ring-1 ring-border hover:ring-primary/50"
                }`}
              >
                <img
                  src={l.image}
                  alt={l.alt}
                  className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="hero-overlay absolute inset-0" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                  <h3 className="font-display text-2xl font-bold text-primary-foreground mb-1">{l.name}</h3>
                  <p className="text-primary-foreground/80 font-body text-sm">{l.address}</p>
                  <p className="text-primary-foreground/70 font-body text-sm">{l.hours}</p>
                  {isComingSoon && (
                    <div className="mt-3 space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-muted-foreground/40 bg-muted/60 text-muted-foreground font-body text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
                        <Clock className="w-3.5 h-3.5" />
                        Próximamente
                      </span>
                      <p className="text-primary-foreground/50 font-body text-xs italic">
                        Las reservas online estarán disponibles muy pronto
                      </p>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!reservationsEnabled && !isAdmin ? (
          <div className="max-w-xl mx-auto bg-card rounded-xl shadow-lg border border-dashed border-muted-foreground/30 overflow-hidden text-center py-16 px-6">
            <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted text-muted-foreground font-body text-sm font-semibold uppercase tracking-wider mb-3">
              🔒 {t("reservation.temporarilyClosed", "Temporalment tancat")}
            </span>
            <p className="text-muted-foreground font-body text-sm mt-3">
              {t(
                "reservation.temporarilyClosedMessage",
                "Les reserves online estan temporalment tancades. Si us plau, torna-ho a provar més tard o truca'ns per telèfon.",
              )}
            </p>
          </div>
        ) : COMING_SOON_LOCATIONS.includes(selectedLocation) && !isAdmin ? (
          <div className="max-w-xl mx-auto bg-card rounded-xl shadow-lg border border-dashed border-muted-foreground/30 overflow-hidden text-center py-16 px-6">
            <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">{loc.name}</h3>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted text-muted-foreground font-body text-sm font-semibold uppercase tracking-wider mb-3">
              🕐 Próximamente
            </span>
            <p className="text-muted-foreground font-body text-sm mt-3">
              Las reservas online estarán disponibles muy pronto
            </p>
          </div>
        ) : (
          <div
            id="reservation-form"
            className={`max-w-xl mx-auto bg-card rounded-xl shadow-lg border overflow-hidden scroll-mt-20 transition-all duration-700 ${highlight ? "border-primary ring-2 ring-primary/40 shadow-primary/20 shadow-xl" : "border-border"}`}
            style={{ scrollMarginBottom: "64px" }}
          >
            <div className="text-center pt-8 pb-2 px-6">
              <h3 className="font-display text-2xl font-bold text-foreground">{loc.name}</h3>
              <p className="text-muted-foreground font-body text-sm mt-1">{t("reservation.pizzeria")}</p>
            </div>

            {step === "success" ? (
              <div className="px-6 pb-8 pt-6 text-center">
                <CheckCircle className="w-16 h-16 text-secondary mx-auto mb-4" />
                <p className="font-display text-xl font-bold text-foreground mb-3">{confirmationMsg}</p>
                <Button onClick={handleNewReservation} variant="outline" className="font-body font-bold">
                  {t("reservation.newReservation", "Hacer otra reserva")}
                </Button>
              </div>
            ) : step === "select" ? (
              <div className="px-6 pb-8">
                <div className="grid grid-cols-2 gap-3 py-6">
                  <div>
                    <label className="block font-body text-xs text-muted-foreground mb-1.5">
                      {t("reservation.guests")}
                    </label>
                    <select
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {guestOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                      <option value="15+">+15</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-body text-xs text-muted-foreground mb-1.5">
                      {t("reservation.date")}
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal font-body text-sm",
                            !date && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(date, "EEE d MMM", { locale: dfLocale })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={(d) => d && setDate(d)}
                          disabled={(d) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const maxDate = new Date(today);
                            maxDate.setDate(today.getDate() + 30);
                            const closedDays = CLOSED_DAYS[selectedLocation] || [];
                            return d < today || d > maxDate || closedDays.includes(d.getDay());
                          }}
                          locale={dfLocale}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30 mb-4">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200 font-body text-sm">
                    {t("reservation.durationWarning")} <strong>{t("reservation.durationTime")}</strong> {t("reservation.durationWarningPost")}
                  </AlertDescription>
                </Alert>

                <div className="border-t border-border my-2" />

                <div className="py-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-body text-sm text-muted-foreground">{t("reservation.selectTime")}</p>
                    {loadingSlots && (
                      <span className="font-body text-xs text-muted-foreground animate-pulse">
                        {t("reservation.checkingAvailability")}
                      </span>
                    )}
                  </div>
                  {guests === "15+" || guestsNum > MAX_ONLINE_GUESTS ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="font-body text-sm text-muted-foreground">
                        {t(
                          "reservation.largeGroupMessage",
                          "Para grupos de más de {{max}} personas, por favor llámanos directamente.",
                          { max: MAX_ONLINE_GUESTS },
                        )}
                      </p>
                      <a
                        href={`tel:${CALL_PHONE}`}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-body font-bold text-sm hover:opacity-90 transition-opacity"
                      >
                        📞 {CALL_PHONE}
                      </a>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => {
                        const isUnavailable = unavailableSlots.has(slot);
                        return (
                          <button
                            key={slot}
                            onClick={() => handleTimeSelect(slot)}
                            disabled={isUnavailable}
                            className={`py-3.5 px-3 rounded-lg font-body text-sm font-medium transition-all duration-200 min-h-[44px] ${
                              isUnavailable
                                ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed line-through"
                                : "bg-muted text-foreground hover:bg-primary/10 hover:text-primary hover:ring-2 hover:ring-primary/30"
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 pb-8">
                <div className="flex items-center gap-3 py-6 border-b border-border mb-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <div className="font-body text-sm text-foreground">
                    <span className="font-bold">{selectedTime}</span>
                    <span className="text-muted-foreground mx-1.5">·</span>
                    <span>{format(date, "EEE d MMM", { locale: dfLocale })}</span>
                    <span className="text-muted-foreground mx-1.5">·</span>
                    <span>
                      {guests} {parseInt(guests) === 1 ? t("reservation.person") : t("reservation.persons")}
                    </span>
                  </div>
                </div>

                {!user && (
                  <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/30 mb-4">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200 font-body text-sm flex items-center justify-between gap-2 flex-wrap">
                      <span>
                        {t("reservation.loginWarning", "Si quieres poder modificar tu reserva, inicia sesión.")}
                      </span>
                      <a
                        href="/auth"
                        className="inline-block px-3 py-1 rounded bg-primary text-primary-foreground font-body text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        {t("nav.login")}
                      </a>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 landscape-form-grid">
                  <div>
                    <label className="block font-body text-sm font-bold text-foreground mb-1.5">
                      {t("reservation.name")} *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t("reservation.name")}
                    />
                  </div>
                  <div>
                    <label className="block font-body text-sm font-bold text-foreground mb-1.5">
                      {t("reservation.phone")} *
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={phonePrefix}
                        onChange={(e) => setPhonePrefix(e.target.value)}
                        className="w-[110px] px-2 py-3 rounded-lg bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={(e) => {
                          handleChange(e);
                          if (phoneError) setPhoneError("");
                        }}
                        className={cn(
                          "flex-1 px-4 py-3 min-h-[44px] rounded-lg bg-background border font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
                          phoneError ? "border-destructive" : "border-input",
                        )}
                        placeholder="600 000 000"
                      />
                    </div>
                    {phoneError && <p className="text-destructive font-body text-xs mt-1">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="block font-body text-sm font-bold text-foreground mb-1.5">
                      {t("reservation.notes")}
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-4 py-3 rounded-lg bg-background border border-input font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder={t("reservation.notesPlaceholder")}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-6 bg-primary text-primary-foreground py-4 min-h-[48px] rounded-lg font-body font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? t("reservation.submitting") : t("reservation.submit")}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ReservationSection;
