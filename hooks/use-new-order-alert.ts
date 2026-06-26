"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export function useNewOrderAlert(storeId: string | undefined, onNewOrder?: () => void) {
  const [showAlert, setShowAlert] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const acceptsWalkinRef = useRef(true)

  // 店舗の当日受付設定を取得
  useEffect(() => {
    if (!storeId) return
    supabase
      .from("stores")
      .select("accepts_walkin")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        acceptsWalkinRef.current = data?.accepts_walkin ?? true
      })
  }, [storeId])

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

  // Supabase Realtime で新規注文を検知
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`new-order-alert-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          // 当日注文かつ当日受付ありの店舗のみ通知
          const orderType: string | null = payload.new?.order_type ?? null
          if (orderType !== "sameday") return
          if (!acceptsWalkinRef.current) return

          if (!audioRef.current) {
            audioRef.current = new Audio("/sounds/order-notification.mp3")
            audioRef.current.loop = true
          }
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(() => {})

          setShowAlert(true)
          onNewOrder?.()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, onNewOrder])

  return { showAlert, dismiss }
}
