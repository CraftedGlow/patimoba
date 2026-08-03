"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useCustomerContext } from "@/lib/customer-context";
import { useEcContext } from "@/lib/ec-context";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";
import { PREFECTURES, regionForPrefecture } from "@/lib/constants/regions";
import { calculateShippingFee, shippingSettingsFromRow, DEFAULT_SHIPPING_SETTINGS, type RegionRate, type ShippingSettings } from "@/lib/shipping-fee";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

const deliveryTimeSlots = [
  "午前（9:00〜12:00）",
  "昼（12:00〜15:00）",
  "夕方（15:00〜18:00）",
  "夜（18:00〜21:00）",
];

function readSavedAddress() {
  try {
    const raw = sessionStorage.getItem("ec_shipping_address");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ECShippingPage() {
  const router = useRouter();
  const { selectedStoreId } = useCustomerContext();
  const { storeLogoUrl } = useEcContext();
  const { storeId: cartStoreId, total: cartTotal } = useCart();
  const persistedStoreId = (() => { try { return localStorage.getItem("patimoba_selected_store_id") } catch { return null } })();
  const storeId = selectedStoreId || cartStoreId || persistedStoreId;

  const [postalCode, setPostalCode] = useState(() => readSavedAddress()?.postalCode ?? "");
  const [prefecture, setPrefecture] = useState(() => readSavedAddress()?.prefecture ?? "");
  const [city, setCity] = useState(() => readSavedAddress()?.city ?? "");
  const [address, setAddress] = useState(() => readSavedAddress()?.address ?? "");
  const [building, setBuilding] = useState(() => readSavedAddress()?.building ?? "");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(() => {
    try {
      return sessionStorage.getItem("ec_delivery_time") ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [regionRates, setRegionRates] = useState<RegionRate[]>([]);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      const { data } = await supabase
        .from("store_shipping_settings")
        .select("mode, flat_fee, origin_region, free_shipping_enabled, free_shipping_threshold, free_shipping_excludes_special_regions, remote_surcharge")
        .eq("store_id", storeId)
        .maybeSingle();
      if (data) setShippingSettings(shippingSettingsFromRow(data));
    })();
  }, [storeId]);

  // 地域別モードの場合、届け先都道府県が決まってから該当する地域の送料を取得する
  // （店舗が個別に金額を上書きしていればそれを優先し、なければ運営管理の目安表を使う）
  useEffect(() => {
    if (shippingSettings.mode !== "region" || !storeId || !prefecture) {
      setRegionRates([]);
      return;
    }
    const destinationRegion = regionForPrefecture(prefecture);
    if (!destinationRegion) { setRegionRates([]); return; }
    (async () => {
      const { data: overrideRow } = await supabase
        .from("store_shipping_rate_overrides")
        .select("fee")
        .eq("store_id", storeId)
        .eq("destination_region", destinationRegion)
        .maybeSingle();
      if (overrideRow) {
        setRegionRates([{ destinationRegion, fee: overrideRow.fee }]);
        return;
      }
      if (!shippingSettings.originRegion) { setRegionRates([]); return; }
      const { data: masterRow } = await supabase
        .from("shipping_rate_regions")
        .select("fee")
        .eq("origin_region", shippingSettings.originRegion)
        .eq("destination_region", destinationRegion)
        .maybeSingle();
      setRegionRates(masterRow ? [{ destinationRegion, fee: masterRow.fee }] : []);
    })();
  }, [shippingSettings.mode, shippingSettings.originRegion, storeId, prefecture]);

  // 郵便番号が7桁になったら自動で都道府県・市区町村を補完する
  useEffect(() => {
    const digits = postalCode.replace(/[^0-9]/g, "");
    if (digits.length !== 7) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/postal-code/lookup?zipcode=${digits}`);
        const data = await res.json();
        if (cancelled || !data.prefecture) return;
        setPrefecture(data.prefecture);
        if (data.city) setCity((prev: string) => prev || data.city);
      } catch {
        // 取得失敗時は手動入力に任せる
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode]);

  const shippingFee = prefecture
    ? calculateShippingFee({ settings: shippingSettings, rates: regionRates, destinationPrefecture: prefecture, subtotal: cartTotal })
    : null;

  const remainingForFree =
    shippingSettings.freeShippingEnabled && shippingSettings.freeShippingThreshold != null
      ? shippingSettings.freeShippingThreshold - cartTotal
      : null;

  return (
    <div className="min-h-screen bg-[var(--ec-bg,#ffffff)]">
      <CustomerHeader
        showCart
        showBack
        backHref="/customer/ec/products"
        logoUrl={storeLogoUrl}
        onCartClick={() => setCartOpen(true)}
      />

      <StepProgress currentStep={3} steps={ecSteps} maxWidthClassName="max-w-[800px] mx-auto" />

      <div className="px-4 pb-8 max-w-[800px] mx-auto">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--ec-500,#f59e0b)]" />
          配送先住所
        </h2>

        <div className="space-y-3 mb-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="block text-sm font-medium text-gray-700">郵便番号</label>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="000-0000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="block text-sm font-medium text-gray-700">都道府県</label>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent focus:outline-none bg-white"
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="block text-sm font-medium text-gray-700">市区町村</label>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="渋谷区"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="block text-sm font-medium text-gray-700">番地</label>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="神宮前3-1-1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              建物名・部屋番号（任意）
            </label>
            <input
              type="text"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="パティモバビル 301"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent focus:outline-none"
            />
          </div>
        </div>

        {prefecture && (
          <div className="mb-8 flex items-center gap-2 bg-[var(--ec-50,#fffbeb)] border border-[var(--ec-200,#fde68a)] rounded-lg px-4 py-3">
            <Truck className="w-4 h-4 text-[var(--ec-500,#f59e0b)] shrink-0" />
            <p className="text-sm text-gray-700">
              配送料：<span className="font-bold">{shippingFee === 0 ? "無料" : `¥${(shippingFee ?? 0).toLocaleString()}`}</span>
              {remainingForFree != null && remainingForFree > 0 && (
                <span className="text-xs text-gray-500 ml-2">（あと¥{remainingForFree.toLocaleString()}で送料無料）</span>
              )}
            </p>
          </div>
        )}

        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[var(--ec-500,#f59e0b)]" />
          配送時間帯
        </h2>

        <div className="space-y-2 mb-8">
          {deliveryTimeSlots.map((slot) => (
            <motion.button
              key={slot}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTimeSlot(slot)}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-colors ${
                selectedTimeSlot === slot
                  ? "border-[var(--ec-400,#fbbf24)] bg-[var(--ec-50,#fffbeb)] text-[var(--ec-700,#b45309)]"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[var(--ec-200,#fde68a)]"
              }`}
            >
              {slot}
            </motion.button>
          ))}
        </div>

        {error && <p className="text-xs text-red-500 text-center mb-3">{error}</p>}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (!postalCode.trim() || !prefecture.trim() || !city.trim() || !address.trim()) {
              setError("郵便番号・都道府県・市区町村・番地は必須です");
              return;
            }
            setError(null);
            sessionStorage.setItem("ec_shipping_address", JSON.stringify({
              postalCode, prefecture, city, address, building,
            }));
            sessionStorage.setItem("ec_delivery_time", selectedTimeSlot);
            sessionStorage.setItem("ec_shipping_fee", String(shippingFee ?? 0));
            router.push("/customer/ec/confirm");
          }}
          className="w-full bg-[var(--ec-400,#fbbf24)] hover:bg-[var(--ec-500,#f59e0b)] text-[var(--ec-button-text,#ffffff)] font-bold py-3.5 rounded-full text-base transition-colors"
        >
          注文内容の確認へ
        </motion.button>
      </div>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        readOnly
        hideProceed
      />
    </div>
  );
}
