"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useProductRegistration } from "@/hooks/use-product-registrations";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { fetchNoshiByIds, NoshiItem } from "@/hooks/use-noshi";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];
const DIGIT_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function TakeoutProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { selectedStoreId, profile,
    points, } = useCustomerContext();
  const { product, loading } = useProductRegistration(params.id as string);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [showQuantityDropdown, setShowQuantityDropdown] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // カスタムオプション
  const [optionSelections, setOptionSelections] = useState<Record<number, string[]>>({});
  const [optionTexts, setOptionTexts] = useState<Record<number, string>>({});
  // ナンバーキャンドル: {digit, qty}の配列
  const [numberCandleSelections, setNumberCandleSelections] = useState<{digit: string; qty: number}[]>([]);
  // ナンバーキャンドルの index（customOptions の何番目か）
  const [numberCandleOptionIndex, setNumberCandleOptionIndex] = useState<number>(-1);

  // のし
  const [noshiItems, setNoshiItems] = useState<NoshiItem[]>([]);
  const [selectedNoshiId, setSelectedNoshiId] = useState<string | null>(null);
  const [noshiName, setNoshiName] = useState("");

  useEffect(() => {
    if (product?.noshi_enabled && product.noshi_ids?.length) {
      fetchNoshiByIds(product.noshi_ids).then(setNoshiItems);
    }
  }, [product?.id, product?.noshi_enabled]);

  // ナンバーキャンドルのインデックスを特定
  useEffect(() => {
    if (!product) return;
    const opts = product.custom_options || [];
    const idx = opts.findIndex(
      (o) => o.values.some((v) => v.label === "ナンバーキャンドル")
    );
    setNumberCandleOptionIndex(idx);
  }, [product?.id]);

  const handleStepClick = (step: number) => {
    if (step === 1) router.push("/customer/takeout");
    if (step === 2 && selectedStoreId) router.push(`/customer/takeout/products?store=${selectedStoreId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <CustomerHeader showBack userName={profile?.lineName} avatarUrl={profile?.avatar || undefined} points={points} onCartClick={() => setCartOpen(true)} />
        <StepProgress currentStep={2} steps={steps} onStepClick={handleStepClick} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const customOptions = product.custom_options || [];
  const maxQty = 10;

  // 期間限定
  const isLimited = !!(product.limited_from || product.limited_until);
  const limitedNote = (() => {
    if (!isLimited) return null;
    const fmt = (s: string) => { const d = new Date(s); return `${d.getMonth() + 1}月${d.getDate()}日`; };
    if (product.limited_from && product.limited_until) return `${fmt(product.limited_from)} 〜 ${fmt(product.limited_until)} の期間受け取り可能`;
    if (product.limited_until) return `${fmt(product.limited_until)} まで受け取り可能`;
    return null;
  })();

  // 必須項目チェック
  const missingRequired = customOptions.some((opt, i) => {
    if (i === numberCandleOptionIndex) return false; // ナンバーキャンドルは別管理
    if (!opt.required) return false;
    if (opt.type === "text") return !(optionTexts[i] || "").trim();
    return !(optionSelections[i] && optionSelections[i].length > 0);
  });

  // 合計追加金額
  const selectedNoshi = noshiItems.find((n) => n.id === selectedNoshiId) ?? null;
  const noshiAdditional = selectedNoshi?.price ?? 0;

  const numberCandleTotalCount = numberCandleSelections.reduce((s, r) => s + r.qty, 0);

  const optionsAdditional = customOptions.reduce((sum, opt, i) => {
    if (opt.type === "text") return sum;
    if (i === numberCandleOptionIndex) {
      const unitPrice = opt.values.find((v) => v.label === "ナンバーキャンドル")?.additional_price ?? 0;
      return sum + numberCandleTotalCount * unitPrice;
    }
    const selectedLabels = optionSelections[i] || [];
    return sum + opt.values.filter((v) => selectedLabels.includes(v.label)).reduce((s, v) => s + (v.additional_price || 0), 0);
  }, 0);

  const handleAddToCart = () => {
    if (missingRequired) {
      alert("必須のオプションを選択してください");
      return;
    }

    const cartCustomOptions = customOptions.flatMap((opt, i) => {
      if (i === numberCandleOptionIndex) {
        const digits = numberCandleSelections.flatMap((s) => Array(s.qty).fill(s.digit));
        if (digits.length === 0) return [];
        const unitPrice = opt.values.find((v) => v.label === "ナンバーキャンドル")?.additional_price ?? 0;
        return [{
          name: "ナンバーキャンドル",
          values: digits,
          additionalPrice: digits.length * unitPrice,
        }];
      }
      if (opt.type === "text") {
        const v = (optionTexts[i] || "").trim();
        return v ? [{ name: opt.name, values: [v], additionalPrice: 0 }] : [];
      }
      const selectedLabels = optionSelections[i] || [];
      if (selectedLabels.length === 0) return [];
      const additionalPrice = opt.values.filter((v) => selectedLabels.includes(v.label)).reduce((s, v) => s + (v.additional_price || 0), 0);
      return [{ name: opt.name, values: selectedLabels, additionalPrice }];
    });

    const res = addItem({
      productId: product.id,
      name: product.name,
      price: product.base_price,
      image: product.image || "",
      quantity,
      storeId: product.store_id,
      isTakeout: true,
      customization: (cartCustomOptions.length > 0 || selectedNoshi)
        ? {
            customOptions: cartCustomOptions,
            ...(selectedNoshi ? { noshi: { id: selectedNoshi.id, name: selectedNoshi.name, displayName: noshiName.trim() || undefined, price: selectedNoshi.price } } : {}),
          }
        : undefined,
    });

    if (!res.ok) {
      alert(res.error || "カートに追加できませんでした");
      return;
    }

    // カート追加後は商品一覧に戻る
    router.push(selectedStoreId ? `/customer/takeout/products?store=${selectedStoreId}` : "/customer/takeout/products");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CustomerHeader
        showBack
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={points}
        onCartClick={() => setCartOpen(true)}
      />

      <StepProgress currentStep={2} steps={steps} onStepClick={handleStepClick} />

      <div className="px-5 pb-56 flex-1 max-w-lg mx-auto w-full">
        {/* 商品画像 */}
        <div className="flex justify-center mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-square shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/5 w-4/5"
        >
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
          )}
          {isLimited && (
            <span className="absolute top-3 left-3 bg-[#A855B7] text-white text-[11px] font-bold tracking-wide px-3.5 py-1.5 rounded-md shadow-sm">
              期間限定
            </span>
          )}
        </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="space-y-0"
        >
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-snug mb-4">{product.name}</h1>

          {isLimited && limitedNote && (
            <p className="text-sm leading-relaxed text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              {limitedNote}
            </p>
          )}

          {product.description && (
            <p className="text-gray-600 text-sm mt-4 whitespace-pre-line leading-[1.75]">{product.description}</p>
          )}

          {/* カスタムオプション */}
          {customOptions.length > 0 && (
            <div className="mt-6 space-y-5">
              {customOptions.map((opt, i) => {
                // ナンバーキャンドル専用UI
                if (i === numberCandleOptionIndex) {
                  const unitPrice = opt.values.find((v) => v.label === "ナンバーキャンドル")?.additional_price ?? 0;
                  const otherValues = opt.values.filter((v) => v.label !== "ナンバーキャンドル");
                  return (
                    <div key={i} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{opt.name}</h3>
                        <span className="text-[10px] font-medium text-gray-500">任意</span>
                      </div>

                      {/* ナンバーキャンドル */}
                      <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-gray-700">
                            ナンバーキャンドル
                            {unitPrice > 0 && <span className="ml-1 font-normal text-gray-500">（¥{unitPrice}/本）</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">数字と本数を選んで追加してください</p>
                        </div>

                        {numberCandleSelections.length > 0 && (
                          <div className="space-y-2">
                            {numberCandleSelections.map((row, ri) => (
                              <div key={ri} className="flex items-center gap-2">
                                <select
                                  value={row.digit}
                                  onChange={(e) => setNumberCandleSelections((prev) => prev.map((r, j) => j === ri ? { ...r, digit: e.target.value } : r))}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                                >
                                  {DIGIT_OPTIONS.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                                <select
                                  value={row.qty}
                                  onChange={(e) => setNumberCandleSelections((prev) => prev.map((r, j) => j === ri ? { ...r, qty: Number(e.target.value) } : r))}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                                >
                                  {QTY_OPTIONS.map((q) => (
                                    <option key={q} value={q}>{q}本</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setNumberCandleSelections((prev) => prev.filter((_, j) => j !== ri))}
                                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-lg leading-none"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setNumberCandleSelections((prev) => [...prev, { digit: "0", qty: 1 }])}
                          className="w-full border border-dashed border-amber-300 rounded-lg py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          ＋ 追加
                        </button>

                        {numberCandleTotalCount > 0 && (
                          <p className="text-xs text-gray-500">合計 {numberCandleTotalCount}本</p>
                        )}
                      </div>

                      {/* その他のろうそく（ノーマル等） */}
                      {otherValues.length > 0 && (
                        <div className="space-y-1.5">
                          {otherValues.map((v) => {
                            const active = (optionSelections[i] || []).includes(v.label);
                            return (
                              <button
                                key={v.label}
                                type="button"
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
                  );
                }

                // 通常オプション
                return (
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
                              key={v.label}
                              type="button"
                              onClick={() => setOptionSelections((prev) => ({ ...prev, [i]: [v.label] }))}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${active ? "border-amber-400 bg-amber-50 text-gray-900 font-medium" : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"}`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${active ? "border-amber-500 bg-amber-500" : "border-gray-300"}`} />
                                {v.label}
                              </span>
                              {v.additional_price > 0 && <span className="text-xs text-gray-600">+¥{v.additional_price.toLocaleString()}</span>}
                              {v.additional_price === 0 && active && product.base_price === 0 && (
                                <span className="text-xs text-gray-500">基本料金に含む</span>
                              )}
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
                              key={v.label}
                              type="button"
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
                );
              })}
            </div>
          )}

          {/* のし選択 */}
          {product.noshi_enabled && noshiItems.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-bold text-gray-900">のし</h3>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => { setSelectedNoshiId(null); setNoshiName(""); }}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg border text-sm transition-colors ${selectedNoshiId === null ? "border-amber-400 bg-amber-50 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"}`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 mr-2 flex-shrink-0 ${selectedNoshiId === null ? "border-amber-500 bg-amber-500" : "border-gray-300"}`} />
                  なし
                </button>
                {noshiItems.map((n) => (
                  <div key={n.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedNoshiId(n.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${selectedNoshiId === n.id ? "border-amber-400 bg-amber-50 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedNoshiId === n.id ? "border-amber-500 bg-amber-500" : "border-gray-300"}`} />
                        {n.imageUrl && <img src={n.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                        {n.name}
                      </span>
                      {n.price > 0 && <span className="text-xs text-gray-600">+¥{n.price.toLocaleString()}</span>}
                    </button>

                    {/* のし名前入力 */}
                    {selectedNoshiId === n.id && (
                      <div className="mt-2 ml-6 space-y-1.5">
                        <label className="text-xs font-bold text-gray-600 block">お名前（のし上の表記）</label>
                        <textarea
                          value={noshiName}
                          onChange={(e) => setNoshiName(e.target.value)}
                          placeholder={"例：山田 太郎\n（改行可）"}
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </div>

      {/* Sticky bottom: 価格・個数・カートボタン */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-5 pt-3 pb-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="flex items-baseline gap-0.5">
              <span className="text-3xl font-bold text-gray-900 tabular-nums">
                {((product.base_price + optionsAdditional + noshiAdditional) * quantity).toLocaleString()}
              </span>
              <span className="text-lg font-bold text-gray-900">円</span>
            </p>
            {quantity > 1 && (
              <p className="text-xs text-gray-500">
                ¥{(product.base_price + optionsAdditional + noshiAdditional).toLocaleString()} × {quantity}
              </p>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowQuantityDropdown(!showQuantityDropdown)}
              className="rounded-lg px-4 py-2.5 min-w-[4.5rem] flex items-center justify-center gap-2 bg-[#FFF9C4] border border-amber-200/80 shadow-sm"
            >
              <span className="font-bold text-lg text-gray-900 tabular-nums">{quantity}</span>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${showQuantityDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showQuantityDropdown && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setShowQuantityDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full right-0 mb-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1.5 min-w-[5.5rem] max-h-52 overflow-y-auto"
                  >
                    {Array.from({ length: maxQty }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => { setQuantity(num); setShowQuantityDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FFFDE7] transition-colors flex items-center gap-2"
                      >
                        {quantity === num && <span className="text-amber-600 font-bold">&#10003;</span>}
                        <span className="font-medium text-gray-900">{num}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAddToCart}
          className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base shadow-md shadow-amber-200/60 transition-colors"
        >
          カートに追加
        </motion.button>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
