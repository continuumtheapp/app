/**
 * Prices are in the local currency, the way posts in the group quote them:
 * £ in London, $ in New York. A place's currency follows its country, and a
 * search's follows the city searched. Client-safe.
 */

const EURO = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PT", "SK", "SI", "ES", "AD", "MC", "SM", "VA", "ME", "XK",
];

const BY_COUNTRY: Record<string, string> = {
  GB: "GBP", US: "USD", CH: "CHF", LI: "CHF", DK: "DKK", SE: "SEK", NO: "NOK",
  IS: "ISK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", RS: "RSD",
  AL: "ALL", MK: "MKD", BA: "BAM", TR: "TRY", UA: "UAH", GE: "GEL", AM: "AMD",
  IL: "ILS", AE: "AED", MA: "MAD", EG: "EGP", ZA: "ZAR", KE: "KES",
  CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  UY: "UYU", CR: "CRC", AU: "AUD", NZ: "NZD", JP: "JPY", KR: "KRW", CN: "CNY",
  HK: "HKD", TW: "TWD", SG: "SGD", TH: "THB", VN: "VND", ID: "IDR", MY: "MYR",
  PH: "PHP", IN: "INR", LK: "LKR",
};

/** ISO 4217 code for a country (ISO 3166-1 alpha-2). Euros if we don't know it. */
export function currencyFor(country: string | null | undefined): string {
  const c = (country ?? "").toUpperCase();
  if (EURO.includes(c)) return "EUR";
  return BY_COUNTRY[c] ?? "EUR";
}

const formatters = new Map<string, Intl.NumberFormat>();

/** "€40", "£40", "$40", "CHF 40": whole units, the local symbol. */
export function formatMoney(cents: number, currency: string): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0,
    });
    formatters.set(currency, f);
  }
  return f.format(cents / 100);
}

/** Just the symbol, for labels and input suffixes: "€", "£", "CHF". */
export function currencySymbol(currency: string): string {
  return formatMoney(0, currency).replace(/[\d\s.,]/g, "") || currency;
}
