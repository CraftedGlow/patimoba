"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";

declare global {
  interface Window {
    onPayjpTokenCreated?: (response: {
      id: string;
      card?: { brand: string; last4: string };
    }) => void;
  }
}

const steps = ["店舗選択", "商品選択", "受取日時", "決済情報"];

export default function CardAddPage() {
  const router = useRouter();
  const { profile,
    points, } = useCustomerContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnPath =
      (() => { try { return sessionStorage.getItem("patimoba_tds_return_path"); } catch { return null; } })()
      ?? "/customer/ec/confirm";

    window.onPayjpTokenCreated = (response) => {
      const brand = response.card?.brand ?? "カード";
      const last4 = response.card?.last4 ?? "****";
      try {
        sessionStorage.setItem("patimoba_pending_token", response.id);
        sessionStorage.setItem("patimoba_card_label", `${brand} ****${last4}`);
        sessionStorage.removeItem("patimoba_tds_return_path");
      } catch { /* ignore */ }
      router.push(returnPath);
    };

    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://checkout.pay.jp/";
    script.className = "payjp-button";
    script.setAttribute("data-payjp-key", process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY ?? "");
    script.setAttribute("data-payjp-three-d-secure", "true");
    script.setAttribute("data-payjp-three-d-secure-workflow", "iframe");
    script.setAttribute("data-payjp-partial", "true");
    script.setAttribute("data-payjp-on-created", "onPayjpTokenCreated");
    script.setAttribute("data-payjp-text", "カードを登録する");
    container.appendChild(script);

    return () => {
      window.onPayjpTokenCreated = undefined;
      if (container.contains(script)) container.removeChild(script);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={points}
      />
      <div className="px-4 pt-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 mb-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <StepProgress currentStep={4} steps={steps} />
      <div className="px-4 pb-10">
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold">クレジットカードの追加</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            下記のボタンよりカード情報を入力してください
          </p>
        </div>

        <div className="bg-gray-100 rounded-md px-4 py-3 mb-6 flex items-center justify-between">
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

        <div className="flex justify-center" ref={containerRef} />

        <p className="text-xs text-gray-400 text-center mt-4">
          ※カード情報は安全に処理されます。当サイトにカード番号は保存されません。
        </p>
      </div>
    </div>
  );
}
