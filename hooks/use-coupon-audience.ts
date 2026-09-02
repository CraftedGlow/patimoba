"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { resolveEffectiveLiffId } from "@/lib/store-liff"

export interface AudienceMember {
  id: string
  name: string
  lineName: string
  gender: string | null
}

/**
 * クーポン配信の母集団（この店舗のLIFFでログイン済み＝LINEユーザーIDが取得できている顧客）を返す。
 * 注文実績の有無は問わない。「注文実績がある人のみ」は orderedUserIds との組み合わせで別途絞り込む。
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

    const effectiveLiffId = await resolveEffectiveLiffId(storeId, supabase)

    const [{ data: userRows }, { data: orderRows }] = await Promise.all([
      effectiveLiffId
        ? supabase
            .from("users")
            .select("id, name, line_name, gender")
            .eq("liff_id", effectiveLiffId)
            .not("line_user_id", "is", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("orders").select("customer_id").eq("store_id", storeId).not("customer_id", "is", null),
    ])

    setAudience(
      (userRows ?? []).map((u: any) => ({
        id: u.id,
        name: u.name || u.line_name || "",
        lineName: u.line_name || "",
        gender: u.gender ?? null,
      }))
    )
    setOrderedUserIds(new Set((orderRows ?? []).map((r: any) => r.customer_id as string)))
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchAudience()
  }, [fetchAudience])

  return { audience, orderedUserIds, loading, refetch: fetchAudience }
}
