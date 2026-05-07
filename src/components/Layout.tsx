import { Outlet, Link } from "react-router-dom";
import { useCart } from "../store/CartContext";

export default function Layout() {
  const { items } = useCart();
  const cartCount = items.reduce((acc, item) => acc + item.cartQuantity, 0);

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      {/* Decorative vertical line */}
      <div className="absolute top-0 right-8 md:right-16 w-[1px] h-full bg-charcoal/5 -z-10"></div>
      
      <header className="border-b border-charcoal/10 bg-ivory sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1 opacity-60">Est. 2024 • Panama City</span>
            <Link to="/" className="text-3xl font-serif tracking-tight font-light text-charcoal">
              GOLDEN <span className="text-gold">CERAMIC</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-12 text-[11px] uppercase tracking-[0.2em] font-medium items-end">
            <Link to="/shop" className="hover:border-b hover:border-gold pb-1 transition-all">The Collection</Link>
            <Link to="/about" className="opacity-50 hover:opacity-100 transition-opacity pb-1">Our Process</Link>
            <Link to="/cart" className="flex items-center gap-2 pb-1">
              <span>Cart</span>
              <span className="bg-gold text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px]">
                {cartCount}
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 relative">
        <Outlet />
      </main>

      <footer className="bg-ivory border-t border-charcoal/10 py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1 opacity-60 block">Est. 2024</span>
            <h3 className="font-serif text-xl tracking-tight font-light text-charcoal mb-4">
              GOLDEN <span className="text-gold">CERAMIC</span>
            </h3>
            <p className="text-charcoal-light text-sm leading-relaxed max-w-sm">
              Handcrafted architectural ceramic molds. Designed in Panama bridging technical precision with classic luxury.
            </p>
          </div>
          <div className="md:justify-self-center">
            <h4 className="text-[10px] uppercase tracking-[0.3em] mb-4 font-semibold opacity-60">Index</h4>
            <ul className="space-y-3 text-sm text-charcoal font-medium">
              <li><Link to="/shop" className="hover:text-gold transition-colors">The Collection</Link></li>
              <li><Link to="/about" className="hover:text-gold transition-colors">Our Process</Link></li>
              <li><Link to="/cart" className="hover:text-gold transition-colors">Your Cart</Link></li>
              <li><Link to="/admin" className="hover:text-gold transition-colors opacity-50">Admin Access</Link></li>
            </ul>
          </div>
          <div className="md:justify-self-end">
            <h4 className="text-[10px] uppercase tracking-[0.3em] mb-4 font-semibold opacity-60">Inquiry</h4>
            <p className="text-sm font-serif italic text-charcoal-light mb-2">info@goldenceramic.pa</p>
            <p className="text-sm font-serif italic text-charcoal-light">+507 555-0199</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
