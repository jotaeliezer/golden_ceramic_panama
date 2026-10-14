import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Product } from "../types";
import { useCatalogText } from "../i18n/useCatalogText";
import { useLanguage } from "../i18n/LanguageContext";
import { moldsInCategory } from "../lib/categories";
import type { MessageKey } from "../i18n/dictionary";

function moldCount(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  count: number,
) {
  return count === 1 ? t("shop.countOne") : t("shop.countMany", { count });
}

export default function ShopCategory() {
  const { t } = useLanguage();
  const catalog = useCatalogText();
  const { category: categoryParam = "" } = useParams();
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

  const molds = moldsInCategory(products, categoryParam);
  const storedCategory = molds[0]?.category?.trim() ?? "";
  const categoryName = storedCategory ? catalog.category(storedCategory) : categoryParam;

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16 w-full">
      <header className="mb-10 md:mb-12 pb-8 border-b border-charcoal/10">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60">
          {t("shop.categoryKicker")}
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl text-charcoal font-light mb-6 break-words">{categoryName}</h1>
        {molds.length > 0 ? (
          <p className="text-charcoal-light leading-relaxed max-w-xl">{moldCount(t, molds.length)}</p>
        ) : (
          <p className="text-charcoal-light leading-relaxed max-w-xl">{t("shop.notFound")}</p>
        )}
        <Link
          to="/shop"
          className="mt-8 inline-flex min-h-11 items-center gap-2 border border-charcoal px-5 text-[11px] uppercase tracking-[0.18em] font-semibold text-charcoal hover:bg-ink hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t("shop.backButton")}
        </Link>
      </header>

      <div className="mb-8">
        <Link
          to="/shop"
          className="inline-flex min-h-11 items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold border-b border-charcoal/30 pb-1 hover:border-gold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {t("shop.backLink")}
        </Link>
      </div>

      {molds.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 md:gap-y-16">
          {molds.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group"
            >
              <Link
                to={`/product/${p.id}`}
                className="flex flex-col h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                <div className="aspect-[4/5] bg-ivory-focus overflow-hidden mb-5">
                  <img
                    src={p.imageUrl}
                    alt={catalog.name(p)}
                    className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-700 ease-out dark:mix-blend-normal"
                  />
                </div>
                <div className="flex flex-col mt-auto">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mb-1.5">{catalog.category(p.category)}</p>
                  <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-charcoal mb-1">{catalog.name(p)}</h2>
                  <p className="text-[10px] font-medium text-charcoal/60">${p.price.toFixed(2)} USD</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
