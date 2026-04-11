"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

type PointOption = "none" | "partial" | "all";
type PaymentMethod = "credit" | "store";

const mockOrderItem = {
  name: "生クリームデコレーション",
  image: "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=100",
  price: 5600,
  details: [
    { label: "5号（4~6名分）", price: 4600 },
    { label: "ノーマルキャンドル(大) \u00A50 \u00D72本", price: 0 },
    { label: "苺アップ\u2460", price: 1000 },
  ],
};

export default function TakeoutConfirmPage() {
  const router = useRouter();
  const { selectedStoreName } = useCustomerContext();
  const [lastName, setLastName] = useState("カイ");
  const [firstName, setFirstName] = useState("ミサキ");
  const [phone, setPhone] = useState("09062501396");
  const [showPointModal, setShowPointModal] = useState(false);
  const [pointOption, setPointOption] = useState<PointOption>("none");
  const [tempPointOption, setTempPointOption] = useState<PointOption>("none");
  const [partialPoints, setPartialPoints] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [showOrderComplete, setShowOrderComplete] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const subtotal = mockOrderItem.price;
  const availablePoints = 69;

  const usedPoints =
    pointOption === "all"
      ? Math.min(availablePoints, subtotal)
      : pointOption === "partial"
        ? Math.min(Number(partialPoints) || 0, availablePoints, subtotal)
        : 0;

  const total = subtotal - usedPoints;
  const earnedPoints = Math.floor(total * 0.005);

  const handleConfirmOrder = () => {
    setShowOrderComplete(true);
  };

  const handlePointChange = () => {
    setPointOption(tempPointOption);
    setShowPointModal(false);
  };

  const pointLabel =
    pointOption === "none"
      ? "利用なし"
      : `${usedPoints}ポイント利用`;

  const pickupDate = "2026年3月31日(火)12:00";

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} />

      <StepProgress currentStep={4} steps={steps} />

      <div className="px-4 pb-10">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold">注文内容の確認</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            まだ注文は確定していません
          </p>
        </div>

        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">お名前(カタカナ)</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">電話番号</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">
            ※日中に連絡の取れる電話番号
          </p>
        </div>

        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">ポイント利用</span>
            <button
              onClick={() => {
                setTempPointOption(pointOption);
                setShowPointModal(true);
              }}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              変更
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">{pointLabel}</p>
          <p className="text-xs mt-0.5">
            ご利用可能ポイント{" "}
            <span className="text-green-600 font-bold">{availablePoints}</span>{" "}
            <span className="text-green-600">ポイント</span>
          </p>
        </div>

        <div className="border-b border-gray-200 pb-4 mb-4">
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
          <div className="border-b border-gray-200 pb-4 mb-4">
            <button className="w-full border-2 border-amber-400 text-amber-500 font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-1 hover:bg-amber-50 transition-colors">
              + カード情報を変更する
            </button>
            <p className="text-sm font-medium mt-2">MasterCard **** 5978</p>
            <p className="text-xs text-red-500 mt-0.5">
              まだ注文は確定していません
            </p>
          </div>
        )}

        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">受け取り方法</span>
            <span className="text-sm text-gray-700">ご来店</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">来店日時</span>
            <span className="text-sm font-bold">{pickupDate}</span>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
              <img
                src={mockOrderItem.image}
                alt={mockOrderItem.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm font-bold flex-1">{mockOrderItem.name}</span>
            <button
              onClick={() => setShowDetailModal(true)}
              className="shrink-0 bg-amber-400 text-white font-bold px-3 py-1 rounded-md text-xs"
            >
              詳細
            </button>
            <span className="text-sm shrink-0">{mockOrderItem.price.toLocaleString()}円</span>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">小計</span>
              <span className="text-sm">{subtotal.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">ポイント利用</span>
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

        <div className="flex gap-3 mb-8">
          <Link href="/customer/takeout/products" className="flex-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-full text-sm transition-colors hover:bg-amber-50"
            >
              買い物を続ける
            </motion.button>
          </Link>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirmOrder}
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm transition-colors"
          >
            注文を確定する
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
        {showDetailModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
              onClick={() => setShowDetailModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[20%] bg-white rounded-2xl shadow-2xl z-[70] p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">ホールケーキの詳細</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  <img
                    src={mockOrderItem.image}
                    alt={mockOrderItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-base font-bold">{mockOrderItem.name}</span>
              </div>

              <div className="space-y-2 mb-4">
                {mockOrderItem.details.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{d.label}</span>
                    <span>&yen;{d.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end items-baseline gap-1 pt-3 border-t border-gray-200">
                <span className="text-base font-bold">合計：</span>
                <span className="text-2xl font-bold">
                  &yen;{mockOrderItem.price.toLocaleString()}
                </span>
              </div>
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
    </div>
  );
}
