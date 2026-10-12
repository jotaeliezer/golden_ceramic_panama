import {
  localizedCategory,
  localizedDescription,
  localizedName,
  type CatalogText,
} from "./catalog";
import { useLanguage } from "./LanguageContext";

export function useCatalogText() {
  const { locale } = useLanguage();
  return {
    name: (product: CatalogText) => localizedName(locale, product),
    description: (product: CatalogText) => localizedDescription(locale, product),
    category: (category: string | null | undefined) => localizedCategory(locale, category),
  };
}
