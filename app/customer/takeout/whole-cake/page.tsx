"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { WholeCakeBasicStep } from "@/components/customer/whole-cake/basic-step";
import { WholeCakeOptionsStep } from "@/components/customer/whole-cake/options-step";
import { WholeCakeConfirmStep } from "@/components/customer/whole-cake/confirm-step";
import type { CandleEntry } from "@/components/customer/whole-cake/basic-step";
import { useWholeCakes } from "@/hooks/use-whole-cakes";
import { useProductDecorationGroups } from "@/hooks/use-decoration-groups";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import type {
  UICartItem,
  CartCandleEntry,
  CartCakeOptionEntry,
  DecorationGroupWithItems,
} from "@/lib/types";

const wholeCakeSteps = ["基本選択", "デコレーション", "内容確認"];

export default function WholeCakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cakeIdParam = searchParams.get("cakeId");
  const { selectedStoreId, profile } = useCustomerContext();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

  const { wholeCakes, candleOptions, loading } = useWholeCakes(
    selectedStoreId ?? ""
  );

  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [candles, setCandles] = useState<CandleEntry[]>([]);
  const [messageText, setMessageText] = useState("");
  // グループID → 選択済みデコレーションID[]
  const [selectedDecorations, setSelectedDecorations] = useState<Record<string, string[]>>({});
  const [allergyNote, setAllergyNote] = useState("");

  const selectedCake = useMemo(() => {
    if (cakeIdParam) {
      return wholeCakes.find((c) => c.id === cakeIdParam) ?? null;
    }
    return wholeCakes[0] ?? null;
  }, [wholeCakes, cakeIdParam]);

  // 選択中のケーキに紐付いたデコレーショングループを取得
  const { groups: decorationGroups, loading: groupsLoading } = useProductDecorationGroups(
    selectedCake?.id
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!selectedCake) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerHeader
          userName={profile?.lineName}
          avatarUrl={profile?.avatar || undefined}
          points={0}
          onCartClick={() => setCartOpen(true)}
        />
        <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
          ホールケーキが見つかりません
        </div>
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>
    );
  }

  const selectedSize = selectedCake.sizes.find((s) => s.id === selectedSizeId);
  const sizePrice = selectedSize?.price ?? 0;

  const candleTotal = candles.reduce((sum, c) => {
    const opt = candleOptions.find((o) => o.id === c.candleOptionId);
    const qty = Number(c.quantity) || 0;
    return sum + (opt?.price ?? 0) * qty;
  }, 0);

  // selectedDecorations から合計金額を計算
  const decorationTotal = decorationGroups.reduce((sum, group) => {
    const ids = selectedDecorations[group.id] ?? [];
    return sum + ids.reduce((s, did) => {
      const dec = group.items.find((item) => item.id === did);
      return s + (dec?.price ?? 0);
    }, 0);
  }, 0);

  const total = sizePrice + candleTotal + decorationTotal;

  const buildCartItem = (): UICartItem | null => {
    if (!selectedSize) return null;

    const validCandles: CartCandleEntry[] = candles
      .filter((c) => c.candleOptionId && Number(c.quantity) > 0)
      .map((c) => {
        const opt = candleOptions.find((o) => o.id === c.candleOptionId);
        return {
          candleOptionId: c.candleOptionId,
          name: opt?.name || "",
          price: Number(opt?.price) || 0,
          quantity: Number(c.quantity) || 0,
        };
      });

    // selectedDecorations をフラット化して CartCakeOptionEntry[] に変換
    const cakeOptions: CartCakeOptionEntry[] = decorationGroups.flatMap((group) => {
      const ids = selectedDecorations[group.id] ?? [];
      const entries: CartCakeOptionEntry[] = [];
      for (const did of ids) {
        const dec = group.items.find((item) => item.id === did);
        if (dec) {
          entries.push({
            wholeCakeOptionId: did,
            name: dec.name,
            price: dec.price,
            groupName: group.name,
          });
        }
      }
      return entries;
    });

    return {
      productId: selectedCake.id,
      name: selectedCake.name,
      price: 0,
      quantity: 1,
      image: selectedCake.image,
      storeId: selectedCake.storeId,
      isCustomCake: true,
      uid: `wc-${selectedCake.id}-${Date.now()}`,
      customization: {
        sizeId: selectedSize.id,
        sizeLabel: selectedSize.name,
        sizePrice: Number(selectedSize.price) || 0,
        candles: validCandles,
        options: cakeOptions,
        messagePlate: messageText || undefined,
        allergyNote: allergyNote || undefined,
      },
    };
  };

  const handleAddToCart = () => {
    const item = buildCartItem();
    if (!item) return;
    const res = addItem({ ...item, isTakeout: true });
    if (!res.ok) { alert(res.error || "カートに追加できませんでした"); return; }
    router.push("/customer/takeout/products");
  };

  const handleProceedToDateTime = () => {
    const item = buildCartItem();
    if (!item) return;
    const res = addItem({ ...item, isTakeout: true });
    if (!res.ok) { alert(res.error || "カートに追加できませんでした"); return; }
    router.push("/customer/takeout/pickup");
  };

  // 必須グループが未選択の場合は次へ進めない
  const hasRequiredUnfilled = decorationGroups.some(
    (g) => g.required && (selectedDecorations[g.id] ?? []).length === 0
  );

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
      />

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
          canProceed={selectedSizeId !== "" && messageText.trim() !== ""}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <WholeCakeOptionsStep
          cake={selectedCake}
          decorationGroups={decorationGroups}
          groupsLoading={groupsLoading}
          selectedDecorations={selectedDecorations}
          onDecorationsChange={setSelectedDecorations}
          total={total}
          hasRequiredUnfilled={hasRequiredUnfilled}
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
          decorationGroups={decorationGroups}
          selectedDecorations={selectedDecorations}
          allergyNote={allergyNote}
          onAllergyChange={setAllergyNote}
          total={total}
          onAddToCart={handleAddToCart}
          onProceedToDateTime={handleProceedToDateTime}
        />
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
