"use client"

import { CartProvider } from "@/lib/cart-context"

export default function TakeoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider storageKey="patimoba_cart_takeout_v1">
      {children}
    </CartProvider>
  )
}
