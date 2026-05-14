"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Customer, toUICustomer } from "@/lib/types"

interface UseCustomersOptions {
  storeId?: string
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)

    if (!options.storeId) {
      setCustomers([])
      setLoading(false)
      return
    }

    const { data: orderRows, error: orderErr } = await supabase
      .from("orders")
      .select("customer_id")
      .eq("store_id", options.storeId)
      .not("customer_id", "is", null)

    if (orderErr) {
      setError(orderErr.message)
      setLoading(false)
      return
    }

    const customerIds = Array.from(new Set((orderRows || []).map((r: any) => r.customer_id as string)))

    if (customerIds.length === 0) {
      setCustomers([])
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
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [options.storeId])

  return { customers, loading, error, refetch: fetchCustomers }
}
