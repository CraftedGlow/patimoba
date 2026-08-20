"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useAuth } from "./auth-context"

interface CustomerProfile {
  lineName: string
  avatar: string | null
  nameKana: string | null
}

interface CustomerContextType {
  userId: string | null
  setUserId: (id: string | null) => void
  setGuestUserId: (id: string | null) => void
  profile: CustomerProfile | null
  points: number
  refreshPoints: () => Promise<void>
  selectedStoreId: string | null
  setSelectedStoreId: (id: string | null) => void
  selectedStoreName: string
  setSelectedStoreName: (name: string) => void
  favorites: Set<string>
  toggleFavorite: (storeId: string) => void
  viewedStoreIds: string[]
  addViewedStore: (storeId: string) => void
}

const FAVORITES_KEY = "patimoba_favorites"
const VIEWED_KEY = "patimoba_viewed_stores"
const SELECTED_STORE_ID_KEY = "patimoba_selected_store_id"
const SELECTED_STORE_NAME_KEY = "patimoba_selected_store_name"
const GUEST_USER_ID_KEY = "patimoba_guest_user_id"

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* ignore */ }
  return new Set()
}

function loadArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [points, setPoints] = useState<number>(0)
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_STORE_ID_KEY) || null } catch { return null }
  })
  const [selectedStoreName, setSelectedStoreNameState] = useState<string>(() => {
    try { return localStorage.getItem(SELECTED_STORE_NAME_KEY) || "" } catch { return "" }
  })

  const setSelectedStoreId = (id: string | null) => {
    setSelectedStoreIdState(id)
    try {
      if (id) localStorage.setItem(SELECTED_STORE_ID_KEY, id)
      else localStorage.removeItem(SELECTED_STORE_ID_KEY)
    } catch { /* ignore */ }
  }

  const setSelectedStoreName = (name: string) => {
    setSelectedStoreNameState(name)
    try {
      if (name) localStorage.setItem(SELECTED_STORE_NAME_KEY, name)
      else localStorage.removeItem(SELECTED_STORE_NAME_KEY)
    } catch { /* ignore */ }
  }
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [viewedStoreIds, setViewedStoreIds] = useState<string[]>([])

  useEffect(() => {
    setFavorites(loadSet(FAVORITES_KEY))
    setViewedStoreIds(loadArray(VIEWED_KEY))
  }, [])

  // LINE未ログインのままEC決済まで進んだゲスト用に作成したユーザーIDを復元する
  const setGuestUserId = (id: string | null) => {
    setUserId(id)
    try {
      if (id) sessionStorage.setItem(GUEST_USER_ID_KEY, id)
      else sessionStorage.removeItem(GUEST_USER_ID_KEY)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!user || user.userType !== "customer") {
      setProfile(null)
      try {
        setUserId(sessionStorage.getItem(GUEST_USER_ID_KEY) || null)
      } catch {
        setUserId(null)
      }
      setPoints(0)
      return
    }

    setUserId(user.id)

    const fetchProfile = async () => {
      const { supabase } = await import("./supabase")

      const { data: userRow } = await supabase
        .from("users")
        .select("name, line_name, name_kana, avatar_url, points")
        .eq("id", user.id)
        .maybeSingle()

      setProfile({
        lineName: userRow?.line_name || user.raw?.line_name || "ゲスト",
        avatar: userRow?.avatar_url || null,
        nameKana: userRow?.name_kana || null,
      })
      setPoints(Number(userRow?.points) || 0)
    }

    fetchProfile()
  }, [user])

  const toggleFavorite = useCallback((storeId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(storeId)) {
        next.delete(storeId)
      } else {
        next.add(storeId)
      }
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }, [])

  const refreshPoints = useCallback(async () => {
    if (!user?.id) return
    const { supabase } = await import("./supabase")
    const { data } = await supabase.from("users").select("points").eq("id", user.id).maybeSingle()
    setPoints(Number(data?.points) || 0)
  }, [user])

  const addViewedStore = useCallback((storeId: string) => {
    setViewedStoreIds((prev) => {
      const filtered = prev.filter((id) => id !== storeId)
      const next = [storeId, ...filtered]
      localStorage.setItem(VIEWED_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <CustomerContext.Provider
      value={{
        userId,
        setUserId,
        setGuestUserId,
        profile,
        points,
        refreshPoints,
        selectedStoreId,
        setSelectedStoreId,
        selectedStoreName,
        setSelectedStoreName,
        favorites,
        toggleFavorite,
        viewedStoreIds,
        addViewedStore,
      }}
    >
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomerContext() {
  const context = useContext(CustomerContext)
  if (!context) {
    throw new Error("useCustomerContext must be used within a CustomerProvider")
  }
  return context
}

/** CustomerProvider の外（ルート直下の CartProvider など）でも安全に呼べる版。ない場合は null。 */
export function useOptionalCustomerContext() {
  return useContext(CustomerContext) ?? null
}
