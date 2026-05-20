"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, X, User, PartyPopper } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import NextImage from "next/image";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";
import { completeLiffLogin } from "@/lib/liff-login";

const ANNIVERSARY_TYPES = [
  "誕生日",
  "結婚記念日",
  "子供の誕生日",
  "交際記念日",
  "入学・卒業記念日",
  "その他",
];

const LIFF_LOGIN_TIMESTAMP_KEY = "liff_login_timestamp";

const years = Array.from({ length: 80 }, (_, i) => 2010 - i);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

function parseBirthDate(dateStr: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) };
}

function formatBirthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CustomerProfilePage() {
  const { user, setUser } = useAuth();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId");

  const [loginDone, setLoginDone] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const liffStarted = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnniversaryModal, setShowAnniversaryModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastNameKana, setLastNameKana] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("回答しない");
  const [birthYear, setBirthYear] = useState<number>(1990);
  const [birthMonth, setBirthMonth] = useState<number>(1);
  const [birthDay, setBirthDay] = useState<number>(1);
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [anniversaries, setAnniversaries] = useState<{ label: string; date: string }[]>([
    { label: ANNIVERSARY_TYPES[0], date: "" },
  ]);

  // 常にLINEログインを実行
  useEffect(() => {
    if (liffStarted.current) return;
    liffStarted.current = true;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setLoginDone(true);
      return;
    }

    // 直前にroot pageでLIFFログイン済みなら再実行不要
    const ts = sessionStorage.getItem(LIFF_LOGIN_TIMESTAMP_KEY);
    if (ts && Date.now() - Number(ts) < 15000 && user) {
      setLoginDone(true);
      return;
    }

    ;(async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isInClient()) {
          if (user) { setLoginDone(true); return; }
          setLoginError("このページはLINEアプリからアクセスしてください");
          return;
        }

        // LINEクライアント内：常にフレッシュログイン
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
        setUser(null);

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const { authUser } = await completeLiffLogin(liff);
        setUser(authUser);
        sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
        setLoginDone(true);
      } catch (err: any) {
        console.error("[Profile] LIFF login error:", err);
        setLoginError(err?.message || "LINEログインに失敗しました");
      }
    })();
  }, []);

  // LINEログイン完了後にDBからプロフィールを取得
  useEffect(() => {
    if (!loginDone || !user) return;

    ;(async () => {
      setLoading(true);
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("users")
          .select("id, name, name_kana, phone, gender, birth_date, postal_code, address, anniversaries")
          .eq("id", user.id)
          .maybeSingle();

        if (data) {
          setUserId(data.id);
          const nameParts = (data.name || "").split(" ");
          setLastName(nameParts[0] || "");
          setFirstName(nameParts.slice(1).join(" ") || "");
          if (data.name_kana) {
            const kanaParts = String(data.name_kana).split(/\s+/);
            setLastNameKana(kanaParts[0] || "");
            setFirstNameKana(kanaParts.slice(1).join(" ") || "");
          }
          setPhone(data.phone || "");
          setGender(data.gender || "回答しない");
          const bd = parseBirthDate(data.birth_date);
          if (bd) {
            setBirthYear(bd.year);
            setBirthMonth(bd.month);
            setBirthDay(bd.day);
          }
          setPostalCode(data.postal_code || "");
          setAddress(data.address || "");
          if (Array.isArray(data.anniversaries) && data.anniversaries.length > 0) {
            setAnniversaries(
              data.anniversaries
                .filter((a: any) => a && typeof a === "object")
                .map((a: any) => ({ label: String(a.label ?? ""), date: String(a.date ?? "") }))
            );
          }
        } else {
          setUserId(user.id);
        }
      } catch (e) {
        console.error("[Profile] load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loginDone, user]);

  const handleSave = async () => {
    if (saving || !userId) return;
    setError(null);
    setSaving(true);

    try {
      const { supabase } = await import("@/lib/supabase");
      const fullName = [lastName, firstName].filter(Boolean).join(" ");
      const fullNameKana = [lastNameKana, firstNameKana].filter(Boolean).join(" ");
      const cleanedAnniversaries = anniversaries
        .map((a) => ({ label: a.label.trim(), date: a.date.trim() }))
        .filter((a) => a.label && a.date);

      const payload: Record<string, any> = {
        name: fullName || user?.raw?.line_name || "",
        name_kana: fullNameKana || null,
        phone: phone || null,
        gender,
        birth_date: formatBirthDate(birthYear, birthMonth, birthDay),
        postal_code: postalCode || null,
        address: address || null,
        anniversaries: cleanedAnniversaries,
      };

      const { error: err } = await supabase
        .from("users")
        .update(payload)
        .eq("id", userId);

      if (err) throw err;

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      if (cleanedAnniversaries.length > 0) {
        setShowAnniversaryModal(true);
        fetch("/api/line/send-anniversary-registered", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, storeId }),
        }).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // LINEログイン中
  if (!loginDone) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-[#FFF9C4] h-2.5 shrink-0" aria-hidden />
        <div className="flex-1 relative flex items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute top-10 left-0 right-0 flex justify-center"
          >
            <NextImage
              src="/パティモバ　ロゴ.png"
              alt="パティモバ"
              width={200}
              height={57}
              className="w-[200px] h-auto"
              priority
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-center"
          >
            {loginError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                <p className="text-sm font-bold text-red-700 mb-1">ログインエラー</p>
                <p className="text-xs text-red-600 break-all">{loginError}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <LineSpinner size={30} />
                <p className="text-2xl font-bold text-gray-900">LINEログイン中...</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LineSpinner size={30} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー（他の注文ページと同じ黄色ヘッダー） */}
      <motion.header
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-[#ffff9d] px-4 py-[11px] flex items-center justify-between sticky top-0 z-50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {user?.raw?.avatar_url ? (
            <img
              src={user.raw.avatar_url}
              alt="avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-white flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="font-bold text-gray-900 text-sm truncate">
            {user?.raw?.line_name || user?.lastName || "ゲスト"}
          </span>
        </div>
      </motion.header>

      <div className="px-5 py-6 pb-16">
        <h1 className="text-lg font-bold text-gray-900 mb-1">お客様情報の登録</h1>
        <p className="text-xs text-gray-500 mb-6">記念日やお客様情報を登録して、特別な日にぴったりなお知らせを受け取れます！</p>

        {/* お名前 */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 pb-1 border-b border-gray-100">お名前</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">姓</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="山田"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">名</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="花子"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">セイ（フリガナ）</label>
              <input
                type="text"
                value={lastNameKana}
                onChange={(e) => setLastNameKana(e.target.value)}
                placeholder="ヤマダ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">メイ（フリガナ）</label>
              <input
                type="text"
                value={firstNameKana}
                onChange={(e) => setFirstNameKana(e.target.value)}
                placeholder="ハナコ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
              />
            </div>
          </div>
        </section>

        {/* 連絡先 */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 pb-1 border-b border-gray-100">連絡先</h2>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">電話番号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">郵便番号</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="123-4567"
              maxLength={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">住所</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="大分県豊後大野市千歳町…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>
        </section>

        {/* 基本情報 */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 pb-1 border-b border-gray-100">基本情報</h2>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">性別</label>
            <div className="flex gap-2">
              {["男性", "女性", "回答しない"].map((g) => (
                <motion.button
                  key={g}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-full text-sm font-medium border-2 transition-colors ${
                    gender === g
                      ? "bg-amber-400 text-white border-amber-400"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {g}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">生年月日</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {days.map((d) => (
                  <option key={d} value={d}>{d}日</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 記念日 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">記念日登録</h2>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setAnniversaries((prev) => [...prev, { label: ANNIVERSARY_TYPES[0], date: "" }])}
              className="flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-600 px-2 py-1 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              記念日を追加
            </motion.button>
          </div>

          {anniversaries.length === 0 && (
            <p className="text-xs text-gray-400 mb-2">
              結婚記念日・お子様の誕生日などを登録すると、記念日に合わせたご提案をお届けします
            </p>
          )}

          <div className="space-y-3">
            {anniversaries.map((a, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 rounded-xl p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      type="date"
                      value={a.date}
                      onChange={(e) =>
                        setAnniversaries((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, date: e.target.value } : p))
                        )
                      }
                      className="w-full border border-amber-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <select
                      value={a.label}
                      onChange={(e) =>
                        setAnniversaries((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p))
                        )
                      }
                      className="w-full border border-amber-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      {ANNIVERSARY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnniversaries((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

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
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <LineSpinner size={16} /> : <Check className="w-4 h-4" />}
          保存する
        </motion.button>
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-4 right-4 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            保存しました
          </motion.div>
        )}
      </AnimatePresence>

      {/* 記念日登録完了モーダル */}
      <AnimatePresence>
        {showAnniversaryModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
              onClick={() => setShowAnniversaryModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-8 text-center"
            >
              <button
                onClick={() => setShowAnniversaryModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                  <PartyPopper className="w-7 h-7 text-amber-500" />
                </div>
              </div>
              <p className="text-base leading-relaxed text-gray-900 font-bold mb-2">
                登録ありがとうございます！
              </p>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                記念日に合わせた特別なご提案をLINEでお届けします✨
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAnniversaryModal(false)}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-base transition-colors"
              >
                閉じる
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
