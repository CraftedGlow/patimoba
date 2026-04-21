"use client";

import { useMemo, useState, useEffect } from "react";
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
import { uploadPrintPhoto } from "@/lib/upload-image";
import { supabase } from "@/lib/supabase";
import type {
  UICartItem,
  CartCandleEntry,
  CartCakeOptionEntry,
  DecorationGroupWithItems,
  WholeCakeProduct,
} from "@/lib/types";

const wholeCakeSteps = ["基本選択", "デコレーション", "内容確認"];

export default function WholeCakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cakeIdParam = searchParams.get("cakeId");
  const mode = searchParams.get("mode");
  const isPrintMode = mode === "print";

  const { selectedStoreId, profile } = useCustomerContext();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

  const { wholeCakes, candleOptions, loading } = useWholeCakes(selectedStoreId ?? "");

  // Print mode: store data about the プリントデコレーション group
  const [printGroupData, setPrintGroupData] = useState<{
    groupId: string;
    itemId: string;
    price: number;
    cakeIds: string[];
  } | null>(null);
  const [printGroupLoading, setPrintGroupLoading] = useState(false);

  useEffect(() => {
    if (!isPrintMode || !selectedStoreId || loading) return;
    setPrintGroupLoading(true);
    (async () => {
      const { data: groups } = await supabase
        .from("decoration_groups")
        .select(`id, decoration_group_items(decorations(id, price))`)
        .eq("store_id", selectedStoreId)
        .ilike("name", "%プリントデコレーション%")
        .limit(1);
      const group = groups?.[0];
      if (!group) { setPrintGroupLoading(false); return; }
      const firstDeco = (group.decoration_group_items?.[0] as any)?.decorations;
      if (!firstDeco) { setPrintGroupLoading(false); return; }
      const { data: links } = await supabase
        .from("product_decoration_groups")
        .select("product_id")
        .eq("group_id", group.id);
      const cakeIds = (links ?? []).map((l: any) => String(l.product_id));
      setPrintGroupData({
        groupId: String(group.id),
        itemId: String(firstDeco.id),
        price: Number(firstDeco.price) || 0,
        cakeIds,
      });
      setPrintGroupLoading(false);
    })();
  }, [isPrintMode, selectedStoreId, loading]);

  // Print mode: filter to cakes that have the print group
  const printCakes = useMemo(() => {
    if (!isPrintMode || !printGroupData) return [];
    return wholeCakes.filter((c) => printGroupData.cakeIds.includes(c.id));
  }, [isPrintMode, printGroupData, wholeCakes]);

  // Selected cake
  const [selectedCakeIdForPrint, setSelectedCakeIdForPrint] = useState<string | null>(null);

  const selectedCake = useMemo(() => {
    if (isPrintMode) {
      return wholeCakes.find((c) => c.id === selectedCakeIdForPrint) ?? null;
    }
    if (cakeIdParam) {
      return wholeCakes.find((c) => c.id === cakeIdParam) ?? null;
    }
    return wholeCakes[0] ?? null;
  }, [isPrintMode, selectedCakeIdForPrint, wholeCakes, cakeIdParam]);

  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [candles, setCandles] = useState<CandleEntry[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedDecorations, setSelectedDecorations] = useState<Record<string, string[]>>({});
  const [allergyNote, setAllergyNote] = useState("");
  const [printPhotoUrl, setPrintPhotoUrl] = useState<string | null>(null);
  const [uploadingPrintPhoto, setUploadingPrintPhoto] = useState(false);

  // Reset size when cake changes in print mode
  useEffect(() => {
    setSelectedSizeId("");
  }, [selectedCakeIdForPrint]);

  const { groups: decorationGroups, loading: groupsLoading } = useProductDecorationGroups(
    selectedCake?.id
  );

  // Auto-select the print decoration item when groups load (print mode)
  useEffect(() => {
    if (!isPrintMode || !printGroupData || decorationGroups.length === 0) return;
    const printGroup = decorationGroups.find((g) => g.id === printGroupData.groupId);
    if (!printGroup) return;
    setSelectedDecorations((prev) => ({
      ...prev,
      [printGroupData.groupId]: [printGroupData.itemId],
    }));
  }, [isPrintMode, printGroupData?.groupId, printGroupData?.itemId, decorationGroups]);

  const selectedSize = selectedCake?.sizes.find((s) => s.id === selectedSizeId);
  const sizePrice = selectedSize?.price ?? 0;

  const candleTotal = candles.reduce((sum, c) => {
    const opt = candleOptions.find((o) => o.id === c.candleOptionId);
    const qty = Number(c.quantity) || 0;
    return sum + (opt?.price ?? 0) * qty;
  }, 0);

  const decorationTotal = decorationGroups.reduce((sum, group) => {
    const ids = selectedDecorations[group.id] ?? [];
    return sum + ids.reduce((s, did) => {
      const dec = group.items.find((item) => item.id === did);
      return s + (dec?.price ?? 0);
    }, 0);
  }, 0);

  const total = sizePrice + candleTotal + decorationTotal;

  const handlePrintPhotoUpload = async (file: File) => {
    if (!selectedStoreId) return;
    setUploadingPrintPhoto(true);
    const { url, error } = await uploadPrintPhoto(file, selectedStoreId);
    setUploadingPrintPhoto(false);
    if (error) { alert(`写真のアップロードに失敗しました: ${error}`); return; }
    setPrintPhotoUrl(url);
  };

  const buildCartItem = (): UICartItem | null => {
    if (!selectedSize || !selectedCake) return null;

    const validCandles: CartCandleEntry[] = candles
      .filter((c) => c.candleOptionId && Number(c.quantity) > 0)
      .map((c) => {
        const opt = candleOptions.find((o) => o.id === c.candleOptionId);
        const isNumber = opt?.name === "ナンバーキャンドル";
        const name = isNumber && c.digit ? `${opt?.name}(${c.digit})` : opt?.name || "";
        return {
          candleOptionId: c.candleOptionId,
          name,
          price: Number(opt?.price) || 0,
          quantity: Number(c.quantity) || 0,
        };
      });

    const cakeOptions: CartCakeOptionEntry[] = decorationGroups.flatMap((group) => {
      const ids = selectedDecorations[group.id] ?? [];
      return ids.flatMap((did) => {
        const dec = group.items.find((item) => item.id === did);
        if (!dec) return [];
        return [{
          wholeCakeOptionId: did,
          name: dec.name,
          price: dec.price,
          groupName: group.name,
        }];
      });
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
        printPhotoUrl: printPhotoUrl || undefined,
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

  // Required groups check: exclude print group in print mode
  const hasRequiredUnfilled = decorationGroups
    .filter((g) => !isPrintMode || g.id !== printGroupData?.groupId)
    .some((g) => g.required && (selectedDecorations[g.id] ?? []).length === 0);

  // Non-print regular decoration check for confirm step upload
  const hasPrintDecorationFromRegularMode = !isPrintMode && decorationGroups.some(
    (g) => g.name.includes("プリント") && (selectedDecorations[g.id] ?? []).length > 0
  );

  // Step 1 can proceed
  const canProceedStep1 = isPrintMode
    ? (!!selectedCakeIdForPrint && selectedSizeId !== "" && messageText.trim() !== "")
    : (selectedSizeId !== "" && messageText.trim() !== "");

  const isPageLoading = loading || (isPrintMode && printGroupLoading);

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!isPrintMode && !selectedCake) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerHeader userName={profile?.lineName} avatarUrl={profile?.avatar || undefined} points={0} onCartClick={() => setCartOpen(true)} />
        <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
          ホールケーキが見つかりません
        </div>
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>
    );
  }

  if (isPrintMode && printCakes.length === 0 && !printGroupLoading) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerHeader userName={profile?.lineName} avatarUrl={profile?.avatar || undefined} points={0} onCartClick={() => setCartOpen(true)} />
        <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
          プリントデコレーション対象のケーキが見つかりません
        </div>
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>
    );
  }

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

      {isPrintMode && (
        <div className="px-4 pb-1">
          <p className="text-base font-bold">プリントデコレーション</p>
        </div>
      )}

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
          canProceed={canProceedStep1}
          onNext={() => setStep(2)}
          isPrintMode={isPrintMode}
          printCakes={printCakes}
          selectedCakeIdForPrint={selectedCakeIdForPrint}
          onCakeSelectForPrint={setSelectedCakeIdForPrint}
          printPhotoUrl={printPhotoUrl}
          uploadingPrintPhoto={uploadingPrintPhoto}
          onPrintPhotoUpload={handlePrintPhotoUpload}
          onPrintPhotoRemove={() => setPrintPhotoUrl(null)}
        />
      )}

      {step === 2 && selectedCake && (
        <WholeCakeOptionsStep
          cake={selectedCake}
          decorationGroups={decorationGroups}
          groupsLoading={groupsLoading}
          selectedDecorations={selectedDecorations}
          onDecorationsChange={setSelectedDecorations}
          total={total}
          hasRequiredUnfilled={hasRequiredUnfilled}
          excludeGroupIds={isPrintMode && printGroupData ? [printGroupData.groupId] : undefined}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && selectedSize && selectedCake && (
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
          showPrintPhotoUpload={hasPrintDecorationFromRegularMode}
          printPhotoUrl={printPhotoUrl}
          uploadingPrintPhoto={uploadingPrintPhoto}
          onPrintPhotoUpload={handlePrintPhotoUpload}
          onPrintPhotoRemove={() => setPrintPhotoUrl(null)}
          onAddToCart={handleAddToCart}
          onProceedToDateTime={handleProceedToDateTime}
        />
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
