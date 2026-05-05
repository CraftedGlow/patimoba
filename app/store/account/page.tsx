"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Loader2, Key, Check, Camera, Link2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useStoreContext } from "@/lib/store-context";
import { uploadStoreLogo, uploadStoreImage } from "@/lib/upload-image";
import type { Database } from "@/lib/database.types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const CUTOFF_OPTIONS = ["1", "1.5", "2", "2.5", "3", "3.5", "4"];

const PREP_TIME_OPTIONS = ["0.5", "1", "1.5", "2", "2.5", "3"];

const MIN_FUTURE_DAYS_OPTIONS = Array.from({ length: 14 }, (_, i) => String(i + 1));

const WEEKDAYS = [
  { label: "日", value: 0 },
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
];

type ModalKind = "hours" | "cutoff" | "prep_time" | "min_future_days" | "holidays" | "saved" | null;

async function fetchStoreForUser(storeIdHint: string | null): Promise<StoreRow | null> {
  if (storeIdHint) {
    const { data } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeIdHint)
      .maybeSingle();
    if (data) return data;
  }
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

interface ClosedDayRuleRow {
  dayOfWeek: number;
  rule: string;
}

async function fetchClosedDayRules(storeId: string): Promise<ClosedDayRuleRow[]> {
  const { data, error } = await supabase
    .from("store_business_hours")
    .select("day_of_week, is_closed")
    .eq("store_id", storeId)
    .eq("is_closed", true)
    .order("day_of_week", { ascending: true });
  if (error || !data) return [];
  return data.map((r: any) => ({
    dayOfWeek: Number(r.day_of_week),
    rule: "毎週",
  }));
}

