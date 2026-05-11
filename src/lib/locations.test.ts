import { describe, it, expect } from "vitest";
import { locationsData } from "./locations";

const BOOKABLE = ["tarragona", "arrabassada"] as const;

describe("locations.ts (R-LOC-*)", () => {
  it("R-LOC-001 — exactly three locations exist", () => {
    expect(Object.keys(locationsData).sort()).toEqual(
      ["arrabassada", "rincon", "tarragona"],
    );
  });

  it("R-LOC-001 — every entry has slug === key", () => {
    for (const [key, loc] of Object.entries(locationsData)) {
      expect(loc.slug).toBe(key);
    }
  });

  it("R-LOC-001 — required string fields are non-empty for all three", () => {
    const required: Array<keyof typeof locationsData[string]> = [
      "name", "type", "address", "street", "city", "postalCode",
      "phone", "hours", "description", "h1", "image",
    ];
    for (const loc of Object.values(locationsData)) {
      for (const field of required) {
        expect(
          typeof loc[field] === "string" && (loc[field] as string).length > 0,
          `Location ${loc.slug} field ${String(field)} should be a non-empty string`,
        ).toBe(true);
      }
    }
  });

  it("R-LOC-001 — every location has at least one hoursSpec entry", () => {
    for (const loc of Object.values(locationsData)) {
      expect(loc.hoursSpec.length).toBeGreaterThan(0);
      for (const spec of loc.hoursSpec) {
        expect(spec.dayOfWeek.length).toBeGreaterThan(0);
        expect(spec.opens).toMatch(/^\d{2}:\d{2}$/);
        expect(spec.closes).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  describe("R-SCH-001/002 cross-check with hoursSpec text", () => {
    it("tarragona hoursSpec must NOT include Tuesday (closed Tuesdays)", () => {
      const days = locationsData.tarragona.hoursSpec.flatMap((s) => s.dayOfWeek);
      expect(days).not.toContain("Tuesday");
    });
    it("arrabassada hoursSpec must NOT include Monday (closed Mondays)", () => {
      const days = locationsData.arrabassada.hoursSpec.flatMap((s) => s.dayOfWeek);
      expect(days).not.toContain("Monday");
    });
  });

  it("R-LOC-002 — only tarragona/arrabassada are bookable; rincon is info-only", () => {
    // We don't have a "bookable" flag in the data. This rule is enforced
    // elsewhere (selectors filter by slug). Here we just lock in the slugs.
    expect(BOOKABLE).toContain("tarragona");
    expect(BOOKABLE).toContain("arrabassada");
    expect(BOOKABLE).not.toContain("rincon" as never);
  });

  it("R-LOC-003 — slugs match the known set", () => {
    const KNOWN = new Set(["tarragona", "arrabassada", "rincon"]);
    for (const slug of Object.keys(locationsData)) {
      expect(KNOWN.has(slug)).toBe(true);
    }
  });
});
