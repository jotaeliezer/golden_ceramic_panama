import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/CartContext";
import { useCatalogText } from "../i18n/useCatalogText";
import { useLanguage } from "../i18n/LanguageContext";
import type { MessageKey } from "../i18n/dictionary";
import {
  PANAMA_COMARCAS,
  PANAMA_PROVINCES,
  parseDeliveryAddress,
  type DeliveryField,
  type DeliveryIssue,
} from "../delivery-address";

const FIELD_CLASS =
  "w-full p-4 border border-charcoal/20 bg-transparent focus:outline-none focus:border-charcoal transition-colors text-sm placeholder:text-charcoal/40";

const ISSUE_KEYS: Record<DeliveryField, MessageKey> = {
  name: "checkout.invalidName",
  street: "checkout.invalidStreet",
  corregimiento: "checkout.invalidCorregimiento",
  city: "checkout.invalidCity",
  province: "checkout.invalidProvince",
  notes: "checkout.invalidNotes",
  country: "checkout.invalidCountry",
};

function issueMessage(issue: DeliveryIssue, t: (key: MessageKey) => string): string {
  if (issue.reason === "too_long") return t("checkout.tooLong");
  return t(ISSUE_KEYS[issue.field]);
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { t, locale } = useLanguage();
  const catalog = useCatalogText();
  const navigate = useNavigate();
  const leavingForThanks = useRef(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DeliveryField | "email", string>>>({});
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    street: "",
    corregimiento: "",
    city: "",
    province: "",
    notes: "",
  });

  useEffect(() => {
    if (items.length === 0 && !leavingForThanks.current) {
      navigate("/shop");
    }
  }, [items.length, navigate]);

  if (items.length === 0) {
    return null;
  }

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const email = formData.email.trim();
    const parsed = parseDeliveryAddress({
      name: formData.name,
      street: formData.street,
      corregimiento: formData.corregimiento,
      city: formData.city,
      province: formData.province,
      notes: formData.notes,
      country: "Panama",
    });
    const nextErrors: Partial<Record<DeliveryField | "email", string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = t("checkout.invalidEmail");
    }
    if (parsed.ok === false) {
      for (const issue of parsed.issues) {
        if (!nextErrors[issue.field]) nextErrors[issue.field] = issueMessage(issue, t);
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || parsed.ok === false) {
      setFormError(t("checkout.invalidAddress"));
      return;
    }
    setFormError("");
    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ id: item.id, quantity: item.cartQuantity })),
          customerEmail: email,
          deliveryAddress: parsed.address,
          locale,
        }),
      });

      const data = await response.json();
      if (data.success) {
        leavingForThanks.current = true;
        clearCart();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          navigate(`/gracias?orderId=${encodeURIComponent(data.orderId)}`);
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

      <section className="mb-12" aria-label={t("checkout.items")}>
        <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-2 border-b border-charcoal/10">{t("checkout.items")}</h2>
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mb-1">{catalog.category(item.category)}</p>
                <p className="font-serif text-lg text-charcoal">{catalog.name(item)}</p>
                {catalog.description(item) ? (
                  <p className="mt-1 text-sm leading-relaxed text-charcoal-light max-w-lg">{catalog.description(item)}</p>
                ) : null}
              </div>
              <p className="text-sm text-charcoal-light">× {item.cartQuantity}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="bg-ivory-dark p-6 mb-12 border border-charcoal/10 text-sm">
        <p className="font-semibold text-charcoal uppercase tracking-widest text-[10px] mb-2">{t("checkout.simTitle")}</p>
        <p className="text-charcoal-light">{t("checkout.simBody")}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-10">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-6 pb-2 border-b border-charcoal/10">{t("checkout.contact")}</h2>
          <label className="block">
            <span className="sr-only">{t("checkout.email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder={t("checkout.email")}
              aria-invalid={fieldErrors.email ? true : undefined}
              className={FIELD_CLASS}
              value={formData.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </label>
          {fieldErrors.email ? <p className="mt-2 text-xs text-red-700">{fieldErrors.email}</p> : null}
        </div>

        <div>
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2 pb-2 border-b border-charcoal/10">{t("checkout.shipping")}</h2>
          <p className="mb-6 text-sm text-charcoal-light">{t("checkout.panamaOnly")}</p>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.fullName")}</span>
              <input
                type="text"
                required
                autoComplete="name"
                placeholder={t("checkout.fullName")}
                aria-invalid={fieldErrors.name ? true : undefined}
                className={FIELD_CLASS}
                value={formData.name}
                onChange={(event) => setField("name", event.target.value)}
              />
              {fieldErrors.name ? <p className="mt-2 text-xs text-red-700">{fieldErrors.name}</p> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.street")}</span>
              <input
                type="text"
                required
                autoComplete="address-line1"
                placeholder={t("checkout.street")}
                aria-invalid={fieldErrors.street ? true : undefined}
                className={FIELD_CLASS}
                value={formData.street}
                onChange={(event) => setField("street", event.target.value)}
              />
              {fieldErrors.street ? <p className="mt-2 text-xs text-red-700">{fieldErrors.street}</p> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.corregimiento")}</span>
              <input
                type="text"
                required
                autoComplete="address-level3"
                placeholder={t("checkout.corregimiento")}
                aria-invalid={fieldErrors.corregimiento ? true : undefined}
                className={FIELD_CLASS}
                value={formData.corregimiento}
                onChange={(event) => setField("corregimiento", event.target.value)}
              />
              {fieldErrors.corregimiento ? <p className="mt-2 text-xs text-red-700">{fieldErrors.corregimiento}</p> : null}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.city")}</span>
                <input
                  type="text"
                  required
                  autoComplete="address-level2"
                  placeholder={t("checkout.city")}
                  aria-invalid={fieldErrors.city ? true : undefined}
                  className={FIELD_CLASS}
                  value={formData.city}
                  onChange={(event) => setField("city", event.target.value)}
                />
                {fieldErrors.city ? <p className="mt-2 text-xs text-red-700">{fieldErrors.city}</p> : null}
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.province")}</span>
                <select
                  required
                  autoComplete="address-level1"
                  aria-invalid={fieldErrors.province ? true : undefined}
                  className={FIELD_CLASS}
                  value={formData.province}
                  onChange={(event) => setField("province", event.target.value)}
                >
                  <option value="">{t("checkout.provincePlaceholder")}</option>
                  <optgroup label={t("checkout.provinces")}>
                    {PANAMA_PROVINCES.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </optgroup>
                  <optgroup label={t("checkout.comarcas")}>
                    {PANAMA_COMARCAS.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </optgroup>
                </select>
                {fieldErrors.province ? <p className="mt-2 text-xs text-red-700">{fieldErrors.province}</p> : null}
              </label>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.country")}</p>
              <p className="mt-2 text-sm text-charcoal">{t("checkout.countryFixed")}</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-charcoal/60">{t("checkout.notes")}</span>
              <textarea
                rows={3}
                autoComplete="off"
                placeholder={t("checkout.notes")}
                aria-invalid={fieldErrors.notes ? true : undefined}
                className={FIELD_CLASS}
                value={formData.notes}
                onChange={(event) => setField("notes", event.target.value)}
              />
              {fieldErrors.notes ? <p className="mt-2 text-xs text-red-700">{fieldErrors.notes}</p> : null}
            </label>
          </div>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-red-700">{formError}</p>
        ) : null}

        <div className="pt-8 border-t border-charcoal/20 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-serif italic text-2xl text-charcoal">{t("checkout.total", { amount: total.toFixed(2) })}</span>
          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto border border-charcoal bg-ink hover:bg-transparent hover:text-charcoal text-white px-10 py-4 uppercase tracking-[0.3em] text-[10px] font-bold transition-colors disabled:opacity-50"
          >
            {loading ? t("checkout.processing") : t("checkout.placeOrder")}
          </button>
        </div>
      </form>
    </div>
  );
}
