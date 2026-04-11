"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { UIDeliveryAddress, toUIDeliveryAddress } from "@/lib/types"

export function useDeliveryAddresses(customerId?: string) {
  const [addresses, setAddresses] = useState<UIDeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAddresses = useCallback(async () => {
    if (!customerId) {
      setAddresses([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
    if (err) setError(err.message)
    else setAddresses((data || []).map(toUIDeliveryAddress))
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const addAddress = async (input: Omit<UIDeliveryAddress, "id" | "customerId">) => {
    if (!customerId) return { error: "ユーザー未ログイン", id: "" }
    const { data, error: err } = await supabase
      .from("shipping_addresses")
      .insert({
        customer_id: customerId,
        postal_code: input.postalCode || "",
        prefecture: input.prefecture || "",
        city: input.city || "",
        address: input.address || "",
        building: input.building || "",
        is_default: input.isDefault ?? false,
      })
      .select("id")
      .single()
    if (!err) await fetchAddresses()
    return { error: err?.message || null, id: data ? String(data.id) : "" }
  }

  const deleteAddress = async (id: string) => {
    const { error: err } = await supabase.from("shipping_addresses").delete().eq("id", id)
    if (!err) await fetchAddresses()
    return { error: err?.message || null }
  }

  return { addresses, loading, error, refetch: fetchAddresses, addAddress, deleteAddress }
}
