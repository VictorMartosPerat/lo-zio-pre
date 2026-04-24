/**
 * Store hours and availability utilities.
 *
 * Lo Zio Tarragona:   19:00–23:30, closed Tuesdays  (getDay() === 2)
 * Lo Zio Arrabassada: 19:00–23:30, closed Mondays   (getDay() === 1)
 */

const OPEN_HOUR = 19;
const OPEN_MINUTE = 0;
const CLOSE_HOUR = 23;
const CLOSE_MINUTE = 30;

// Day of week (0=Sun,1=Mon,2=Tue,...) when each store is closed
const CLOSED_DAY: Record<string, number> = {
  tarragona:   2, // Tuesday
  arrabassada: 1, // Monday
};

/** Returns true if the store is open on the given Date */
export function isStoreOpen(store: string, at: Date = new Date()): boolean {
  const day = at.getDay();
  if (day === CLOSED_DAY[store]) return false;

  const totalMinutes = at.getHours() * 60 + at.getMinutes();
  const openMinutes  = OPEN_HOUR  * 60 + OPEN_MINUTE;
  const closeMinutes = CLOSE_HOUR * 60 + CLOSE_MINUTE;

  return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
}

/** Returns the open stores at a given time */
export function openStores(at: Date = new Date()): Array<"tarragona" | "arrabassada"> {
  return (["tarragona", "arrabassada"] as const).filter((s) => isStoreOpen(s, at));
}

export type ScheduleStatus =
  | { type: "open" }
  | { type: "before_hours"; opensAt: Date }        // today, not open yet
  | { type: "after_hours";  opensAt: Date };        // next valid day at 19:00

/**
 * Returns whether the restaurant network is currently open (at least one store),
 * or when the next opening time is.
 */
export function getScheduleStatus(at: Date = new Date()): ScheduleStatus {
  // At least one store open right now?
  if (openStores(at).length > 0) return { type: "open" };

  const totalMinutes = at.getHours() * 60 + at.getMinutes();
  const openMinutes  = OPEN_HOUR * 60 + OPEN_MINUTE;

  if (totalMinutes < openMinutes) {
    // Before opening today — schedule for 19:00 today
    const opensAt = new Date(at);
    opensAt.setHours(OPEN_HOUR, OPEN_MINUTE, 0, 0);
    return { type: "before_hours", opensAt };
  }

  // After closing — find next day when at least one store is open at 19:00
  const opensAt = new Date(at);
  opensAt.setDate(opensAt.getDate() + 1);
  opensAt.setHours(OPEN_HOUR, OPEN_MINUTE, 0, 0);

  // Skip days where BOTH stores are closed (currently impossible since they
  // each only close on different days, but defensive loop just in case)
  for (let i = 0; i < 7; i++) {
    if (openStores(opensAt).length > 0) break;
    opensAt.setDate(opensAt.getDate() + 1);
  }

  return { type: "after_hours", opensAt };
}

/** Format a Date as "lunes 21 de abril a las 19:00" */
export function formatScheduleDate(d: Date): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} a las ${hh}:${mm}`;
}

/** Format time as "HH:MM" */
export function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format date as localized "Today" / "Tomorrow" / "mon 13 apr" */
export function formatDayLabel(d: Date, now: Date = new Date(), lang: string = "es"): string {
  const labels: Record<string, { today: string; tomorrow: string; days: string[]; months: string[] }> = {
    es: { today: "Hoy", tomorrow: "Mañana",
      days: ["dom","lun","mar","mié","jue","vie","sáb"],
      months: ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"] },
    en: { today: "Today", tomorrow: "Tomorrow",
      days: ["sun","mon","tue","wed","thu","fri","sat"],
      months: ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] },
    ca: { today: "Avui", tomorrow: "Demà",
      days: ["dg","dl","dt","dc","dj","dv","ds"],
      months: ["gen","feb","març","abr","maig","juny","jul","ag","set","oct","nov","des"] },
    it: { today: "Oggi", tomorrow: "Domani",
      days: ["dom","lun","mar","mer","gio","ven","sab"],
      months: ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"] },
  };
  const code = (lang || "es").slice(0, 2).toLowerCase();
  const L = labels[code] ?? labels.es;
  const todayStr    = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const tomorrowStr = (() => { const t = new Date(now); t.setDate(t.getDate()+1); return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`; })();
  const dStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (dStr === todayStr)    return L.today;
  if (dStr === tomorrowStr) return L.tomorrow;
  return `${L.days[d.getDay()]} ${d.getDate()} ${L.months[d.getMonth()]}`;
}

/**
 * Returns the next 7 dates (starting today) where at least one store
 * matching the filter is open. Pass `store` for pickup, omit for delivery.
 */
export function getAvailableDays(store?: string, from: Date = new Date()): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14 && days.length < 7; i++) {
    // Check if at least one candidate store opens that day at 19:00
    const testAt = new Date(cursor);
    testAt.setHours(OPEN_HOUR, OPEN_MINUTE, 0, 0);

    const candidates = store ? [store] : ["tarragona", "arrabassada"];
    const anyOpen = candidates.some((s) => isStoreOpen(s, testAt));
    if (anyOpen) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * Returns 30-min time slots (HH:MM strings) for a given day.
 * Slots run 19:00–23:00 (last slot, 30 min before closing).
 * For today, skips slots in the past + adds 15 min buffer.
 */
export function getTimeSlots(day: Date, store?: string, now: Date = new Date()): string[] {
  const slots: string[] = [];
  const isToday =
    day.getFullYear() === now.getFullYear() &&
    day.getMonth()    === now.getMonth() &&
    day.getDate()     === now.getDate();

  const bufferMinutes = isToday ? now.getHours() * 60 + now.getMinutes() + 15 : 0;

  for (let h = OPEN_HOUR; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue; // last slot is 23:00
      const totalMin = h * 60 + m;
      if (isToday && totalMin <= bufferMinutes) continue;

      // Check the store is open at this slot
      const testAt = new Date(day);
      testAt.setHours(h, m, 0, 0);
      const candidates = store ? [store] : ["tarragona", "arrabassada"];
      if (!candidates.some((s) => isStoreOpen(s, testAt))) continue;

      slots.push(formatTime(h, m));
    }
  }
  return slots;
}
