"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface CustomerContextType {
  userId: string | null
  setUserId: (id: string | null) => void
  selectedStoreId: string | null
  setSelectedStoreId: (id: string | null) => void
  selectedStoreName: string
  setSelectedStoreName: (name: string) => void
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [selectedStoreName, setSelectedStoreName] = useState<string>("")

  return (
    <CustomerContext.Provider
      value={{
        userId,
        setUserId,
        selectedStoreId,
        setSelectedStoreId,
        selectedStoreName,
        setSelectedStoreName,
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
