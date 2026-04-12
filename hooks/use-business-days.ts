"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface SpecialDate {
  id: string
  targetDate: string
  openTime: string | null
  closeTime: string | null
  isClosed: boolean
  reason: string | null
  storeId: string
}

export function useBusinessDays(storeId?: string) {
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSpecialDates = useCallback(async () => {
    if (!storeId) {
      setSpecialDates([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from("store_special_dates")
      .select("*")
      .eq("store_id", storeId)
      .order("target_date", { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setSpecialDates(
        (data || []).map((row: any) => ({
          id: String(row.id),
          targetDate: row.target_date,
          openTime: row.open_time,
          closeTime: row.close_time,
          isClosed: row.is_closed ?? false,
          reason: row.reason,
          storeId: String(row.store_id),
        }))
      )
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchSpecialDates()
  }, [fetchSpecialDates])

  const addSpecialDate = async (day: Omit<SpecialDate, "id">) => {
    const { error: err } = await supabase.from("store_special_dates").insert({
      target_date: day.targetDate,
      open_time: day.openTime ?? null,
      close_time: day.closeTime ?? null,
      is_closed: day.isClosed,
      reason: day.reason ?? null,
      store_id: day.storeId,
    })
    if (err) throw err
    await fetchSpecialDates()
  }

  const updateSpecialDate = async (id: string, updates: Partial<SpecialDate>) => {
    const payload: any = {}
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate
    if (updates.openTime !== undefined) payload.open_time = updates.openTime ?? null
    if (updates.closeTime !== undefined) payload.close_time = updates.closeTime ?? null
    if (updates.isClosed !== undefined) payload.is_closed = updates.isClosed
    if (updates.reason !== undefined) payload.reason = updates.reason

    const { error: err } = await supabase
      .from("store_special_dates")
      .update(payload)
      .eq("id", id)
    if (err) throw err
    await fetchSpecialDates()
  }

  const deleteSpecialDate = async (id: string) => {
    const { error: err } = await supabase
      .from("store_special_dates")
      .delete()
      .eq("id", id)
    if (err) throw err
    await fetchSpecialDates()
  }

  const saveMonth = async (
    targetStoreId: string,
    year: number,
    month: number,
    entries: Array<{
      date: string
      isClosed: boolean
      openTime: string | null
      closeTime: string | null
      reason?: string | null
    }>
  ) => {
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const nextMonth = new Date(year, month + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`

    const { error: delErr } = await supabase
      .from("store_special_dates")
      .delete()
      .eq("store_id", targetStoreId)
      .gte("target_date", monthStart)
      .lt("target_date", monthEnd)
    if (delErr) throw delErr

    if (entries.length === 0) {
      await fetchSpecialDates()
      return
    }

    const rows = entries.map((entry) => ({
      store_id: targetStoreId,
      target_date: entry.date,
      open_time: entry.isClosed ? null : (entry.openTime ?? null),
      close_time: entry.isClosed ? null : (entry.closeTime ?? null),
      is_closed: entry.isClosed,
      reason: entry.reason ?? null,
    }))

    const { error: insErr } = await supabase.from("store_special_dates").insert(rows)
    if (insErr) throw insErr

    await fetchSpecialDates()
  }

  return {
    specialDates,
    // backwards compat alias
    businessDays: specialDates.map((sd) => ({
      id: sd.id,
      date: sd.targetDate,
      openTime: sd.openTime,
      closeTime: sd.closeTime,
      isOpen: !sd.isClosed,
      storeId: sd.storeId,
    })),
    loading,
    error,
    refetch: fetchSpecialDates,
    addSpecialDate,
    addBusinessDay: async (day: { date: string; openTime: string | null; closeTime: string | null; isOpen: boolean; storeId: string }) => {
      await addSpecialDate({
        targetDate: day.date,
        openTime: day.openTime,
        closeTime: day.closeTime,
        isClosed: !day.isOpen,
        reason: null,
        storeId: day.storeId,
      })
    },
    updateBusinessDay: async (id: string, updates: any) => {
      await updateSpecialDate(id, {
        targetDate: updates.date,
        openTime: updates.openTime,
        closeTime: updates.closeTime,
        isClosed: updates.isOpen !== undefined ? !updates.isOpen : undefined,
      })
    },
    deleteBusinessDay: deleteSpecialDate,
    updateSpecialDate,
    deleteSpecialDate,
    saveMonth,
  }
}
