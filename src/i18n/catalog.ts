import type { Locale, MessageKey } from "./dictionary";
import { translate } from "./dictionary";

const CATEGORY_KEYS: Record<string, MessageKey> = {
  Columnas: "category.columnas",
  Pedestales: "category.pedestales",
  Macetas: "category.macetas",
  Jardín: "category.jardin",
  Fuentes: "category.fuentes",
  Ornamento: "category.ornamento",
  Baldosas: "category.baldosas",
  Jarrones: "category.jarrones",
  Coronas: "category.coronas",
  Techos: "category.techos",
};

export interface CatalogText {
  name: string;
  description?: string | null;
  name_en?: string | null;
  description_en?: string | null;
}

function englishOrSpanish(locale: Locale, spanish: string, english?: string | null): string {
  if (locale === "en") {
    const value = english?.trim();
    if (value) return value;
  }
  return spanish;
}

export function localizedName(locale: Locale, product: CatalogText): string {
  return englishOrSpanish(locale, product.name, product.name_en);
}

export function localizedDescription(locale: Locale, product: CatalogText): string {
  return englishOrSpanish(locale, product.description?.trim() ?? "", product.description_en);
}

/** Known workshop categories go through the dictionary. Anything else is shown as stored. */
export function localizedCategory(locale: Locale, category: string | null | undefined): string {
  if (!category) return "";
  const key = CATEGORY_KEYS[category];
  if (!key) return category;
  return translate(locale, key);
}

