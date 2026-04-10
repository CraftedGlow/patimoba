"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Loader2, Check } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface Anniversary {
  id: string;
  label: string;
  month: string;
  day: string;
}

const years = Array.from({ length: 80 }, (_, i) => `${2010 - i}年`);
const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
const days = Array.from({ length: 31 }, (_, i) => `${i + 1}日`);

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

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

  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);

  const loadProfile = useCallback(async () => {
    if (user) {
      setUserId(user.id);
      setLastName(user.lastName || "");
      setFirstName(user.firstName || "");
      setEmail(user.email || "");
      setPhone(user.raw.phone_num || "");
      setGender(user.raw.gender || "女性");
      setZipCode(user.raw.zip_code || "");
      setAddress(user.raw.address || "");

      if (user.raw.birthday) {
        const bd = new Date(user.raw.birthday);
        setBirthYear(`${bd.getFullYear()}年`);
        setBirthMonth(`${bd.getMonth() + 1}月`);
        setBirthDay(`${bd.getDate()}日`);
      }

      setIsNew(false);
    } else {
      setIsNew(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const removeAnniversary = (id: string) => {
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
  };

  const addAnniversary = () => {
    setAnniversaries((prev) => [
      ...prev,
      { id: `${Date.now()}`, label: "", month: "1月", day: "1日" },
    ]);
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
      if (password.length < 4) {
        setError("パスワードは4文字以上で設定してください");
        return;
      }
      if (password !== confirmPassword) {
        setError("パスワードが一致しません");
        return;
      }
    }

    setSaving(true);
    try {
      const y = parseInt(birthYear) || 1990;
      const m = parseInt(birthMonth) || 1;
      const d = parseInt(birthDay) || 1;
      const birthday = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      const payload: Record<string, any> = {
        last_name_kn: lastName,
        first_name_kn: firstName || null,
        login_num: email,
        phone_num: phone || null,
        gender: gender,
        birthday: birthday,
        zip_code: zipCode || null,
        address: address || null,
        user_type: "customer",
      };

      if (password.trim()) {
        payload.password = password;
      }

      if (userId) {
        const { error: err } = await supabase
          .from("users")
          .update(payload)
          .eq("id", userId);
        if (err) throw err;
      } else {
        payload.created_date = new Date().toISOString();
        const { data: created, error: err } = await supabase
          .from("users")
          .insert(payload)
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
      setTimeout(() => setSaved(false), 2500);
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
        shopName="パティモバ"
        points={0}
        showCart={false}
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
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {days.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">郵便番号</label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="150-0001"
              className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs text-gray-500 mb-1">住所</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border-b border-gray-300 pb-2 text-sm focus:outline-none focus:border-amber-400"
            />
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
        </section>

        <section className="mb-6">
          <AnimatePresence>
            {anniversaries.map((ann) => (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="border border-gray-200 rounded-xl p-4 mb-3 relative"
              >
                <button
                  onClick={() => removeAnniversary(ann.id)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
                {ann.label ? (
                  <>
                    <p className="text-xs text-gray-500 mb-1">{ann.label}</p>
                    <p className="text-base font-medium">
                      {ann.month.replace("月", "")}月{ann.day.replace("日", "")}日
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="記念日名"
                      className="text-xs text-gray-500 mb-2 w-full focus:outline-none border-b border-gray-200 pb-1"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                        {months.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                        {days.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={addAnniversary}
            className="w-full border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-full text-sm flex items-center justify-center gap-1 hover:bg-amber-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            記念日を追加する
          </motion.button>
        </section>

        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            店舗へのひとこと（任意）
          </h2>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例：いちごアレルギーがあります"
            rows={4}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </section>
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
            {isNew ? "アカウントを登録しました" : "変更を保存しました"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
