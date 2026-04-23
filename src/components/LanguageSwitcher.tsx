import { useTranslation } from "react-i18next";

const languages = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "ca", label: "CA" },
  { code: "it", label: "IT" },
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-0.5 bg-primary-foreground/10 rounded-sm overflow-hidden">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`px-2.5 py-1.5 md:px-2 md:py-1 text-xs font-body font-bold uppercase tracking-wider transition-colors min-h-[32px] md:min-h-0 ${
            i18n.language === lang.code
              ? "bg-primary text-primary-foreground"
              : "text-primary-foreground/60 hover:text-primary-foreground"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
