import { useEffect, useRef, useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useCart } from "../store/CartContext";

export default function Layout() {
  const { items } = useCart();
  const cartCount = items.reduce((acc, item) => acc + item.cartQuantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      {/* Decorative vertical line */}
      <div className="absolute top-0 right-8 md:right-16 w-[1px] h-full bg-charcoal/5 -z-10"></div>
      
      <header ref={headerRef} className="border-b border-charcoal/10 bg-ivory sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex items-end justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1 opacity-60">Est. 2024 • Panama City</span>
            <Link to="/" className="text-2xl sm:text-3xl font-serif tracking-tight font-light text-charcoal">
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

          <button
            ref={menuButtonRef}
            type="button"
            className="md:hidden shrink-0 mb-0.5 inline-flex h-11 w-11 items-center justify-center text-charcoal hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>

        <nav
          id="mobile-nav"
          className={`md:hidden border-t border-charcoal/10 bg-ivory px-6 ${menuOpen ? "block" : "hidden"}`}
          aria-label="Mobile"
        >
          <Link
            to="/shop"
            onClick={closeMenu}
            className="flex min-h-11 items-center border-b border-charcoal/10 text-[11px] uppercase tracking-[0.2em] font-medium hover:text-gold"
          >
            The Collection
          </Link>
          <Link
            to="/about"
            onClick={closeMenu}
            className="flex min-h-11 items-center border-b border-charcoal/10 text-[11px] uppercase tracking-[0.2em] font-medium hover:text-gold"
          >
            Our Process
          </Link>
          <Link
            to="/cart"
            onClick={closeMenu}
            className="flex min-h-11 items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-medium hover:text-gold"
          >
            <span>Cart</span>
            <span className="bg-gold text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px]">
              {cartCount}
            </span>
          </Link>
        </nav>
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
