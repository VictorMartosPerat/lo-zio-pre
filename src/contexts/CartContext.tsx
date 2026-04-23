import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const CART_STORAGE_KEY = "lozio_cart";

export interface CartItemExtra {
  id: string;
  label: string;
  emoji: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  note?: string;
  extras?: CartItemExtra[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateNote: (id: string, note: string) => void;
  addExtra: (itemId: string, extra: Omit<CartItemExtra, "quantity">) => void;
  updateExtraQuantity: (itemId: string, extraId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity } : i))
      );
    }
  }, []);

  const updateNote = useCallback((id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)));
  }, []);

  const addExtra = useCallback((itemId: string, extra: Omit<CartItemExtra, "quantity">) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const existingExtras = item.extras || [];
        const existing = existingExtras.find((e) => e.id === extra.id);
        if (existing) {
          return {
            ...item,
            extras: existingExtras.map((e) =>
              e.id === extra.id ? { ...e, quantity: e.quantity + 1 } : e
            ),
          };
        }
        return { ...item, extras: [...existingExtras, { ...extra, quantity: 1 }] };
      })
    );
  }, []);

  const updateExtraQuantity = useCallback((itemId: string, extraId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (quantity <= 0) {
          return { ...item, extras: (item.extras || []).filter((e) => e.id !== extraId) };
        }
        return {
          ...item,
          extras: (item.extras || []).map((e) =>
            e.id === extraId ? { ...e, quantity } : e
          ),
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => {
    const extrasTotal = (i.extras || []).reduce((es, e) => es + e.price * e.quantity, 0);
    return sum + i.price * i.quantity + extrasTotal;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateNote,
        addExtra,
        updateExtraQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
