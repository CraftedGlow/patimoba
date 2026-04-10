"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen flex flex-col">
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 px-5 py-2.5 flex items-center"
      >
        <Link
          href="/login"
          className="flex items-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 transition-colors"
        >
          ログイン
        </Link>
      </motion.div>

      <div className="flex-1 bg-gradient-to-b from-amber-50/40 to-white flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-lg flex flex-col items-center"
        >
          <Link href="/" className="flex items-center justify-center mb-12">
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
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all"
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
            onClick={(e) => handleLogin(e as any)}
            disabled={submitting}
            className="px-12 py-2.5 rounded-full border-2 border-amber-400 text-amber-500 font-bold text-sm hover:bg-amber-400 hover:text-white transition-all duration-200 mb-4 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            ログイン
          </motion.button>

          <button
            type="button"
            className="text-sm text-amber-500 hover:text-amber-600 underline underline-offset-2 transition-colors"
          >
            パスワードをお忘れの方
          </button>
        </motion.div>
      </div>
    </div>
  );
}
