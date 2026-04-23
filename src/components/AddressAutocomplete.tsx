import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";

interface AddressResult {
  address: string;
  city: string;
  postalCode: string;
  display: string;
}

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    state?: string;
    country_code?: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: { address: string; city: string; postalCode: string }) => void;
  placeholder?: string;
  error?: string;
}

function parseNominatim(r: NominatimResult): AddressResult | null {
  const a = r.address;
  const street = a.road || a.pedestrian || "";
  if (!street) return null;

  const address = [street, a.house_number].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.municipality || "";
  const postalCode = a.postcode || "";

  // Build a readable display: "Calle X 3, 43001, Tarragona"
  const display = [address, postalCode, city].filter(Boolean).join(", ");

  return { address, city, postalCode, display };
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, error }: Props) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        addressdetails: "1",
        limit: "6",
        countrycodes: "es",
        // Bias results towards Tarragona area
        viewbox: "-0.5,40.5,3.5,42.5",
        bounded: "0",
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { "Accept-Language": "es" } },
      );
      if (!res.ok) throw new Error("network");
      const data: NominatimResult[] = await res.json();

      const results = data
        .map(parseNominatim)
        .filter((r): r is AddressResult => r !== null);

      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIndex(-1);
    } catch {
      // silently ignore — user can still type manually
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 450);
  };

  const handleSelect = (result: AddressResult) => {
    onChange(result.address);
    onSelect({ address: result.address, city: result.city, postalCode: result.postalCode });
    setSuggestions([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={error ? "border-destructive pr-8" : "pr-8"}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              aria-selected={activeIndex === i}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
                activeIndex === i
                  ? "bg-menu-teal/10 text-foreground"
                  : "hover:bg-muted/60 text-foreground"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-menu-teal mt-0.5 shrink-0" />
              <span className="leading-snug">{s.display}</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-amber-600 border-t border-border bg-amber-50/60 dark:bg-amber-950/20 dark:text-amber-400 select-none">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {t("checkout.addressSuggestionHint")}
          </li>
        </ul>
      )}

      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  );
}
