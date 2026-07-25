"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import Image from "next/image";
import {
  fetchStoreById,
  updateStore,
  uploadStoreLogo,
  uploadStoreImage,
  fetchClosedDayRules,
  saveClosedDayRules,
  type ClosedDayRule,
} from "@/lib/admin-api";
import type { StorePlanSlug } from "@/lib/store-plans";
import { normalizeStorePlan } from "@/lib/store-plans";
import { StorePlanPicker } from "@/components/admin/store-plan-picker";
import { supabase } from "@/lib/supabase";

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

export default function AdminStoreEditPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [mail, setMail] = useState("");
  const [addressUrl, setAddressUrl] = useState("");
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [closedDayRules, setClosedDayRules] = useState<ClosedDayRule[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StorePlanSlug>("light");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [invoiceNum, setInvoiceNum] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [tokushoText, setTokushoText] = useState("");
  const [privacyPolicyText, setPrivacyPolicyText] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadStore = useCallback(async () => {
    try {
      const store = await fetchStoreById(storeId);
      setStoreName(store.name ?? "");
      setPhone(store.phone ?? "");
      setMail(store.email ?? "");
      setAddressUrl(store.address ?? "");
      if (store.logo_url) setLogoPreview(store.logo_url);
      if ((store as any).image) setImagePreview((store as any).image);
      setSelectedPlan(normalizeStorePlan((store as { plan?: string | null }).plan));

      const rawOptions = (store as any).plan_options;
      if (Array.isArray(rawOptions)) setSelectedAddons(rawOptions as string[]);

      setIsPublished((store as any).is_published ?? false);
      setInvoiceNum((store as any).invoice_num ?? "");
      setTokushoText((store as any).tokusho_text ?? "");
      setPrivacyPolicyText((store as any).privacy_policy_text ?? "");

      try {
        const rules = await fetchClosedDayRules(storeId);
        setClosedDayRules(rules);
      } catch {
        /* ignore */
      }

      // 営業時間
      const { data: bhData } = await supabase
        .from("store_business_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("store_id", storeId)
        .order("day_of_week", { ascending: true });
      if (bhData && bhData.length > 0) {
        const openDay = bhData.find((r: any) => !r.is_closed);
        if (openDay?.open_time) {
          const [h, m] = String(openDay.open_time).split(":");
          setOpenTime(`${h.padStart(2, "0")}:${m.padStart(2, "0")}`);
        }
        if (openDay?.close_time) {
          const [h, m] = String(openDay.close_time).split(":");
          setCloseTime(`${h.padStart(2, "0")}:${m.padStart(2, "0")}`);
        }
      }
    } catch {
      setError("店舗情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { loadStore(); }, [loadStore]);

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

  const handleUpdate = async () => {
    if (saving) return;
    if (!storeName.trim()) { setError("店舗名は必須です"); return; }
    setSaving(true);
    setError(null);
    try {
      let logoUrl: string | undefined;
      if (logoFile) logoUrl = await uploadStoreLogo(logoFile, storeId);

      let storeImageUrl: string | undefined;
      if (imageFile) storeImageUrl = await uploadStoreImage(imageFile, storeId);

      const updates: Record<string, unknown> = {
        name: storeName,
        email: mail || "",
        phone: phone || "",
        address: addressUrl || "",
        plan: selectedPlan,
        plan_options: selectedAddons.length > 0 ? selectedAddons : null,
        invoice_num: invoiceNum || null,
        tokusho_text: tokushoText || null,
        privacy_policy_text: privacyPolicyText || null,
        is_published: isPublished,
      };
      if (logoUrl !== undefined) updates.logo_url = logoUrl;
      if (storeImageUrl !== undefined) updates.image = storeImageUrl;
      await updateStore(storeId, updates);
      await saveClosedDayRules(storeId, closedDayRules);

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
        router.push("/admin/stores");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LineSpinner size={30} />
      </div>
    );
  }

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
          <h1 className="text-base sm:text-lg font-bold text-gray-900">店舗編集</h1>
          <p className="text-xs text-gray-600">{storeName || `ID: ${storeId}`}</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        <Section title="店舗基本情報">
          <Field label="パティモバへの出店">
            <button
              type="button"
              onClick={() => setIsPublished((v) => !v)}
              className="flex items-center gap-3"
            >
              <span className={`text-sm font-bold w-14 text-right transition-colors ${!isPublished ? "text-gray-700" : "text-gray-300"}`}>停止中</span>
              <div className={`relative h-7 w-14 rounded-full transition-colors duration-200 ${isPublished ? "bg-amber-500" : "bg-gray-300"}`}>
                <span
                  style={{ left: isPublished ? "calc(100% - 22px)" : "2px", transition: "left 0.2s" }}
                  className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
                />
              </div>
              <span className={`text-sm font-bold w-14 transition-colors ${isPublished ? "text-amber-500" : "text-gray-300"}`}>出店中</span>
            </button>
          </Field>
          <Field label="店舗名">
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="パティスリー・サクラ"
              className="form-input"
            />
          </Field>
          <Field label="メールアドレス">
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              placeholder="info@patisserie.jp"
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
          <Field label="インボイス番号">
            <input
              type="text"
              value={invoiceNum}
              onChange={(e) => setInvoiceNum(e.target.value)}
              placeholder="T1234567890123"
              className="form-input"
            />
          </Field>
          <Field label="住所">
            <input
              type="text"
              value={addressUrl}
              onChange={(e) => setAddressUrl(e.target.value)}
              placeholder="東京都渋谷区神宮前1-2-3"
              className="form-input"
            />
          </Field>

          <Field label="店舗ロゴ">
            <label className="block">
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              {logoPreview ? (
                <div className="relative border-2 border-amber-400 rounded-xl p-4 text-center cursor-pointer hover:border-amber-500 transition-colors">
                  <Image src={logoPreview} alt="プレビュー" width={120} height={120} className="mx-auto rounded-lg object-cover" />
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

          <Field label="営業時間">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="form-select">
                {hours.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-gray-500">〜</span>
              <select value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="form-select">
                {hours.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
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
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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

        <Section title="プライバシーポリシー">
          <Field label="内容">
            <textarea
              value={privacyPolicyText}
              onChange={(e) => setPrivacyPolicyText(e.target.value)}
              placeholder="プライバシーポリシーの内容を入力してください"
              rows={10}
              className="form-input font-mono text-xs leading-relaxed resize-y"
            />
          </Field>
          <p className="text-xs text-gray-600">
            ここで入力した内容が店舗のプライバシーポリシーページに反映されます。
          </p>
        </Section>

        <Section title="特定商取引法に基づく表記">
          <Field label="表記内容">
            <textarea
              value={tokushoText}
              onChange={(e) => setTokushoText(e.target.value)}
              placeholder={`販売事業者名: ○○パティスリー\n運営責任者: 山田 太郎\n所在地: 東京都渋谷区神宮前1-2-3\n電話番号: 03-1234-5678\nメール: info@example.jp\n販売価格: 各商品ページに表示\n送料: 別途記載\n支払方法: クレジットカード・銀行振込\n商品引渡し時期: ご注文から3〜5営業日\n返品・交換: 食品のため原則不可`}
              rows={10}
              className="form-input font-mono text-xs leading-relaxed resize-y"
            />
          </Field>
          <p className="text-xs text-gray-600">
            ここで入力した内容が店舗の特商法ページに反映されます。後から随時更新可能です。
          </p>
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
            onClick={handleUpdate}
            className={`px-12 sm:px-16 py-3.5 rounded-full font-bold text-base transition-all flex items-center gap-2 ${
              !saving
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                : "bg-gray-200 text-gray-600 cursor-not-allowed"
            }`}
          >
            {saving && <LineSpinner size={16} />}
            {saving ? "更新中..." : "更新する"}
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
                <p className="text-lg font-bold text-center">店舗情報を更新しました</p>
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
