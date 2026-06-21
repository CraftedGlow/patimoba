"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Minus, Plus } from "lucide-react";

export interface CartItemDetail {
  label: string;
  price: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  details?: CartItemDetail[];
}

interface CartModalProps {
  items: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onProceed: () => void;
  proceedLabel?: string;
}

export function CartModal({
  items,
  onClose,
  onUpdateQuantity,
  onRemove,
  onProceed,
  proceedLabel = "日時選択に進む",
}: CartModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[60]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed left-4 right-4 top-[15%] bg-white rounded-2xl shadow-2xl z-[70] max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            カートの状況 ({totalItems}点)
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {items.map((item) => {
              const hasDetails = item.details && item.details.length > 0;
              const isExpanded = expandedId === item.id;

              return (
                <div key={item.id}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="shrink-0 text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-sm text-gray-600">&yen;{item.price.toLocaleString()}</p>
                    </div>
                    {hasDetails ? (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="shrink-0 border-2 border-amber-400 text-amber-500 font-bold px-4 py-1.5 rounded-full text-xs hover:bg-amber-50 transition-colors"
                      >
                        {isExpanded ? "閉じる" : "詳細"}
                      </button>
                    ) : (
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-[#FFF9C4] shrink-0">
                        <button
                          onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="px-2.5 py-1.5 text-gray-700 hover:bg-amber-100 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1.5 text-sm font-bold min-w-[32px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="px-2.5 py-1.5 text-gray-700 hover:bg-amber-100 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {hasDetails && isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 ml-[72px] space-y-1"
                    >
                      {item.details!.map((detail, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">{detail.label}</span>
                          <span className="text-gray-700">
                            &yen;{detail.price.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3">
          <div className="flex items-baseline justify-end gap-1 mb-4">
            <span className="text-base text-gray-600">合計</span>
            <span className="text-3xl font-bold text-gray-900">
              {totalPrice.toLocaleString()}
            </span>
            <span className="text-base text-gray-600">円</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onProceed}
            className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors"
          >
            {proceedLabel}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}
