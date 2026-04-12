"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useAuth } from "./auth-context"

interface CustomerProfile {
  lineName: string
  avatar: string | null
}

interface CustomerContextType {
  userId: string | null
  setUserId: (id: string | null) => void
  profile: CustomerProfile | null
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
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [selectedStoreName, setSelectedStoreName] = useState<string>("")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [viewedStoreIds, setViewedStoreIds] = useState<string[]>([])

  useEffect(() => {
    setFavorites(loadSet(FAVORITES_KEY))
    setViewedStoreIds(loadArray(VIEWED_KEY))
  }, [])

  useEffect(() => {
    if (!user || user.userType !== "customer") {
      setProfile(null)
      setUserId(null)
      return
    }

    setUserId(user.id)

    const fetchProfile = async () => {
      const { supabase } = await import("./supabase")

      const { data: userRow } = await supabase
        .from("users")
        .select("name, line_name")
        .eq("id", user.id)
        .maybeSingle()

      setProfile({
        lineName: userRow?.line_name || userRow?.name || user.lastName || "ゲスト",
        avatar: null,
      })
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
        profile,
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
