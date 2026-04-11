"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface DashboardStats {
  todaySales: number
  todayOrders: number
  monthlySales: number
}

export function useDashboardStats(storeId?: string) {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    monthlySales: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    try {
      let todayQuery = supabase
        .from("orders")
        .select("subtotal")
        .gte("created_at", todayStart)
      if (storeId) todayQuery = todayQuery.eq("store_id", storeId)

      let monthQuery = supabase
        .from("orders")
        .select("subtotal")
        .gte("created_at", monthStart)
      if (storeId) monthQuery = monthQuery.eq("store_id", storeId)

      const [todayResult, monthResult] = await Promise.all([todayQuery, monthQuery])

      const todayOrders = todayResult.data || []
      const monthOrders = monthResult.data || []

      setStats({
        todaySales: todayOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0),
        todayOrders: todayOrders.length,
        monthlySales: monthOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0),
      })
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [storeId])

  return { stats, loading, error, refetch: fetchStats }
}
