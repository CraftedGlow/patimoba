"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";

const steps = ["店舗選択", "商品選択", "受取日時", "決済情報"];

const months = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

export default function CardAddPage() {
  const router = useRouter();
  const { profile } = useCustomerContext();

  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [holderName, setHolderName] = useState("");

  const canSubmit =
    cardNumber.replace(/\s/g, "").length >= 13 &&
    expMonth &&
    expYear &&
    securityCode.length >= 3 &&
    holderName.trim().length > 0;

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const detectBrand = (num: string): string => {
    const d = num.replace(/\s/g, "");
    if (/^4/.test(d)) return "Visa";
    if (/^3[47]/.test(d)) return "AmericanExpress";
    if (/^(5[1-5]|2[2-7])/.test(d)) return "MasterCard";
    if (/^35(2[89]|[3-8])/.test(d)) return "JCB";
    return "カード";
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const digits = cardNumber.replace(/\s/g, "");
    const last4 = digits.slice(-4);
    const brand = detectBrand(digits);
    sessionStorage.setItem("patimoba_has_card", "1");
    sessionStorage.setItem("patimoba_card_label", `${brand} ****${last4}`);
    router.back();
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
      />

      <div className="px-4 pt-2">
        <button onClick={() => router.back()} className="inline-flex items-center text-gray-600 mb-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <StepProgress currentStep={4} steps={steps} />

      <div className="px-4 pb-10">
        <div className="text-center mb-2">
          <h2 className="text-lg font-bold">クレジットカードの追加</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            下記の案内に従ってカード情報の登録をお進めください
          </p>
        </div>

        <div className="bg-gray-100 rounded-md px-4 py-3 my-4 flex items-center justify-between">
          <span className="text-sm text-gray-700">ご利用可能なカード</span>
          <div className="flex items-center gap-2">
            <span className="inline-block bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] font-bold text-blue-700">
              VISA
            </span>
            <span className="inline-block bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] font-bold">
              <span className="text-red-500">●</span>
              <span className="text-orange-400">●</span>
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-sm font-bold">カード番号</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="0000 0000 0000 0000"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-sm font-bold">有効期限</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <select
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-md pl-3 pr-8 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent appearance-none"
                style={{
                  color: expMonth ? undefined : "#d1d5db",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 28px center",
                }}
              >
                <option value="" disabled>
                  MM
                </option>
                {months.map((m) => (
                  <option key={m} value={m} style={{ color: "#111827" }}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                月
              </span>
            </div>
            <div className="relative">
              <select
                value={expYear}
                onChange={(e) => setExpYear(e.target.value)}
                className="w-full border border-gray-300 rounded-md pl-3 pr-8 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent appearance-none"
                style={{
                  color: expYear ? undefined : "#d1d5db",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 28px center",
                }}
              >
                <option value="" disabled>
                  YYYY
                </option>
                {years.map((y) => (
                  <option key={y} value={y} style={{ color: "#111827" }}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                年
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-sm font-bold">セキュリティーコード</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={securityCode}
            onChange={(e) =>
              setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="000"
            className="w-28 border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-sm font-bold">名義人</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="TARO YAMADA"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
          />
        </div>

        <motion.button
          whileHover={canSubmit ? { scale: 1.02 } : undefined}
          whileTap={canSubmit ? { scale: 0.98 } : undefined}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`block mx-auto w-full max-w-xs py-3 rounded-md text-base font-bold transition-colors ${
            canSubmit
              ? "bg-amber-400 hover:bg-amber-500 text-white"
              : "bg-amber-200 text-white cursor-not-allowed"
          }`}
        >
          決定する
        </motion.button>
      </div>
    </div>
  );
}
