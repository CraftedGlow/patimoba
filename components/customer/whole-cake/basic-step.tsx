"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ChartCandlestick as CandlestickChart, X, Check, ImagePlus, Loader2 } from "lucide-react";
import type { WholeCakeProduct } from "@/lib/types";
import type { CandleOption } from "@/hooks/use-whole-cakes";

export interface CandleEntry {
  id: string;
  candleOptionId: string;
  quantity: string;
  digit?: string;
}

interface BasicStepProps {
  cake: WholeCakeProduct | null;
  candleOptions: CandleOption[];
  selectedSizeId: string;
  onSizeChange: (id: string) => void;
  candles: CandleEntry[];
  onCandlesChange: (candles: CandleEntry[]) => void;
  messageText: string;
  onMessageChange: (text: string) => void;
  total: number;
  canProceed: boolean;
  onNext: () => void;
  // Print mode
  isPrintMode?: boolean;
  printCakes?: WholeCakeProduct[];
  selectedCakeIdForPrint?: string | null;
  onCakeSelectForPrint?: (id: string) => void;
  printPhotoUrl?: string | null;
  uploadingPrintPhoto?: boolean;
  onPrintPhotoUpload?: (file: File) => Promise<void>;
  onPrintPhotoRemove?: () => void;
}

export function WholeCakeBasicStep({
  cake,
  candleOptions,
  selectedSizeId,
  onSizeChange,
  candles,
  onCandlesChange,
  messageText,
  onMessageChange,
  total,
  canProceed,
  onNext,
  isPrintMode,
  printCakes,
  selectedCakeIdForPrint,
  onCakeSelectForPrint,
  printPhotoUrl,
  uploadingPrintPhoto,
  onPrintPhotoUpload,
  onPrintPhotoRemove,
}: BasicStepProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);

  const addCandle = () => {
    onCandlesChange([
      ...candles,
      { id: `c-${Date.now()}`, candleOptionId: "", quantity: "" },
    ]);
  };

  const removeCandle = (id: string) => {
    onCandlesChange(candles.filter((c) => c.id !== id));
  };

  const updateCandle = (id: string, field: "candleOptionId" | "quantity" | "digit", value: string) => {
    onCandlesChange(
      candles.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const isNumberCandle = (candleOptionId: string) =>
    candleOptions.find((o) => o.id === candleOptionId)?.name === "ナンバーキャンドル";

  const showForm = !isPrintMode || !!selectedCakeIdForPrint;

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold">基本選択</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-gray-500">合計</span>
          <span className="text-2xl font-bold">{total.toLocaleString()}</span>
          <span className="text-base">円</span>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        {/* 通常モード: ケーキ画像+名前 */}
        {!isPrintMode && cake && (
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              <img src={cake.image} alt={cake.name} className="w-full h-full object-cover" />
            </div>
            <h3 className="text-lg font-bold">{cake.name}</h3>
          </div>
        )}

        {/* プリントモード: ケーキ種類の選択グリッド */}
        {isPrintMode && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">ケーキの種類を選択</p>
            <div className="grid grid-cols-2 gap-3">
              {(printCakes ?? []).map((c) => {
                const isSelected = selectedCakeIdForPrint === c.id;
                const fromPrice = c.sizes.length
                  ? Math.min(...c.sizes.map((s) => Number(s.price) || 0))
                  : 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCakeSelectForPrint?.(c.id)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-colors text-left ${
                      isSelected ? "border-amber-400" : "border-gray-200 hover:border-amber-200"
                    }`}
                  >
                    <div className="aspect-square bg-gray-100">
                      {c.image ? (
                        <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-medium leading-tight line-clamp-2">{c.name}</p>
                      {fromPrice > 0 && (
                        <p className="text-xs text-amber-600 font-bold mt-0.5">
                          ¥{fromPrice.toLocaleString()}〜
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* サイズ・ろうそく・メッセージ（ケーキ選択後 or 通常モード） */}
        {showForm && (
          <>
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">ケーキのサイズを選択</p>
              <select
                value={selectedSizeId}
                onChange={(e) => onSizeChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              >
                <option value="">サイズを選択</option>
                {(cake?.sizes ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} &yen;{s.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-sm font-medium text-gray-700">ろうそくを選択</p>
                <span className="text-xs text-gray-400">複数選択可能です</span>
              </div>

              {candles.map((candle) => (
                <div key={candle.id} className="mb-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={candle.candleOptionId}
                      onChange={(e) => updateCandle(candle.id, "candleOptionId", e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    >
                      <option value="">種類を選択</option>
                      {candleOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} &yen;{opt.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeCandle(candle.id)}
                      className="shrink-0 text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {candle.candleOptionId && (
                    <div className="flex items-center gap-2 mt-2">
                      {isNumberCandle(candle.candleOptionId) && (
                        <select
                          value={candle.digit ?? ""}
                          onChange={(e) => updateCandle(candle.id, "digit", e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                        >
                          <option value="">数字を選択</option>
                          {["0","1","2","3","4","5","6","7","8","9"].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      )}
                      <select
                        value={candle.quantity}
                        onChange={(e) => updateCandle(candle.id, "quantity", e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                      >
                        <option value="">本数を選択</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={String(n)}>{n}</option>
                        ))}
                      </select>
                      <span className="text-sm font-medium shrink-0">本</span>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={addCandle}
                  className="flex items-center gap-1.5 border-2 border-amber-400 text-amber-600 font-bold px-5 py-2 rounded-lg text-sm hover:bg-amber-50 transition-colors"
                >
                  <CandlestickChart className="w-4 h-4" />
                  ろうそくを追加
                </motion.button>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm font-medium text-gray-700">メッセージプレートの文字を入力</p>
                <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">必須</span>
              </div>
              <input
                type="text"
                placeholder="例）Happy birthday!!"
                value={messageText}
                onChange={(e) => onMessageChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                メッセージが必要ない方は「なし」とご入力ください
              </p>
            </div>

            {/* プリント写真アップロード（プリントモードのみ） */}
            {isPrintMode && (
              <div className="mb-8">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-sm font-medium text-gray-700">プリントしたい画像の選択</p>
                  <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">必須</span>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPrintPhotoUpload?.(f);
                    e.target.value = "";
                  }}
                />
                {printPhotoUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-amber-200 max-w-[200px] group">
                    <img src={printPhotoUrl} alt="プリント用写真" className="w-full object-cover" />
                    <button
                      onClick={onPrintPhotoRemove}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPrintPhoto}
                    className="w-full h-32 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-500 text-sm hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                  >
                    {uploadingPrintPhoto ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <ImagePlus className="w-6 h-6" />
                    )}
                    <span className="whitespace-pre-line text-center">
                      {uploadingPrintPhoto ? "アップロード中..." : "タップして画像を\n選択"}
                    </span>
                  </motion.button>
                )}
                <p className="text-xs text-gray-400 mt-1.5">
                  ※画像の反映に少々お時間がかかることがあります
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex justify-center">
          <motion.button
            whileHover={canProceed ? { scale: 1.02 } : {}}
            whileTap={canProceed ? { scale: 0.98 } : {}}
            disabled={!canProceed}
            onClick={onNext}
            className={`px-10 py-3.5 rounded-full font-bold text-base transition-colors ${
              canProceed
                ? "bg-amber-400 hover:bg-amber-500 text-white"
                : "bg-amber-200 text-white cursor-not-allowed"
            }`}
          >
            オプション選択に進む
          </motion.button>
        </div>
      </div>
    </div>
  );
}
