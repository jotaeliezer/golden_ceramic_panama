import { useLanguage } from "../i18n/LanguageContext";
import type { Locale } from "../i18n/dictionary";

const options: { locale: Locale; code: string; labelKey: "language.spanish" | "language.english"; lang: Locale }[] = [
  { locale: "es", code: "ES", labelKey: "language.spanish", lang: "es" },
  { locale: "en", code: "EN", labelKey: "language.english", lang: "en" },
];

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={`inline-flex items-center font-serif tracking-[0.22em] text-charcoal ${
        compact ? "gap-2 text-[11px]" : "gap-2.5 text-[12px]"
      }`}
    >
      {options.map((option, index) => {
        const selected = locale === option.locale;
        return (
          <span key={option.locale} className="inline-flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-gold">
                |
              </span>
            )}
            <button
              type="button"
              lang={option.lang}
              aria-pressed={selected}
              aria-label={t(option.labelKey)}
              onClick={() => setLocale(option.locale)}
              className={`px-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                compact ? "py-1" : "min-h-11 min-w-11"
              } ${selected ? "font-semibold text-charcoal" : "font-normal text-charcoal/40 hover:text-gold"}`}
            >
              {option.code}
            </button>
          </span>
        );
      })}
    </div>
  );
}
