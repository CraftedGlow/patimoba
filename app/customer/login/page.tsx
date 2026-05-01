"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";
import { PasswordInput } from "@/components/ui/password-input";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liffLoading, setLiffLoading] = useState(false);

  const loginWithLiff = useCallback(async (liff: any) => {
    const idToken = liff.getIDToken();
    if (!idToken) throw new Error("IDトークンを取得できませんでした");

    const res = await fetch("/api/line/liff-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "ログインに失敗しました");
    }

    const result = await res.json();

    if (result.action === "register") {
      sessionStorage.removeItem("liff_login_pending");
      router.push("/customer/line-register");
      return;
    }

    if (result.action === "signup") {
      sessionStorage.removeItem("liff_login_pending");
      sessionStorage.setItem("liff_signup_link_user_id", result.userId);
      router.push("/customer/signup");
      return;
    }

    const { user, otp } = result;

    if (otp) {
      const { supabase } = await import("@/lib/supabase");
      await supabase.auth.verifyOtp({
        email: otp.email,
        token: otp.token,
        type: "magiclink",
      });
    }

    const nameParts = (user.name || user.line_name || "").split(" ");
    const authUser = {
      id: user.id,
      email: user.email ?? "",
      userType: "customer" as const,
      firstName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
      lastName: nameParts[0] ?? "",
      storeId: null,
      raw: user,
    };

    sessionStorage.removeItem("liff_login_pending");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    router.push("/customer/takeout");
  }, [router]);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId || !sessionStorage.getItem("liff_login_pending")) return;

    setLiffLoading(true);
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (liff.isLoggedIn()) {
          await loginWithLiff(liff);
        } else {
          sessionStorage.removeItem("liff_login_pending");
          setLiffLoading(false);
        }
      } catch (err: any) {
        sessionStorage.removeItem("liff_login_pending");
        setError(err.message || "LINEログインに失敗しました");
        setLiffLoading(false);
      }
    })();
  }, [loginWithLiff]);

  const handleLineLogin = async () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setError("LIFFが設定されていません");
      return;
    }

    setLiffLoading(true);
    setError("");

    try {
      const liff = (await import("@line/liff")).default;
      await liff.init({ liffId });

      if (!liff.isLoggedIn()) {
        sessionStorage.setItem("liff_login_pending", "1");
        liff.login({ redirectUri: window.location.href });
        return;
      }

      await loginWithLiff(liff);
    } catch (err: any) {
      setError(err.message || "LINEログインに失敗しました");
      setLiffLoading(false);
    }
  };

  const handleEmailLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) return;

    setError("");
    setSubmitting(true);
    try {
      await login(email, password, "customer");
      router.push("/customer/takeout");
    } catch (err: any) {
      setError(err.message || "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen flex flex-col bg-white"
        >
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-4 sm:px-5 py-2.5 flex items-center"
          >
            <Link
              href="/"
              className="flex items-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Link>
          </motion.div>

          <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full max-w-sm flex flex-col items-center"
            >
              <Link href="/" className="flex items-center justify-center mb-8 sm:mb-10">
                <Image
                  src="/スクリーンショット_2026-04-09_14.49.59.png"
                  alt="パティモバ"
                  width={240}
                  height={68}
                  className="h-12 sm:h-14 w-auto"
                  priority
                />
              </Link>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="w-full text-center mb-8 sm:mb-10"
              >
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2">
                  ログイン
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  LINEまたはメールアドレスでログイン
                </p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                whileHover={{ scale: liffLoading ? 1 : 1.02, boxShadow: liffLoading ? "none" : "0 8px 25px rgba(6, 199, 85, 0.3)" }}
                whileTap={{ scale: liffLoading ? 1 : 0.97 }}
                onClick={handleLineLogin}
                disabled={liffLoading}
                className="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34d] text-white font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl transition-colors duration-200 shadow-lg shadow-green-200/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {liffLoading ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-5 h-5 sm:w-6 sm:h-6 fill-current"
                  >
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.271.173-.508.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                )}
                LINEでログイン
              </motion.button>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="mt-6 sm:mt-8 w-full flex flex-col items-center gap-4"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">または</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <form
                  onSubmit={handleEmailLogin}
                  className="w-full flex flex-col gap-3"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all"
                    placeholder="メールアドレスを入力"
                    autoComplete="email"
                    required
                  />
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all"
                    placeholder="パスワードを入力"
                    autoComplete="current-password"
                    required
                  />

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs sm:text-sm text-red-500 text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.97 }}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl transition-colors duration-200 shadow-lg shadow-amber-200/50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    メールアドレスでログイン
                  </motion.button>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                    <Link
                      href="/"
                      className="flex w-full items-center justify-center gap-2 border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl transition-colors duration-200 hover:bg-gray-50 hover:border-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                      戻る
                    </Link>
                  </motion.div>
                </form>

                <Link
                  href="/customer/signup"
                  className="text-xs sm:text-sm text-amber-500 hover:text-amber-600 underline underline-offset-2 font-medium transition-colors"
                >
                  アカウントをお持ちでない方は新規作成はこちら
                </Link>

                <Link
                  href="/login"
                  className="text-xs sm:text-sm text-gray-500 hover:text-amber-600 transition-colors"
                >
                  店舗・管理者の方はこちら
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                className="mt-10 sm:mt-12 text-[10px] sm:text-xs text-gray-400 text-center leading-relaxed"
              >
                ログインすることで、
                <br />
                <span className="underline underline-offset-2">利用規約</span>
                および
                <span className="underline underline-offset-2">プライバシーポリシー</span>
                に同意したものとみなします
              </motion.p>
            </motion.div>
          </div>
        </motion.div>
    </AnimatePresence>
  );
}
