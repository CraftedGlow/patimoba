"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { LineSpinner } from "@/components/ui/line-spinner";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabaseがhashからセッションを復元するのを待つ
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("パスワードは6文字以上で設定してください");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }

    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError("パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。");
      return;
    }

    setDone(true);
    setTimeout(() => router.replace("/login"), 2500);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <LineSpinner size={28} />
          <p className="mt-4 text-sm text-gray-500">確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 to-white flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-10">
          <Image
            src="/スクリーンショット_2026-04-09_14.49.59.png"
            alt="パティモバ"
            width={200}
            height={56}
            className="h-10 w-auto"
            priority
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg px-8 py-10">
          <h1 className="text-lg font-bold text-center text-gray-900 mb-6">
            新しいパスワードを設定
          </h1>

          {done ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
              <p className="text-sm font-bold text-gray-800 mb-1">パスワードを更新しました</p>
              <p className="text-xs text-gray-500">ログインページに移動します...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="新しいパスワード（6文字以上）"
                required
              />
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="パスワードを再入力"
                required
              />
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="w-full py-3 rounded-full border-2 border-amber-400 text-amber-500 font-bold text-sm hover:bg-amber-400 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {saving && <LineSpinner size={16} />}
                パスワードを更新する
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
