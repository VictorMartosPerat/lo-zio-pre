import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Star, MessageSquareHeart, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  category: string;
  message: string | null;
  created_at: string;
}

const categoryLabels: Record<string, { label: string; emoji: string }> = {
  restaurant: { label: "Restaurante", emoji: "🍽️" },
  food: { label: "Comida", emoji: "🍕" },
  web: { label: "Web", emoji: "💻" },
};

const AdminReviews = () => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterRating, setFilterRating] = useState("all");

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Error al cargar las reseñas");
    } else {
      setReviews((data as Review[]) || []);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (filterRating !== "all" && r.rating !== Number(filterRating)) return false;
      return true;
    });
  }, [reviews, filterCategory, filterRating]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const avgByCategory = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    reviews.forEach((r) => {
      if (!map[r.category]) map[r.category] = { sum: 0, count: 0 };
      map[r.category].sum += r.rating;
      map[r.category].count++;
    });
    return Object.entries(map).map(([cat, v]) => ({
      category: cat,
      avg: v.sum / v.count,
      count: v.count,
    }));
  }, [reviews]);

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground font-body">Cargando reseñas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <p className="text-muted-foreground font-body text-sm">Total reseñas</p>
          <p className="font-display text-3xl font-bold text-foreground">{reviews.length}</p>
        </div>
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <p className="text-muted-foreground font-body text-sm">Media general</p>
          <div className="flex items-center gap-2">
            <p className="font-display text-3xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
            <Star className="h-5 w-5 fill-primary text-primary" />
          </div>
        </div>
        {avgByCategory.map((c) => {
          const cat = categoryLabels[c.category] || { label: c.category, emoji: "📝" };
          return (
            <div key={c.category} className="bg-card rounded-lg p-5 border border-border shadow-sm">
              <p className="text-muted-foreground font-body text-sm">
                {cat.emoji} {cat.label}
              </p>
              <div className="flex items-center gap-2">
                <p className="font-display text-3xl font-bold text-foreground">{c.avg.toFixed(1)}</p>
                <span className="text-xs text-muted-foreground font-body">({c.count})</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 rounded-sm bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todas las categorías</option>
          <option value="restaurant">🍽️ Restaurante</option>
          <option value="food">🍕 Comida</option>
          <option value="web">💻 Web</option>
        </select>
        <select
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value)}
          className="px-4 py-2 rounded-sm bg-background border border-input font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todas las puntuaciones</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {"⭐".repeat(r)} ({r})
            </option>
          ))}
        </select>
        <Badge variant="secondary" className="text-xs self-center">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Review list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-lg p-12 border border-border text-center">
            <MessageSquareHeart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-body text-lg">No hay reseñas</p>
          </div>
        ) : (
          filtered.map((r) => {
            const cat = categoryLabels[r.category] || { label: r.category, emoji: "📝" };
            return (
              <div
                key={r.id}
                className="bg-card rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      {renderStars(r.rating)}
                      <Badge variant="outline" className="text-xs font-body">
                        {cat.emoji} {cat.label}
                      </Badge>
                    </div>
                    {r.message ? (
                      <p className="font-body text-foreground text-sm mt-2">{r.message}</p>
                    ) : (
                      <p className="font-body text-muted-foreground text-sm italic mt-2">
                        Sin comentario
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-body shrink-0">
                    {format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminReviews;
