"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Trash2, LogOut, Plus, X, Camera } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
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
  const [lastNameKana, setLastNameKana] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<string>("女性");
  const [birthYear, setBirthYear] = useState("1990年");
  const [birthMonth, setBirthMonth] = useState("1月");
  const [birthDay, setBirthDay] = useState("1日");
  const [anniversaries, setAnniversaries] = useState<{ label: string; date: string }[]>([]);

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
    setAvatarUrl(data.avatar_url || null);
    if (data.name_kana) {
      const kanaParts = String(data.name_kana).split(/\s+/);
      setLastNameKana(kanaParts[0] || "");
      setFirstNameKana(kanaParts.slice(1).join(" ") || "");
    }
    if (Array.isArray(data.anniversaries)) {
      setAnniversaries(
        data.anniversaries
          .filter((a: any) => a && typeof a === "object")
          .map((a: any) => ({ label: String(a.label ?? ""), date: String(a.date ?? "") })),
      );
    }

    setIsNew(false);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("画像は 5MB 以下にしてください");
      return;
    }
    if (!userId) {
      setError("プロフィール保存後にアップロードできます");
      return;
    }
    setUploadingAvatar(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub?.publicUrl || null;
      setAvatarUrl(url);
      await supabase.from("users").update({ avatar_url: url }).eq("id", userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像のアップロードに失敗しました");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

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

      const cleanedAnniversaries = anniversaries
        .map((a) => ({ label: a.label.trim(), date: a.date.trim() }))
        .filter((a) => a.label && a.date);

      const fullNameKana = [lastNameKana, firstNameKana].filter(Boolean).join(" ");

      const payload = {
        name: fullName,
        name_kana: fullNameKana || null,
        email,
        phone: phone || null,
        avatar_url: avatarUrl,
        anniversaries: cleanedAnniversaries,
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
        avatarUrl={avatarUrl || undefined}
      />

      <div className="px-5 py-6 pb-12">
        <h1 className="text-lg font-bold text-gray-900 mb-6">
          お客様情報のご登録
        </h1>

        <div className="flex flex-col items-center mb-6">
          <div className="relative w-24 h-24">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-amber-300"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                <Camera className="w-7 h-7 text-gray-400" />
              </div>
            )}
            <label
              className={`absolute bottom-0 right-0 bg-amber-400 hover:bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow cursor-pointer ${
                uploadingAvatar ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {userId ? "タップで画像を変更（5MBまで）" : "先にアカウントを登録すると画像を設定できます"}
          </p>
        </div>

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
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isNew ? "パスワードを設定" : "変更する場合のみ入力"}
                className="w-full border-b border-gray-300 pb-2 pr-8 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                パスワード確認 {isNew && <span className="text-red-500">*</span>}
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full border-b border-gray-300 pb-2 pr-8 text-sm focus:outline-none focus:border-amber-400"
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

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">セイ（フリガナ）</label>
              <input
                type="text"
                value={lastNameKana}
                onChange={(e) => setLastNameKana(e.target.value)}
                placeholder="ヤマダ"
                className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">メイ（フリガナ）</label>
              <input
                type="text"
                value={firstNameKana}
                onChange={(e) => setFirstNameKana(e.target.value)}
                placeholder="ハナコ"
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
              maxLength={11}
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

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-gray-500">記念日</label>
              <button
                type="button"
                onClick={() =>
                  setAnniversaries((prev) => [...prev, { label: "", date: "" }])
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-600"
              >
                <Plus className="w-3.5 h-3.5" />
                追加
              </button>
            </div>
            {anniversaries.length === 0 && (
              <p className="text-xs text-gray-400 mb-1">
                結婚記念日・お子様の誕生日などを登録できます
              </p>
            )}
            <div className="space-y-2">
              {anniversaries.map((a, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={a.label}
                    onChange={(e) =>
                      setAnniversaries((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)),
                      )
                    }
                    placeholder="記念日の名称（例: 結婚記念日）"
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="date"
                    value={a.date}
                    onChange={(e) =>
                      setAnniversaries((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, date: e.target.value } : p)),
                      )
                    }
                    className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAnniversaries((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-2 text-gray-400 hover:text-red-500"
                    aria-label="削除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
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

          <div className="flex justify-center mt-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="border-2 border-gray-300 text-gray-600 font-bold py-2.5 px-8 rounded-full text-sm flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </motion.button>
          </div>

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
