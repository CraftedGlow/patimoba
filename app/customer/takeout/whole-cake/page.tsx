"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
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
import { fetchNoshiByIds, NoshiItem } from "@/hooks/use-noshi";
import type {
  UICartItem,
  CartCandleEntry,
  CartCakeOptionEntry,
  DecorationGroupWithItems,
  WholeCakeProduct,
} from "@/lib/types";
import type { CandleOption } from "@/hooks/use-whole-cakes";

const wholeCakeSteps = ["基本選択", "デコレーション", "内容確認"];

export default function WholeCakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cakeIdParam = searchParams.get("cakeId");
  const mode = searchParams.get("mode");
  const isPrintMode = mode === "print";
  const noshiIdParam = searchParams.get("noshiId");
  const noshiPurposeParam = searchParams.get("noshiPurpose") || undefined;
  const noshiNameParam = searchParams.get("noshiName") || undefined;
  const [noshiDesign, setNoshiDesign] = useState<NoshiItem | null>(null);

  useEffect(() => {
    if (!noshiIdParam) { setNoshiDesign(null); return; }
    fetchNoshiByIds([noshiIdParam]).then((items) => setNoshiDesign(items[0] ?? null));
  }, [noshiIdParam]);

  const { selectedStoreId, profile,
    points, } = useCustomerContext();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

  const { wholeCakes, loading } = useWholeCakes(selectedStoreId ?? "");

  // カテゴリ=printのデコレーションを直接取得（グループ紐付け不要）
  const [printDeco, setPrintDeco] = useState<{ id: string; name: string; price: number; imageUrl: string | null; preparationDays: number | null } | null>(null);
  const [printGroupLoading, setPrintGroupLoading] = useState(false);

  useEffect(() => {
    if (!selectedStoreId || loading) return;
    setPrintGroupLoading(true);
    supabase
      .from("decorations")
      .select("id, name, price, image_url, preparation_days")
      .eq("store_id", selectedStoreId)
      .eq("category", "print")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPrintDeco(
          data
            ? {
                id: String(data.id),
                name: data.name ?? "プリントデコレーション",
                price: Number(data.price) || 0,
                imageUrl: data.image_url ?? null,
                preparationDays: data.preparation_days != null ? Number(data.preparation_days) : null,
              }
            : null
        );
        setPrintGroupLoading(false);
      });
  }, [selectedStoreId, loading]);

  // プリントデコレーション対応ケーキのみ対象
  const printCakes = useMemo(() => {
    if (!isPrintMode || !printDeco) return [];
    return wholeCakes.filter((c) => c.printDecorationEnabled);
  }, [isPrintMode, printDeco, wholeCakes]);

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

  // 選択中ケーキの custom_options からろうそく・プレート設定を導出
  const candleCustomOption = selectedCake?.customOptions?.find((o) => o.name === "ろうそく");
  const candleOptions: CandleOption[] = (candleCustomOption?.values ?? []).map((v, i) => ({
    id: String(i),
    name: v.label,
    price: v.additional_price,
    storeId: selectedStoreId ?? "",
  }));
  const hasCandles = !!candleCustomOption;

  const messagePlateOption = selectedCake?.customOptions?.find((o) => o.name === "メッセージプレート");
  const hasMessagePlate = !!messagePlateOption;
  const messagePlateRequired = messagePlateOption?.required ?? false;
  const messagePlateSizes = messagePlateOption?.values ?? [];

  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [candles, setCandles] = useState<CandleEntry[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedMessagePlateIdx, setSelectedMessagePlateIdx] = useState("");
  const [selectedDecorations, setSelectedDecorations] = useState<Record<string, string[]>>({});
  const [allergyNote, setAllergyNote] = useState("");
  const [printPhotoUrl, setPrintPhotoUrl] = useState<string | null>(null);
  const [uploadingPrintPhoto, setUploadingPrintPhoto] = useState(false);

  // ケーキ切り替え時にサイズ・ろうそく・メッセージをリセット
  useEffect(() => {
    setSelectedSizeId("");
    setCandles([]);
    setMessageText("");
    setSelectedMessagePlateIdx("");
  }, [selectedCakeIdForPrint]);

  const { groups: linkedDecorationGroups, loading: groupsLoading } = useProductDecorationGroups(
    selectedCake?.id
  );

  // 通常モードでprint_decoration_enabledのケーキには、グループ紐付け不要で
  // プリントデコレーションの選択肢を自動的に差し込む
  const decorationGroups = useMemo<DecorationGroupWithItems[]>(() => {
    if (isPrintMode || !selectedCake?.printDecorationEnabled || !printDeco) return linkedDecorationGroups;
    const alreadyLinked = linkedDecorationGroups.some((g) =>
      g.items.some((item) => item.category === "print")
    );
    if (alreadyLinked) return linkedDecorationGroups;
    const printGroup: DecorationGroupWithItems = {
      id: "print-deco-virtual",
      storeId: selectedCake.storeId,
      name: "プリントデコレーション",
      description: null,
      selectionType: "single",
      maxSelections: null,
      required: false,
      displayOrder: 9999,
      items: [{
        id: printDeco.id,
        name: printDeco.name,
        description: null,
        imageUrl: printDeco.imageUrl,
        category: "print",
        price: printDeco.price,
        isActive: true,
        isSeasonal: false,
        seasonStart: null,
        seasonEnd: null,
        preparationDays: printDeco.preparationDays,
        displayOrder: 9999,
      }],
    };
    return [...linkedDecorationGroups, printGroup];
  }, [isPrintMode, selectedCake, printDeco, linkedDecorationGroups]);


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

  const total = sizePrice + candleTotal + decorationTotal + (noshiDesign?.price ?? 0);

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

    // 選択されたメッセージプレート種類をオプションに追加
    if (hasMessagePlate && messagePlateSizes.length > 0 && selectedMessagePlateIdx !== "") {
      const idx = parseInt(selectedMessagePlateIdx, 10);
      const plateSize = messagePlateSizes[idx];
      if (plateSize) {
        cakeOptions.push({
          wholeCakeOptionId: `plate-${idx}`,
          name: plateSize.label,
          price: plateSize.additional_price,
          groupName: "メッセージプレート",
        });
      }
    }

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
        ...(noshiDesign ? {
          noshi: {
            id: noshiDesign.id,
            name: noshiDesign.name,
            purpose: noshiPurposeParam,
            displayName: noshiNameParam,
            price: noshiDesign.price,
          },
        } : {}),
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

  // デコレーションは任意なので常にfalse
  const hasRequiredUnfilled = false;

  // Non-print regular decoration check for confirm step upload
  const hasPrintDecorationFromRegularMode = !isPrintMode && decorationGroups.some(
    (g) => g.items.some((item) => item.category === "print") && (selectedDecorations[g.id] ?? []).length > 0
  );

  // Step 1 can proceed
  const messagePlateOk = !hasMessagePlate || !messagePlateRequired || (
    messagePlateSizes.length > 0 ? selectedMessagePlateIdx !== "" : messageText.trim() !== ""
  );
  const canProceedStep1 = isPrintMode
    ? (!!selectedCakeIdForPrint && selectedSizeId !== "" && messagePlateOk && !!printPhotoUrl)
    : (selectedSizeId !== "" && messagePlateOk);

  const isPageLoading = loading || (isPrintMode && printGroupLoading);

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LineSpinner size={24} />
      </div>
    );
  }

  if (!isPrintMode && !selectedCake) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerHeader userName={profile?.lineName} avatarUrl={profile?.avatar || undefined} points={points} onCartClick={() => setCartOpen(true)} />
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
        <CustomerHeader userName={profile?.lineName} avatarUrl={profile?.avatar || undefined} points={points} onCartClick={() => setCartOpen(true)} />
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
        points={points}
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
          hasCandles={hasCandles}
          hasMessagePlate={hasMessagePlate}
          messagePlateRequired={messagePlateRequired}
          messagePlateSizes={messagePlateSizes}
          selectedMessagePlateIdx={selectedMessagePlateIdx}
          onMessagePlateIdxChange={setSelectedMessagePlateIdx}
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
          excludeGroupIds={undefined}
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
          selectedMessagePlateIdx={selectedMessagePlateIdx}
          messagePlateSizes={messagePlateSizes}
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
