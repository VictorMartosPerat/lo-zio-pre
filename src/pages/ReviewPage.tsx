import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Star, Send, Heart, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const categories = ["restaurant", "food", "web"] as const;
type Category = (typeof categories)[number];

const ReviewPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<Category>("restaurant");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: t("reviews.ratingRequired"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reviews" as any).insert({
      category,
      rating,
      message: message.trim() || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: t("reviews.error"), variant: "destructive" });
      return;
    }
    setSubmitted(true);
  };

  const handleReset = () => {
    setRating(0);
    setHoverRating(0);
    setCategory("restaurant");
    setMessage("");
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Deja tu reseña — Pizzeria Lo Zio Tarragona</title>
        <meta name="description" content="Cuéntanos qué te ha parecido tu experiencia en Pizzeria Lo Zio Tarragona. Tu opinión nos ayuda a mejorar." />
        <link rel="canonical" href="https://pizzerialozio.com/resenas" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      {/* Header */}
      <div className="relative bg-foreground px-6 pt-10 pb-8 text-center">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>

        {/* Logo → home */}
        <Link to="/" className="inline-block mb-3 group">
          <img
            src="/Lozio_favicon-2.png"
            alt="Lo Zio"
            className="h-14 w-auto mx-auto brightness-0 invert transition-opacity group-hover:opacity-75"
          />
        </Link>

        <h1 className="font-display text-2xl font-bold text-primary-foreground">
          {t("reviews.title")}
        </h1>
        <p className="font-body text-primary-foreground/60 text-sm mt-1">
          {t("reviews.subtitle")}
        </p>

        {/* Back to menu link */}
        <Link
          to="/#menu"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-1.5 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors font-body text-xs font-bold text-primary-foreground/70 hover:text-primary-foreground uppercase tracking-widest"
        >
          <UtensilsCrossed className="w-3 h-3" />
          {t("nav.menu")}
        </Link>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
        {submitted ? (
          <div className="flex flex-col items-center text-center gap-5 pt-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-10 h-10 text-primary fill-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("reviews.thankYou")}
              </h2>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">
                {t("reviews.thankYouDesc")}
              </p>
            </div>

            {/* External review links */}
            <div className="w-full space-y-3 pt-2">
              <p className="font-body text-xs text-muted-foreground uppercase tracking-widest font-bold">
                {t("reviews.shareAlso")}
              </p>
              <a
                href="https://www.google.com/maps/place/Pizzeria+Lo+Zio/@41.1220121,1.2677832,19.18z/data=!4m8!3m7!1s0x12a3fde71873e23b:0x2d1d5fa3713d83aa!8m2!3d41.1218819!4d1.2680747!9m1!1b1!16s%2Fg%2F11nbh3b1vm?entry=ttu&g_ep=EgoyMDI2MDQwNi4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl border border-border bg-card font-body font-bold text-sm text-foreground hover:bg-muted transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </a>
              <a
                href="https://www.tripadvisor.es/Restaurant_Review-g187503-d25019953-Reviews-Pizzeria_Lo_Zio-Tarragona_Costa_Dorada_Province_of_Tarragona_Catalonia.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl border border-border bg-card font-body font-bold text-sm text-foreground hover:bg-muted transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#00AF87">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                TripAdvisor
              </a>
            </div>

            <Button variant="ghost" onClick={handleReset} className="font-body text-sm text-muted-foreground">
              {t("reviews.another")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Category */}
            <div>
              <label className="font-body text-sm font-bold text-foreground mb-3 block">
                {t("reviews.categoryLabel")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-body font-medium transition-all ${
                      category === cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {t(`reviews.cat_${cat}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Stars */}
            <div>
              <label className="font-body text-sm font-bold text-foreground mb-3 block">
                {t("reviews.ratingLabel")}
              </label>
              <div className="flex gap-2 justify-center py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform active:scale-90 hover:scale-110"
                  >
                    <Star
                      className={`h-10 w-10 transition-colors ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="font-body text-sm font-bold text-foreground mb-3 block">
                {t("reviews.messageLabel")}
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder={t("reviews.messagePlaceholder")}
                rows={4}
                className="resize-none text-base"
              />
              <p className="font-body text-xs text-muted-foreground mt-1 text-right">
                {message.length}/500
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full gap-2 py-6 text-base font-body font-bold"
              size="lg"
            >
              <Send className="w-4 h-4" />
              {submitting ? t("reviews.submitting") : t("reviews.submit")}
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <p className="font-body text-xs text-muted-foreground/50">Lo Zio · Tarragona</p>
      </div>
    </div>
  );
};

export default ReviewPage;
