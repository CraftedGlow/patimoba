"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useCustomerContext } from "@/lib/customer-context";
import { useEcContext } from "@/lib/ec-context";

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
  const { storeLogoUrl } = useEcContext();
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [building, setBuilding] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

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

        <div className="space-y-3 mb-8">
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
            <input
              type="text"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              placeholder="東京都"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent focus:outline-none"
            />
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
