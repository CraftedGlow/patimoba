"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { createStore, uploadStoreLogo, saveClosedDays } from "@/lib/admin-api";
import { supabase } from "@/lib/supabase";

const daysOfWeek = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
];

const hours = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return [`${h}:00`, `${h}:30`];
}).flat();

const standardFeatures = ["予約・注文管理", "顧客管理", "売上レポート"];
const premiumFeatures = [
  "スタンダードの全機能",
  "記念日通知",
  "月次レポート（詳細版）",
  "カスタマイズケーキ機能",
  "焼き菓子EC機能",
  "配達機能",
  "優先サポート",
];

export default function AdminStoreNewPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [closedDays, setClosedDays] = useState<string[]>(["wed", "sun"]);
  const [selectedPlan, setSelectedPlan] = useState<"standard" | "premium">("premium");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTrade, setAgreeTrade] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleDay = (day: string) => {
    setClosedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const allAgreed = agreePrivacy && agreeTrade && agreeTerms;

  const handleSubmit = async () => {
    if (!allAgreed || saving) return;
    if (!storeName.trim()) {
      setError("店舗名は必須です");
      return;
    }
    if (!email.trim()) {
      setError("メールアドレスは必須です");
      return;
    }
    if (!password.trim()) {
      setError("パスワードは必須です");
      return;
    }
    if (password.length < 4) {
      setError("パスワードは4文字以上で設定してください");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let logoUrl: string = "";
      if (logoFile) {
        logoUrl = await uploadStoreLogo(logoFile);
      }

      const created = await createStore({
        name: storeName,
        email: email,
        phone: phone || "",
        postal_code: postalCode || "",
        prefecture: prefecture || "",
        city: city || "",
        address: address || "",
        open_time: openTime,
        close_time: closeTime,
        plan: selectedPlan,
        logo_url: logoUrl,
      });
      if (closedDays.length > 0) {
        await saveClosedDays(created.id, closedDays);
      }

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "認証ユーザーの作成に失敗しました");

      if (result.userId) {
        const { error: userErr } = await supabase.from("store_users").insert({
          auth_user_id: result.userId,
          store_id: created.id,
          email: email.trim().toLowerCase(),
          role: "owner",
        });
        if (userErr) throw userErr;
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
        router.push("/admin/stores");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="bg-[#FFF9C4] px-6 py-4 border-b border-yellow-200 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-yellow-200/60 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">店舗登録</h1>
          <p className="text-xs text-gray-600">新しい店舗を追加します</p>
        </div>
      </header>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Section title="アカウント情報">
          <Field label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@patisserie-example.jp"
              className="form-input"
            />
          </Field>
          <Field label="パスワード">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="店舗基本情報">
          <Field label="店舗名">
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="パティスリー・サクラ"
              className="form-input"
            />
          </Field>
          <Field label="電話番号">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03-1234-5678"
              className="form-input"
            />
          </Field>
          <Field label="郵便番号">
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="150-0001"
              className="form-input max-w-[200px]"
            />
          </Field>
          <Field label="都道府県">
            <input
              type="text"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              placeholder="東京都"
              className="form-input"
            />
          </Field>
          <Field label="市区町村">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="渋谷区神宮前"
              className="form-input"
            />
          </Field>
          <Field label="番地">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="1-2-3 サクラビル1F"
              className="form-input"
            />
          </Field>

          <Field label="店舗ロゴ">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              {logoPreview ? (
                <div className="relative border-2 border-amber-400 rounded-xl p-4 text-center cursor-pointer hover:border-amber-500 transition-colors">
                  <Image
                    src={logoPreview}
                    alt="プレビュー"
                    width={120}
                    height={120}
                    className="mx-auto rounded-lg object-cover"
                  />
                  <p className="text-xs text-amber-600 mt-2">クリックして変更</p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-gray-400 transition-colors">
                  <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ロゴをアップロード</p>
                  <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP対応</p>
                </div>
              )}
            </label>
          </Field>

          <Field label="営業時間">
            <div className="flex items-center gap-3">
              <select
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="form-select"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-gray-500 text-lg">~</span>
              <select
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="form-select"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="定休日">
            <div className="flex items-center gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = closedDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      isSelected
                        ? "bg-amber-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </Section>

        <Section title="ご利用プラン">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedPlan("standard")}
              className={`text-left border-2 rounded-xl p-5 transition-all ${
                selectedPlan === "standard"
                  ? "border-amber-500 bg-amber-50/40 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-bold text-base mb-1">スタンダード</p>
              <p className="text-xl font-bold mb-3">
                月額 10,000<span className="text-base">円</span>
              </p>
              <ul className="space-y-1.5">
                {standardFeatures.map((f) => (
                  <li key={f} className="text-xs text-gray-600">・{f}</li>
                ))}
              </ul>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlan("premium")}
              className={`text-left border-2 rounded-xl p-5 transition-all relative ${
                selectedPlan === "premium"
                  ? "border-amber-500 bg-amber-50/40 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                おすすめ
              </span>
              <p className="font-bold text-base mb-1 text-amber-700">プレミアム</p>
              <p className="text-xl font-bold mb-3">
                月額 15,000<span className="text-base">円</span>
              </p>
              <ul className="space-y-1.5">
                {premiumFeatures.map((f) => (
                  <li key={f} className="text-xs text-gray-600">・{f}</li>
                ))}
              </ul>
            </button>
          </div>
        </Section>

        <Section title="利用規約">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                <a href="#" className="text-blue-600 underline">プライバシーポリシー</a>に同意する
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTrade}
                onChange={(e) => setAgreeTrade(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                <a href="#" className="text-blue-600 underline">特定商取引法に基づく表記</a>を確認した
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                <a href="#" className="text-blue-600 underline">利用規約</a>に同意する
              </span>
            </label>
          </div>
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center pt-2 pb-8">
          <motion.button
            whileHover={allAgreed && !saving ? { scale: 1.02 } : {}}
            whileTap={allAgreed && !saving ? { scale: 0.97 } : {}}
            disabled={!allAgreed || saving}
            onClick={handleSubmit}
            className={`px-16 py-3.5 rounded-full font-bold text-base transition-all flex items-center gap-2 ${
              allAgreed && !saving
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "登録中..." : "店舗登録する"}
          </motion.button>
        </div>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl p-8"
              >
                <p className="text-lg font-bold text-center">店舗を登録しました</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      <div className="bg-[#FFF9C4] px-5 py-3 border-b border-yellow-200">
        <h2 className="font-bold text-sm text-gray-900">{title}</h2>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
