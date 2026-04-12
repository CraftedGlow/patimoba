"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { UICartItem } from "@/lib/types";
import { useRouter } from "next/navigation";

function itemCartKey(item: UICartItem): string {
  if (item.uid) return item.uid;
  if (!item.customization) return item.productId;
  const c = item.customization;
  const candleKey = (c.candles || [])
    .map((cd) => `${cd.candleOptionId}x${cd.quantity}`)
    .join("|");
  const optionKey = (c.options || []).map((op) => op.wholeCakeOptionId).join("|");
  return [
    item.productId,
    c.sizeId || "",
    candleKey,
    optionKey,
    c.messagePlate || "",
  ].join(":");
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  proceedPath?: string;
  proceedLabel?: string;
}

export function CartDrawer({
  open,
  onClose,
  proceedPath = "/customer/takeout/pickup",
  proceedLabel = "日時選択に進む",
}: CartDrawerProps) {
  const router = useRouter();
  const { items, itemCount, total, updateQuantity, removeItem, clear } = useCart();

  const handleProceed = () => {
    onClose();
    router.push(proceedPath);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-[60]"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-gray-900">
                  カート
                  {itemCount > 0 && (
                    <span className="ml-1.5 text-sm font-medium text-gray-500">
                      ({itemCount}点)
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-500 text-base font-medium">カートは空です</p>
                <p className="text-gray-400 text-sm mt-1">商品を追加してください</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="mt-6 px-8 py-2.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  商品を見る
                </motion.button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-0">
                    {items.map((item, index) => {
                      const c = item.customization;
                      const candleSum = (c?.candles || []).reduce(
                        (s, cd) => s + cd.price * cd.quantity,
                        0
                      );
                      const optionSum = (c?.options || []).reduce(
                        (s, op) => s + op.price,
                        0
                      );
                      const itemTotal =
                        item.price * item.quantity +
                        ((c?.sizePrice || 0) + candleSum + optionSum) * item.quantity;
                      const key = itemCartKey(item);

                      return (
                        <motion.div
                          key={`${key}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10, height: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex gap-3 py-4 border-b border-gray-50 last:border-0"
                        >
                          <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                                No Image
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {item.name}
                            </p>

                            {c && (
                              <div className="mt-0.5 space-y-0">
                                {c.sizeLabel && (
                                  <p className="text-xs text-gray-500">
                                    サイズ: {c.sizeLabel}
                                  </p>
                                )}
                                {(c.candles || []).map((cd, i) => (
                                  <p key={`cd-${i}`} className="text-xs text-gray-500">
                                    ろうそく: {cd.name} ×{cd.quantity}本
                                  </p>
                                ))}
                                {(c.options || []).map((op, i) => (
                                  <p key={`op-${i}`} className="text-xs text-gray-500">
                                    オプション: {op.name}
                                  </p>
                                ))}
                                {c.messagePlate && (
                                  <p className="text-xs text-gray-500">
                                    プレート: 「{c.messagePlate}」
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-2">
                              <p className="text-sm font-bold text-gray-900">
                                &yen;{itemTotal.toLocaleString()}
                              </p>

                              <div className="flex items-center gap-1">
                                {item.isCustomCake ? (
                                  <span className="px-2.5 py-1 text-sm font-bold text-gray-900">
                                    ×{item.quantity}
                                  </span>
                                ) : (
                                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <button
                                      onClick={() =>
                                        updateQuantity(item.productId, item.quantity - 1, key)
                                      }
                                      className="px-2 py-1 text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="px-2.5 py-1 text-sm font-bold min-w-[28px] text-center text-gray-900">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateQuantity(item.productId, item.quantity + 1, key)
                                      }
                                      className="px-2 py-1 text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                                <button
                                  onClick={() => removeItem(item.productId, key)}
                                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-gray-100 px-5 pt-4 pb-6 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={clear}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
                    >
                      カートを空にする
                    </button>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-gray-500">合計</span>
                      <span className="text-2xl font-bold text-gray-900">
                        &yen;{total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleProceed}
                    className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow-lg shadow-amber-200/50"
                  >
                    {proceedLabel}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
