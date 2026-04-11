"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface BusinessDay {
  id: string
  date: string
  openTime: string | null
  closeTime: string | null
  isOpen: boolean
  storeId: string
}

export function useBusinessDays(storeId?: string) {
  const [businessDays, setBusinessDays] = useState<BusinessDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBusinessDays = useCallback(async () => {
    if (!storeId) {
      setBusinessDays([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("business_day_schedules")
      .select("*")
      .eq("store_id", storeId)
      .order("date", { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setBusinessDays(
        (data || []).map((row: any) => ({
          id: String(row.id),
          date: row.date,
          openTime: row.open_time,
          closeTime: row.close_time,
          isOpen: row.is_open ?? true,
          storeId: String(row.store_id),
        }))
      )
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchBusinessDays()
  }, [fetchBusinessDays])

  const addBusinessDay = async (day: Omit<BusinessDay, "id">) => {
    const { error: err } = await supabase.from("business_day_schedules").insert({
      date: day.date,
      open_time: day.openTime ?? "",
      close_time: day.closeTime ?? "",
      is_open: day.isOpen,
      store_id: day.storeId,
    })
    if (err) throw err
    await fetchBusinessDays()
  }

  const updateBusinessDay = async (id: string, updates: Partial<BusinessDay>) => {
    const payload: any = {}
    if (updates.date !== undefined) payload.date = updates.date
    if (updates.openTime !== undefined) payload.open_time = updates.openTime ?? ""
    if (updates.closeTime !== undefined) payload.close_time = updates.closeTime ?? ""
    if (updates.isOpen !== undefined) payload.is_open = updates.isOpen

    const { error: err } = await supabase
      .from("business_day_schedules")
      .update(payload)
      .eq("id", id)
    if (err) throw err
    await fetchBusinessDays()
  }

  const deleteBusinessDay = async (id: string) => {
    const { error: err } = await supabase
      .from("business_day_schedules")
      .delete()
      .eq("id", id)
    if (err) throw err
    await fetchBusinessDays()
  }

  /**
   * 指定月の日別オーバーライドを置換保存する。
   */
  const saveMonth = async (
    targetStoreId: string,
    year: number,
    month: number,
    entries: Array<{
      date: string
      isOpen: boolean
      openTime: string | null
      closeTime: string | null
    }>
  ) => {
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const nextMonth = new Date(year, month + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`

    const { error: delErr } = await supabase
      .from("business_day_schedules")
      .delete()
      .eq("store_id", targetStoreId)
      .gte("date", monthStart)
      .lt("date", monthEnd)
    if (delErr) throw delErr

    if (entries.length === 0) {
      await fetchBusinessDays()
      return
    }

    const rows = entries.map((entry) => ({
      store_id: targetStoreId,
      date: entry.date,
      open_time: entry.isOpen ? (entry.openTime ?? "") : "",
      close_time: entry.isOpen ? (entry.closeTime ?? "") : "",
      is_open: entry.isOpen,
    }))

    const { error: insErr } = await supabase.from("business_day_schedules").insert(rows)
    if (insErr) throw insErr

    await fetchBusinessDays()
  }

  return {
    businessDays,
    loading,
    error,
    refetch: fetchBusinessDays,
    addBusinessDay,
    updateBusinessDay,
    deleteBusinessDay,
    saveMonth,
  }
}
