"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

const deliveryTimeSlots = [
  "午前（9:00〜12:00）",
  "昼（12:00〜15:00）",
  "夕方（15:00〜18:00）",
  "夜（18:00〜21:00）",
];

export default function ECShippingPage() {
  const router = useRouter();
  const { selectedStoreName } = useCustomerContext();
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [building, setBuilding] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} showCart />

      <div className="px-4 pt-2">
        <Link
          href="/customer/ec/products"
          className="inline-flex items-center text-gray-600 mb-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <StepProgress currentStep={3} steps={ecSteps} />

      <div className="px-4 pb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-500" />
          配送先住所
        </h2>

        <div className="space-y-3 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              郵便番号
            </label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="000-0000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              都道府県
            </label>
            <input
              type="text"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              placeholder="東京都"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              市区町村
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="渋谷区"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              番地
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="神宮前3-1-1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:outline-none"
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
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:outline-none"
            />
          </div>
        </div>

        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
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
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-amber-200"
              }`}
            >
              {slot}
            </motion.button>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            sessionStorage.setItem("ec_shipping_address", JSON.stringify({
              postalCode, prefecture, city, address, building,
            }));
            sessionStorage.setItem("ec_delivery_time", selectedTimeSlot);
            router.push("/customer/ec/confirm");
          }}
          className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors"
        >
          注文内容の確認へ
        </motion.button>
      </div>
    </div>
  );
}
