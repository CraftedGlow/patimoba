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

    if (options.storeId) {
      const { data, error: err } = await supabase
        .from("customer_store_relationships")
        .select("*, customers(*)")
        .eq("store_id", options.storeId)
        .order("last_visit", { ascending: false, nullsFirst: false })

      if (err) {
        setError(err.message)
      } else {
        const mapped = (data || [])
          .filter((row: any) => row.customers)
          .map((row: any) =>
            toUICustomer({
              ...row.customers,
              customer_store_relationships: [row],
            })
          )
        setCustomers(mapped)
      }
    } else {
      const { data, error: err } = await supabase
        .from("customers")
        .select("*, customer_store_relationships(*)")
        .order("created_at", { ascending: false })

      if (err) {
        setError(err.message)
      } else {
        setCustomers((data || []).map((row: any) => toUICustomer(row)))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [options.storeId])

  return { customers, loading, error, refetch: fetchCustomers }
}
