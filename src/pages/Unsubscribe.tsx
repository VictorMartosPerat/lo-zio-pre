import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, MailX, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json();
        if (!res.ok) return setStatus("invalid");
        if (data.valid) return setStatus("valid");
        if (data.reason === "already_unsubscribed") return setStatus("already");
        setStatus("invalid");
      } catch {
        setStatus("error");
      }
    };
    validate();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } },
      );
      if (error) throw error;
      if ((data as { success?: boolean })?.success) setStatus("success");
      else if ((data as { reason?: string })?.reason === "already_unsubscribed")
        setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-32 pb-24 px-4">
        <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-menu-teal mx-auto mb-4" />
              <p className="font-body text-muted-foreground">{t("unsubscribe.checking")}</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="w-12 h-12 text-menu-teal mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("unsubscribe.title")}
              </h1>
              <p className="text-muted-foreground font-body mb-6">
                {t("unsubscribe.description")}
              </p>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground font-display"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("unsubscribe.confirm")
                )}
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("unsubscribe.successTitle")}
              </h1>
              <p className="text-muted-foreground font-body">
                {t("unsubscribe.successDescription")}
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-menu-teal mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("unsubscribe.alreadyTitle")}
              </h1>
              <p className="text-muted-foreground font-body">
                {t("unsubscribe.alreadyDescription")}
              </p>
            </>
          )}

          {(status === "invalid" || status === "error") && (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("unsubscribe.errorTitle")}
              </h1>
              <p className="text-muted-foreground font-body">
                {t("unsubscribe.errorDescription")}
              </p>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Unsubscribe;
