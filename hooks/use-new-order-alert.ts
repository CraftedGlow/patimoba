"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { toLocalDateString } from "@/lib/date-utils"

const TAKEOUT_ORDER_TYPES = ["takeout", "pickup", "delivery"]

export function useNewOrderAlert(storeIds: string[], onNewOrder?: () => void) {
  const [showAlert, setShowAlert] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const acceptsWalkinMapRef = useRef<Record<string, boolean>>({})
  const idsKey = storeIds.join(",")

  // 各店舗の当日受付設定を取得
  useEffect(() => {
    if (storeIds.length === 0) return
    supabase
      .from("stores")
      .select("id, accepts_walkin")
      .in("id", storeIds)
      .then(({ data }) => {
        const map: Record<string, boolean> = {}
        for (const row of data ?? []) map[row.id] = (row as any).accepts_walkin ?? true
        acceptsWalkinMapRef.current = map
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const dismiss = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setShowAlert(false)
  }, [])

  // アラート中は画面の任意操作でも音声・モーダルを止める
  useEffect(() => {
    if (!showAlert) return
    const handler = () => dismiss()
    document.addEventListener("click", handler, { once: true })
    document.addEventListener("keydown", handler, { once: true })
    document.addEventListener("touchstart", handler, { once: true })
    return () => {
      document.removeEventListener("click", handler)
      document.removeEventListener("keydown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [showAlert, dismiss])

  // Supabase Realtime で新規注文を検知（マスターアカウントは子店舗分もまとめて監視）
  useEffect(() => {
    if (storeIds.length === 0) return

    const handleInsert = (storeId: string) => (payload: any) => {
      // 当日注文（受け取り日が今日のテイクアウト注文）かつ当日受付ありの店舗のみ通知
      const orderType: string | null = payload.new?.order_type ?? null
      const pickupDate: string | null = payload.new?.pickup_date ?? null
      if (!orderType || !TAKEOUT_ORDER_TYPES.includes(orderType)) return
      if (pickupDate !== toLocalDateString(new Date())) return
      if (acceptsWalkinMapRef.current[storeId] === false) return

      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/order-notification.mp3")
        audioRef.current.loop = true
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})

      setShowAlert(true)
      onNewOrder?.()
    }

    const channels = storeIds.map((id) =>
      supabase
        .channel(`new-order-alert-${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${id}` },
          handleInsert(id)
        )
        .subscribe()
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, onNewOrder])

  return { showAlert, dismiss }
}
