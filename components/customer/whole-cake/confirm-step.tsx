"use client";

import { motion } from "framer-motion";
import type { WholeCakeProduct, WholeCakeSize } from "@/lib/types";
import type { CandleOption } from "@/hooks/use-whole-cakes";
import type { CandleEntry } from "./basic-step";

interface ConfirmStepProps {
  cake: WholeCakeProduct;
  candleOptions: CandleOption[];
  selectedSize: WholeCakeSize;
  candles: CandleEntry[];
  messageText: string;
  selectedOptionIds: string[];
  allergyNote: string;
  onAllergyChange: (note: string) => void;
  total: number;
  onAddToCart: () => void;
  onProceedToDateTime: () => void;
}

export function WholeCakeConfirmStep({
  cake,
  candleOptions,
  selectedSize,
  candles,
  messageText,
  selectedOptionIds,
  allergyNote,
  onAllergyChange,
  total,
  onAddToCart,
  onProceedToDateTime,
}: ConfirmStepProps) {
  const selectedOptions: { id: string; name: string; price: number }[] = [];
  void selectedOptionIds;

  const validCandles = candles.filter(
    (c) => c.candleOptionId && Number(c.quantity) > 0
  );

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
          <div className="flex justify-between items-start">
            <div>
              <span className="text-sm font-bold">サイズ：</span>
              <span className="text-sm">
                {selectedSize.name}
              </span>
            </div>
            <span className="text-sm">
              &yen;{selectedSize.price.toLocaleString()}
            </span>
          </div>

          {validCandles.length > 0 && (
            <div>
              <span className="text-sm font-bold">ろうそく：</span>
              {validCandles.map((c) => {
                const opt = candleOptions.find(
                  (o) => o.id === c.candleOptionId
                );
                if (!opt) return null;
                const qty = Number(c.quantity);
                return (
                  <div
                    key={c.id}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm">
                      {opt.name} x{qty}本
                    </span>
                    <span className="text-sm">
                      &yen;{(opt.price * qty).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {messageText && (
            <div>
              <span className="text-sm font-bold">メッセージ：</span>
              <span className="text-sm">「{messageText}」</span>
            </div>
          )}

          {selectedOptions.length > 0 && (
            <div>
              <span className="text-sm font-bold">オプション：</span>
              {selectedOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm">{opt.name}</span>
                  <span className="text-sm">
                    &yen;{opt.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end items-baseline gap-1 pt-3 border-t border-gray-200">
            <span className="text-sm font-bold">合計</span>
            <span className="text-2xl font-bold">
              &yen;{total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

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
