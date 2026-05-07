import { Outlet, Navigate, Link } from "react-router-dom";
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

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-charcoal text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <h2 className="font-serif text-xl text-gold">Admin Panel</h2>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link to="/admin" className="flex items-center px-4 py-3 text-gray-300 hover:bg-charcoal-light hover:text-white rounded transition-colors">
            <ShoppingBag className="w-5 h-5 mr-3" />
            Orders
          </Link>
          <Link to="/admin/products" className="flex items-center px-4 py-3 text-gray-300 hover:bg-charcoal-light hover:text-white rounded transition-colors">
            <Package className="w-5 h-5 mr-3" />
            Products
          </Link>
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

      {/* Main Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
