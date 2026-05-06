"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CartProvider } from "@/lib/cart-context"
import { useAuth } from "@/lib/auth-context"

const CART_SESSION_KEY = "patimoba_cart_session"

export default function TakeoutLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  // セッション開始時にカートをクリア（前回セッションの商品を消す）
  const [cartReady] = useState(() => {
    try {
      if (!sessionStorage.getItem(CART_SESSION_KEY)) {
        localStorage.removeItem("patimoba_cart_takeout_v1")
        localStorage.removeItem("patimoba_cart_ec_v1")
        sessionStorage.setItem(CART_SESSION_KEY, "1")
      }
    } catch { /* ignore */ }
    return true
  })

  useEffect(() => {
    if (loading) return
    if (!user || user.userType !== "customer") {
      router.replace("/customer/signup")
    }
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <CartProvider storageKey="patimoba_cart_takeout_v1">
      {children}
    </CartProvider>
  )
}
