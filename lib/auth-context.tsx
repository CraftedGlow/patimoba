"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import type { Database } from "./database.types"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

export type UserType = "admin" | "store" | "customer"

export interface AuthUser {
  id: string
  email: string
  userType: UserType
  firstName: string
  lastName: string
  storeId: string | null
  raw: UserRow
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string, expectedType?: UserType) => Promise<AuthUser>
  logout: () => void
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const STORAGE_KEY = "patimoba_auth_user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restore = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return

        const parsed = JSON.parse(stored)

        // Supabaseセッションが有効か確認する
        const { supabase } = await import("./supabase")
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          // セッション切れ → ローカル状態もクリア
          localStorage.removeItem(STORAGE_KEY)
          return
        }

        setUser(parsed)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    restore()
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

    // users テーブルから auth_user_id で検索
    const { data: userRow } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle()

    if (!userRow) {
      throw new Error("アカウントが見つかりません")
    }

    const userType = userRow.user_type as UserType
    if (expectedType && userType !== expectedType) {
      if (expectedType === "admin") throw new Error("管理者アカウントが見つかりません")
      if (expectedType === "store") throw new Error("店舗アカウントが見つかりません")
      throw new Error("アカウントが見つかりません")
    }

    // store スタッフの場合は store_users から store_id を取得
    let storeId: string | null = null
    if (userType === "store") {
      const { data: storeUser } = await supabase
        .from("store_users")
        .select("store_id")
        .eq("user_id", userRow.id)
        .eq("is_active", true)
        .maybeSingle()
      storeId = storeUser?.store_id ?? null
    }

    const nameParts = (userRow.name || "").split(" ")
    const authUser: AuthUser = {
      id: userRow.id,
      email: userRow.email || "",
      userType,
      firstName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
      lastName: nameParts[0] || "",
      storeId,
      raw: userRow,
    }
    setUser(authUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
    return authUser
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    import("./supabase").then(({ supabase }) => supabase.auth.signOut())
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
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
