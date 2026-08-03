"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Truck } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { REGION_BLOCKS, regionForPrefecture } from "@/lib/constants/regions";
import { FALLBACK_FLAT_FEE } from "@/lib/shipping-fee";

interface ShippingSettingsRow {
  mode: "flat" | "region";
  flat_fee: number;
  origin_region: string | null;
  free_shipping_enabled: boolean;
  free_shipping_threshold: number | null;
  free_shipping_excludes_special_regions: boolean;
  remote_surcharge: number;
}

const DEFAULTS: ShippingSettingsRow = {
  mode: "flat",
  flat_fee: FALLBACK_FLAT_FEE,
  origin_region: null,
  free_shipping_enabled: false,
  free_shipping_threshold: null,
  free_shipping_excludes_special_regions: true,
  remote_surcharge: 0,
};

export default function StoreShippingPage() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<ShippingSettingsRow>(DEFAULTS);

  // 発送元は店舗の郵便番号から自動判定する（店舗が選ぶ項目ではない）
  const [originRegion, setOriginRegion] = useState<string | null>(null);
  // 地域別モード: 運営管理の目安金額（未編集ならこの値がそのまま使われる）
  const [masterFees, setMasterFees] = useState<Record<string, number>>({});
  // 地域別モード: 実際に画面に表示・編集される金額（初期値は上書き優先、なければ目安）
  const [regionFees, setRegionFees] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }

    let { data: settingsRow } = await supabase
      .from("store_shipping_settings")
      .select("mode, flat_fee, origin_region, free_shipping_enabled, free_shipping_threshold, free_shipping_excludes_special_regions, remote_surcharge")
      .eq("store_id", storeId)
      .maybeSingle();

    // 発送元を店舗の郵便番号から自動判定
    let resolvedOrigin: string | null = settingsRow?.origin_region ?? null;
    const { data: store } = await supabase
      .from("stores")
      .select("postal_code")
      .eq("id", storeId)
      .maybeSingle();
    if (store?.postal_code) {
      const digits = store.postal_code.replace(/[^0-9]/g, "");
      if (digits.length === 7) {
        try {
          const res = await fetch(`/api/postal-code/lookup?zipcode=${digits}`);
          const json = await res.json();
          if (json.prefecture) {
            const region = regionForPrefecture(json.prefecture);
            if (region) resolvedOrigin = region;
          }
        } catch {
          // 取得失敗時は既存の origin_region をそのまま使う
        }
      }
    }
    setOriginRegion(resolvedOrigin);

    // 未設定の店舗は、何もしなくても妥当な既定値がすぐ保存された状態になるようにする
    if (!settingsRow) {
      const defaultPayload = {
        store_id: storeId,
        mode: (resolvedOrigin ? "region" : "flat") as "flat" | "region",
        flat_fee: FALLBACK_FLAT_FEE,
        origin_region: resolvedOrigin,
        free_shipping_enabled: false,
        free_shipping_threshold: null,
        free_shipping_excludes_special_regions: true,
        remote_surcharge: 0,
      };
      const { data: inserted } = await supabase
        .from("store_shipping_settings")
        .insert(defaultPayload)
        .select("mode, flat_fee, origin_region, free_shipping_enabled, free_shipping_threshold, free_shipping_excludes_special_regions, remote_surcharge")
        .maybeSingle();
      settingsRow = inserted ?? defaultPayload;
    }
    setSettings(settingsRow as ShippingSettingsRow);

    if (resolvedOrigin) {
      const { data: masterRows } = await supabase
        .from("shipping_rate_regions")
        .select("destination_region, fee")
        .eq("origin_region", resolvedOrigin);
      const master: Record<string, number> = {};
      for (const r of masterRows ?? []) master[r.destination_region] = r.fee;
      setMasterFees(master);

      const { data: overrideRows } = await supabase
        .from("store_shipping_rate_overrides")
        .select("destination_region, fee")
        .eq("store_id", storeId);
      const overrides: Record<string, number> = {};
      for (const r of overrideRows ?? []) overrides[r.destination_region] = r.fee;

      const merged: Record<string, number> = {};
      for (const block of REGION_BLOCKS) merged[block] = overrides[block] ?? master[block] ?? 0;
      setRegionFees(merged);
    }

    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      const settingsPayload = { ...settings, origin_region: originRegion };
      const { data: existing } = await supabase
        .from("store_shipping_settings")
        .select("id")
        .eq("store_id", storeId)
        .maybeSingle();
      if (existing) {
        await supabase.from("store_shipping_settings").update(settingsPayload).eq("id", existing.id);
      } else {
        await supabase.from("store_shipping_settings").insert({ store_id: storeId, ...settingsPayload });
      }

      if (settings.mode === "region") {
        for (const block of REGION_BLOCKS) {
          const current = regionFees[block] ?? 0;
          const master = masterFees[block] ?? 0;
          if (current === master) {
            await supabase
              .from("store_shipping_rate_overrides")
              .delete()
              .eq("store_id", storeId)
              .eq("destination_region", block);
          } else {
            await supabase
              .from("store_shipping_rate_overrides")
              .upsert({ store_id: storeId, destination_region: block, fee: current }, { onConflict: "store_id,destination_region" });
          }
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [storeId, settings, originRegion, regionFees, masterFees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LineSpinner size={30} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <h1 className="text-xl font-bold mb-2 flex items-center gap-2">
        <Truck className="w-5 h-5 text-amber-500" />
        配送設定
      </h1>
      <p className="text-sm text-gray-600 mb-8">EC（配送）注文の送料の決め方を設定します。テイクアウトの注文には影響しません。</p>

      <div className="space-y-8">
        <div>
          <p className="text-sm font-bold text-gray-700 mb-3">料金の決め方</p>
          <div className="flex gap-3">
            {([
              { value: "flat", label: "一律料金" },
              { value: "region", label: "地域別料金" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, mode: opt.value }))}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-bold transition-colors ${
                  settings.mode === opt.value
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-600 hover:border-amber-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {settings.mode === "flat" ? (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">一律送料</label>
            <div className="flex items-center gap-2 max-w-xs">
              <span className="text-gray-500">¥</span>
              <input
                type="number"
                min={0}
                value={settings.flat_fee}
                onChange={(e) => setSettings((s) => ({ ...s, flat_fee: Number(e.target.value) || 0 }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>

            <label className="block text-sm font-bold text-gray-700 mt-5 mb-2">沖縄への追加料金</label>
            <div className="flex items-center gap-2 max-w-xs">
              <span className="text-gray-500">+¥</span>
              <input
                type="number"
                min={0}
                value={settings.remote_surcharge}
                onChange={(e) => setSettings((s) => ({ ...s, remote_surcharge: Number(e.target.value) || 0 }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">一律送料に上乗せする金額です</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              発送元：<span className="font-bold text-gray-800">{originRegion ?? "判定できませんでした"}</span>
              <span className="text-xs text-gray-500 ml-1">（店舗の郵便番号から自動判定）</span>
            </p>
            {!originRegion && (
              <p className="text-xs text-red-500 mb-3">店舗の郵便番号が未設定、または判定に失敗しました。アカウント情報の住所をご確認ください。</p>
            )}
            <p className="text-sm font-bold text-gray-700 mb-2">地域ごとの送料</p>
            <p className="text-xs text-gray-600 mb-3">未編集の地域は運営が管理する目安金額がそのまま使われ、相場が変わると自動で更新されます。金額を変更した地域だけその金額で固定されます。</p>
            <div className="space-y-2 max-w-xs">
              {REGION_BLOCKS.map((block) => (
                <div key={block} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-gray-700 shrink-0">{block}</span>
                  <span className="text-gray-500">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={regionFees[block] ?? 0}
                    onChange={(e) => setRegionFees((r) => ({ ...r, [block]: Number(e.target.value) || 0 }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  {regionFees[block] !== (masterFees[block] ?? 0) && (
                    <span className="text-[10px] text-amber-600 font-bold shrink-0">変更済</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-6">
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <div
              onClick={() => setSettings((s) => ({ ...s, free_shipping_enabled: !s.free_shipping_enabled }))}
              className={`relative w-10 h-6 rounded-full transition-colors ${settings.free_shipping_enabled ? "bg-amber-400" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.free_shipping_enabled ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm font-bold text-gray-700">送料無料ラインを設定する</span>
          </label>

          {settings.free_shipping_enabled && (
            <div className="pl-1 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">税込小計がこの金額以上で送料無料</label>
                <div className="flex items-center gap-2 max-w-xs">
                  <span className="text-gray-500">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.free_shipping_threshold ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, free_shipping_threshold: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <span className="text-gray-500">以上</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">ポイント利用前の金額で判定します</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setSettings((s) => ({ ...s, free_shipping_excludes_special_regions: !s.free_shipping_excludes_special_regions }))}
                  className={`relative w-10 h-6 rounded-full transition-colors ${settings.free_shipping_excludes_special_regions ? "bg-amber-400" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.free_shipping_excludes_special_regions ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-sm text-gray-700">沖縄は送料無料の対象外にする</span>
              </label>
            </div>
          )}
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving || !storeId}
          className="px-6 py-2.5 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <LineSpinner size={16} />}
          保存する
        </motion.button>
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
            配送設定を保存しました
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
