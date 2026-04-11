"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { WholeCakeBasicStep } from "@/components/customer/whole-cake/basic-step";
import { WholeCakeOptionsStep } from "@/components/customer/whole-cake/options-step";
import { WholeCakeConfirmStep } from "@/components/customer/whole-cake/confirm-step";
import type { CandleEntry } from "@/components/customer/whole-cake/basic-step";
import { useWholeCakes } from "@/hooks/use-whole-cakes";
import { useCustomerContext } from "@/lib/customer-context";

const wholeCakeSteps = ["基本選択", "オプション", "内容確認"];

export default function WholeCakePage() {
  const router = useRouter();
  const { selectedStoreName, selectedStoreId } = useCustomerContext();
  const [step, setStep] = useState(1);
  const { wholeCakes, candleOptions, loading } = useWholeCakes(selectedStoreId ?? "");

  const [selectedCakeId, setSelectedCakeId] = useState("");
  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [candles, setCandles] = useState<CandleEntry[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [allergyNote, setAllergyNote] = useState("");

  // Set default cake once loaded
  if (!selectedCakeId && wholeCakes.length > 0) {
    setSelectedCakeId(wholeCakes[0].id);
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-500">読み込み中...</div>;
  }

  const selectedCake = wholeCakes.find((c) => c.id === selectedCakeId);
  if (!selectedCake) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-500">ホールケーキが見つかりません</div>;
  }

  const selectedSize = selectedCake.sizes.find((s) => s.id === selectedSizeId);
  const sizePrice = selectedSize?.price ?? 0;

  const candleTotal = candles.reduce((sum, c) => {
    const opt = candleOptions.find((o) => o.id === c.candleOptionId);
    const qty = Number(c.quantity) || 0;
    return sum + (opt?.price ?? 0) * qty;
  }, 0);

  const optionTotal = selectedOptionIds.reduce((sum, oid) => {
    const opt = selectedCake.options.find((o) => o.id === oid);
    return sum + (opt?.price ?? 0);
  }, 0);

  const total = sizePrice + candleTotal + optionTotal;

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} />

      <div className="px-4 pt-2">
        {step === 1 ? (
          <Link
            href="/customer/takeout/products"
            className="inline-flex items-center text-gray-600 mb-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <button
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center text-gray-600 mb-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <StepProgress currentStep={step} steps={wholeCakeSteps} />

      {step === 1 && (
        <WholeCakeBasicStep
          cake={selectedCake}
          candleOptions={candleOptions}
          selectedSizeId={selectedSizeId}
          onSizeChange={setSelectedSizeId}
          candles={candles}
          onCandlesChange={setCandles}
          messageText={messageText}
          onMessageChange={setMessageText}
          total={total}
          canProceed={selectedSizeId !== ""}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <WholeCakeOptionsStep
          cake={selectedCake}
          selectedOptionIds={selectedOptionIds}
          onOptionsChange={setSelectedOptionIds}
          total={total}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && selectedSize && (
        <WholeCakeConfirmStep
          cake={selectedCake}
          candleOptions={candleOptions}
          selectedSize={selectedSize}
          candles={candles}
          messageText={messageText}
          selectedOptionIds={selectedOptionIds}
          allergyNote={allergyNote}
          onAllergyChange={setAllergyNote}
          total={total}
          onAddToCart={() => router.push("/customer/takeout/products")}
          onProceedToDateTime={() => router.push("/customer/takeout/pickup")}
        />
      )}
    </div>
  );
}
