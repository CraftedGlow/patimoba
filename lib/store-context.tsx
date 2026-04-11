"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useAuth } from "./auth-context"
import { supabase } from "./supabase"

interface StoreContextType {
  storeId: string
  setStoreId: (id: string) => void
  storeName: string
  setStoreName: (name: string) => void
  storeImage: string
  storeLogo: string
  setStoreLogo: (url: string) => void
  refetchStore: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<string>("")
  const [storeName, setStoreName] = useState<string>("")
  const [storeImage, setStoreImage] = useState<string>("")
  const [storeLogo, setStoreLogo] = useState<string>("")

  useEffect(() => {
    if (user?.storeId) {
      setStoreId(user.storeId)
    }
  }, [user])

  const fetchStore = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase
      .from("stores")
      .select("name, image, logo_url")
      .eq("id", storeId)
      .maybeSingle()
    if (data) {
      setStoreName(data.name || "")
      setStoreImage(data.image || "")
      setStoreLogo(data.logo_url || "")
    }
  }, [storeId])

  useEffect(() => {
    fetchStore()
  }, [fetchStore])

  return (
    <StoreContext.Provider value={{ storeId, setStoreId, storeName, setStoreName, storeImage, storeLogo, setStoreLogo, refetchStore: fetchStore }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStoreContext() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error("useStoreContext must be used within a StoreProvider")
  }
  return context
}
