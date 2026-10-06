import { Outlet, Navigate, NavLink } from "react-router-dom";
import { Package, ShoppingBag, LogOut } from "lucide-react";

export default function AdminLayout() {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
  };

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-3 rounded transition-colors ${
      isActive ? "bg-charcoal-light text-white" : "text-gray-300 hover:bg-charcoal-light hover:text-white"
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors ${
      isActive ? "text-gold border-b-2 border-gold" : "text-gray-300 hover:text-white"
    }`;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-charcoal text-white flex-col hidden md:flex">
        <div className="p-6">
          <h2 className="font-serif text-xl text-gold">Admin Panel</h2>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4" aria-label="Admin">
          <NavLink to="/admin" end className={desktopLinkClass}>
            <ShoppingBag className="w-5 h-5 mr-3" />
            Orders
          </NavLink>
          <NavLink to="/admin/products" className={desktopLinkClass}>
            <Package className="w-5 h-5 mr-3" />
            Products
          </NavLink>
        </nav>
        <div className="p-4 mt-auto">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-400 hover:text-white hover:bg-red-900/30 rounded transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 bg-charcoal text-white md:hidden">
          <div className="px-4 pt-4 pb-3">
            <h2 className="font-serif text-lg text-gold">Admin Panel</h2>
          </div>
          <nav aria-label="Admin" className="grid grid-cols-3 border-t border-white/10">
            <NavLink to="/admin" end className={mobileLinkClass}>
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              Orders
            </NavLink>
            <NavLink to="/admin/products" className={mobileLinkClass}>
              <Package className="w-4 h-4" aria-hidden="true" />
              Products
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-medium text-gray-300 hover:text-white"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Logout
            </button>
          </nav>
        </header>

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
