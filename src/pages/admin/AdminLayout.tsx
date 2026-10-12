import { useEffect, useRef, useState } from "react";
import { Outlet, Navigate, NavLink } from "react-router-dom";
import { Package, ShoppingBag, LogOut, Settings } from "lucide-react";
import { useTheme } from "../../theme/ThemeContext";

function focusableItems(panel: HTMLElement | null) {
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"),
  ).filter((element) => !element.hasAttribute("disabled"));
}

function focusWithRing(element: HTMLElement | null | undefined) {
  element?.focus({ focusVisible: true } as FocusOptions);
}

function AdminSettingsMenu({
  panelId,
  placement,
  buttonClassName,
}: {
  panelId: string;
  placement: "up" | "down";
  buttonClassName: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(false);

  const closeMenu = (restoreFocus: boolean) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  };

  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    focusWithRing(buttonRef.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const items = focusableItems(panelRef.current);
    focusWithRing(items[0]);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab") return;
      const current = focusableItems(panelRef.current);
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        focusWithRing(last);
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        focusWithRing(first);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu(true);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => setOpen(false);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
  };

  const panelPosition =
    placement === "up"
      ? "bottom-full left-0 mb-2"
      : "top-full right-0 mt-2";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) closeMenu(false);
          else setOpen(true);
        }}
      >
        <Settings className={placement === "up" ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Settings"
          className={`absolute z-50 w-56 rounded-md border border-charcoal/15 bg-ivory p-1.5 text-charcoal shadow-xl ${panelPosition}`}
        >
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            onClick={toggleTheme}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded px-3 text-left text-sm hover:bg-charcoal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <span>Dark mode</span>
            <span
              aria-hidden="true"
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                theme === "dark" ? "bg-gold" : "bg-neutral-400"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  theme === "dark" ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-red-900/15 hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold dark:hover:bg-red-950 dark:hover:text-red-200"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-3 rounded transition-colors ${
      isActive ? "bg-ink-light text-white" : "text-gray-300 hover:bg-ink-light hover:text-white"
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors ${
      isActive ? "text-gold border-b-2 border-gold" : "text-gray-300 hover:text-white"
    }`;

  return (
    <div className="min-h-screen flex bg-gray-50 text-charcoal dark:bg-neutral-950">
      <aside className="w-64 bg-ink text-white flex-col hidden md:flex">
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
          <AdminSettingsMenu
            panelId="admin-settings-desktop"
            placement="up"
            buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 py-3 text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 bg-ink text-white md:hidden">
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
            <AdminSettingsMenu
              panelId="admin-settings-mobile"
              placement="down"
              buttonClassName="inline-flex min-h-11 w-full items-center justify-center text-gray-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            />
          </nav>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
