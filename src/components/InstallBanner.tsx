import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lozio-install-banner-dismissed";

const InstallBanner = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (!showBanner || !isMobile) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-3 shadow-lg animate-fade-in-up">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Download className="w-5 h-5 shrink-0" />
        <span className="text-sm font-body font-medium truncate">
          {t("pwa.installBanner")}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-3 text-xs font-bold"
          onClick={handleInstall}
        >
          {t("pwa.install")}
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-sm hover:bg-primary-foreground/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
