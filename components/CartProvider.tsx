"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CART_STORAGE_KEY } from "@/lib/constants";
import type { CartLine } from "@/lib/types";

type CartContextValue = {
  items: CartLine[];
  count: number;
  ready: boolean;
  addItem: (line: Omit<CartLine, "qty">, qty: number) => void;
  setQty: (codpro: string, qty: number) => void;
  remove: (codpro: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartLine[]);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.qty, 0),
      ready,
      addItem: (line, qty) => {
        setItems((current) => {
          const existing = current.find((item) => item.codpro === line.codpro);
          if (!existing) return [...current, { ...line, qty }];
          return current.map((item) =>
            item.codpro === line.codpro ? { ...item, ...line, qty: Math.min(999, item.qty + qty) } : item,
          );
        });
      },
      setQty: (codpro, qty) => {
        setItems((current) =>
          qty < 1
            ? current.filter((item) => item.codpro !== codpro)
            : current.map((item) => (item.codpro === codpro ? { ...item, qty: Math.min(999, qty) } : item)),
        );
      },
      remove: (codpro) => setItems((current) => current.filter((item) => item.codpro !== codpro)),
      clear: () => setItems([]),
    }),
    [items, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart doit être utilisé dans CartProvider.");
  return value;
}
