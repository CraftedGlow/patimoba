"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Image from "next/image"
import type { Database } from "@/lib/database.types"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

// auth-context.tsx と同じキー
const STORAGE_KEY = "patimoba_auth_user"

export function LineCallbackClient({ user }: { user: UserRow }) {
  const router = useRouter()

  useEffect(() => {
    const nameParts = (user.name || user.line_name || "").split(" ")
    const authUser = {
      id: user.id,
      email: user.email ?? "",
      userType: "customer" as const,
      firstName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
      lastName: nameParts[0] ?? "",
      storeId: null,
      raw: user,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))

    // セッションクッキーをクリア
    document.cookie = "line_session_uid=; path=/; max-age=0"

    router.push("/customer/takeout")
  }, [user, router])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col items-center gap-8"
      >
        <Image
          src="/スクリーンショット_2026-04-09_14.49.59.png"
          alt="パティモバ"
          width={280}
          height={80}
          className="h-14 w-auto"
          priority
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#06C755] border-t-transparent rounded-full animate-spin" />
          <p className="text-base font-bold text-gray-900">ログイン中...</p>
        </div>
      </motion.div>
    </div>
  )
}
