import { motion } from "motion/react";
import { useLanguage } from "../i18n/LanguageContext";

export default function About() {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-24 text-center">
      <motion.span 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60"
      >
        {t("about.kicker")}
      </motion.span>
      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-5xl mb-8 font-light text-charcoal"
      >
        {t("about.title")}
      </motion.h1>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-12 h-[1px] bg-gold mx-auto mb-10"
      ></motion.div>
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-lg text-charcoal-light leading-relaxed mb-16 max-w-2xl mx-auto"
      >
        {t("about.body")}
      </motion.p>
      
      <div className="relative p-2 bg-ivory-focus isolate shadow-xl">
        <div className="absolute inset-4 border border-ivory/50 opacity-100 pointer-events-none z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1565193566173-7a0cb3d90403?q=80&w=1200&auto=format&fit=crop" 
          alt={t("about.imageAlt")} 
          className="w-full h-[500px] object-cover mix-blend-multiply opacity-90"
        />
        {/* Floating Label */}
        <div className="absolute -bottom-6 -right-6 bg-charcoal text-white p-6 w-64 shadow-xl z-20 hidden md:block text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2">{t("about.location")}</p>
          <p className="text-sm italic font-serif">{t("about.locationQuote")}</p>
        </div>
      </div>
    </div>
  );
}
