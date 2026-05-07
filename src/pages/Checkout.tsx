import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/CartContext";

export default function Checkout() {
  const { items, total, clearCart } = useCart();
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

  const handleSubmit = async (e: React.FormEvent) => {
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
          alert(`Order created! (Stripe Checkout skipped since STRIPE_SECRET_KEY is missing). Order ID: ${data.orderId}`);
          navigate("/");
        }
      } else {
        alert(data.error || "Checkout failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-16">
      <header className="mb-12 pb-8 border-b border-charcoal/10">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60">Finalize</span>
        <h1 className="font-serif text-4xl text-charcoal font-light">Secure Checkout</h1>
      </header>
      
      <div className="bg-ivory-dark p-6 mb-12 border border-charcoal/10 text-sm">
        <p className="font-semibold text-charcoal uppercase tracking-widest text-[10px] mb-2">Simulated Checkout Info</p>
        <p className="text-charcoal-light">If you configure STRIPE_SECRET_KEY in the environment, you will be redirected to a secure Stripe portal. Otherwise, clicking Place Order will mock success for demo purposes.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-2 border-b border-charcoal/10">Contact Details</h2>
          <input 
            type="email" 
            required 
            placeholder="Email address"
            className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div>
           <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-2 border-b border-charcoal/10">Shipping Logistics</h2>
           <div className="space-y-4">
             <input type="text" required placeholder="Full Name" className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                 value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
             <input type="text" required placeholder="Street Address" className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                 value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
             <div className="grid grid-cols-2 gap-4">
                <input type="text" required placeholder="City" className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                     value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                <input type="text" required placeholder="Country" className="w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40"
                     value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
             </div>
           </div>
        </div>

        <div className="pt-8 border-t border-charcoal/20 flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-serif italic text-2xl text-charcoal">Total: ${total.toFixed(2)} USD</span>
            <button 
                type="submit" 
                disabled={loading}
                className="w-full md:w-auto border border-charcoal bg-charcoal hover:bg-transparent hover:text-charcoal text-white px-10 py-4 uppercase tracking-[0.3em] text-[10px] font-bold transition-colors disabled:opacity-50"
                >
                {loading ? "Processing..." : "Place Order"}
            </button>
        </div>
      </form>
    </div>
  );
}
