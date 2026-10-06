import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Product } from "../types";
import { useLanguage } from "../i18n/LanguageContext";

export default function Shop() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold animate-pulse text-charcoal">{t("shop.loading")}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 w-full">
      <header className="mb-16 pb-8 border-b border-charcoal/10">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60">{t("shop.kicker")}</span>
        <h1 className="font-serif text-5xl text-charcoal font-light mb-6">{t("shop.title")}</h1>
        <p className="text-charcoal-light leading-relaxed max-w-xl">
          {t("shop.body")}
        </p>
      </header>
      
      {products.length === 0 ? (
        <p className="text-center font-serif text-2xl font-light text-charcoal-light py-16">{t("shop.empty")}</p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
        {products.map((p, i) => (
          <motion.div 
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <Link to={`/product/${p.id}`} className="flex flex-col h-full">
              <div className="aspect-[4/5] bg-ivory-focus overflow-hidden mb-5">
                <img 
                  src={p.imageUrl} 
                  alt={p.name}
                  className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              </div>
              <div className="flex flex-col mt-auto">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mb-1.5">{p.category}</p>
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-charcoal mb-1">{p.name}</h3>
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
