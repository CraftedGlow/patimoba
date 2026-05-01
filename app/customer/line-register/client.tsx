"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Loader2, Check } from "lucide-react"
import { PasswordInput } from "@/components/ui/password-input"
import type { Database } from "@/lib/database.types"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

const STORAGE_KEY = "patimoba_auth_user"

export function LineRegisterClient({
  lineName,
  avatarUrl,
}: {
  lineName: string
  avatarUrl: string | null
}) {
  const router = useRouter()

  const [name, setName] = useState(lineName)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)

    if (!name.trim()) {
      setError("お名前を入力してください")
      return
    }
    if (!email.trim()) {
      setError("メールアドレスを入力してください")
      return
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で設定してください")
      return
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/line/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const result = await res.json()

      if (!res.ok) {
        if (result.error === "email_already_used") {
          setError("このメールアドレスは既に登録されています")
        } else if (result.error === "session_expired") {
          setError("セッションが切れました。LINEログインをやり直してください")
        } else {
          setError("登録に失敗しました。もう一度お試しください")
        }
        return
      }

      const user: UserRow = result.user
      const nameParts = (user.name || "").split(" ")
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

      setSaved(true)
      setTimeout(() => {
        router.push("/customer/takeout")
      }, 900)
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-4 sm:px-5 py-2.5 flex items-center"
      >
        <Link
          href="/customer/login"
          className="flex items-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          ログイン
        </Link>
      </motion.div>

      <div className="flex-1 px-5 py-6 pb-12 max-w-xl w-full mx-auto">
        <Link href="/" className="flex items-center justify-center mb-6">
          <Image
            src="/スクリーンショット_2026-04-09_14.49.59.png"
            alt="パティモバ"
            width={200}
            height={56}
            className="h-10 w-auto"
            priority
          />
        </Link>

        {/* LINE連携バッジ */}
        <div className="flex flex-col items-center mb-6">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={lineName}
              className="w-16 h-16 rounded-full border-2 border-[#06C755] mb-3 object-cover"
            />
          )}
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4 fill-[#06C755]"
            >
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.271.173-.508.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            <span className="text-sm font-medium text-green-800">
              LINE連携済み：{lineName}
            </span>
          </div>
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-1 text-center">
          アカウント登録
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          LINEアカウントと紐づけるための情報を登録してください
        </p>

        <form onSubmit={handleSubmit}>
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">アカウント情報</h2>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 花子"
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@patimoba.com"
                autoComplete="email"
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  パスワード <span className="text-red-500">*</span>
                </label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                  autoComplete="new-password"
                  className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  パスワード確認 <span className="text-red-500">*</span>
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="もう一度入力"
                  autoComplete="new-password"
                  className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            </div>
          </section>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-red-500 mb-4 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            whileHover={{ scale: submitting ? 1 : 1.01 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            disabled={submitting}
            className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            登録して店舗を選ぶ
          </motion.button>

          <p className="text-center text-xs text-gray-400 mt-3">
            登録することで、利用規約およびプライバシーポリシーに同意したものとみなします
          </p>

          <p className="text-center text-xs text-gray-500 mt-6">
            既にアカウントをお持ちの方は{" "}
            <Link
              href="/customer/login"
              className="text-amber-500 hover:text-amber-600 underline underline-offset-2 font-medium"
            >
              ログイン
            </Link>
          </p>
        </form>
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            アカウントを登録しました
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
