import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapPin, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMedia } from "@/hooks/useMedia";
import { locationsData } from "@/lib/locations";

const LocationDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = slug ? locationsData[slug] : null;
  const { getImageForItem } = useMedia("location");
  const uploadedImage = slug ? getImageForItem(slug) : null;

  const heroImages = location?.images ?? [uploadedImage || location?.image || ""];
  const [currentImg, setCurrentImg] = useState(0);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentImg((i) => (i + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  if (!location) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar forceSolid />
        <div className="pt-24 pb-16 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Local no encontrado</h1>
          <Link to="/locales" className="text-primary underline mt-4 inline-block">
            Ver todos los locales
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: location.name,
    description: location.description,
    image: location.image,
    telephone: location.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: location.street,
      addressLocality: location.city,
      postalCode: location.postalCode,
      addressCountry: "ES",
    },
    servesCuisine: location.type === "Bar de paninis artesanales" ? "Italian, Panini" : "Italian, Pizza",
    priceRange: "€€",
    openingHoursSpecification: location.hoursSpec.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.dayOfWeek,
      opens: h.opens,
      closes: h.closes,
    })),
    url: `https://lozio-table-booker.lovable.app/locales/${location.slug}`,
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${location.name} — ${location.type} en Tarragona`}</title>
        <meta name="description" content={location.description} />
        <link rel="canonical" href={`https://lozio-table-booker.lovable.app/locales/${location.slug}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Navbar forceSolid />

      <div className="pb-16">
        {/* Hero */}
        <div className="relative h-80 md:h-[420px] overflow-hidden">
          {heroImages[0] === "/placeholder.svg" ? (
            <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2">
              <span className="text-5xl">📸</span>
              <span className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">Próximamente</span>
            </div>
          ) : (
            heroImages.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Pizza artesanal Lo Zio Tarragona — ${location.name}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === currentImg ? "opacity-100" : "opacity-0"}`}
              />
            ))
          )}
          <div className="absolute inset-0 bg-foreground/60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground text-center px-4">
              {location.h1}
            </h1>
          </div>
          {heroImages.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImg(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === currentImg ? "bg-white w-4" : "bg-white/50"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="max-w-5xl mx-auto px-4 mt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Info */}
            <div>
              <p className="text-muted-foreground font-body text-lg leading-relaxed mb-8">{location.description}</p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body font-semibold text-foreground">Dirección</p>
                    <p className="font-body text-muted-foreground">{location.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body font-semibold text-foreground">Teléfono</p>
                    <a href={`tel:${location.phone}`} className="text-primary hover:underline">
                      {location.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body font-semibold text-foreground">Horario</p>
                    <p className="font-body text-muted-foreground">{location.hours}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <a href="/#reservar">Reservar Mesa</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="/#menu">Ver Menú</a>
                </Button>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-border shadow-sm h-80 lg:h-full min-h-[320px]">
              <iframe
                src={location.mapEmbed}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa de ${location.name}`}
              />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LocationDetail;
