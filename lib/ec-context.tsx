"use client"

import { createContext, useContext } from "react"

interface EcContextType {
  storeLogoUrl: string | null
}

const EcContext = createContext<EcContextType>({ storeLogoUrl: null })

export const EcProvider = EcContext.Provider

export function useEcContext() {
  return useContext(EcContext)
}
