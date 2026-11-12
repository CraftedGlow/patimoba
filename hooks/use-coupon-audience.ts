"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/auth-fetch"

export interface AudienceMember {
  id: string
  name: string
  lineName: string
  gender: string | null
}

/**
 * クーポン配信の母集団（この店舗のLIFFでログイン済み＝LINEユーザーIDが取得できている顧客）を返す。
 * 注文実績の有無は問わない。「注文実績がある人のみ」は orderedUserIds との組み合わせで別途絞り込む。
 * 通常のRLS（orders経由でしか users が見えない）では注文実績が無い客が見えないため、
 * サーバー側（service role + staff権限チェック）で取得する専用APIを使う。
 */
export function useCouponAudience(storeId?: string | null) {
  const [audience, setAudience] = useState<AudienceMember[]>([])
  const [orderedUserIds, setOrderedUserIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchAudience = useCallback(async () => {
    if (!storeId) {
      setAudience([])
      setOrderedUserIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)

    const [audienceRows, { data: orderRows }] = await Promise.all([
      authFetch(`/api/store/coupon-audience?storeId=${storeId}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      supabase.from("orders").select("customer_id").eq("store_id", storeId).not("customer_id", "is", null),
    ])

    setAudience(Array.isArray(audienceRows) ? audienceRows : [])
    setOrderedUserIds(new Set((orderRows ?? []).map((r: any) => r.customer_id as string)))
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchAudience()
  }, [fetchAudience])

  return { audience, orderedUserIds, loading, refetch: fetchAudience }
}
