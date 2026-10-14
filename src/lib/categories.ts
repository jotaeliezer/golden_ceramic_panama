import { Product } from "../types";

/** Spanish collation so accents sort with their base letter (Ángel with A, not after Z). */
export function compareSpanish(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

/** URL slug for a category name. Accents are stripped; spaces become hyphens. */
export function categorySlug(category: string): string {
  const slug = category
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "categoria";
}

export interface CategoryGroup {
  name: string;
  slug: string;
  count: number;
  imageUrl: string;
  /** Representative mold, so the cover alt follows the shop language. */
  cover: Pick<Product, "name" | "name_en">;
}

export function groupCategories(products: Product[]): CategoryGroup[] {
  const buckets = new Map<string, { name: string; products: Product[] }>();

  for (const product of products) {
    const name = product.category?.trim();
    if (!name) continue;
    const slug = categorySlug(name);
    const bucket = buckets.get(slug);
    if (bucket) {
      bucket.products.push(product);
    } else {
      buckets.set(slug, { name, products: [product] });
    }
  }

  const groups: CategoryGroup[] = [];
  for (const [slug, bucket] of buckets) {
    const sorted = [...bucket.products].sort((a, b) => compareSpanish(a.name, b.name));
    const representative = sorted[0];
    groups.push({
      name: bucket.name,
      slug,
      count: bucket.products.length,
      imageUrl: representative.imageUrl,
      cover: { name: representative.name, name_en: representative.name_en },
    });
  }

  groups.sort((a, b) => compareSpanish(a.name, b.name));
  return groups;
}

export function moldsInCategory(products: Product[], slugParam: string): Product[] {
  let requested = slugParam;
  try {
    requested = decodeURIComponent(slugParam);
  } catch {
    requested = slugParam;
  }
  const slug = categorySlug(requested);
  return products
    .filter((product) => categorySlug(product.category?.trim() ?? "") === slug)
    .sort((a, b) => compareSpanish(a.name, b.name));
}
