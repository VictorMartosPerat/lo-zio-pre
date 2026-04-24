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
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <Navbar />
      <div
        className="min-h-screen bg-background landscape-compact"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isAnimating ? "transform 0.3s ease" : "none",
        }}
      >
        <TestEnvBanner />
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
