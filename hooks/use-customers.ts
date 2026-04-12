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

    let query = supabase
      .from("users")
      .select("*")
      .eq("user_type", "customer")
      .order("created_at", { ascending: false })

    const { data, error: err } = await query
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
