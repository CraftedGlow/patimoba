"use client";

import { motion } from "framer-motion";
import type { WholeCakeProduct } from "@/lib/types";

interface OptionsStepProps {
  cake: WholeCakeProduct;
  selectedOptionIds: string[];
  onOptionsChange: (ids: string[]) => void;
  total: number;
  onNext: () => void;
}

export function WholeCakeOptionsStep({
  cake,
  selectedOptionIds,
  onOptionsChange,
  total,
  onNext,
}: OptionsStepProps) {
  const toggleOption = (optionId: string) => {
    if (selectedOptionIds.includes(optionId)) {
      onOptionsChange(selectedOptionIds.filter((id) => id !== optionId));
    } else {
      onOptionsChange([...selectedOptionIds, optionId]);
    }
  };

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold">オプション</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-gray-500">合計</span>
          <span className="text-2xl font-bold">{total.toLocaleString()}</span>
          <span className="text-base">円</span>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
            <img
              src={cake.image}
              alt={cake.name}
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-lg font-bold">{cake.name}</h3>
        </div>

        <div className="border border-gray-200 rounded-xl divide-y divide-gray-200 mb-8">
          {([] as { id: string; name: string; price: number }[]).map((option) => {
            const isChecked = selectedOptionIds.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(option.id)}
                    className="w-5 h-5 rounded border-gray-300 accent-amber-500"
                  />
                  <span className="text-base">{option.name}</span>
                </div>
                <span className="text-base font-medium">
                  +{option.price.toLocaleString()}円
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            className="px-10 py-3.5 rounded-full font-bold text-base bg-amber-400 hover:bg-amber-500 text-white transition-colors"
          >
            確認に進む
          </motion.button>
        </div>
      </div>
    </div>
  );
}
