"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { CartProvider } from "@/lib/cart-context"
import { useAuth } from "@/lib/auth-context"

export default function TakeoutLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

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
