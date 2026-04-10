"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import type { Database } from "./database.types"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

export type UserType = "admin" | "store" | "customer"

interface AuthUser {
  id: number
  email: string
  userType: UserType
  firstName: string
  lastName: string
  storeId: number | null
  raw: UserRow
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string, expectedType?: UserType) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = "patimoba_auth_user"

function rowToAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.login_num || "",
    userType: (row.user_type as UserType) || "customer",
    firstName: row.first_name_kn || "",
    lastName: row.last_name_kn || "",
    storeId: row.store_id,
    raw: row,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setUser(parsed)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string, expectedType?: UserType): Promise<AuthUser> => {
    const { supabase } = await import("./supabase")

    let query = supabase
      .from("users")
      .select("*")
      .eq("login_num", email)
      .eq("password", password)

    if (expectedType) {
      query = query.eq("user_type", expectedType)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error("ログインに失敗しました")
    if (!data) throw new Error("メールアドレスまたはパスワードが正しくありません")

    const authUser = rowToAuthUser(data)
    setUser(authUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
    return authUser
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
