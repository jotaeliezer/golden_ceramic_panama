/**
 * Panama-only delivery address collected at checkout and stored on the order.
 * The country is always Panama. There is no country picker.
 */

export const PANAMA_PROVINCES = [
  "Bocas del Toro",
  "Chiriquí",
  "Coclé",
  "Colón",
  "Darién",
  "Herrera",
  "Los Santos",
  "Panamá",
  "Panamá Oeste",
  "Veraguas",
] as const;

/** Indigenous comarcas are first-level divisions, so a Panama delivery can name them. */
export const PANAMA_COMARCAS = [
  "Comarca Emberá-Wounaan",
  "Comarca Guna Yala",
  "Comarca Naso Tjër Di",
  "Comarca Ngäbe-Buglé",
] as const;

export const PANAMA_DELIVERY_REGIONS = [...PANAMA_PROVINCES, ...PANAMA_COMARCAS] as const;

const REGION_SET = new Set<string>(PANAMA_DELIVERY_REGIONS);

const NAME_MAX = 120;
const STREET_MAX = 200;
const CORREGIMIENTO_MAX = 120;
const CITY_MAX = 80;
const NOTES_MAX = 400;

export type DeliveryAddress = {
  name: string;
  street: string;
  corregimiento: string;
  city: string;
  province: string;
  notes: string | null;
  country: "Panama";
};

export type DeliveryField =
  | "name"
  | "street"
  | "corregimiento"
  | "city"
  | "province"
  | "notes"
  | "country";

export type DeliveryIssue = {
  field: DeliveryField;
  reason: "required" | "invalid" | "too_long";
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPanamaCountry(value: string): boolean {
  const folded = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return folded === "panama" || folded === "pa";
}

function checkLength(
  issues: DeliveryIssue[],
  field: DeliveryField,
  value: string,
  max: number,
  required: boolean,
): void {
  if (!value) {
    if (required) issues.push({ field, reason: "required" });
    return;
  }
  if (value.length > max) issues.push({ field, reason: "too_long" });
}

export function parseDeliveryAddress(
  input: unknown,
): { ok: true; address: DeliveryAddress } | { ok: false; issues: DeliveryIssue[] } {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const name = asText(body.name);
  const street = asText(body.street);
  const corregimiento = asText(body.corregimiento);
  const city = asText(body.city);
  const province = asText(body.province);
  const notes = asText(body.notes);
  const country = asText(body.country);
  const issues: DeliveryIssue[] = [];

  checkLength(issues, "name", name, NAME_MAX, true);
  checkLength(issues, "street", street, STREET_MAX, true);
  checkLength(issues, "corregimiento", corregimiento, CORREGIMIENTO_MAX, true);
  checkLength(issues, "city", city, CITY_MAX, true);

  if (!province) issues.push({ field: "province", reason: "required" });
  else if (!REGION_SET.has(province)) issues.push({ field: "province", reason: "invalid" });

  if (notes.length > NOTES_MAX) issues.push({ field: "notes", reason: "too_long" });

  if (country && !isPanamaCountry(country)) issues.push({ field: "country", reason: "invalid" });

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    address: {
      name,
      street,
      corregimiento,
      city,
      province,
      notes: notes || null,
      country: "Panama",
    },
  };
}

/** Readable copy kept in orders.shipping_address. The first line is the customer name. */
export function formatShippingAddress(address: DeliveryAddress): string {
  const lines = [
    address.name,
    address.street,
    address.corregimiento,
    `${address.city}, ${address.province}`,
    "Panama",
  ];
  if (address.notes) lines.push(address.notes);
  return lines.join("\n");
}

export function readStoredDeliveryAddress(value: unknown): DeliveryAddress | null {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const parsed = parseDeliveryAddress(candidate);
  return parsed.ok ? parsed.address : null;
}

export function deliveryErrorMessage(issue: DeliveryIssue): string {
  if (issue.field === "country") return "Delivery is only available within Panama.";
  if (issue.field === "province" && issue.reason !== "too_long") return "Choose a province of Panama.";
  if (issue.reason === "too_long") {
    const labels: Record<DeliveryField, string> = {
      name: "Full name",
      street: "Street, house, or building",
      corregimiento: "Corregimiento or district",
      city: "City",
      province: "Province",
      notes: "Delivery notes",
      country: "Country",
    };
    return `${labels[issue.field]} is too long.`;
  }
  const required: Record<DeliveryField, string> = {
    name: "Full name is required.",
    street: "Street, house, or building is required.",
    corregimiento: "Corregimiento or district is required.",
    city: "City is required.",
    province: "Choose a province of Panama.",
    notes: "Delivery notes are too long.",
    country: "Delivery is only available within Panama.",
  };
  return required[issue.field];
}
