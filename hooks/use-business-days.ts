"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"

/** Postgres time 向けに HH:mm → HH:mm:ss（400 回避） */
function toPgTime(v: string | null | undefined): string | null {
  if (v == null || String(v).trim() === "") return null
  const t = String(v).trim()
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    const [h, m, s] = t.split(":")
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`
  }
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":")
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`
  }
  return t
}

export interface SpecialDate {
  id: string
  targetDate: string
  openTime: string | null
  closeTime: string | null
  isClosed: boolean
  /** 営業はしているがパティモバ経由の予約受付のみ停止する */
  reservationStopped: boolean
  reason: string | null
  /** カレンダー用の一言 */
  dailyNote: string | null
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
          reservationStopped: row.reservation_stopped ?? false,
          reason: row.reason,
          // daily_note 列が無い環境でも動くよう、一言は reason を主に使う（あれば daily_note も参照）
          dailyNote: (row.daily_note ?? row.reason) ?? null,
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
    const note = day.dailyNote ?? day.reason ?? null
    const { error: err } = await supabase.from("store_special_dates").insert({
      target_date: day.targetDate,
      open_time: toPgTime(day.openTime),
      close_time: toPgTime(day.closeTime),
      is_closed: day.isClosed,
      reservation_stopped: day.reservationStopped,
      // 一言は reason に保存（daily_note 未マイグレーションの DB でも 400 にならない）
      reason: note,
      store_id: day.storeId,
    })
    if (err) throw err
    await fetchSpecialDates()
  }

  const updateSpecialDate = async (id: string, updates: Partial<SpecialDate>) => {
    const payload: any = {}
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate
    if (updates.openTime !== undefined) payload.open_time = toPgTime(updates.openTime)
    if (updates.closeTime !== undefined) payload.close_time = toPgTime(updates.closeTime)
    if (updates.isClosed !== undefined) payload.is_closed = updates.isClosed
    if (updates.reservationStopped !== undefined) payload.reservation_stopped = updates.reservationStopped
    if (updates.reason !== undefined) payload.reason = updates.reason
    if (updates.dailyNote !== undefined) payload.reason = updates.dailyNote

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
      dailyNote?: string | null
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
      open_time: entry.isClosed ? null : toPgTime(entry.openTime),
      close_time: entry.isClosed ? null : toPgTime(entry.closeTime),
      is_closed: entry.isClosed,
      reason: entry.dailyNote ?? entry.reason ?? null,
    }))

    const { error: insErr } = await supabase.from("store_special_dates").insert(rows)
    if (insErr) throw insErr

    await fetchSpecialDates()
  }

  const businessDays = useMemo(
    () =>
      specialDates.map((sd) => ({
        id: sd.id,
        date: sd.targetDate,
        openTime: sd.openTime,
        closeTime: sd.closeTime,
        isOpen: !sd.isClosed,
        reservationStopped: sd.reservationStopped,
        storeId: sd.storeId,
        dailyNote: sd.dailyNote,
      })),
    [specialDates]
  )

  return {
    specialDates,
    // backwards compat alias
    businessDays,
    loading,
    error,
    refetch: fetchSpecialDates,
    addSpecialDate,
    addBusinessDay: async (day: {
      date: string
      openTime: string | null
      closeTime: string | null
      isOpen: boolean
      reservationStopped?: boolean
      storeId: string
      dailyNote?: string | null
    }) => {
      await addSpecialDate({
        targetDate: day.date,
        openTime: day.openTime,
        closeTime: day.closeTime,
        isClosed: !day.isOpen,
        reservationStopped: day.reservationStopped ?? false,
        reason: null,
        dailyNote: day.dailyNote ?? null,
        storeId: day.storeId,
      })
    },
    updateBusinessDay: async (id: string, updates: any) => {
      await updateSpecialDate(id, {
        targetDate: updates.date,
        openTime: updates.openTime,
        closeTime: updates.closeTime,
        isClosed: updates.isOpen !== undefined ? !updates.isOpen : undefined,
        reservationStopped: updates.reservationStopped,
        dailyNote: updates.dailyNote,
      })
    },
    deleteBusinessDay: deleteSpecialDate,
    updateSpecialDate,
    deleteSpecialDate,
    saveMonth,
  }
}
