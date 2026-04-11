"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import type { Database } from "./database.types"

type AdminUserRow = Database["public"]["Tables"]["admin_users"]["Row"]
type StoreUserRow = Database["public"]["Tables"]["store_users"]["Row"]
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]

export type UserType = "admin" | "store" | "customer"

interface AuthUser {
  id: string
  email: string
  userType: UserType
  firstName: string
  lastName: string
  storeId: string | null
  raw: AdminUserRow | StoreUserRow | CustomerRow
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string, expectedType?: UserType) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = "patimoba_auth_user"

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

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError || !authData.user) {
      throw new Error("メールアドレスまたはパスワードが正しくありません")
    }

    const authUserId = authData.user.id

    if (!expectedType || expectedType === "admin") {
      const { data: admin } = await supabase
        .from("admin_users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle()
      if (admin) {
        const authUser: AuthUser = {
          id: admin.id,
          email: admin.email,
          userType: "admin",
          firstName: "",
          lastName: admin.name,
          storeId: null,
          raw: admin,
        }
        setUser(authUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
        return authUser
      }
      if (expectedType === "admin") {
        throw new Error("管理者アカウントが見つかりません")
      }
    }

    if (!expectedType || expectedType === "store") {
      const { data: storeUser } = await supabase
        .from("store_users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle()
      if (storeUser) {
        const authUser: AuthUser = {
          id: storeUser.id,
          email: storeUser.email,
          userType: "store",
          firstName: "",
          lastName: "",
          storeId: storeUser.store_id,
          raw: storeUser,
        }
        setUser(authUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
        return authUser
      }
      if (expectedType === "store") {
        throw new Error("店舗アカウントが見つかりません")
      }
    }

    if (!expectedType || expectedType === "customer") {
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle()
      if (customer) {
        const authUser: AuthUser = {
          id: customer.id,
          email: customer.email || "",
          userType: "customer",
          firstName: customer.first_name_kn || "",
          lastName: customer.last_name_kn || "",
          storeId: null,
          raw: customer,
        }
        setUser(authUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
        return authUser
      }
    }

    throw new Error("アカウントが見つかりません")
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    import("./supabase").then(({ supabase }) => supabase.auth.signOut())
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
