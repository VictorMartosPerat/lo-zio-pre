import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";

const CartFloatingButton = () => {
  const { totalItems, totalPrice, setIsOpen } = useCart();

  if (totalItems === 0) return null;

  return (
    <Button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 z-50 bg-menu-teal hover:bg-menu-teal/90 text-menu-teal-foreground shadow-xl rounded-full h-14 px-5 gap-2 font-display text-base animate-fade-in-up hidden md:flex"
    >
      <ShoppingCart className="w-5 h-5" />
      <span>{totalItems}</span>
      <span>· {totalPrice.toFixed(2)} €</span>
    </Button>
  );
};

export default CartFloatingButton;
