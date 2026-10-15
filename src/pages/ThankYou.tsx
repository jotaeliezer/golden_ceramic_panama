import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import type { CatalogText } from "../i18n/catalog";
import { useCatalogText } from "../i18n/useCatalogText";
import { useCart } from "../store/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

interface ThankYouItem extends CatalogText {
  quantity: number;
  category?: string | null;
}

const POLL_LIMIT = 4;
const POLL_INTERVAL_MS = 2000;

/** Display only. The stored id (for example `ord_12345`) is left unchanged. */
function displayOrderNumber(orderId: string): string {
  const match = /^ord_(.+)$/i.exec(orderId);
  const number = match?.[1]?.trim();
  return number || orderId;
}

export default function ThankYou() {
  const { t } = useLanguage();
  const catalog = useCatalogText();
  const { clearCart } = useCart();
  const [params] = useSearchParams();
  const orderId = params.get("orderId")?.trim() || "";
  const [status, setStatus] = useState<string | null>(null);
  const [items, setItems] = useState<ThankYouItem[]>([]);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let attempts = 0;
    let timer = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`);
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string; items?: ThankYouItem[] };
        if (cancelled || typeof body.status !== "string") return;
        setStatus(body.status);
        if (Array.isArray(body.items)) {
          setItems(body.items.filter((item) => item && typeof item.name === "string"));
        }
        if (body.status === "pending" && attempts < POLL_LIMIT) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        // The thank-you copy still stands if the status check cannot reach the server.
      }
    };

    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orderId]);

  const paymentLabel =
    status === "paid" ? t("thanks.paid") : status === "pending" ? t("thanks.pending") : null;

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-10 md:py-24 text-center">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3 block opacity-60"
      >
        {t("thanks.kicker")}
      </motion.span>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-4xl sm:text-5xl md:text-6xl font-light text-charcoal leading-tight"
      >
        {t("thanks.title")}
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.1 }}
        className="w-12 h-px bg-gold mx-auto my-6 md:my-8"
      />

      {orderId ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-[10px] uppercase tracking-[0.25em] text-charcoal-light"
        >
          {t("thanks.orderLabel")}
          <span className="mt-3 block font-serif text-2xl sm:text-3xl normal-case tracking-normal text-charcoal break-all">
            {t("thanks.orderNumber", { number: displayOrderNumber(orderId) })}
          </span>
        </motion.p>
      ) : null}

      {items.length > 0 ? (
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          aria-label={t("thanks.items")}
          className="mt-8 md:mt-10 max-w-md mx-auto space-y-4 text-left"
        >
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="border-b border-charcoal/10 pb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mb-1">{catalog.category(item.category)}</p>
              <p className="font-serif text-xl text-charcoal">
                {catalog.name(item)}
                <span className="ml-2 text-base text-charcoal-light">× {item.quantity}</span>
              </p>
              {catalog.description(item) ? (
                <p className="mt-1 text-sm leading-relaxed text-charcoal-light">{catalog.description(item)}</p>
              ) : null}
            </li>
          ))}
        </motion.ul>
      ) : null}

      {paymentLabel ? (
        <p
          className={`mt-6 md:mt-8 inline-block border px-4 py-2 text-[10px] uppercase tracking-[0.22em] ${
            status === "paid" ? "border-gold text-gold-dark" : "border-charcoal/20 text-charcoal-light"
          }`}
          aria-live="polite"
        >
          {paymentLabel}
        </p>
      ) : null}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-6 md:mt-10 text-base sm:text-lg leading-relaxed text-charcoal-light max-w-xl mx-auto"
      >
        {t("thanks.note")}
      </motion.p>

      <Link
        to="/shop"
        className="mt-8 md:mt-12 inline-flex w-full sm:w-auto items-center justify-center border border-charcoal px-8 sm:px-10 py-4 text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] font-semibold hover:bg-ink hover:text-white transition-colors"
      >
        {t("thanks.catalog")}
      </Link>
    </div>
  );
}
