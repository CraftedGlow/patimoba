"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useAuth } from "./auth-context"
import { supabase } from "./supabase"

export interface ChildStore {
  id: string
  name: string
}

interface StoreContextType {
  storeId: string
  setStoreId: (id: string) => void
  storeName: string
  setStoreName: (name: string) => void
  storeImage: string
  storeLogo: string
  setStoreLogo: (url: string) => void
  isMaster: boolean
  childStores: ChildStore[]
  refetchStore: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<string>("")
  const [storeName, setStoreName] = useState<string>("")
  const [storeImage, setStoreImage] = useState<string>("")
  const [storeLogo, setStoreLogo] = useState<string>("")
  const [isMaster, setIsMaster] = useState<boolean>(false)
  const [childStores, setChildStores] = useState<ChildStore[]>([])

  useEffect(() => {
    if (user?.storeId) {
      setStoreId(user.storeId)
    }
  }, [user])

  const fetchStore = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase
      .from("stores")
      .select("name, image, logo_url, is_master")
      .eq("id", storeId)
      .maybeSingle()
    if (data) {
      setStoreName(data.name || "")
      setStoreImage(data.image || "")
      setStoreLogo(data.logo_url || "")
      const master = !!(data as any).is_master
      setIsMaster(master)
      if (master) {
        const { data: children } = await supabase
          .from("stores")
          .select("id, name")
          .eq("parent_store_id", storeId)
          .eq("is_active", true)
          .order("name")
        setChildStores((children as ChildStore[]) || [])
      } else {
        setChildStores([])
      }
    }
  }, [storeId])

  useEffect(() => {
    fetchStore()
  }, [fetchStore])

  return (
    <StoreContext.Provider value={{ storeId, setStoreId, storeName, setStoreName, storeImage, storeLogo, setStoreLogo, isMaster, childStores, refetchStore: fetchStore }}>
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
