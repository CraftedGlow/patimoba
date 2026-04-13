"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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

/** DB の pickup_time (PostgreSQL time) 用。value は各帯の開始時刻 */
const pickupTimeSlots: { value: string; label: string }[] = [
  { value: "08:00:00", label: "午前中 (8:00〜12:00)" },
  { value: "14:00:00", label: "午後 (14:00〜16:00)" },
  { value: "16:00:00", label: "午後 (16:00〜18:00)" },
  { value: "18:00:00", label: "夕方〜夜 (18:00〜20:00)" },
  { value: "19:00:00", label: "夜 (19:00〜21:00)" },
];

export default function TakeoutConfirmPage() {
  const router = useRouter();
  const { userId, selectedStoreId, profile } = useCustomerContext();
  const { items: cartItems, total: cartTotal, storeId: cartStoreId, clear: clearCart } = useCart();
  const { createOrder } = useOrderMutations();
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  /** 空 = 未選択。値は Supabase time 列向け (例 16:00:00) */
  const [pickupTimeValue, setPickupTimeValue] = useState("");
  const [showPointModal, setShowPointModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [pointOption, setPointOption] = useState<PointOption>("none");
  const [tempPointOption, setTempPointOption] = useState<PointOption>("none");
  const [partialPoints, setPartialPoints] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [showOrderComplete, setShowOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("name, phone")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      if (data.name) {
        const parts = data.name.split(/\s+/);
        setLastName(parts[0] ?? "");
        setFirstName(parts.slice(1).join(" ") ?? "");
      }
      if (data.phone) setPhone(data.phone);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const subtotal = cartTotal;
  const availablePoints = 0;

  const usedPoints =
    pointOption === "all"
      ? Math.min(availablePoints, subtotal)
      : pointOption === "partial"
        ? Math.min(Number(partialPoints) || 0, availablePoints, subtotal)
        : 0;

  const total = subtotal - usedPoints;
  const earnedPoints = Math.floor(total / 100);

  const handleConfirmOrder = async () => {
    if (submitting) return;
    const storeIdForOrder = selectedStoreId || cartStoreId;
    if (!storeIdForOrder) {
      setSubmitError("店舗が選択されていません");
      return;
    }
    if (cartItems.length === 0) {
      setSubmitError("カートに商品がありません");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await createOrder({
      storeId: storeIdForOrder,
      customerId: userId,
      paymentStatus: paymentMethod === "credit" ? "paid" : "unpaid",
      items: cartItems,
      subtotal,
      discountAmount: usedPoints,
      orderType: "takeout",
      pickupTime: pickupTimeValue || null,
    });

    setSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
      return;
    }

    clearCart();
    setShowOrderComplete(true);
  };

  const continueShoppingHref = selectedStoreId || cartStoreId
    ? `/customer/takeout/products?store=${selectedStoreId || cartStoreId}`
    : "/customer/takeout";

  const handleContinueShopping = () => {
    router.push(continueShoppingHref);
  };

  const handlePointChange = () => {
    setPointOption(tempPointOption);
    setShowPointModal(false);
  };

  const pointLabel = pointOption === "none" ? "利用なし" : `${usedPoints}ポイント利用`;

  const handleStepClick = (step: number) => {
    if (step === 1) router.push("/customer/takeout");
    if (step === 2 && selectedStoreId)
      router.push(`/customer/takeout/products?store=${selectedStoreId}`);
    if (step === 3) router.push("/customer/takeout/pickup");
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

      <div className="px-4 pb-10">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold">注文内容の確認</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            まだ注文は確定していません
          </p>
        </div>

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
          <p className="text-xs text-gray-400 mt-1">
            ※日中に連絡の取れる電話番号
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">ポイント利用</span>
            <button
              onClick={() => {
                setTempPointOption(pointOption);
                setShowPointModal(true);
              }}
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
              className="w-full border-2 border-amber-400 text-amber-500 font-bold py-2.5 rounded-md text-sm flex items-center justify-center gap-1 hover:bg-amber-50 transition-colors"
            >
              ＋ カード情報を変更する
            </button>
            <p className="text-sm text-gray-400 mt-3">MasterCard **** 5978</p>
            <p className="text-xs text-red-500 mt-0.5">
              まだ注文は確定していません
            </p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm font-bold mb-2">お届け先</p>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="〒"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
          />
        </div>

        <div className="mb-5">
          <p className="text-sm font-bold mb-2">受取時間帯</p>
          <select
            value={pickupTimeValue}
            onChange={(e) => setPickupTimeValue(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent appearance-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              color: pickupTimeValue ? undefined : "#9ca3af",
            }}
          >
            <option value="" disabled>
              受取時間
            </option>
            {pickupTimeSlots.map(({ value, label }) => (
              <option key={value} value={value} style={{ color: "#111827" }}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">小計</span>
              <span className="text-sm text-gray-900">
                {subtotal.toLocaleString()}円
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">ポイント利用</span>
              <span className="text-sm text-gray-500">{pointLabel}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-gray-200">
              <span className="text-sm font-bold">支払い金額</span>
              <div className="text-right">
                <span className="text-2xl font-bold">
                  {total.toLocaleString()}
                </span>
                <span className="text-base ml-0.5">円</span>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm font-bold">獲得予定ポイント</span>
              <div className="text-right">
                <span className="text-red-500 font-bold text-lg">
                  {earnedPoints}
                </span>
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
            whileHover={submitting ? undefined : { scale: 1.02 }}
            whileTap={submitting ? undefined : { scale: 0.98 }}
            onClick={handleConfirmOrder}
            disabled={submitting}
            className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-white font-bold py-3 rounded-md text-sm transition-colors"
          >
            {submitting ? "処理中..." : "注文を確定する"}
          </motion.button>
        </div>

        <div className="text-center space-y-2">
          <button className="text-sm text-amber-600 underline">
            利用規約を読む
          </button>
          <br />
          <button className="text-sm text-amber-600 underline">
            プライバシーポリシーを読む
          </button>
          <br />
          <button className="text-sm text-amber-600 underline">
            特定商取引法を読む
          </button>
        </div>
      </div>

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
                <span className="text-3xl font-bold text-red-500">
                  {availablePoints}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="points"
                    checked={tempPointOption === "partial"}
                    onChange={() => setTempPointOption("partial")}
                    className="w-5 h-5 accent-amber-500"
                  />
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
                  <input
                    type="radio"
                    name="points"
                    checked={tempPointOption === "all"}
                    onChange={() => setTempPointOption("all")}
                    className="w-5 h-5 accent-amber-500"
                  />
                  <span className="text-sm">全部のポイントを使う</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="points"
                    checked={tempPointOption === "none"}
                    onChange={() => setTempPointOption("none")}
                    className="w-5 h-5 accent-amber-500"
                  />
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
              className="fixed left-6 right-6 top-[30%] bg-white rounded-2xl shadow-2xl z-[70] p-8 text-center"
            >
              <p className="text-base leading-relaxed text-gray-900">
                ご注文ありがとうございます。
                <br />
                来店時にLINEに送信された
                <br />
                メッセージをお見せください。
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/customer/takeout")}
                className="mt-6 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 px-10 rounded-lg text-base transition-colors"
              >
                トップに戻る
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
