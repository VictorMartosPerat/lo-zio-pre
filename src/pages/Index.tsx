import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TestEnvBanner from "@/components/TestEnvBanner";
import MenuSection from "@/components/MenuSection";
import ReservationSection from "@/components/ReservationSection";
import FAQSection from "@/components/FAQSection";
import ReviewSection from "@/components/ReviewSection";
import Footer from "@/components/Footer";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";

const Index = () => {
  const { pullDistance, refreshing, translateY, isAnimating } = usePullToRefresh(async () => {
    window.location.reload();
  });

  return (
    <div className="relative" style={{ overflowX: "clip" }}>
      <Helmet>
        <title>Pizzería Lo Zio Tarragona — Pizza italiana artesanal · Reservas y delivery</title>
        <meta name="description" content="Pizzería Lo Zio en Tarragona: pizza italiana artesanal al horno, ingredientes frescos, reservas online y entrega a domicilio. Tres locales en Tarragona." />
        <link rel="canonical" href="https://pizzerialozio.com/" />
        <meta property="og:title" content="Pizzería Lo Zio Tarragona — Pizza italiana artesanal" />
        <meta property="og:description" content="Pizza italiana artesanal en Tarragona. Reserva mesa o pide a domicilio." />
        <meta property="og:url" content="https://pizzerialozio.com/" />
      </Helmet>
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <TestEnvBanner />
      <Navbar />
      <div
        className="min-h-screen bg-background landscape-compact"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isAnimating ? "transform 0.3s ease" : "none",
        }}
      >
        <HeroSection />
        <MenuSection />
        <ReservationSection />
        <FAQSection />
        <ReviewSection />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
