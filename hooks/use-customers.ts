"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Customer, toUICustomer } from "@/lib/types"

interface UseCustomersOptions {
  storeId?: string
  storeIds?: string[]
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerStoreMap, setCustomerStoreMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)

    if (!options.storeId && (!options.storeIds || options.storeIds.length === 0)) {
      setCustomers([])
      setCustomerStoreMap({})
      setLoading(false)
      return
    }

    let query = supabase
      .from("orders")
      .select("customer_id, store_id")
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })

    query = options.storeIds && options.storeIds.length > 0
      ? query.in("store_id", options.storeIds)
      : query.eq("store_id", options.storeId!)

    const { data: orderRows, error: orderErr } = await query

    if (orderErr) {
      setError(orderErr.message)
      setLoading(false)
      return
    }

    // 顧客ごとに最新の注文店舗を記録（LINE送信チャネルの解決に使用）
    const storeMap: Record<string, string> = {}
    for (const r of orderRows || []) {
      const row = r as any
      if (!storeMap[row.customer_id]) storeMap[row.customer_id] = row.store_id
    }
    const customerIds = Object.keys(storeMap)

    if (customerIds.length === 0) {
      setCustomers([])
      setCustomerStoreMap({})
      setLoading(false)
      return
    }

    const { data, error: err } = await supabase
      .from("users")
      .select("*")
      .in("id", customerIds)
      .order("created_at", { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setCustomers((data || []).map((row: any) => toUICustomer(row)))
      setCustomerStoreMap(storeMap)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [options.storeId, (options.storeIds || []).join(",")])

  return { customers, customerStoreMap, loading, error, refetch: fetchCustomers }
}
