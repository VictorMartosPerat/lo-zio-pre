import { describe, it, expect } from "vitest";
import es from "./locales/es.json";
import en from "./locales/en.json";
import ca from "./locales/ca.json";
import itLocale from "./locales/it.json";

type AnyObj = Record<string, unknown>;

/** Flattens a nested translation object to a list of dot-separated key paths. */
function flatKeys(obj: AnyObj, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatKeys(v as AnyObj, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe("i18n parity (R-I18N-001/003)", () => {
  const esKeys = flatKeys(es as AnyObj);
  const enKeys = flatKeys(en as AnyObj);
  const caKeys = flatKeys(ca as AnyObj);
  const itKeys = flatKeys(itLocale as AnyObj);

  const setOf = (xs: string[]) => new Set(xs);

  function diffMissingFromTarget(targetName: string, target: string[], baseline: string[]) {
    const targetSet = setOf(target);
    return baseline.filter((k) => !targetSet.has(k)).map((k) => `${targetName}: missing ${k}`);
  }

  it("en has every key present in es", () => {
    const missing = diffMissingFromTarget("en", enKeys, esKeys);
    expect(missing).toEqual([]);
  });

  it("ca has every key present in es", () => {
    const missing = diffMissingFromTarget("ca", caKeys, esKeys);
    expect(missing).toEqual([]);
  });

  it("it has every key present in es", () => {
    const missing = diffMissingFromTarget("it", itKeys, esKeys);
    expect(missing).toEqual([]);
  });

  // The reverse check: any extra key in en/ca/it that doesn't exist in es is
  // dead code (no source translations to copy from). Flag it.
  it("en has no extra keys not present in es", () => {
    const extra = diffMissingFromTarget("en (extra)", esKeys, enKeys);
    expect(extra).toEqual([]);
  });
  it("ca has no extra keys not present in es", () => {
    const extra = diffMissingFromTarget("ca (extra)", esKeys, caKeys);
    expect(extra).toEqual([]);
  });
  it("it has no extra keys not present in es", () => {
    const extra = diffMissingFromTarget("it (extra)", esKeys, itKeys);
    expect(extra).toEqual([]);
  });
});
