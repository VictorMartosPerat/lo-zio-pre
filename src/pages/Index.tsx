import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
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
    <div className="relative overflow-hidden">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div
        className="min-h-screen bg-background landscape-compact"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isAnimating ? "transform 0.3s ease" : "none",
        }}
      >
        <Navbar />
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
