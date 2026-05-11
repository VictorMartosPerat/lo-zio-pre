/**
 * Client-side validators used as defense-in-depth before rendering user-supplied
 * data in attributes that can carry URI schemes (href, src, etc.).
 *
 * The DB-level `reject_html_input` trigger is the source of truth; these are
 * UX guards that prevent obvious XSS vectors from being rendered to the DOM.
 */

/**
 * R-INP-003: phone numbers used in `tel:` hrefs must match this whitelist.
 * Only +, digits, spaces, dashes, parens, dots, max 20 chars. Anything outside
 * (letters, `javascript:`, `data:`, control chars, `<>`) is rejected.
 */
export const PHONE_TEL_HREF_REGEX = /^[+\d\s\-().]{1,20}$/;

export function isPhoneSafeForTelHref(phone: string | null | undefined): boolean {
  if (typeof phone !== "string") return false;
  return PHONE_TEL_HREF_REGEX.test(phone);
}

/**
 * Returns a safe `tel:` href value. If the phone is unsafe or empty, returns
 * `"#"` so the link is inert.
 */
export function telHref(phone: string | null | undefined): string {
  return isPhoneSafeForTelHref(phone) ? `tel:${phone}` : "#";
}
