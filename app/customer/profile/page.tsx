"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Trash2, LogOut } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const years = Array.from({ length: 80 }, (_, i) => `${2010 - i}年`);
const monthLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
const dayLabels = Array.from({ length: 31 }, (_, i) => `${i + 1}日`);

export default function CustomerProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const loadProfile = useCallback(async () => {
    if (!user || user.userType !== "customer") {
      setIsNew(true);
      setLoading(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (err || !data) {
      setIsNew(true);
      setLoading(false);
      return;
    }

    setUserId(data.id);
    const nameParts = (data.name || "").split(" ");
    setLastName(nameParts[0] || "");
    setFirstName(nameParts.slice(1).join(" ") || "");
    setEmail(data.email || "");
    setPhone(data.phone || "");

    setIsNew(false);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleDelete = async () => {
    if (deleting || !userId) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("users")
        .delete()
        .eq("id", userId);
      if (err) throw err;
      logout();
      router.push("/customer/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError(null);

    if (!lastName.trim()) {
      setError("姓は必須です");
      return;
    }
    if (!email.trim()) {
      setError("メールアドレスは必須です");
      return;
    }

    if (isNew || password.trim()) {
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
    }

    setSaving(true);
    try {
      const fullName = [lastName, firstName].filter(Boolean).join(" ");

      const payload = {
        name: fullName,
        email,
        phone: phone || null,
      };

      if (userId) {
        const { error: err } = await supabase
          .from("users")
          .update(payload)
          .eq("id", userId);
        if (err) throw err;

        if (password.trim()) {
          const { error: pwErr } = await supabase.auth.updateUser({ password });
          if (pwErr) throw pwErr;
        }
      } else {
        const { data: authResp, error: authErr } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authErr) throw authErr;
        const authUserId = authResp.user?.id;
        if (!authUserId) throw new Error("認証ユーザーの作成に失敗しました");

        const { data: created, error: err } = await supabase
          .from("users")
          .insert({
            ...payload,
            auth_user_id: authUserId,
            user_type: "customer",
          })
          .select()
          .single();
        if (err) throw err;
        if (created) {
          setUserId(created.id);
          setIsNew(false);
        }
      }

      setPassword("");
      setConfirmPassword("");
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        router.push("/customer/takeout");
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={
          [lastName, firstName].filter(Boolean).join(" ") ||
          user?.lastName ||
          "ゲスト"
        }
      />

      <div className="px-5 py-6 pb-12">
        <h1 className="text-lg font-bold text-gray-900 mb-6">
          お客様情報のご登録
        </h1>

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
              className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                パスワード {isNew && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isNew ? "パスワードを設定" : "変更する場合のみ入力"}
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                パスワード確認 {isNew && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
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
            <label className="block text-xs text-gray-500 mb-1">電話番号</label>
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
            <label className="block text-xs text-gray-500 mb-2">生年月日</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {monthLabels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {dayLabels.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-red-500 mb-4"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isNew ? "登録する" : "変更を保存"}
          </motion.button>

          <p className="text-center text-xs text-gray-400 mt-3">
            入力内容はお店にのみ共有されます
          </p>

          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="w-full mt-4 border-2 border-gray-300 text-gray-600 font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </motion.button>

          {!isNew && userId && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full mt-4 border-2 border-red-300 text-red-500 font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-1 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              お客様情報を削除する
            </motion.button>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
              onClick={() => !deleting && setShowDeleteConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[30%] bg-white rounded-2xl shadow-2xl z-[70] p-6"
            >
              <h3 className="text-base font-bold text-center mb-2">
                お客様情報を削除しますか？
              </h3>
              <p className="text-xs text-gray-500 text-center mb-5">
                削除するとログアウトされ、元に戻せません。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 font-bold py-2.5 rounded-full text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-1 disabled:opacity-60"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  削除する
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            {isNew ? "アカウントを登録しました" : "変更を保存しました"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
