import { describe, it, expect } from "vitest";
import {
  PHONE_TEL_HREF_REGEX,
  isPhoneSafeForTelHref,
  telHref,
} from "./validators";

describe("validators (R-INP-003)", () => {
  describe("PHONE_TEL_HREF_REGEX / isPhoneSafeForTelHref", () => {
    const ACCEPTED = [
      "+34123456789",
      "+34 123 456 789",
      "+34-123-456-789",
      "(34) 123 456 789",
      "123456789",
      "123 456 789",
      "+34.123.456.789",
      "1",                  // single digit at min length 1
      "12345678901234567890", // exactly 20 chars
      "+",                  // technically allowed by the regex
      // Whitespace (\s) is allowed by the regex; newlines/tabs are not an XSS
      // vector inside a tel: URI. These accept-cases lock in the current
      // behavior so we notice if it ever changes.
      "+34\n123",
      "+34 \t 123",
    ];

    const REJECTED = [
      "",                            // too short (min length 1)
      "123456789012345678901",       // 21 chars, over the limit
      "abc",                          // letters
      "+34 abc",                      // letters mixed
      "javascript:alert(1)",          // JS URI scheme
      "data:text/html,<script>",      // data URI
      "tel:+34123456789",             // attempt to inject scheme
      "<script>",                     // HTML
      "+34 / 123",                    // slash not in whitelist
      "+34;ext=999",                  // semicolon not in whitelist
      null as unknown as string,
      undefined as unknown as string,
      123456 as unknown as string,    // non-string
    ];

    for (const ok of ACCEPTED) {
      it(`accepts ${JSON.stringify(ok)}`, () => {
        expect(isPhoneSafeForTelHref(ok)).toBe(true);
        expect(PHONE_TEL_HREF_REGEX.test(ok)).toBe(true);
      });
    }

    for (const bad of REJECTED) {
      it(`rejects ${JSON.stringify(bad)}`, () => {
        expect(isPhoneSafeForTelHref(bad)).toBe(false);
      });
    }
  });

  describe("telHref", () => {
    it("returns tel: for safe numbers", () => {
      expect(telHref("+34 687 605 647")).toBe("tel:+34 687 605 647");
    });
    it("returns '#' for unsafe numbers", () => {
      expect(telHref("javascript:alert(1)")).toBe("#");
      expect(telHref("")).toBe("#");
      expect(telHref(null)).toBe("#");
    });
  });
});
