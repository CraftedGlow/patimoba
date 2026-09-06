"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ImagePlus, X, Download } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import type { WholeCakeProduct, WholeCakeSize, DecorationGroupWithItems } from "@/lib/types";
import type { CandleOption } from "@/hooks/use-whole-cakes";
import type { CandleEntry } from "./basic-step";

interface MessagePlateSize {
  label: string;
  additional_price: number;
}

interface ConfirmStepProps {
  cake: WholeCakeProduct;
  candleOptions: CandleOption[];
  selectedSize: WholeCakeSize;
  candles: CandleEntry[];
  messageText: string;
  selectedMessagePlateIdx?: string;
  messagePlateSizes?: MessagePlateSize[];
  decorationGroups: DecorationGroupWithItems[];
  selectedDecorations: Record<string, string[]>;
  plateMessages?: Record<string, string>;
  allergyNote: string;
  onAllergyChange: (note: string) => void;
  total: number;
  showPrintPhotoUpload: boolean;
  printPhotoUrl: string | null;
  uploadingPrintPhoto: boolean;
  onPrintPhotoUpload: (file: File) => Promise<void>;
  onPrintPhotoRemove: () => void;
  onAddToCart: () => void;
  onProceedToDateTime: () => void;
}

export function WholeCakeConfirmStep({
  cake,
  candleOptions,
  selectedSize,
  candles,
  messageText,
  selectedMessagePlateIdx,
  messagePlateSizes,
  decorationGroups,
  selectedDecorations,
  plateMessages,
  allergyNote,
  onAllergyChange,
  total,
  showPrintPhotoUpload,
  printPhotoUrl,
  uploadingPrintPhoto,
  onPrintPhotoUpload,
  onPrintPhotoRemove,
  onAddToCart,
  onProceedToDateTime,
}: ConfirmStepProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const validCandles = candles.filter(
    (c) => c.candleOptionId && Number(c.quantity) > 0
  );

  // グループごとに選択済みデコレーションを収集
  const selectedDecorationsByGroup = decorationGroups
    .map((group) => {
      const ids = selectedDecorations[group.id] ?? [];
      const items = ids
        .map((did) => group.items.find((item) => item.id === did))
        .filter((item): item is NonNullable<typeof item> => !!item);
      return items.length > 0 ? { group, items } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <div className="px-4 pb-8">
      <div className="border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
            <img
              src={cake.image}
              alt={cake.name}
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-lg font-bold">{cake.name}</h3>
        </div>

        <div className="space-y-3">
          {/* サイズ */}
          <div className="flex justify-between items-start">
            <div>
              <span className="text-sm font-bold">サイズ：</span>
              <span className="text-sm">{selectedSize.name}</span>
            </div>
            <span className="text-sm">&yen;{selectedSize.price.toLocaleString()}</span>
          </div>

          {/* ろうそく */}
          {validCandles.length > 0 && (
            <div>
              <span className="text-sm font-bold">ろうそく：</span>
              {validCandles.map((c) => {
                const opt = candleOptions.find((o) => o.id === c.candleOptionId);
                if (!opt) return null;
                const qty = Number(c.quantity);
                const isNumber = opt.type === "number" || (!opt.type && opt.name === "ナンバーキャンドル");
                const label = isNumber && c.digit ? `${opt.name}(${c.digit})` : opt.name;
                return (
                  <div key={c.id} className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-1.5">
                      {opt.imageUrl && <img src={opt.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />}
                      {label} x{qty}本
                    </span>
                    <span className="text-sm">&yen;{(opt.price * qty).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* メッセージプレート */}
          {(() => {
            const idx = selectedMessagePlateIdx !== undefined ? parseInt(selectedMessagePlateIdx, 10) : NaN;
            const plateSize = !isNaN(idx) ? messagePlateSizes?.[idx] : undefined;
            return plateSize ? (
              <div>
                <span className="text-sm font-bold">メッセージプレート：</span>
                <span className="text-sm">{plateSize.label}</span>
                {messageText && <span className="text-sm">「{messageText}」</span>}
              </div>
            ) : messageText ? (
              <div>
                <span className="text-sm font-bold">メッセージ：</span>
                <span className="text-sm">「{messageText}」</span>
              </div>
            ) : null;
          })()}

          {/* デコレーション */}
          {selectedDecorationsByGroup.map(({ group, items }) => (
            <div key={group.id}>
              <span className="text-sm font-bold">{group.name}：</span>
              {items.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{item.name}</span>
                    <span className="text-sm">
                      {item.price === 0 ? "無料" : `+¥${item.price.toLocaleString()}`}
                    </span>
                  </div>
                  {item.category === "plate" && plateMessages?.[item.id] && (
                    <p className="text-xs text-gray-500 ml-2">「{plateMessages[item.id]}」</p>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* 合計 */}
          <div className="flex justify-end items-baseline gap-1 pt-3 border-t border-gray-200">
            <span className="text-sm font-bold">合計</span>
            <span className="text-2xl font-bold">&yen;{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {showPrintPhotoUpload && (
        <div className="mb-6 border border-amber-200 rounded-xl p-4 bg-amber-50/40">
          <p className="text-sm font-bold text-amber-800 mb-1">プリント用写真のアップロード</p>
          <p className="text-xs text-gray-500 mb-3">ケーキにプリントしたい写真を1枚アップロードしてください</p>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPrintPhotoUpload(f);
              e.target.value = "";
            }}
          />
          {printPhotoUrl ? (
            <div className="relative w-full max-w-[200px] rounded-lg overflow-hidden border border-amber-300 group">
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
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPrintPhoto}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-amber-400 text-amber-600 text-sm font-bold hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {uploadingPrintPhoto ? <LineSpinner size={20} /> : <ImagePlus className="w-4 h-4" />}
              {uploadingPrintPhoto ? "アップロード中..." : "写真を選択"}
            </motion.button>
          )}
        </div>
      )}

      <div className="mb-8">
        <textarea
          value={allergyNote}
          onChange={(e) => onAllergyChange(e.target.value)}
          placeholder={"苦手な食べ物やアレルギーがあればご記入ください\n例)キウイが苦手です"}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
        />
      </div>

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAddToCart}
          className="flex-1 border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-full text-sm transition-colors hover:bg-amber-50"
        >
          カートに追加
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onProceedToDateTime}
          className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm transition-colors"
        >
          日時選択に進む
        </motion.button>
      </div>
    </div>
  );
}
