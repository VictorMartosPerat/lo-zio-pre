import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import CartDrawer from "@/components/CartDrawer";
import CartFloatingButton from "@/components/CartFloatingButton";
import MobileBottomNav from "@/components/MobileBottomNav";
import InstallBanner from "@/components/InstallBanner";
import UpdateBanner from "@/components/UpdateBanner";
import AdminFAB from "@/components/AdminFAB";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import Checkout from "./pages/Checkout.tsx";
import OrderConfirmation from "./pages/OrderConfirmation.tsx";
import Locales from "./pages/Locales.tsx";
import LocationDetail from "./pages/LocationDetail.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import MyReservations from "./pages/MyReservations.tsx";
import NotFound from "./pages/NotFound.tsx";
import ReviewPage from "./pages/ReviewPage.tsx";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const queryClient = new QueryClient();

const AdminNotificationListener = () => {
  useAdminNotifications();
  return null;
};

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AdminNotificationListener />
          <BrowserRouter>
            <InstallBanner />
            <UpdateBanner />
            <CartDrawer />
            <CartFloatingButton />
            <MobileBottomNav />
            <AdminFAB />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/mis-reservas" element={<MyReservations />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/pedido" element={stripePromise ? <Elements stripe={stripePromise}><Checkout /></Elements> : <Checkout />} />
              <Route path="/pedido-confirmado" element={<OrderConfirmation />} />
              <Route path="/locales" element={<Locales />} />
              <Route path="/locales/:slug" element={<LocationDetail />} />
              <Route path="/resenas" element={<ReviewPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
