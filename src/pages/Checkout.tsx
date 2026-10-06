import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    address: "",
    city: "",
    country: "",
  });

  if (items.length === 0) {
    navigate("/shop");
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ id: i.id, quantity: i.cartQuantity })),
          customerEmail: formData.email,
          shippingAddress: `${formData.name}\n${formData.address}\n${formData.city}, ${formData.country}`
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        clearCart();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert(t("checkout.orderCreated", { orderId: data.orderId }));
          navigate("/");
        }
      } else {
        alert(data.error || t("checkout.failed"));
      }
    } catch (err) {
      console.error(err);
      alert(t("checkout.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-16">
      <header className="mb-12 pb-8 border-b border-charcoal/10">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60">{t("checkout.kicker")}</span>
        <h1 className="font-serif text-4xl text-charcoal font-light">{t("checkout.title")}</h1>
      </header>
      
      <div className="bg-ivory-dark p-6 mb-12 border border-charcoal/10 text-sm">
        <p className="font-semibold text-charcoal uppercase tracking-widest text-[10px] mb-2">{t("checkout.simTitle")}</p>
        <p className="text-charcoal-light">{t("checkout.simBody")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-2 border-b border-charcoal/10">{t("checkout.contact")}</h2>
          <input 
            type="email" 
            required 
            placeholder={t("checkout.email")}
            className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div>
           <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-2 border-b border-charcoal/10">{t("checkout.shipping")}</h2>
           <div className="space-y-4">
             <input type="text" required placeholder={t("checkout.fullName")} className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                 value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
             <input type="text" required placeholder={t("checkout.address")} className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                 value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
             <div className="grid grid-cols-2 gap-4">
                <input type="text" required placeholder={t("checkout.city")} className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                     value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                <input type="text" required placeholder={t("checkout.country")} className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                     value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
             </div>
           </div>
        </div>

        <div className="pt-8 border-t border-charcoal/20 flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-serif italic text-2xl text-charcoal">{t("checkout.total", { amount: total.toFixed(2) })}</span>
            <button 
                type="submit" 
                disabled={loading}
                className="w-full md:w-auto border border-charcoal bg-charcoal hover:bg-transparent hover:text-charcoal text-white px-10 py-4 uppercase tracking-[0.3em] text-[10px] font-bold transition-colors disabled:opacity-50"
                >
                {loading ? t("checkout.processing") : t("checkout.placeOrder")}
            </button>
        </div>
      </form>
    </div>
  );
}
