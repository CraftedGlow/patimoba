"use client"

import { CartProvider } from "@/lib/cart-context"

export default function EcLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider storageKey="patimoba_cart_ec_v1">
      {children}
    </CartProvider>
  )
}
