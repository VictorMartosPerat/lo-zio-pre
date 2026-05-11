import { describe, it, expect } from "vitest";
import {
  isStoreOpen,
  openStores,
  getScheduleStatus,
  getAvailableDays,
  getTimeSlots,
} from "./storeHours";

// Helper: build a Date with explicit Y/M/D/h/m. Month is 0-indexed.
const D = (
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
) => new Date(year, month - 1, day, hours, minutes, 0, 0);

// Reference Mondays/Tuesdays/etc — all in May 2026:
//   2026-05-10 Sun, 2026-05-11 Mon, 2026-05-12 Tue, 2026-05-13 Wed, …
//   2026-05-17 Sun, 2026-05-18 Mon, 2026-05-19 Tue, …
const MON_2000 = D(2026, 5, 11, 20, 0);
const MON_1800 = D(2026, 5, 11, 18, 0);
const MON_1000 = D(2026, 5, 11, 10, 0);
const MON_2330 = D(2026, 5, 11, 23, 30);
const TUE_2000 = D(2026, 5, 12, 20, 0);
const TUE_1000 = D(2026, 5, 12, 10, 0);
const WED_2000 = D(2026, 5, 13, 20, 0);
const SUN_2330 = D(2026, 5, 10, 23, 30);

describe("storeHours", () => {
  describe("R-SCH-001 — Tarragona open Wed-Mon, closed Tuesday", () => {
    it("is open Monday 20:00", () => {
      expect(isStoreOpen("tarragona", MON_2000)).toBe(true);
    });
    it("is open Wednesday 20:00", () => {
      expect(isStoreOpen("tarragona", WED_2000)).toBe(true);
    });
    it("is CLOSED Tuesday 20:00 (closed day)", () => {
      expect(isStoreOpen("tarragona", TUE_2000)).toBe(false);
    });
    it("is closed before 19:00 (Monday 18:00)", () => {
      expect(isStoreOpen("tarragona", MON_1800)).toBe(false);
    });
    it("is closed at exact close 23:30", () => {
      expect(isStoreOpen("tarragona", MON_2330)).toBe(false);
    });
    it("is open at 19:00 exactly (lower edge inclusive)", () => {
      expect(isStoreOpen("tarragona", D(2026, 5, 11, 19, 0))).toBe(true);
    });
    it("is open at 23:29 (one minute before close)", () => {
      expect(isStoreOpen("tarragona", D(2026, 5, 11, 23, 29))).toBe(true);
    });
  });

  describe("R-SCH-002 — Arrabassada open Tue-Sun, closed Monday", () => {
    it("is CLOSED Monday 20:00 (closed day)", () => {
      expect(isStoreOpen("arrabassada", MON_2000)).toBe(false);
    });
    it("is open Tuesday 20:00", () => {
      expect(isStoreOpen("arrabassada", TUE_2000)).toBe(true);
    });
    it("is open Sunday at 22:00", () => {
      expect(isStoreOpen("arrabassada", D(2026, 5, 10, 22, 0))).toBe(true);
    });
  });

  describe("openStores", () => {
    it("returns only tarragona on a Monday evening (Arrabassada closed)", () => {
      expect(openStores(MON_2000)).toEqual(["tarragona"]);
    });
    it("returns only arrabassada on a Tuesday evening (Tarragona closed)", () => {
      expect(openStores(TUE_2000)).toEqual(["arrabassada"]);
    });
    it("returns both Wed-Sun evenings", () => {
      expect(openStores(WED_2000)).toEqual(["tarragona", "arrabassada"]);
    });
    it("returns none outside hours, even on a regular day", () => {
      expect(openStores(D(2026, 5, 13, 10, 0))).toEqual([]);
    });
    it("never includes rincon (R-LOC-002)", () => {
      // Sweep every hour of a full week and ensure rincon is never returned.
      for (let day = 10; day <= 16; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const stores = openStores(D(2026, 5, day, hour, 0));
          expect(stores).not.toContain("rincon");
        }
      }
    });
  });

  describe("R-SCH-005 — getScheduleStatus", () => {
    it("returns open when at least one store is open", () => {
      expect(getScheduleStatus(MON_2000).type).toBe("open"); // Tarragona open
      expect(getScheduleStatus(TUE_2000).type).toBe("open"); // Arrabassada open
    });

    it("returns before_hours on Monday morning, opensAt today 19:00", () => {
      const r = getScheduleStatus(MON_1000);
      expect(r.type).toBe("before_hours");
      if (r.type === "before_hours") {
        expect(r.opensAt.getHours()).toBe(19);
        expect(r.opensAt.getMinutes()).toBe(0);
        // Same day
        expect(r.opensAt.getDate()).toBe(MON_1000.getDate());
      }
    });

    it("returns before_hours on Tuesday morning (Arrabassada will open today at 19:00)", () => {
      const r = getScheduleStatus(TUE_1000);
      expect(r.type).toBe("before_hours");
      if (r.type === "before_hours") {
        expect(r.opensAt.getDate()).toBe(TUE_1000.getDate());
      }
    });

    it("returns after_hours on Monday 23:30, opens Tuesday 19:00", () => {
      const r = getScheduleStatus(MON_2330);
      expect(r.type).toBe("after_hours");
      if (r.type === "after_hours") {
        expect(r.opensAt.getDate()).toBe(12); // Tuesday
        expect(r.opensAt.getHours()).toBe(19);
      }
    });

    it("returns after_hours on Sunday 23:30, opens Monday 19:00", () => {
      // Sunday 23:30 — both stores past closing. Next opening: Monday 19:00 (Tarragona).
      const r = getScheduleStatus(SUN_2330);
      expect(r.type).toBe("after_hours");
      if (r.type === "after_hours") {
        // Monday
        expect(r.opensAt.getDay()).toBe(1);
        expect(r.opensAt.getHours()).toBe(19);
      }
    });
  });

  describe("R-SCH-006 — getAvailableDays", () => {
    it("returns 7 future days from a Wednesday baseline (both stores open most days)", () => {
      // Wed-Sun: both open. Mon: only Tarragona. Tue: only Arrabassada.
      // Without a store filter, every day in the week has at least one open store
      // → 7 days returned.
      const days = getAvailableDays(undefined, D(2026, 5, 13, 12, 0));
      expect(days.length).toBe(7);
    });

    it("skips Tuesday when filtering by tarragona", () => {
      // Starting from Monday — Tarragona is open Mon, closed Tue, open Wed-Sun.
      // Across 14 days the function should return 6 of every 7 days (skipping Tuesdays).
      const days = getAvailableDays("tarragona", D(2026, 5, 11, 12, 0));
      // No Tuesday in the result
      for (const d of days) {
        expect(d.getDay()).not.toBe(2);
      }
    });

    it("skips Monday when filtering by arrabassada", () => {
      const days = getAvailableDays("arrabassada", D(2026, 5, 11, 12, 0));
      for (const d of days) {
        expect(d.getDay()).not.toBe(1);
      }
    });
  });

  describe("R-SCH-007 — getTimeSlots", () => {
    it("returns 19:00 → 23:00 in 30-min increments (9 slots) for a Wednesday", () => {
      // Future day, so no buffer applied.
      const slots = getTimeSlots(D(2026, 5, 13), undefined, D(2026, 5, 10));
      expect(slots).toEqual([
        "19:00", "19:30", "20:00", "20:30",
        "21:00", "21:30", "22:00", "22:30",
        "23:00",
      ]);
    });

    it("never includes 23:30 (last slot is 23:00)", () => {
      const slots = getTimeSlots(D(2026, 5, 13), undefined, D(2026, 5, 10));
      expect(slots).not.toContain("23:30");
    });

    it("returns empty list when filtering by tarragona on a Tuesday (closed)", () => {
      const slots = getTimeSlots(D(2026, 5, 12), "tarragona", D(2026, 5, 10));
      expect(slots).toEqual([]);
    });

    it("returns empty list when filtering by arrabassada on a Monday (closed)", () => {
      const slots = getTimeSlots(D(2026, 5, 11), "arrabassada", D(2026, 5, 10));
      expect(slots).toEqual([]);
    });

    it("R-SCH-008 — for today, skips slots earlier than now+15 min", () => {
      // now = Wed 19:10 → buffer = 19:25. Slot 19:00 ≤ 19:25 excluded; 19:30 included.
      const now = D(2026, 5, 13, 19, 10);
      const slots = getTimeSlots(D(2026, 5, 13), undefined, now);
      expect(slots).not.toContain("19:00");
      expect(slots[0]).toBe("19:30");
    });

    it("R-SCH-008 — buffer NOT applied to future days", () => {
      // now = Wed 19:10, request slots for Thursday → all 9 slots return.
      const now = D(2026, 5, 13, 19, 10);
      const slots = getTimeSlots(D(2026, 5, 14), undefined, now);
      expect(slots.length).toBe(9);
      expect(slots[0]).toBe("19:00");
    });
  });
});
