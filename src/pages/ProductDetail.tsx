import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Product } from "../types";
import { useCart } from "../store/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import { categorySlug } from "../lib/categories";

export default function ProductDetail() {
  const { t } = useLanguage();
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(data => setProduct(data))
      .catch(console.error);
  }, [id]);

  if (!product) return null;

  const handleAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const categoryName = product.category?.trim() ?? "";
  const categoryHref = categoryName ? `/shop/${categorySlug(categoryName)}` : "/shop";

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16 lg:py-24">
      <Link
        to={categoryHref}
        className="inline-flex min-h-11 items-center gap-2 mb-8 text-[11px] uppercase tracking-[0.2em] font-bold border-b border-charcoal/30 pb-1 hover:border-gold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
      >
        <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {categoryName ? t("product.backToCategory", { category: categoryName }) : t("product.backToShop")}
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full bg-ivory-focus p-8 flex shadow-2xl relative"
      >
        <div className="absolute inset-4 border border-ivory opacity-30 pointer-events-none"></div>
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full aspect-[4/5] object-cover shadow-lg mix-blend-multiply"
        />
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col justify-center"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mb-3">{product.category}</p>
        <h1 className="font-serif text-4xl lg:text-5xl text-charcoal font-light mb-4">{product.name}</h1>
        <div className="w-12 h-[1px] bg-gold mb-6"></div>
        
        <p className="text-xl font-serif italic text-charcoal-light mb-8">${product.price.toFixed(2)} USD</p>
        
        <p className="text-sm text-charcoal-light leading-relaxed mb-10 max-w-lg">
          {product.description}
        </p>
        
        <div className="flex items-center space-x-4 mb-10">
          <div className="flex items-center border border-charcoal/20">
            <button
              type="button"
              aria-label={t("product.decrease")}
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="min-h-11 min-w-11 w-11 h-12 flex justify-center items-center hover:bg-charcoal hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >-</button>
            <input 
              type="number" 
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-10 text-center appearance-none outline-none font-medium bg-transparent text-sm"
              readOnly
              aria-label={t("product.quantity")}
            />
            <button
              type="button"
              aria-label={t("product.increase")}
              onClick={() => setQty(qty + 1)}
              className="min-h-11 min-w-11 w-11 h-12 flex justify-center items-center hover:bg-charcoal hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >+</button>
          </div>
          
          <button 
            onClick={handleAdd}
            className="flex-1 border border-charcoal bg-transparent hover:bg-charcoal hover:text-white text-charcoal h-12 uppercase tracking-[0.3em] text-[10px] font-bold transition-colors"
          >
            {added ? t("product.added") : t("product.add")}
          </button>
        </div>
        
        <div className="pt-8 border-t border-charcoal/10 mt-auto">
          <p className="text-[11px] uppercase tracking-widest text-charcoal/60 mb-2">
            <span className="font-bold text-charcoal mr-2">{t("product.status")}</span>
            {product.stock > 0 ? t("product.units", { count: product.stock }) : t("product.outOfStock")}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-charcoal/60">
            <span className="font-bold text-charcoal mr-2">{t("product.fulfillment")}</span>
            {t("product.fulfillmentValue")}
          </p>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
