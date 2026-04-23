import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquareHeart, Send, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const categories = ["restaurant", "food", "web"] as const;
type Category = (typeof categories)[number];

const ReviewSection = () => {
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
    toast({ title: t("reviews.success") });
  };

  const handleReset = () => {
    setRating(0);
    setHoverRating(0);
    setCategory("restaurant");
    setMessage("");
    setSubmitted(false);
  };

  return (
    <section id="reviews" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-body font-medium mb-4">
            <MessageSquareHeart className="h-4 w-4" />
            {t("reviews.badge")}
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {t("reviews.title")}
          </h2>
          <p className="mt-3 font-body text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
            {t("reviews.subtitle")}
          </p>
        </div>

        {submitted ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-10 h-10 text-primary fill-primary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                {t("reviews.thankYou")}
              </h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">
                {t("reviews.thankYouDesc")}
              </p>
            </div>

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
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            {/* Category selector */}
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-2 block">
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

            {/* Star rating */}
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-2 block">
                {t("reviews.ratingLabel")}
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-2 block">
                {t("reviews.messageLabel")}
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder={t("reviews.messagePlaceholder")}
                rows={3}
                className="resize-none"
              />
              <p className="font-body text-xs text-muted-foreground mt-1 text-right">
                {message.length}/500
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? t("reviews.submitting") : t("reviews.submit")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ReviewSection;
