"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useProduct } from "@/hooks/use-products";
import { useProductRegistration } from "@/hooks/use-product-registrations";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

// アレルゲン定義（表示名 + 検索キーワード）
const ALLERGEN_DEFS: { display: string; keywords: string[] }[] = [
  { display: "えび", keywords: ["えび", "エビ", "海老"] },
  { display: "かに", keywords: ["かに", "カニ", "蟹"] },
  { display: "くるみ", keywords: ["くるみ", "クルミ"] },
  { display: "小麦", keywords: ["小麦", "薄力粉", "強力粉", "中力粉", "小麦粉"] },
  { display: "そば", keywords: ["そば", "ソバ", "蕎麦"] },
  { display: "卵", keywords: ["卵", "タマゴ", "たまご", "玉子"] },
  { display: "乳", keywords: ["乳", "ミルク", "バター", "チーズ", "ヨーグルト", "生クリーム", "脱脂粉乳", "クリーム"] },
  { display: "落花生（ピーナッツ）", keywords: ["落花生", "ピーナッツ"] },
  { display: "アーモンド", keywords: ["アーモンド"] },
  { display: "あわび", keywords: ["あわび", "アワビ", "鮑"] },
  { display: "いか", keywords: ["いか", "イカ", "烏賊"] },
  { display: "いくら", keywords: ["いくら", "イクラ"] },
  { display: "オレンジ", keywords: ["オレンジ"] },
  { display: "カシューナッツ", keywords: ["カシューナッツ"] },
  { display: "キウイフルーツ", keywords: ["キウイ", "キウイフルーツ"] },
  { display: "牛肉", keywords: ["牛肉", "ビーフ", "牛"] },
  { display: "ごま", keywords: ["ごま", "ゴマ", "胡麻"] },
  { display: "さけ", keywords: ["さけ", "サケ", "サーモン", "鮭"] },
  { display: "さば", keywords: ["さば", "サバ", "鯖"] },
  { display: "大豆", keywords: ["大豆", "だいず"] },
  { display: "鶏肉", keywords: ["鶏肉", "チキン", "鶏"] },
  { display: "バナナ", keywords: ["バナナ"] },
  { display: "豚肉", keywords: ["豚肉", "ポーク", "豚"] },
  { display: "マカダミアナッツ", keywords: ["マカダミアナッツ"] },
  { display: "もも", keywords: ["もも", "モモ", "桃"] },
  { display: "やまいも", keywords: ["やまいも", "山芋", "ヤマイモ", "長芋", "山イモ"] },
  { display: "りんご", keywords: ["りんご", "リンゴ", "林檎", "アップル"] },
  { display: "ゼラチン", keywords: ["ゼラチン"] },
];

function detectAllergens(ingredients: string | null | undefined): string[] {
  if (!ingredients) return [];
  const found: string[] = [];
  for (const { display, keywords } of ALLERGEN_DEFS) {
    if (keywords.some((kw) => ingredients.includes(kw))) {
      found.push(display);
    }
  }
  return found;
}

function formatBestBefore(days: number | null | undefined): string | null {
  if (!days) return null;
  if (days % 7 === 0) return `発送日より${days / 7}週間`;
  return `発送日より${days}日`;
}

