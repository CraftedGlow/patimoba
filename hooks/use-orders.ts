"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Order, OrderStatus, toUIOrder } from "@/lib/types"

interface UseOrdersOptions {
  storeId?: string
  customerId?: string
  status?: OrderStatus | OrderStatus[]
  excludeStatus?: OrderStatus[]
  date?: string
  from?: string
  to?: string
  unpreparedOnly?: boolean
}

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from("orders")
      .select(`
        *,
        customers(id, line_name, last_name_kn, first_name_kn, phone, gender),
        order_items(id, name, quantity, unit_price, subtotal, product_id)
      `)
      .order("created_at", { ascending: false })

    if (options.storeId) {
      query = query.eq("store_id", options.storeId)
    }
    if (options.customerId) {
      query = query.eq("customer_id", options.customerId)
    }
    if (options.status) {
      if (Array.isArray(options.status)) {
        query = query.in("status", options.status)
      } else {
        query = query.eq("status", options.status)
      }
    }
    if (options.excludeStatus && options.excludeStatus.length > 0) {
      query = query.not("status", "in", `(${options.excludeStatus.join(",")})`)
    }
    if (options.unpreparedOnly) {
      query = query.or("is_prepared.is.null,is_prepared.eq.false")
    }
    if (options.from) query = query.gte("created_at", options.from)
    if (options.to) query = query.lte("created_at", options.to)

    if (options.date) {
      const start = new Date(options.date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(options.date)
      end.setHours(23, 59, 59, 999)
      query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString())
    }

    const { data, error: err } = await query
    if (err) {
      setError(err.message)
    } else {
      setOrders((data || []).map(toUIOrder))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [
    options.storeId,
    options.customerId,
    options.date,
    options.from,
    options.to,
    Array.isArray(options.status) ? options.status.join(",") : options.status,
    options.excludeStatus?.join(","),
    options.unpreparedOnly,
  ])

  return { orders, loading, error, refetch: fetchOrders }
}
