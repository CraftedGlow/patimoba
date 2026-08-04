"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Store, toUIStore } from "@/lib/types"
import { isDevOnlyStoreVisible } from "@/lib/store-visibility"

export function useStores() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStores = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from("stores")
      .select("*")
      .eq("is_active", true)
      .eq("is_master", false)
    if (err) {
      setError(err.message)
    } else {
      setStores((data || []).map(toUIStore).filter((s) => isDevOnlyStoreVisible(s.isDevOnly)))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStores()
  }, [])

  return { stores, loading, error, refetch: fetchStores }
}
