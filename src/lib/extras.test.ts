import { describe, it, expect } from "vitest";
import { extraCategories, getExtraCategoryEmoji } from "./extras";
import { EU_ALLERGENS } from "./allergens";

describe("extras.ts (R-ITEM-* sanity)", () => {
  it("has stable category and item ids (no duplicates)", () => {
    const catIds = extraCategories.map((c) => c.id);
    expect(new Set(catIds).size).toBe(catIds.length);

    const itemIds = extraCategories.flatMap((c) => c.items.map((i) => i.id));
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });

  it("every extra item has a non-negative numeric price", () => {
    for (const c of extraCategories) {
      for (const i of c.items) {
        expect(typeof i.price).toBe("number");
        expect(Number.isFinite(i.price)).toBe(true);
        expect(i.price).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("every allergen referenced in extras matches an EU_ALLERGENS id", () => {
    const known = new Set<string>(EU_ALLERGENS.map((a) => a.id));
    const unknownReferences: string[] = [];
    for (const c of extraCategories) {
      for (const i of c.items) {
        for (const a of i.allergens) {
          if (!known.has(a)) unknownReferences.push(`${i.id} → ${a}`);
        }
      }
    }
    expect(unknownReferences).toEqual([]);
  });

  it("getExtraCategoryEmoji returns the configured emoji and falls back to '➕'", () => {
    expect(getExtraCategoryEmoji("embutidos")).toBe("🥩");
    expect(getExtraCategoryEmoji("nonexistent")).toBe("➕");
  });
});

describe("allergens.ts", () => {
  it("EU_ALLERGENS ids are unique", () => {
    const ids = EU_ALLERGENS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
