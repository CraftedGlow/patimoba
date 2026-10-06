"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { CartProvider } from "@/lib/cart-context"
import { useCustomerContext } from "@/lib/customer-context"
import { supabase } from "@/lib/supabase"
import { buildEcThemeVars } from "@/lib/ec-theme"
import { EcProvider } from "@/lib/ec-context"

const CART_SESSION_KEY = "patimoba_cart_session"

export default function EcLayout({ children }: { children: React.ReactNode }) {
  const { selectedStoreId } = useCustomerContext()
  const [themeVars, setThemeVars] = useState<CSSProperties>({})
  const [storeLogoUrl, setStoreLogoUrl] = useState<string | null>(null)

  // タブ/セッションが新しく始まった最初のアクセスで一度だけ、EC・テイクアウト
  // 両方のカートを掃除する。リッチメニューの通常リンク(LINEミニアプリ外)から
  // ECへ直接入った場合など、ログイン状態に関わらず前回セッションの残りカートが
  // 残らないようにする(テイクアウト側のlayout.tsxと同じ仕組み・同じキーを共有)
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
    if (!selectedStoreId) {
      setThemeVars({})
      setStoreLogoUrl(null)
      return
    }
    let cancelled = false
    supabase
      .from("stores")
      .select("ec_header_color, ec_button_color, ec_background_color, logo_url")
      .eq("id", selectedStoreId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setThemeVars(buildEcThemeVars(data))
        setStoreLogoUrl(data?.logo_url ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedStoreId])

  return (
    <CartProvider storageKey="patimoba_cart_ec_v1">
      <EcProvider value={{ storeLogoUrl }}>
        <div style={themeVars} className="min-h-screen bg-[var(--ec-bg,#ffffff)]">
          {children}
        </div>
      </EcProvider>
    </CartProvider>
  )
}
