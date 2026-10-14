import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Product } from "../types";
import { useCatalogText } from "../i18n/useCatalogText";
import { useLanguage } from "../i18n/LanguageContext";
import { groupCategories } from "../lib/categories";
import type { MessageKey } from "../i18n/dictionary";

function moldCount(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  count: number,
) {
  return count === 1 ? t("shop.countOne") : t("shop.countMany", { count });
}

export default function Shop() {
  const { t } = useLanguage();
  const catalog = useCatalogText();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold animate-pulse text-charcoal">
          {t("shop.loading")}
        </div>
      </div>
    );
  }

  const categories = groupCategories(products);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16 w-full">
      <header className="mb-10 md:mb-16 pb-8 border-b border-charcoal/10">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60">
          {t("shop.kicker")}
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl text-charcoal font-light mb-6">{t("shop.title")}</h1>
        <p className="text-charcoal-light leading-relaxed max-w-xl">{t("shop.body")}</p>
      </header>

      {categories.length === 0 ? (
        <p className="text-center font-serif text-2xl font-light text-charcoal-light py-16">{t("shop.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 md:gap-y-16">
          {categories.map((category, i) => (
            <motion.div
              key={category.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group"
            >
              <Link
                to={`/shop/${category.slug}`}
                className="flex flex-col h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                <div className="aspect-[4/5] bg-ivory-focus overflow-hidden mb-5">
                  <img
                    src={category.imageUrl}
                    alt={catalog.name(category.cover)}
                    className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="flex flex-col mt-auto">
                  <h2 className="font-serif text-2xl font-light text-charcoal">{catalog.category(category.name)}</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mt-2">
                    {moldCount(t, category.count)}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
