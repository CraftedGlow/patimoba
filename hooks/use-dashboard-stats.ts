"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface DashboardStats {
  todaySales: number
  todayOrders: number
  monthlySales: number
}

// JST = UTC+9。日本固定アプリなので JST で日付境界を計算する
function getJSTBoundaries() {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000
  const now = Date.now()
  const jstNow = new Date(now + JST_OFFSET_MS)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth()
  const d = jstNow.getUTCDate()

  const todayStart = new Date(Date.UTC(y, m, d) - JST_OFFSET_MS).toISOString()
  const todayEnd   = new Date(Date.UTC(y, m, d + 1) - JST_OFFSET_MS).toISOString()
  const monthStart = new Date(Date.UTC(y, m, 1) - JST_OFFSET_MS).toISOString()
  const monthEnd   = new Date(Date.UTC(y, m + 1, 1) - JST_OFFSET_MS).toISOString()
  return { todayStart, todayEnd, monthStart, monthEnd }
}

export function useDashboardStats(storeId?: string | string[]) {
  const storeKey = Array.isArray(storeId) ? storeId.join(",") : storeId

  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    monthlySales: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    if (storeId === "" || (Array.isArray(storeId) && storeId.length === 0)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const ids = Array.isArray(storeId) ? storeId : storeId ? [storeId] : []
    const { todayStart, todayEnd, monthStart, monthEnd } = getJSTBoundaries()

    try {
      let todayQuery = supabase
        .from("orders")
        .select("total_amount")
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd)
      if (ids.length === 1) todayQuery = todayQuery.eq("store_id", ids[0])
      else if (ids.length > 1) todayQuery = todayQuery.in("store_id", ids)

      let monthQuery = supabase
        .from("orders")
        .select("total_amount")
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd)
        .not("order_status", "in", "(cancelled)")
      if (ids.length === 1) monthQuery = monthQuery.eq("store_id", ids[0])
      else if (ids.length > 1) monthQuery = monthQuery.in("store_id", ids)

      const [todayResult, monthResult] = await Promise.all([todayQuery, monthQuery])

      const todayOrders = todayResult.data || []
      const monthOrders = monthResult.data || []

      setStats({
        todaySales: todayOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
        todayOrders: todayOrders.length,
        monthlySales: monthOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
      })
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [storeKey])

  return { stats, loading, error, refetch: fetchStats }
}
