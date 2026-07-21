"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Image from "next/image"
import type { Database } from "@/lib/database.types"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

const STORAGE_KEY = "patimoba_auth_user"

export function LineCallbackClient({
  user,
  otp,
}: {
  user: UserRow
  otp: { email: string; token: string } | null
}) {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      if (otp) {
        const { supabase } = await import("@/lib/supabase")
        await supabase.auth.verifyOtp({
          email: otp.email,
          token: otp.token,
          type: "magiclink",
        })
      }

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
      document.cookie = "line_session_uid=; path=/; max-age=0"

      router.push("/customer/takeout")
    })()
  }, [user, otp, router])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col items-center gap-8"
      >
        <Image
          src="/パティモバ　ロゴ.png"
          alt="パティモバ"
          width={280}
          height={93}
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
