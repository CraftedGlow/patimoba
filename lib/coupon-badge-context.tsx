"use client"

import { createContext, useContext, useMemo, useState, ReactNode } from "react"
import { useMyCoupons, type MyCoupon } from "@/hooks/use-my-coupons"
import { useOptionalCustomerContext } from "./customer-context"

interface CouponBadgeContextType {
  coupons: MyCoupon[]
  count: number
  loading: boolean
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
  refetch: () => void
}

const CouponBadgeContext = createContext<CouponBadgeContextType | undefined>(undefined)

/**
 * ヘッダーのクーポンバッジ／ドロワー用。今ログイン中の店舗（selectedStoreId）が
 * 発行した未使用クーポンだけを対象にする（他店舗のクーポンは表示・カウントしない）。
 */
export function CouponBadgeProvider({ children }: { children: ReactNode }) {
  const customer = useOptionalCustomerContext()
  const { coupons, loading, refetch } = useMyCoupons({
    userId: customer?.userId,
    storeId: customer?.selectedStoreId,
  })
  const [open, setOpen] = useState(false)

  // 保有していても期限切れのものはバッジ・ドロワーどちらからも除外する（開始日前のものは「持っている」ので含める）。
  // 期限が近いものほど上に表示し、無期限のものは一番後ろに回す。
  const activeCoupons = useMemo(() => {
    const now = new Date()
    return coupons
      .filter((c) => !c.expiresAt || now <= new Date(c.expiresAt))
      .sort((a, b) => {
        if (!a.expiresAt && !b.expiresAt) return 0
        if (!a.expiresAt) return 1
        if (!b.expiresAt) return -1
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
      })
  }, [coupons])

  return (
    <CouponBadgeContext.Provider
      value={{
        coupons: activeCoupons,
        count: activeCoupons.length,
        loading,
        open,
        openDrawer: () => setOpen(true),
        closeDrawer: () => setOpen(false),
        refetch,
      }}
    >
      {children}
    </CouponBadgeContext.Provider>
  )
}

export function useCouponBadge() {
  const context = useContext(CouponBadgeContext)
  if (!context) {
    throw new Error("useCouponBadge must be used within a CouponBadgeProvider")
  }
  return context
}

/** CouponBadgeProvider の外でも安全に呼べる版。ない場合は null。 */
export function useOptionalCouponBadge() {
  return useContext(CouponBadgeContext) ?? null
}
