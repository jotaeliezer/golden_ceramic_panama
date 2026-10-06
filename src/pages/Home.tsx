import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Product } from "../types";
import { useLanguage } from "../i18n/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => setFeatured(data.slice(0, 4)))
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-ivory-dark -z-10 hidden md:block"></div>
      <div className="absolute top-64 left-0 w-full h-[1px] bg-charcoal opacity-10 -z-10"></div>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-12 gap-12 py-16 md:py-24 items-center min-h-[70vh]">
        <div className="col-span-1 md:col-span-5 relative z-10">
          <div className="inline-block bg-gold text-white px-3 py-1 text-[10px] uppercase tracking-widest mb-6">
            {t("home.limited")}
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-6xl md:text-7xl font-serif leading-[0.9] mb-8 font-light text-charcoal"
          >
            {t("home.heroLead")} <br/><i className="text-gold">{t("home.heroEmphasis")}</i>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-lg leading-relaxed opacity-80 mb-10 pr-0 md:pr-12 text-charcoal-light"
          >
            {t("home.heroBody")}
          </motion.p>
          <Link 
            to="/shop" 
            className="inline-block border border-charcoal px-10 py-4 text-xs uppercase tracking-[0.3em] font-semibold hover:bg-charcoal hover:text-white transition-colors"
          >
            {t("home.viewCatalog")}
          </Link>
        </div>

        <div className="col-span-1 md:col-span-7 h-full relative mt-12 md:mt-0">
          <div className="w-full aspect-[4/3] bg-ivory-focus overflow-hidden flex items-center justify-center shadow-2xl relative">
            <div className="absolute inset-0 border-[24px] border-ivory opacity-20 pointer-events-none z-10"></div>
            <img 
              src="https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=1200&auto=format&fit=crop" 
              alt={t("home.heroAlt")} 
              className="w-full h-full object-cover mix-blend-multiply opacity-90 transition-transform duration-1000 hover:scale-105"
            />
          </div>
          
          {/* Floating Overlay Label */}
          <div className="hidden lg:block absolute -bottom-8 -left-12 bg-charcoal text-white p-6 w-64 shadow-xl z-20">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2">{t("home.material")}</p>
            <p className="text-sm italic font-serif">{t("home.materialQuote")}</p>
          </div>
        </div>
      </section>

      {/* Featured / Gallery Preview */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto w-full border-t border-charcoal/10">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-2 block opacity-60">{t("home.selection")}</span>
            <h2 className="font-serif text-3xl font-light text-charcoal">{t("home.curated")}</h2>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1">{t("home.inquiry")}</p>
            <p className="text-xs font-serif opacity-60">info@goldenceramic.pa</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {featured.map((p, i) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="flex flex-col group cursor-pointer"
            >
              <Link to={`/product/${p.id}`} className="block w-full h-full">
                <div className="aspect-square bg-ivory-focus mb-4 overflow-hidden relative">
                  <img 
                    src={p.imageUrl} 
                    alt={p.name}
                    className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-charcoal">{p.name}</span>
                  <span className="text-[10px] text-gold mt-1">${p.price.toFixed(2)} USD</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
