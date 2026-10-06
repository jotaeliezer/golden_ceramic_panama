import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCart } from "../store/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCart();
  const { t } = useLanguage();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-32 text-center">
        <h1 className="font-serif text-4xl mb-6 font-light">{t("cart.emptyTitle")}</h1>
        <Link to="/shop" className="text-[11px] uppercase tracking-[0.2em] font-bold border-b border-charcoal/30 pb-1 hover:border-gold transition-colors">{t("cart.return")}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
      <header className="mb-16 pb-8 border-b border-charcoal/10">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60">{t("cart.kicker")}</span>
        <h1 className="font-serif text-4xl text-charcoal font-light">{t("cart.title")}</h1>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8 space-y-8">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 sm:gap-8 border-b border-charcoal/10 pb-8 items-center">
              <div className="w-32 h-32 bg-ivory-focus flex-shrink-0">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" />
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-charcoal">{item.name}</h3>
                    <p className="font-serif italic text-charcoal-light bg-ivory-dark px-2 py-1">${(item.price * item.cartQuantity).toFixed(2)}</p>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-charcoal/50">${item.price.toFixed(2)} {t("cart.each")}</p>
                </div>
                
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center border border-charcoal/20">
                    <button
                      type="button"
                      aria-label={t("cart.decrease", { name: item.name })}
                      onClick={() => updateQuantity(item.id, item.cartQuantity - 1)}
                      className="min-h-11 min-w-11 w-11 h-11 flex justify-center items-center hover:bg-charcoal hover:text-white transition-colors text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-[11px] select-none font-medium text-charcoal">{item.cartQuantity}</span>
                    <button
                      type="button"
                      aria-label={t("cart.increase", { name: item.name })}
                      onClick={() => updateQuantity(item.id, item.cartQuantity + 1)}
                      className="min-h-11 min-w-11 w-11 h-11 flex justify-center items-center hover:bg-charcoal hover:text-white transition-colors text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={t("cart.remove", { name: item.name })}
                    onClick={() => removeFromCart(item.id)}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center text-charcoal/40 hover:text-charcoal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="lg:col-span-4 mt-8 lg:mt-0">
          <div className="bg-ivory-dark/50 p-8 border border-charcoal/10">
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-4 border-b border-charcoal/10">{t("cart.summary")}</h2>
            <div className="space-y-4 mb-8 text-sm">
              <div className="flex justify-between">
                <span className="text-charcoal-light font-medium">{t("cart.subtotal")}</span>
                <span className="font-serif italic">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal-light font-medium">{t("cart.logistics")}</span>
                <span className="text-[10px] uppercase tracking-widest opacity-60 mt-1">{t("cart.calculatedNext")}</span>
              </div>
              <div className="border-t border-charcoal/20 pt-4 flex justify-between font-bold text-lg mt-4">
                <span className="uppercase text-xs tracking-widest flex items-center">{t("cart.total")}</span>
                <span className="font-serif italic text-gold-dark">${total.toFixed(2)}</span>
              </div>
            </div>
            <Link 
              to="/checkout" 
              className="block w-full text-center border border-charcoal bg-transparent hover:bg-charcoal hover:text-white text-charcoal py-4 uppercase tracking-[0.3em] text-[10px] font-bold transition-colors"
            >
              {t("cart.proceed")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
