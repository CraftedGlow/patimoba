"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, PartyPopper, ShoppingBag } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { supabase } from "@/lib/supabase";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

type PointOption = "none" | "partial" | "all";
type PaymentMethod = "credit" | "store";

export default function TakeoutConfirmPage() {
  const router = useRouter();
  const { userId, selectedStoreId, profile, points: userPoints } = useCustomerContext();
  const { items: cartItems, total: cartTotal, storeId: cartStoreId, clear: clearCart } = useCart();
  const { createOrder } = useOrderMutations();
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPointModal, setShowPointModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [pointOption, setPointOption] = useState<PointOption>("none");
  const [tempPointOption, setTempPointOption] = useState<PointOption>("none");
  const [partialPoints, setPartialPoints] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [showOrderComplete, setShowOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [hasCardInfo, setHasCardInfo] = useState(false);
  const [cardLabel, setCardLabel] = useState("");
  useEffect(() => {
    const d = sessionStorage.getItem("patimoba_pickup_date") ?? "";
    const t = sessionStorage.getItem("patimoba_pickup_time") ?? "";
    setPickupDate(d);
    setPickupTime(t);
    setHasCardInfo(!!sessionStorage.getItem("patimoba_has_card"));
    setCardLabel(sessionStorage.getItem("patimoba_card_label") || "");
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("name, name_kana, phone")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || error || !data) return;
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

    const printPhotoUrl = cartItems.find((i) => i.customization?.printPhotoUrl)?.customization?.printPhotoUrl ?? null;

    const result = await createOrder({
      storeId: storeIdForOrder,
      customerId: userId,
      paymentStatus: paymentMethod === "credit" ? "paid" : "unpaid",
      items: cartItems,
      subtotal,
      discountAmount: usedPoints,
      orderType: "takeout",
      pickupDate: pickupDate || null,
      pickupTime: pickupTime || null,
      printPhotoUrl,
    });

    setSubmitting(false);

    if (result.error) { setSubmitError(result.error); return; }

    if (result.orderId) {
      fetch("/api/line/send-order-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: result.orderId }),
      }).catch(() => {});
    }

    // ポイント付与・消費をDBに反映
    if (userId) {
      const { data: userData } = await supabase
        .from("users")
        .select("points")
        .eq("id", userId)
        .maybeSingle();
      const currentPts = Number(userData?.points) || 0;
      const newPts = Math.max(0, currentPts - usedPoints + earnedPoints);
      await supabase.from("users").update({ points: newPts }).eq("id", userId);
    }

    clearCart();
    sessionStorage.removeItem("patimoba_pickup_date");
    sessionStorage.removeItem("patimoba_pickup_time");
    sessionStorage.removeItem("patimoba_order_type");
    setShowOrderComplete(true);
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          router.push(continueShoppingHref);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const continueShoppingHref = selectedStoreId || cartStoreId
    ? `/customer/takeout/products?store=${selectedStoreId || cartStoreId}`
    : "/customer/takeout";

  const handleContinueShopping = () => router.push(continueShoppingHref);
  const handlePointChange = () => { setPointOption(tempPointOption); setShowPointModal(false); };
  const pointLabel = pointOption === "none" ? "利用なし" : `${usedPoints}ポイント利用`;

  const handleStepClick = (step: number) => {
    if (step === 1) router.push("/customer/takeout");
    if (step === 2 && selectedStoreId) router.push(`/customer/takeout/products?store=${selectedStoreId}`);
    if (step === 3) router.push("/customer/takeout/pickup");
  };

  const fmtDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
      />

      <StepProgress currentStep={4} steps={steps} onStepClick={handleStepClick} />

      <div className="px-4 md:px-8 lg:px-12 pb-10 md:max-w-2xl md:mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold">注文内容の確認</h2>
          <p className="text-xs text-gray-400 mt-0.5">まだ注文は確定していません</p>
        </div>

        {/* 受け取り日時 (表示のみ) */}
        {(pickupDate || pickupTime) && (
          <div className="mb-4 border border-amber-200 rounded-xl px-4 py-3 bg-amber-50/60">
            <p className="text-xs font-bold text-amber-700 mb-0.5">受け取り日時</p>
            <p className="text-sm font-bold text-gray-900">
              {fmtDate(pickupDate)}{pickupTime ? `　${pickupTime}` : ""}
            </p>
          </div>
        )}


        {/* お名前 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">お名前(カタカナ)</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="セイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
            />
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="メイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* 電話番号 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">電話番号</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09012345678"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
          />
          <p className="text-xs text-gray-400 mt-1">※日中に連絡の取れる電話番号</p>
        </div>

        {/* ポイント利用 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">ポイント利用</span>
            <button
              onClick={() => { setTempPointOption(pointOption); setShowPointModal(true); }}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              変更
            </button>
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{pointLabel}</p>
          <p className="text-xs mt-0.5">
            <span className="text-gray-500">ご利用可能ポイント </span>
            <span className="text-red-500 font-bold">{availablePoints}</span>
            <span className="text-red-500"> ポイント</span>
          </p>
        </div>

        {/* お支払い方法 */}
        <div className="mb-4">
          <p className="text-sm font-bold mb-2">お支払い方法</p>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "credit"}
                onChange={() => setPaymentMethod("credit")}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm">クレジットカード</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "store"}
                onChange={() => setPaymentMethod("store")}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm">店頭支払い</span>
            </label>
          </div>
        </div>

        {paymentMethod === "credit" && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => router.push("/customer/payment/card")}
              className={`w-full border-2 font-bold py-2.5 rounded-md text-sm flex items-center justify-center gap-1 transition-colors ${hasCardInfo ? "border-green-400 text-green-600 hover:bg-green-50" : "border-amber-400 text-amber-500 hover:bg-amber-50"}`}
            >
              {hasCardInfo ? `✓ ${cardLabel || "カード情報登録済み"}（変更する）` : "＋ カード情報を登録する"}
            </button>
            {!hasCardInfo && (
              <p className="text-xs text-red-500 mt-1.5">カード情報を登録しないと注文を確定できません</p>
            )}
          </div>
        )}

        {/* 注文商品 + 合計 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <ShoppingBag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">注文商品・金額</span>
          </div>
          {/* 商品一覧 */}
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
                    {(c?.customOptions ?? []).map((o, i) => (
                      <p key={i} className="text-xs text-gray-500">{o.name}: {(o.values ?? []).join("、")}</p>
                    ))}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">¥{lineTotal.toLocaleString()}</p>
                    {item.quantity > 1 && <p className="text-xs text-gray-400">×{item.quantity}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* 合計 */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">小計</span>
              <span className="text-sm text-gray-900">{subtotal.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ポイント利用</span>
              <span className="text-sm text-gray-500">{pointLabel}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-gray-200">
              <span className="text-sm font-bold">支払い金額</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                <span className="text-base ml-0.5">円</span>
                <span className="ml-1 text-gray-400" style={{ fontSize: 11 }}>(税込)</span>
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

        {submitError && (
          <p className="text-xs text-red-500 text-center mb-2">{submitError}</p>
        )}

        <div className="flex gap-3 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinueShopping}
            className="flex-1 border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-md text-sm transition-colors hover:bg-amber-50"
          >
            買い物を続ける
          </motion.button>
          <motion.button
            whileHover={submitting || (paymentMethod === "credit" && !hasCardInfo) || !lastName.trim() || !firstName.trim() || !phone.trim() ? undefined : { scale: 1.02 }}
            whileTap={submitting || (paymentMethod === "credit" && !hasCardInfo) || !lastName.trim() || !firstName.trim() || !phone.trim() ? undefined : { scale: 0.98 }}
            onClick={handleConfirmOrder}
            disabled={submitting || (paymentMethod === "credit" && !hasCardInfo) || !lastName.trim() || !firstName.trim() || !phone.trim()}
            className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-bold py-3 rounded-md text-sm transition-colors"
          >
            {submitting ? "処理中..." : "注文を確定する"}
          </motion.button>
        </div>

        <div className="text-center space-y-2">
          <button className="text-sm text-amber-600 underline">利用規約を読む</button>
          <br />
          <button className="text-sm text-amber-600 underline">プライバシーポリシーを読む</button>
          <br />
          <button className="text-sm text-amber-600 underline">特定商取引法を読む</button>
        </div>
      </div>

      {/* ポイント変更モーダル */}
      <AnimatePresence>
        {showPointModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
              onClick={() => setShowPointModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-6"
            >
              <button
                onClick={() => setShowPointModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-base font-bold">利用可能ポイント</span>
                <span className="text-3xl font-bold text-red-500">{availablePoints}</span>
              </div>
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="points" checked={tempPointOption === "partial"} onChange={() => setTempPointOption("partial")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">一部のポイントを使う</span>
                </label>
                {tempPointOption === "partial" && (
                  <input
                    type="number"
                    value={partialPoints}
                    onChange={(e) => setPartialPoints(e.target.value)}
                    placeholder="利用するポイント数"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm ml-8 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    style={{ width: "calc(100% - 2rem)" }}
                    max={Math.min(availablePoints, subtotal)}
                  />
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="points" checked={tempPointOption === "all"} onChange={() => setTempPointOption("all")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">全部のポイントを使う</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="points" checked={tempPointOption === "none"} onChange={() => setTempPointOption("none")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">ポイントを利用しない</span>
                </label>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePointChange}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm transition-colors"
              >
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-8 text-center"
            >
              <button
                onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); router.push(continueShoppingHref); }}
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
                ご注文ありがとうございます！
              </p>
              <p className="text-sm text-gray-500 leading-relaxed mb-1">
                注文情報がLINEに届いています。
              </p>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                来店時にLINEのメッセージをお見せください。
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {countdown}秒後に自動で商品一覧に戻ります
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); router.push(continueShoppingHref); }}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-base transition-colors"
              >
                商品一覧に戻る
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} readOnly hideProceed />
    </div>
  );
}
