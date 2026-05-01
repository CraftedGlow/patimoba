"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Store,
  ShieldCheck,
  Users,
  ChevronRight,
  ArrowLeft,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useAuth, type UserType, STORAGE_KEY } from "@/lib/auth-context";
import { PasswordInput } from "@/components/ui/password-input";

type Role = "store" | "admin" | "customer" | null;

const roles = [
  {
    id: "store" as const,
    label: "店舗ログイン",
    description: "店舗管理画面にアクセス",
    icon: Store,
    color:
      "bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-100/60",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    redirect: "/store/dashboard",
  },
  {
    id: "admin" as const,
    label: "管理者ログイン",
    description: "社内管理画面にアクセス",
    icon: ShieldCheck,
    color:
      "bg-sky-50 border-sky-200 hover:border-sky-400 hover:bg-sky-100/60",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    redirect: "/admin",
  },
  {
    id: "customer" as const,
    label: "顧客ログイン",
    description: "テイクアウト・EC注文",
    icon: Users,
    color:
      "bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/60",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    redirect: "/customer/takeout",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liffLoading, setLiffLoading] = useState(false);

  const currentRole = roles.find((r) => r.id === selectedRole);

  const loginWithLiff = useCallback(async (liff: any) => {
    const idToken = liff.getIDToken()
    if (!idToken) throw new Error("IDトークンを取得できませんでした")

    const res = await fetch("/api/line/liff-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || "ログインに失敗しました")
    }

    const result = await res.json()

    if (result.action === "register") {
      sessionStorage.removeItem("liff_login_pending")
      router.push("/customer/line-register")
      return
    }

    if (result.action === "signup") {
      sessionStorage.removeItem("liff_login_pending")
      sessionStorage.setItem("liff_signup_link_user_id", result.userId)
      router.push("/customer/signup")
      return
    }

    const { user, otp } = result

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

    sessionStorage.removeItem("liff_login_pending")
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
    router.push("/customer/takeout")
  }, [router])

  // LINEからのリダイレクト戻りを処理
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId || !sessionStorage.getItem("liff_login_pending")) return

    setLiffLoading(true)
    ;(async () => {
      try {
        const liff = (await import("@line/liff")).default
        await liff.init({ liffId })
        if (liff.isLoggedIn()) {
          await loginWithLiff(liff)
        } else {
          sessionStorage.removeItem("liff_login_pending")
          setLiffLoading(false)
        }
      } catch (err: any) {
        sessionStorage.removeItem("liff_login_pending")
        setError(err.message || "LINEログインに失敗しました")
        setLiffLoading(false)
      }
    })()
  }, [loginWithLiff])

  const handleCustomerLogin = async () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setError("LIFFが設定されていません")
      return
    }

    setLiffLoading(true)
    setError("")

    try {
      const liff = (await import("@line/liff")).default
      await liff.init({ liffId })

      if (!liff.isLoggedIn()) {
        sessionStorage.setItem("liff_login_pending", "1")
        liff.login({ redirectUri: window.location.href })
        return
      }

      await loginWithLiff(liff)
    } catch (err: any) {
      setError(err.message || "LINEログインに失敗しました")
      setLiffLoading(false)
    }
  }

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentRole || !email || !password) return;

    setError("");
    setSubmitting(true);
    try {
      await login(email, password, selectedRole as UserType);
      router.push(currentRole.redirect);
    } catch (err: any) {
      setError(err.message || "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const resetToRoleSelect = () => {
    setSelectedRole(null);
    setEmail("");
    setPassword("");
    setError("");
  };

  return (
    <AnimatePresence mode="wait">
      {!selectedRole ? (
        <motion.div
          key="role-select"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-gradient-to-b from-amber-50/60 to-white flex flex-col items-center justify-center px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Link
              href="/"
              className="flex items-center justify-center mb-10"
            >
              <Image
                src="/スクリーンショット_2026-04-09_14.49.59.png"
                alt="パティモバ"
                width={200}
                height={56}
                className="h-10 w-auto"
                priority
              />
            </Link>

            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/60 p-6">
              <h2 className="text-lg font-bold text-center text-gray-900 mb-2">
                ログイン
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                アカウントの種類を選択してください
              </p>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-red-500 text-center mb-4"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {roles.map((role, i) => (
                  <motion.button
                    key={role.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                    onClick={() => {
                      if (role.id === "customer") {
                        handleCustomerLogin()
                        return
                      }
                      setSelectedRole(role.id)
                      setError("")
                    }}
                    disabled={liffLoading}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${role.color} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center ${role.iconBg}`}
                    >
                      <role.icon className={`w-5 h-5 ${role.iconColor}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-gray-900 text-sm">
                        {role.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {role.description}
                      </div>
                    </div>
                    {role.id === "customer" ? (
                      liffLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#06C755]" />
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-[#06C755] font-medium">
                          <MessageCircle className="w-3.5 h-3.5" />
                          LINE
                        </span>
                      )
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              <Link
                href="/"
                className="hover:text-amber-600 transition-colors"
              >
                トップページに戻る
              </Link>
            </p>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="login-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen flex flex-col"
        >
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-5 py-2.5 flex items-center"
          >
            <button
              type="button"
              onClick={resetToRoleSelect}
              className="flex items-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              ログイン
            </button>
          </motion.div>

          <div className="flex-1 bg-gradient-to-b from-amber-50/40 to-white flex flex-col items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full max-w-lg flex flex-col items-center"
            >
              <Link
                href="/"
                className="flex items-center justify-center mb-12"
              >
                <Image
                  src="/スクリーンショット_2026-04-09_14.49.59.png"
                  alt="パティモバ"
                  width={240}
                  height={68}
                  className="h-14 w-auto"
                  priority
                />
              </Link>

              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="w-full max-w-md bg-gray-50/80 rounded-2xl px-10 py-10 mb-8"
              >
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all"
                      placeholder="メールアドレスを入力"
                      required
                    />
                  </div>

                  <div>
                    <PasswordInput
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all"
                      placeholder="パスワードを入力"
                      required
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-sm text-red-500 text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </form>
              </motion.div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleLogin()}
                disabled={submitting}
                className="px-12 py-2.5 rounded-full border-2 border-amber-400 text-amber-500 font-bold text-sm hover:bg-amber-400 hover:text-white transition-all duration-200 mb-3 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                ログイン
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetToRoleSelect}
                className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </motion.button>

              <button
                type="button"
                className="text-sm text-amber-500 hover:text-amber-600 underline underline-offset-2 transition-colors"
              >
                パスワードをお忘れの方
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
