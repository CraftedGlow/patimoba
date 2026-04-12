"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const years = Array.from({ length: 80 }, (_, i) => `${2010 - i}年`);
const monthLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
const dayLabels = Array.from({ length: 31 }, (_, i) => `${i + 1}日`);

export default function CustomerSignupPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<string>("女性");
  const [birthYear, setBirthYear] = useState("1990年");
  const [birthMonth, setBirthMonth] = useState("1月");
  const [birthDay, setBirthDay] = useState("1日");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setError(null);

    if (!lastName.trim()) {
      setError("姓は必須です");
      return;
    }
    if (!email.trim()) {
      setError("メールアドレスは必須です");
      return;
    }
    if (!password.trim()) {
      setError("パスワードを設定してください");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で設定してください");
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "認証ユーザーの作成に失敗しました");
      }
      const authUserId = result.userId;
      if (!authUserId) {
        throw new Error("認証ユーザーの作成に失敗しました");
      }

      const fullName = [lastName, firstName].filter(Boolean).join(" ");

      const payload = {
        auth_user_id: authUserId,
        name: fullName,
        email: cleanEmail,
        phone: phone || null,
        user_type: "customer",
      };

      const { error: insertErr } = await supabase
        .from("users")
        .insert(payload);
      if (insertErr) throw insertErr;

      try {
        await login(cleanEmail, password, "customer");
      } catch {
        /* ログイン失敗時は手動ログインへ */
        router.push("/customer/login");
        return;
      }

      setSaved(true);
      setTimeout(() => {
        router.push("/customer/takeout");
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

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

        <h1 className="text-lg font-bold text-gray-900 mb-1 text-center">
          新規アカウント登録
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          下記情報を入力してアカウントを作成してください
        </p>

        <form onSubmit={handleSubmit}>
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">
              アカウント情報
            </h2>

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
                <input
                  type="password"
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
                <input
                  type="password"
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

          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">
              お名前・連絡先
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  姓 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="山田"
                  className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">名</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="花子"
                  className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">
                電話番号
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="090-1234-5678"
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-3">性別</label>
              <div className="flex gap-2">
                {["男性", "女性", "回答しない"].map((g) => (
                  <motion.button
                    type="button"
                    key={g}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setGender(g)}
                    className={`flex-1 py-2.5 rounded-full text-sm font-medium border-2 transition-colors ${
                      gender === g
                        ? "bg-amber-400 text-white border-amber-400"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    {g}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-2">
                生年月日
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {monthLabels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {dayLabels.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">
                郵便番号
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="150-0001"
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">住所</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="東京都渋谷区..."
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">
              店舗へのひとこと（任意）
            </h2>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例：いちごアレルギーがあります"
              rows={3}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
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
            登録する
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
  );
}
