"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X, ShoppingBag, PartyPopper } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { supabase } from "@/lib/supabase";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

const deliveryTimeSlots = [
  "午前（9:00〜12:00）",
  "昼（12:00〜15:00）",
  "夕方（15:00〜18:00）",
  "夜（18:00〜21:00）",
];

type PointOption = "none" | "partial" | "all";

interface ShippingAddress {
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
}

export default function ECConfirmPage() {
  const router = useRouter();
  const { userId, selectedStoreId, selectedStoreName, profile, points: userPoints } = useCustomerContext();
  const { items: cartItems, total: cartTotal, storeId: cartStoreId, clear: clearCart } = useCart();
  const { createOrder } = useOrderMutations();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [hasCardInfo, setHasCardInfo] = useState(false);
  const [cardLabel, setCardLabel] = useState("");

  const [showPointModal, setShowPointModal] = useState(false);
  const [pointOption, setPointOption] = useState<PointOption>("none");
  const [tempPointOption, setTempPointOption] = useState<PointOption>("none");
  const [partialPoints, setPartialPoints] = useState("");
  const [showOrderComplete, setShowOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  // sessionStorage から配送情報を復元
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ec_shipping_address");
      if (raw) setShippingAddress(JSON.parse(raw));
      const time = sessionStorage.getItem("ec_delivery_time");
      if (time) setDeliveryTime(time);
      setHasCardInfo(!!sessionStorage.getItem("patimoba_has_card"));
      setCardLabel(sessionStorage.getItem("patimoba_card_label") || "");
    } catch { /* ignore */ }
  }, []);

  // ログイン済みならユーザー情報を事前入力
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("name, name_kana, phone")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const source = data.name_kana || data.name || "";
      if (source) {
        const parts = source.split(/\s+/);
        setLastName(parts[0] ?? "");
        setFirstName(parts.slice(1).join(" ") ?? "");
      }
      if (data.phone) setPhone(data.phone);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const subtotal = cartTotal;
  const availablePoints = userPoints;

  const usedPoints =
    pointOption === "all"
      ? Math.min(availablePoints, subtotal)
      : pointOption === "partial"
        ? Math.min(Number(partialPoints) || 0, availablePoints, subtotal)
        : 0;

  const total = subtotal - usedPoints;
  const earnedPoints = Math.floor(total / 200); // 100円 = 0.5pt

  const handleConfirmOrder = async () => {
    if (submitting) return;
    const persistedStoreId = (() => { try { return localStorage.getItem("patimoba_selected_store_id") } catch { return null } })();
    const storeIdForOrder = selectedStoreId || cartStoreId || persistedStoreId;
    if (!storeIdForOrder) { setSubmitError("店舗が選択されていません"); return; }
    if (cartItems.length === 0) { setSubmitError("カートに商品がありません"); return; }

    setSubmitting(true);
    setSubmitError(null);

    const result = await createOrder({
      storeId: storeIdForOrder,
      customerId: userId,
      paymentStatus: hasCardInfo ? "paid" : "unpaid",
      items: cartItems,
      subtotal,
      discountAmount: usedPoints,
      orderType: "ec",
      notes: shippingAddress
        ? `〒${shippingAddress.postalCode} ${shippingAddress.prefecture}${shippingAddress.city}${shippingAddress.address}${shippingAddress.building ? " " + shippingAddress.building : ""}　配送時間:${deliveryTime}`
        : undefined,
    });

    setSubmitting(false);
    if (result.error) { setSubmitError(result.error); return; }

    // ポイント付与・消費をDBに反映
    if (userId) {
      const { data: userData } = await supabase
        .from("users").select("points").eq("id", userId).maybeSingle();
      const currentPts = Number(userData?.points) || 0;
      const newPts = Math.max(0, currentPts - usedPoints + earnedPoints);
      await supabase.from("users").update({ points: newPts }).eq("id", userId);
    }

    clearCart();
    sessionStorage.removeItem("ec_shipping_address");
    sessionStorage.removeItem("ec_delivery_time");

    setShowOrderComplete(true);
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          router.push(selectedStoreId ? `/customer/ec/products?store=${selectedStoreId}` : "/customer/ec");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const handlePointChange = () => { setPointOption(tempPointOption); setShowPointModal(false); };
  const pointLabel = pointOption === "none" ? "利用なし" : `${usedPoints}ポイント利用`;

  const fmtAddress = (a: ShippingAddress) =>
    `〒${a.postalCode} ${a.prefecture}${a.city}${a.address}${a.building ? " " + a.building : ""}`;

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        shopName={selectedStoreName || "パティモバ"}
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={userPoints}
        showCart
      />

      <div className="px-4 pt-2">
        <Link href="/customer/ec/shipping" className="inline-flex items-center text-gray-600 mb-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <StepProgress currentStep={4} steps={ecSteps} />

      <div className="px-4 md:px-8 pb-10 md:max-w-2xl md:mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold">注文内容の確認</h2>
          <p className="text-xs text-gray-400 mt-0.5">まだ注文は確定していません</p>
        </div>

        {/* お名前 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">お名前(カタカナ)</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
              placeholder="セイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-300" />
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              placeholder="メイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-300" />
          </div>
        </div>

        {/* 電話番号 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">電話番号</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="09012345678"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-300" />
          <p className="text-xs text-gray-400 mt-1">※日中に連絡の取れる電話番号</p>
        </div>

        {/* ポイント利用 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">ポイント利用</span>
            <button onClick={() => { setTempPointOption(pointOption); setShowPointModal(true); }}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
              変更
            </button>
          </div>
          <p className="text-sm text-gray-700">{pointLabel}</p>
          <p className="text-xs mt-0.5">
            <span className="text-gray-500">ご利用可能ポイント </span>
            <span className="text-red-500 font-bold">{availablePoints}</span>
            <span className="text-red-500"> ポイント</span>
          </p>
        </div>

        {/* お支払い方法 */}
        <div className="mb-4">
          <p className="text-sm font-bold mb-2">お支払い方法</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm">クレジットカード</span>
          </div>
        </div>

        {/* カード情報 */}
        <div className="mb-4">
          <button type="button" onClick={() => router.push("/customer/payment/card")}
            className={`w-full border-2 font-bold py-2.5 rounded-md text-sm flex items-center justify-center gap-1 transition-colors ${hasCardInfo ? "border-green-400 text-green-600 hover:bg-green-50" : "border-amber-400 text-amber-500 hover:bg-amber-50"}`}>
            {hasCardInfo ? `✓ ${cardLabel || "カード情報登録済み"}（変更する）` : "＋ カード情報を登録する"}
          </button>
          {!hasCardInfo && (
            <p className="text-xs text-red-500 mt-1.5">カード情報を登録しないと注文を確定できません</p>
          )}
        </div>

        {/* お届け先 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">お届け先</span>
            <Link href="/customer/ec/shipping" className="text-xs text-amber-600 underline">変更</Link>
          </div>
          {shippingAddress ? (
            <p className="text-sm text-gray-700 leading-relaxed">{fmtAddress(shippingAddress)}</p>
          ) : (
            <p className="text-sm text-gray-400">未入力</p>
          )}
        </div>

        {/* 配送時間帯 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">配送時間帯</span>
          </div>
          <div className="space-y-2">
            {deliveryTimeSlots.map((slot) => (
              <button key={slot} type="button" onClick={() => setDeliveryTime(slot)}
                className={`w-full text-left px-4 py-2.5 rounded-lg border-2 text-sm transition-colors ${
                  deliveryTime === slot
                    ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:border-amber-200"
                }`}>
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* 注文商品 + 合計 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <ShoppingBag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">注文商品・金額</span>
          </div>
          <div className="divide-y divide-gray-100">
            {cartItems.map((item, idx) => {
              const c = item.customization;
              const optSum = [
                (c?.sizePrice ?? 0),
                ...(c?.candles ?? []).map((cd) => cd.price * cd.quantity),
                ...(c?.options ?? []).map((op) => op.price),
                ...(c?.customOptions ?? []).map((o) => o.additionalPrice || 0),
              ].reduce((s, v) => s + v, 0);
              const lineTotal = (item.price + optSum) * item.quantity;
              return (
                <div key={idx} className="flex items-center gap-3 px-4 py-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {c?.sizeLabel && <p className="text-xs text-gray-500">{c.sizeLabel}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">¥{lineTotal.toLocaleString()}</p>
                    {item.quantity > 1 && <p className="text-xs text-gray-400">×{item.quantity}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">小計</span>
              <span className="text-sm">{subtotal.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">ポイント利用</span>
              <span className="text-sm text-gray-500">{pointLabel}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-gray-200">
              <span className="text-sm font-bold">支払い金額</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                <span className="text-base ml-0.5">円</span>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm font-bold">獲得予定ポイント</span>
              <div className="text-right">
                <span className="text-red-500 font-bold text-lg">{earnedPoints}</span>
                <span className="text-red-500 text-sm ml-0.5">ポイント</span>
                <p className="text-xs text-gray-400">1ポイント=1円</p>
              </div>
            </div>
          </div>
        </div>

        {submitError && <p className="text-xs text-red-500 text-center mb-2">{submitError}</p>}

        <div className="flex gap-3 mb-8">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => router.back()}
            className="flex-1 border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-md text-sm hover:bg-amber-50 transition-colors">
            買い物を続ける
          </motion.button>
          <motion.button
            whileHover={submitting || !hasCardInfo || !lastName.trim() || !firstName.trim() || !phone.trim() ? undefined : { scale: 1.02 }}
            whileTap={submitting || !hasCardInfo || !lastName.trim() || !firstName.trim() || !phone.trim() ? undefined : { scale: 0.98 }}
            onClick={handleConfirmOrder}
            disabled={submitting || !hasCardInfo || !lastName.trim() || !firstName.trim() || !phone.trim()}
            className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-bold py-3 rounded-md text-sm transition-colors">
            {submitting ? "処理中..." : "注文を確定する"}
          </motion.button>
        </div>
      </div>

      {/* ポイント変更モーダル */}
      <AnimatePresence>
        {showPointModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]" onClick={() => setShowPointModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-6">
              <button onClick={() => setShowPointModal(false)} className="absolute top-4 right-4 text-gray-400">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-base font-bold">利用可能ポイント</span>
                <span className="text-3xl font-bold text-red-500">{availablePoints}</span>
              </div>
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="ec-pts" checked={tempPointOption === "partial"}
                    onChange={() => setTempPointOption("partial")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">一部のポイントを使う</span>
                </label>
                {tempPointOption === "partial" && (
                  <input type="number" value={partialPoints} onChange={(e) => setPartialPoints(e.target.value)}
                    placeholder="利用するポイント数"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    max={Math.min(availablePoints, subtotal)} />
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="ec-pts" checked={tempPointOption === "all"}
                    onChange={() => setTempPointOption("all")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">全部のポイントを使う</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="ec-pts" checked={tempPointOption === "none"}
                    onChange={() => setTempPointOption("none")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">ポイントを利用しない</span>
                </label>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handlePointChange}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm">
                変更する
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 注文完了モーダル */}
      <AnimatePresence>
        {showOrderComplete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-8 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                  <PartyPopper className="w-7 h-7 text-amber-500" />
                </div>
              </div>
              <p className="text-base font-bold mb-2">ご注文ありがとうございます！</p>
              <p className="text-sm text-gray-500 mb-5">
                ご注文を受け付けました。準備が整い次第発送いたします。
              </p>
              <p className="text-xs text-gray-400 mb-4">{countdown}秒後に自動で商品一覧に戻ります</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  router.push(selectedStoreId ? `/customer/ec/products?store=${selectedStoreId}` : "/customer/ec");
                }}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-base">
                商品一覧に戻る
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
