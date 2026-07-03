"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import Image from "next/image";
import {
  createStore,
  uploadStoreLogo,
  uploadStoreImage,
  saveClosedDayRules,
  fetchMasterStores,
  type ClosedDayRule,
  type Store,
} from "@/lib/admin-api";
import { supabase } from "@/lib/supabase";
import type { StorePlanSlug } from "@/lib/store-plans";
import { StorePlanPicker } from "@/components/admin/store-plan-picker";

const RULE_OPTIONS = [
  { value: "", label: "なし" },
  { value: "毎週", label: "毎週" },
  { value: "第1", label: "第1" },
  { value: "第2", label: "第2" },
  { value: "第3", label: "第3" },
  { value: "第4", label: "第4" },
  { value: "第1.3", label: "第1・3" },
  { value: "第1.4", label: "第1・4" },
  { value: "第2.4", label: "第2・4" },
];

const DAYS_OF_WEEK = [
  { dow: 0, label: "日" },
  { dow: 1, label: "月" },
  { dow: 2, label: "火" },
  { dow: 3, label: "水" },
  { dow: 4, label: "木" },
  { dow: 5, label: "金" },
  { dow: 6, label: "土" },
];

const hours = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return [`${h}:00`, `${h}:30`];
}).flat();

export default function AdminStoreNewPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"regular" | "master">("regular");
  const [masterStores, setMasterStores] = useState<Store[]>([]);
  const [parentStoreId, setParentStoreId] = useState<string>("");
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
  const [closedDayRules, setClosedDayRules] = useState<ClosedDayRule[]>([]);
  const [acceptsWalkin, setAcceptsWalkin] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<StorePlanSlug>("light");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isMaster = accountType === "master";

  useEffect(() => {
    fetchMasterStores().then(setMasterStores).catch(console.error);
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const getRuleForDay = (dow: number) =>
    closedDayRules.find((r) => r.dayOfWeek === dow)?.rule ?? "";

  const setRuleForDay = (dow: number, label: string, rule: string) => {
    setClosedDayRules((prev) => {
      const filtered = prev.filter((r) => r.dayOfWeek !== dow);
      if (!rule) return filtered;
      return [...filtered, { dayOfWeek: dow, day: label, rule }];
    });
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!storeName.trim()) { setError("店舗名は必須です"); return; }
    if (!email.trim()) { setError("メールアドレスは必須です"); return; }
    if (!password.trim()) { setError("パスワードは必須です"); return; }
    if (password.length < 4) { setError("パスワードは4文字以上で設定してください"); return; }

    setSaving(true);
    setError(null);
    try {
      let logoUrl = "";
      if (logoFile) logoUrl = await uploadStoreLogo(logoFile);

      const created = await createStore({
        name: storeName,
        email: email,
        phone: phone || "",
        postal_code: isMaster ? "" : postalCode || "",
        address: isMaster ? "" : `${prefecture || ""}${city || ""}${address || ""}`,
        logo_url: logoUrl,
        plan: selectedPlan,
        plan_options: selectedAddons.length > 0 ? selectedAddons : null,
        accepts_walkin: acceptsWalkin,
        is_master: isMaster,
        parent_store_id: !isMaster && parentStoreId ? parentStoreId : null,
      });

      if (imageFile) {
        const imageUrl = await uploadStoreImage(imageFile, created.id);
        await supabase.from("stores").update({ image: imageUrl }).eq("id", created.id);
      }
      if (closedDayRules.length > 0) {
        await saveClosedDayRules(created.id, closedDayRules);
      }

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "認証ユーザーの作成に失敗しました");

      if (result.userId) {
        const { data: userRow, error: userInsertErr } = await supabase
          .from("users")
          .insert({
            auth_user_id: result.userId,
            email: email.trim().toLowerCase(),
            name: storeName,
            user_type: "store",
          })
          .select("id")
          .single();
        if (userInsertErr) throw userInsertErr;
        const { error: userErr } = await supabase.from("store_users").insert({
          user_id: userRow.id,
          store_id: created.id,
          permission: "owner",
          is_active: true,
          joined_at: new Date().toISOString(),
        });
        if (userErr) throw userErr;
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
        router.push("/admin/stores");
      }, 1500);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      setError(msg || "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="bg-[#FFF9C4] px-4 sm:px-6 py-4 border-b border-yellow-200 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-yellow-200/60 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900">店舗登録</h1>
          <p className="text-xs text-gray-600">新しい店舗を追加します</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="bg-[#FFF9C4] px-5 py-3 border-b border-yellow-200">
            <h2 className="font-bold text-sm text-gray-900">アカウント種別</h2>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAccountType("regular")}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  !isMaster
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                通常店舗
              </button>
              <button
                type="button"
                onClick={() => setAccountType("master")}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  isMaster
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                マスタアカウント
              </button>
            </div>
            {isMaster && (
              <p className="text-xs text-gray-500 mt-2">
                顧客からは表示されない管理用アカウントです。配下に子店舗を紐付けられます。
              </p>
            )}
            {!isMaster && masterStores.length > 0 && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  親店舗（任意）
                </label>
                <select
                  value={parentStoreId}
                  onChange={(e) => setParentStoreId(e.target.value)}
                  className="form-select w-full"
                >
                  <option value="">なし（独立店舗）</option>
                  {masterStores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </motion.div>

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
          {!isMaster && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="郵便番号">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="150-0001"
                    className="form-input"
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
              </div>
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
            </>
          )}

          {!isMaster && (
            <>
              <Field label="店舗ロゴ">
                <label className="block">
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
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
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
                      <Upload className="w-7 h-7 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">ロゴをアップロード</p>
                      <p className="text-xs text-gray-600 mt-1">JPEG, PNG, WebP対応</p>
                    </div>
                  )}
                </label>
              </Field>
              <Field label="店舗外観写真">
                <p className="text-xs text-gray-600 mb-2">顧客向けTOPページに表示される外観・店内写真</p>
                <label className="block">
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {imagePreview ? (
                    <div className="relative border-2 border-amber-400 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500 transition-colors">
                      <img src={imagePreview} alt="外観プレビュー" className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full">クリックして変更</p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
                      <Upload className="w-7 h-7 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">外観写真をアップロード</p>
                      <p className="text-xs text-gray-600 mt-1">横長の写真推奨（JPEG, PNG, WebP）</p>
                    </div>
                  )}
                </label>
              </Field>
            </>
          )}

          <Field label="営業時間">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="form-select"
              >
                {hours.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-gray-500">〜</span>
              <select
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="form-select"
              >
                {hours.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </Field>

          <Field label="受付タイプ">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAcceptsWalkin(true)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  acceptsWalkin
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                当日受付あり
              </button>
              <button
                type="button"
                onClick={() => setAcceptsWalkin(false)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  !acceptsWalkin
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                予約のみ
              </button>
            </div>
          </Field>

          <Field label="定休日">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const rule = getRuleForDay(day.dow);
                const isSat = day.dow === 6;
                const isSun = day.dow === 0;
                return (
                  <div key={day.dow} className="flex flex-col items-center gap-1">
                    <span
                      className={`text-xs font-bold ${
                        rule
                          ? "text-amber-600"
                          : isSun
                          ? "text-red-500"
                          : isSat
                          ? "text-blue-500"
                          : "text-gray-600"
                      }`}
                    >
                      {day.label}
                    </span>
                    <select
                      value={rule}
                      onChange={(e) => setRuleForDay(day.dow, day.label, e.target.value)}
                      className={`w-full text-[10px] sm:text-xs border rounded-lg px-0.5 py-1.5 text-center appearance-none focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                        rule
                          ? "border-amber-400 bg-amber-50 text-amber-800 font-bold"
                          : "border-gray-200 text-gray-500"
                      }`}
                    >
                      {RULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {closedDayRules.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">
                定休: {closedDayRules.map((r) => `${r.day}（${r.rule}）`).join(" ・ ")}
              </p>
            )}
          </Field>
        </Section>

        <Section title="ご利用プラン">
          <StorePlanPicker
            value={selectedPlan}
            onChange={setSelectedPlan}
            selectedAddons={selectedAddons}
            onAddonsChange={setSelectedAddons}
          />
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center pt-2 pb-8">
          <motion.button
            whileHover={!saving ? { scale: 1.02 } : {}}
            whileTap={!saving ? { scale: 0.97 } : {}}
            disabled={saving}
            onClick={handleSubmit}
            className={`px-12 sm:px-16 py-3.5 rounded-full font-bold text-base transition-all flex items-center gap-2 ${
              !saving
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                : "bg-gray-200 text-gray-600 cursor-not-allowed"
            }`}
          >
            {saving && <LineSpinner size={20} />}
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
      <div className="p-4 sm:p-5 space-y-5">{children}</div>
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
