"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useAuth } from "./auth-context"

interface StoreContextType {
  storeId: number
  setStoreId: (id: number) => void
  storeName: string
  setStoreName: (name: string) => void
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<number>(0)
  const [storeName, setStoreName] = useState<string>("")

  useEffect(() => {
    if (user?.storeId) {
      setStoreId(user.storeId)
    }
  }, [user])

  return (
    <StoreContext.Provider value={{ storeId, setStoreId, storeName, setStoreName }}>
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