export default function ECProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedStoreName, selectedStoreId, setSelectedStoreId, profile } = useCustomerContext();
  const storeFromUrl = searchParams.get("store");
  const effectiveStoreId = selectedStoreId || storeFromUrl || "";
  const { product, loading } = useProduct(params.id as string);
  const { product: productReg } = useProductRegistration(params.id as string);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [showQuantityDropdown, setShowQuantityDropdown] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<number, string[]>>({});
  const [optionTexts, setOptionTexts] = useState<Record<number, string>>({});

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!product) return null;

  const customOptions = productReg?.custom_options || [];

  const missingRequired = customOptions.some((opt, i) => {
    if (!opt.required) return false;
    if (opt.type === "text") return !(optionTexts[i] || "").trim();
    return !(optionSelections[i] && optionSelections[i].length > 0);
  });

  const optionsAdditional = customOptions.reduce((sum, opt, i) => {
    if (opt.type === "text") return sum;
    const selectedLabels = optionSelections[i] || [];
    return (
      sum +
      opt.values
        .filter((v) => selectedLabels.includes(v.label))
        .reduce((s, v) => s + (v.additional_price || 0), 0)
    );
  }, 0);

  const allergens = detectAllergens(productReg?.ingredients);
  const bestBeforeText = formatBestBefore(productReg?.best_before_days);

  // 表示する商品情報行
  const infoRows: { label: string; value: string }[] = [
    productReg?.content_quantity ? { label: "内容量", value: productReg.content_quantity } : null,
    productReg?.ingredients ? { label: "原材料", value: productReg.ingredients } : null,
    allergens.length > 0 ? { label: "アレルゲン", value: allergens.join("、") } : null,
    bestBeforeText ? { label: "賞味期限", value: bestBeforeText } : null,
    productReg?.storage_method ? { label: "保存方法", value: productReg.storage_method } : null,
    productReg?.shipping_method ? { label: "発送方法", value: productReg.shipping_method } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);

  const handleAddToCart = () => {
    if (missingRequired) {
      setErrorMsg("必須のオプションを選択してください");
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }
    const cartCustomOptions = customOptions
      .map((opt, i) => {
        if (opt.type === "text") {
          const v = (optionTexts[i] || "").trim();
          return v ? { name: opt.name, values: [v], additionalPrice: 0 } : null;
        }
        const selectedLabels = optionSelections[i] || [];
        if (selectedLabels.length === 0) return null;
        const additionalPrice = opt.values
          .filter((v) => selectedLabels.includes(v.label))
          .reduce((s, v) => s + (v.additional_price || 0), 0);
        return { name: opt.name, values: selectedLabels, additionalPrice };
      })
      .filter((v): v is { name: string; values: string[]; additionalPrice: number } => v != null);

    if (storeFromUrl && !selectedStoreId) setSelectedStoreId(storeFromUrl);

    const res = addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image || "",
      quantity,
      storeId: effectiveStoreId,
      isEc: true,
      customization: cartCustomOptions.length > 0 ? { customOptions: cartCustomOptions } : undefined,
    });

    if (!res.ok) {
      setErrorMsg(res.error || "カートに追加できませんでした");
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }

    router.push(effectiveStoreId ? `/customer/ec/products?store=${effectiveStoreId}` : "/customer/ec/products");
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
        showBack
      />

      <StepProgress currentStep={2} steps={ecSteps} />

      <div className="px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] mb-4"
        >
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>

          <div className="flex items-start justify-between mt-3 gap-4">
            <div>
              <p>
                <span className="text-3xl font-bold text-gray-900">
                  {((product.price + optionsAdditional) * quantity).toLocaleString()}
                </span>
                <span className="text-base text-gray-600 ml-1">円（税込）</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">* 配送料は別途かかります</p>
            </div>

            {/* 数量 */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowQuantityDropdown(!showQuantityDropdown)}
                className="border border-gray-200 rounded-lg px-4 py-2.5 min-w-[4rem] bg-[#FFF9C4] flex items-center gap-2"
              >
                <span className="font-bold text-base">{quantity}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showQuantityDropdown ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {showQuantityDropdown && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setShowQuantityDropdown(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 min-w-[80px] max-h-[200px] overflow-y-auto"
                    >
                      {Array.from({ length: product.maxQuantity }, (_, i) => i + 1).map((num) => (
                        <button
                          key={num}
                          onClick={() => { setQuantity(num); setShowQuantityDropdown(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-2"
                        >
                          {quantity === num && <span className="text-amber-600">✓</span>}
                          <span>{num}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* カートに追加ボタン */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddToCart}
            className="w-full mt-5 mb-5 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors"
          >
            カートに追加
          </motion.button>

          {/* 商品説明 */}
          {product.description && (
            <p className="text-gray-600 text-sm mt-2 mb-5 whitespace-pre-line leading-relaxed">
              {product.description}
            </p>
          )}

          {/* カスタムオプション */}
          {customOptions.length > 0 && (
            <div className="mb-6 space-y-5">
              {customOptions.map((opt, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{opt.name}</h3>
                    {opt.required ? (
                      <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">必須</span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-500">任意</span>
                    )}
                  </div>

                  {opt.type === "text" && (
                    <textarea
                      value={optionTexts[i] || ""}
                      onChange={(e) => setOptionTexts((prev) => ({ ...prev, [i]: e.target.value }))}
                      rows={2}
                      placeholder="メッセージを入力"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                    />
                  )}

                  {opt.type === "single" && (
                    <div className="space-y-1.5">
                      {opt.values.map((v) => {
                        const active = (optionSelections[i] || [])[0] === v.label;
                        return (
                          <button
                            key={v.label} type="button"
                            onClick={() => setOptionSelections((prev) => ({ ...prev, [i]: [v.label] }))}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${active ? "border-amber-400 bg-amber-50 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-4 h-4 rounded-full border-2 ${active ? "border-amber-500 bg-amber-500" : "border-gray-300"}`} />
                              {v.label}
                            </span>
                            {v.additional_price > 0 && <span className="text-xs text-gray-600">+¥{v.additional_price.toLocaleString()}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {opt.type === "multiple" && (
                    <div className="space-y-1.5">
                      {opt.values.map((v) => {
                        const active = (optionSelections[i] || []).includes(v.label);
                        return (
                          <button
                            key={v.label} type="button"
                            onClick={() => setOptionSelections((prev) => {
                              const cur = prev[i] || [];
                              return { ...prev, [i]: active ? cur.filter((x) => x !== v.label) : [...cur, v.label] };
                            })}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${active ? "border-amber-400 bg-amber-50 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${active ? "border-amber-500 bg-amber-500 text-white" : "border-gray-300"}`}>
                                {active && <span className="text-[10px] leading-none">✓</span>}
                              </span>
                              {v.label}
                            </span>
                            {v.additional_price > 0 && <span className="text-xs text-gray-600">+¥{v.additional_price.toLocaleString()}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 商品情報テーブル */}
          {infoRows.length > 0 && (
            <div className="mt-4 border border-gray-300 rounded-sm overflow-hidden">
              {infoRows.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex text-sm ${i < infoRows.length - 1 ? "border-b border-gray-300" : ""}`}
                >
                  <div className="w-24 shrink-0 px-3 py-3 text-gray-600 bg-gray-50 border-r border-gray-300 flex items-start">
                    {row.label}
                  </div>
                  <div className={`flex-1 px-3 py-3 text-gray-800 leading-relaxed ${row.label === "アレルゲン" ? "font-medium" : ""}`}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] bg-red-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg"
          >
            {errorMsg}
          </motion.div>
        )}
        {showToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"
              >
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <p className="text-base font-bold text-gray-900">カートに追加しました</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        proceedPath="/customer/ec/shipping"
        proceedLabel="配送先を入力する"
      />
    </div>
  );
}
