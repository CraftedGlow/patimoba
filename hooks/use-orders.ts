"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Order, OrderStatus, toUIOrder } from "@/lib/types"

export type OrderChannel = "takeout" | "ec"

interface UseOrdersOptions {
  storeId?: string
  customerId?: string
  status?: OrderStatus | OrderStatus[]
  excludeStatus?: OrderStatus[]
  date?: string
  pickupDate?: string
  pickupDateFrom?: string
  pickupDateTo?: string
  from?: string
  to?: string
  orderType?: string
  channel?: OrderChannel
  fulfillmentStatus?: "pending" | "fulfilled"
  sortBy?: "pickup_date" | "created_at"
  sortAsc?: boolean
}

const TAKEOUT_ORDER_TYPES = ["takeout", "pickup", "delivery"]

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)

    const sortColumn = options.sortBy ?? "created_at"
    const sortAscending = options.sortAsc ?? false

    let query = supabase
      .from("orders")
      .select(`
        *,
        users:users!orders_customer_id_fkey(id, name, line_name, phone, email),
        order_items(id, product_name_snapshot, quantity, unit_price, subtotal, product_id, variant_name_snapshot, order_item_options(id))
      `)
      .order(sortColumn, { ascending: sortAscending })

    if (options.storeId) {
      query = query.eq("store_id", options.storeId)
    }
    if (options.customerId) {
      query = query.eq("customer_id", options.customerId)
    }
    if (options.status) {
      if (Array.isArray(options.status)) {
        query = query.in("order_status", options.status)
      } else {
        query = query.eq("order_status", options.status)
      }
    }
    if (options.excludeStatus && options.excludeStatus.length > 0) {
      query = query.not("order_status", "in", `(${options.excludeStatus.join(",")})`)
    }
    if (options.orderType) {
      query = query.eq("order_type", options.orderType)
    }
    if (options.channel === "ec") {
      query = query.eq("order_type", "ec")
    } else if (options.channel === "takeout") {
      query = query.in("order_type", TAKEOUT_ORDER_TYPES)
    }
    if (options.fulfillmentStatus) {
      query = query.eq("fulfillment_status", options.fulfillmentStatus)
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
    if (options.pickupDate) {
      query = query.eq("pickup_date", options.pickupDate)
    }
    if (options.pickupDateFrom) {
      query = query.gte("pickup_date", options.pickupDateFrom)
    }
    if (options.pickupDateTo) {
      query = query.lt("pickup_date", options.pickupDateTo)
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
    options.pickupDate,
    options.pickupDateFrom,
    options.pickupDateTo,
    options.from,
    options.to,
    Array.isArray(options.status) ? options.status.join(",") : options.status,
    options.excludeStatus?.join(","),
    options.orderType,
    options.channel,
    options.fulfillmentStatus,
    options.sortBy,
    options.sortAsc,
  ])

  return { orders, loading, error, refetch: fetchOrders }
}