export default function StoreAccountPage() {
  const { user } = useAuth();
  const { setStoreLogo: updateSidebarLogo } = useStoreContext();
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [storeImageUrl, setStoreImageUrl] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [cutoffHours, setCutoffHours] = useState("3");
  const [prepTimeHours, setPrepTimeHours] = useState("1.5");
  const [minFutureDays, setMinFutureDays] = useState("2");
  const [sameDayOrderAllowed, setSameDayOrderAllowed] = useState(true);

  const [modalOpenTime, setModalOpenTime] = useState(openTime);
  const [modalCloseTime, setModalCloseTime] = useState(closeTime);
  const [modalCutoff, setModalCutoff] = useState(cutoffHours);
  const [modalPrepTime, setModalPrepTime] = useState(prepTimeHours);
  const [modalMinFutureDays, setModalMinFutureDays] = useState(minFutureDays);

  const [modal, setModal] = useState<ModalKind>(null);
  const [holidays, setHolidays] = useState<{ day: string; freq: string; dayOfWeek: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [ecLinkCopied, setEcLinkCopied] = useState(false);

  const [modalHolidays, setModalHolidays] = useState<{ dayOfWeek: number; rule: string }[]>([]);

  const loadStore = useCallback(async () => {
    try {
      const store = await fetchStoreForUser(user?.storeId ?? null);
      if (store) {
        setStoreId(store.id);
        setStoreName(store.name ?? "");
        setAddress(store.address ?? "");
        setPhone(store.phone ?? "");
        setEmail(store.email ?? "");
        setLogoUrl(store.logo_url ?? null);
        setStoreImageUrl((store as any).image ?? null);

        // store_order_rules から当日受付設定を取得
        const { data: orderRules } = await supabase
          .from("store_order_rules")
          .select("default_cutoff_time, default_lead_time_minutes, same_day_order_allowed, min_future_days")
          .eq("store_id", store.id)
          .maybeSingle();
        if (orderRules?.default_lead_time_minutes != null) {
          setCutoffHours(String(Math.round(orderRules.default_lead_time_minutes / 60)));
        }
        if (orderRules?.default_cutoff_time != null) {
          // default_cutoff_time に準備時間（分）を文字列で保存
          const prepMin = Number(orderRules.default_cutoff_time);
          if (!isNaN(prepMin) && prepMin > 0) {
            setPrepTimeHours(String(prepMin / 60));
          }
        }
        if (orderRules?.same_day_order_allowed != null) {
          setSameDayOrderAllowed(orderRules.same_day_order_allowed);
        }
        if (orderRules?.min_future_days != null) {
          setMinFutureDays(String(orderRules.min_future_days));
        }

        // store_business_hours から通常営業時間を取得（最初の営業日を基準に）
        const { data: bhRows } = await supabase
          .from("store_business_hours")
          .select("open_time, close_time, is_closed")
          .eq("store_id", store.id)
          .eq("is_closed", false)
          .limit(1)
          .maybeSingle();
        if (bhRows?.open_time) setOpenTime(bhRows.open_time);
        if (bhRows?.close_time) setCloseTime(bhRows.close_time);

        const rules = await fetchClosedDayRules(store.id);
        const names = ["日", "月", "火", "水", "木", "金", "土"];
        setHolidays(rules.map((r) => ({
          day: names[r.dayOfWeek] ?? "",
          freq: r.rule,
          dayOfWeek: r.dayOfWeek,
        })));
      }
      if (user) setHasPassword(true);
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const openHoursModal = useCallback(() => {
    setModalOpenTime(openTime);
    setModalCloseTime(closeTime);
    setModal("hours");
  }, [openTime, closeTime]);

  const openCutoffModal = useCallback(() => {
    setModalCutoff(cutoffHours);
    setModal("cutoff");
  }, [cutoffHours]);

  const openPrepTimeModal = useCallback(() => {
    setModalPrepTime(prepTimeHours);
    setModal("prep_time");
  }, [prepTimeHours]);

  const openMinFutureDaysModal = useCallback(() => {
    setModalMinFutureDays(minFutureDays);
    setModal("min_future_days");
  }, [minFutureDays]);

  const saveHours = useCallback(async () => {
    setSaving(true);
    try {
      if (storeId) {
        // store_business_hours の営業日の open_time, close_time を一括更新
        await supabase
          .from("store_business_hours")
          .update({
            open_time: modalOpenTime,
            close_time: modalCloseTime,
          })
          .eq("store_id", storeId)
          .eq("is_closed", false);
      }
      setOpenTime(modalOpenTime);
      setCloseTime(modalCloseTime);
      setModal("saved");
      setTimeout(() => setModal(null), 1500);
    } finally {
      setSaving(false);
    }
  }, [modalOpenTime, modalCloseTime, storeId]);

  const upsertOrderRules = useCallback(async (updates: Record<string, unknown>) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("store_order_rules")
        .select("id")
        .eq("store_id", storeId)
        .maybeSingle();
      if (existing) {
        await supabase.from("store_order_rules").update(updates).eq("id", existing.id);
      } else {
        await supabase.from("store_order_rules").insert({ store_id: storeId, ...updates });
      }
      setModal("saved");
      setTimeout(() => setModal(null), 1500);
    } finally {
      setSaving(false);
    }
  }, [storeId]);

  const saveCutoff = useCallback(async () => {
    await upsertOrderRules({ default_lead_time_minutes: Number(modalCutoff) * 60 });
    setCutoffHours(modalCutoff);
  }, [modalCutoff, upsertOrderRules]);

  const savePrepTime = useCallback(async () => {
    const minutes = Number(modalPrepTime) * 60;
    await upsertOrderRules({ default_cutoff_time: String(minutes) });
    setPrepTimeHours(modalPrepTime);
  }, [modalPrepTime, upsertOrderRules]);

  const saveMinFutureDays = useCallback(async () => {
    await upsertOrderRules({ min_future_days: Number(modalMinFutureDays) });
    setMinFutureDays(modalMinFutureDays);
  }, [modalMinFutureDays, upsertOrderRules]);

  const toggleSameDayOrder = useCallback(async (value: boolean) => {
    if (!storeId) return;
    setSameDayOrderAllowed(value);
    const { data: existing } = await supabase
      .from("store_order_rules")
      .select("id")
      .eq("store_id", storeId)
      .maybeSingle();
    if (existing) {
      await supabase.from("store_order_rules")
        .update({ same_day_order_allowed: value })
        .eq("id", existing.id);
    } else {
      await supabase.from("store_order_rules")
        .insert({ store_id: storeId, same_day_order_allowed: value });
    }
  }, [storeId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storeId) return;
    setImageUploading(true);
    try {
      const { url, error } = await uploadStoreImage(file, storeId);
      if (error) throw new Error(error);
      if (url) {
        await supabase.from("stores").update({ image: url }).eq("id", storeId);
        setStoreImageUrl(url);
      }
    } catch (err) {
      console.error("Store image upload failed:", err);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storeId) return;
    setLogoUploading(true);
    try {
      const { url, error } = await uploadStoreLogo(file, storeId);
      if (error) throw new Error(error);
      if (url) {
        await supabase.from("stores").update({ logo_url: url }).eq("id", storeId);
        setLogoUrl(url);
        updateSidebarLogo(url);
      }
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openHolidaysModal = useCallback(() => {
    setModalHolidays(holidays.map((h) => ({ dayOfWeek: h.dayOfWeek, rule: h.freq })));
    setModal("holidays");
  }, [holidays]);

  const toggleModalHoliday = (dayOfWeek: number) => {
    setModalHolidays((prev) => {
      const exists = prev.find((h) => h.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter((h) => h.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, rule: "毎週" }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
  };

  const updateModalHolidayRule = (dayOfWeek: number, rule: string) => {
    setModalHolidays((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, rule } : h))
    );
  };

  const saveHolidays = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      // store_business_hours を再構築
      await supabase.from("store_business_hours").delete().eq("store_id", storeId);

      const allDays = Array.from({ length: 7 }, (_, i) => {
        const isClosed = modalHolidays.some((h) => h.dayOfWeek === i);
        return {
          store_id: storeId,
          day_of_week: i,
          is_closed: isClosed,
          open_time: isClosed ? null : openTime,
          close_time: isClosed ? null : closeTime,
        };
      });
      const { error } = await supabase.from("store_business_hours").insert(allDays);
      if (error) throw error;

      const names = ["日", "月", "火", "水", "木", "金", "土"];
      setHolidays(modalHolidays.map((h) => ({
        day: names[h.dayOfWeek] ?? "",
        freq: h.rule,
        dayOfWeek: h.dayOfWeek,
      })));
      setModal("saved");
      setTimeout(() => setModal(null), 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwSaving) return;
    setPwError(null);

    if (!newPassword.trim()) {
      setPwError("新しいパスワードを入力してください");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("パスワードは6文字以上で設定してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("新しいパスワードが一致しません");
      return;
    }
    if (!user) {
      setPwError("ログインが必要です");
      return;
    }

    setPwSaving(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (err) throw err;

      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "パスワード変更に失敗しました");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <h1 className="text-xl font-bold mb-8">登録情報確認</h1>

      {storeId && (
        <div className="mb-8 flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-4 py-3">
          <Link2 className="w-4 h-4 text-sky-500 shrink-0" />
          <p className="text-xs text-sky-700 flex-1 truncate font-mono">
            {typeof window !== "undefined" ? window.location.origin : ""}/customer/ec/products?store={storeId}
          </p>
          <button
            onClick={() => {
              const url = `${window.location.origin}/customer/ec/products?store=${storeId}`;
              navigator.clipboard.writeText(url);
              setEcLinkCopied(true);
              setTimeout(() => setEcLinkCopied(false), 2000);
            }}
            className="shrink-0 flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
          >
            {ecLinkCopied ? <><Check className="w-3 h-3" />コピー済み</> : <>コピー</>}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
        <div className="space-y-5">
          <InfoRow label="店舗名" value={storeName || "未設定"} />
          <InfoRow label="店舗の住所" value={address || "未設定"} />
          <InfoRow label="電話番号" value={phone || "未設定"} />
          <InfoRow label="メールアドレス" value={email || "未設定"} />
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-sm text-gray-500 mb-2">店舗のアイコン</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="relative group"
            >
              {logoUrl ? (
                <div className="relative">
                  <Image
                    src={logoUrl}
                    alt="店舗ロゴ"
                    width={200}
                    height={56}
                    className="h-14 w-auto rounded-lg"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 hover:border-amber-400 hover:text-amber-500 transition-colors">
                  {logoUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span>未設定</span>
                    </>
                  )}
                </div>
              )}
              {logoUploading && logoUrl && (
                <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                </div>
              )}
            </motion.button>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">店舗外観写真</p>
            <p className="text-xs text-gray-400 mb-3">顧客向けTOPページのヒーロー画像として表示されます</p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => imageInputRef.current?.click()}
              disabled={imageUploading}
              className="relative group w-full max-w-sm"
            >
              {storeImageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={storeImageUrl}
                    alt="店舗外観"
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  {imageUploading && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-36 max-w-sm rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 hover:border-amber-400 hover:text-amber-500 transition-colors">
                  {imageUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mb-1" />
                      <span>外観写真を追加</span>
                    </>
                  )}
                </div>
              )}
            </motion.button>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">通常の営業時間</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold">
                {(openTime || "").slice(0, 5)}~{(closeTime || "").slice(0, 5)}
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openHoursModal}
                className="px-4 py-1.5 rounded-md bg-amber-400 text-white text-sm font-bold hover:bg-amber-500 transition-colors"
              >
                変更
              </motion.button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">当日注文受付終了（CLOSE前）</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold">
                CLOSEから -{cutoffHours}{" "}
                <span className="text-sm font-normal text-gray-500">時間</span>
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openCutoffModal}
                className="px-4 py-1.5 rounded-md bg-amber-400 text-white text-sm font-bold hover:bg-amber-500 transition-colors"
              >
                変更
              </motion.button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">当日注文の準備時間</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold">
                {prepTimeHours}{" "}
                <span className="text-sm font-normal text-gray-500">時間</span>
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openPrepTimeModal}
                className="px-4 py-1.5 rounded-md bg-amber-400 text-white text-sm font-bold hover:bg-amber-500 transition-colors"
              >
                変更
              </motion.button>
            </div>
            <p className="text-xs text-gray-400 mt-1">注文から受取まで最低限必要な時間</p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">予約注文の最低事前日数</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold">
                {minFutureDays}{" "}
                <span className="text-sm font-normal text-gray-500">日前から</span>
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openMinFutureDaysModal}
                className="px-4 py-1.5 rounded-md bg-amber-400 text-white text-sm font-bold hover:bg-amber-500 transition-colors"
              >
                変更
              </motion.button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">当日注文機能</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleSameDayOrder(!sameDayOrderAllowed)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  sameDayOrderAllowed ? "bg-amber-400" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    sameDayOrderAllowed ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700">
                {sameDayOrderAllowed ? "ON（受け付ける）" : "OFF（受け付けない）"}
              </span>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">定休日</p>
            <div className="flex items-center gap-3">
              {holidays.length > 0 ? (
                <div className="flex items-center gap-6">
                  {holidays.map((h, i) => (
                    <span key={i} className="text-base">
                      <span className="font-semibold">{h.day}</span>{" "}
                      <span className="text-sm text-gray-500">{h.freq}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">定休日未設定</p>
              )}
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openHolidaysModal}
                className="px-4 py-1.5 rounded-md bg-amber-400 text-white text-sm font-bold hover:bg-amber-500 transition-colors"
              >
                変更
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-bold mb-4">パスワード設定</h2>
        <div className="max-w-md space-y-4">
          {!hasPassword && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              パスワードが未設定です。ログインに必要なパスワードを設定してください。
            </p>
          )}
          {hasPassword && (
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">現在のパスワード</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="現在のパスワードを入力"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">
              {hasPassword ? "新しいパスワード" : "パスワード"}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={hasPassword ? "新しいパスワードを入力" : "パスワードを設定"}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">
              {hasPassword ? "新しいパスワード（確認）" : "パスワード（確認）"}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>
          <AnimatePresence>
            {pwError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-500"
              >
                {pwError}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleChangePassword}
            disabled={pwSaving}
            className="px-6 py-2.5 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {hasPassword ? "パスワードを変更" : "パスワードを設定"}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {pwSaved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            パスワードを{hasPassword ? "変更" : "設定"}しました
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {modal === "hours" && (
          <Modal key="hours" onClose={() => setModal(null)}>
            <h2 className="text-lg font-bold text-center mb-6">
              営業時間の変更
            </h2>
            <div className="flex items-center justify-center gap-3 mb-6">
              <TimeSelect
                value={modalOpenTime}
                onChange={setModalOpenTime}
              />
              <span className="text-gray-500">～</span>
              <TimeSelect
                value={modalCloseTime}
                onChange={setModalCloseTime}
              />
            </div>
            <div className="flex justify-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={saveHours}
                disabled={saving}
                className="px-6 py-2 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                以上の内容に変更
              </motion.button>
            </div>
          </Modal>
        )}

        {modal === "cutoff" && (
          <Modal key="cutoff" onClose={() => setModal(null)}>
            <h2 className="text-lg font-bold text-center mb-6">
              当日注文受付終了の変更
            </h2>
            <p className="text-sm text-gray-500 text-center mb-4">CLOSEの何時間前まで受け付けるか</p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <select
                value={modalCutoff}
                onChange={(e) => setModalCutoff(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {CUTOFF_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">時間前</span>
            </div>
            <div className="flex justify-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={saveCutoff}
                disabled={saving}
                className="px-6 py-2 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </motion.button>
            </div>
          </Modal>
        )}

        {modal === "prep_time" && (
          <Modal key="prep_time" onClose={() => setModal(null)}>
            <h2 className="text-lg font-bold text-center mb-6">
              準備時間の変更
            </h2>
            <p className="text-sm text-gray-500 text-center mb-4">注文から受取まで最低限必要な時間</p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <select
                value={modalPrepTime}
                onChange={(e) => setModalPrepTime(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {PREP_TIME_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">時間</span>
            </div>
            <div className="flex justify-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={savePrepTime}
                disabled={saving}
                className="px-6 py-2 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </motion.button>
            </div>
          </Modal>
        )}

        {modal === "min_future_days" && (
          <Modal key="min_future_days" onClose={() => setModal(null)}>
            <h2 className="text-lg font-bold text-center mb-6">
              予約最低事前日数の変更
            </h2>
            <p className="text-sm text-gray-500 text-center mb-4">今日から何日後以降に予約できるか</p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <select
                value={modalMinFutureDays}
                onChange={(e) => setModalMinFutureDays(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {MIN_FUTURE_DAYS_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}日後
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={saveMinFutureDays}
                disabled={saving}
                className="px-6 py-2 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </motion.button>
            </div>
          </Modal>
        )}

        {modal === "holidays" && (
          <Modal key="holidays" onClose={() => setModal(null)}>
            <h2 className="text-lg font-bold text-center mb-6">
              定休日の変更
            </h2>
            <div className="space-y-3 mb-6">
              {WEEKDAYS.map((wd) => {
                const selected = modalHolidays.find((h) => h.dayOfWeek === wd.value);
                return (
                  <div
                    key={wd.value}
                    className="flex items-center gap-3"
                  >
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleModalHoliday(wd.value)}
                      className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${
                        selected
                          ? "bg-amber-400 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {wd.label}
                    </motion.button>
                    {selected && (
                      <select
                        value={selected.rule}
                        onChange={(e) => updateModalHolidayRule(wd.value, e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                      >
                        <option value="毎週">毎週</option>
                        <option value="第1">第1</option>
                        <option value="第2">第2</option>
                        <option value="第3">第3</option>
                        <option value="第4">第4</option>
                        <option value="第1.3">第1・3</option>
                        <option value="第1.4">第1・4</option>
                        <option value="第2.4">第2・4</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={saveHolidays}
                disabled={saving}
                className="px-6 py-2 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                以上の内容に変更
              </motion.button>
            </div>
          </Modal>
        )}

        {modal === "saved" && (
          <Modal key="saved" onClose={() => setModal(null)} hideClose>
            <p className="text-lg font-bold text-center py-6">
              変更しました
            </p>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-base">{value}</p>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function Modal({
  children,
  onClose,
  hideClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
  hideClose?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-8 relative"
      >
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}
