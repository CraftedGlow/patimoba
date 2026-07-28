"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShoppingBag, Check } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { useBags, type BagItem } from "@/hooks/use-bags";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

const STORAGE_KEY = "patimoba_selected_bag";

export default function TakeoutBagPage() {
  const router = useRouter();
  const { selectedStoreId, profile } = useCustomerContext();
  const { items: cartItems, storeId: cartStoreId } = useCart();
  const storeId = selectedStoreId || cartStoreId || undefined;
  const { bags, loading } = useBags(storeId);

  const [cartOpen, setCartOpen] = useState(false);
  const [selectedBagId, setSelectedBagId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const applicableBags = useMemo(() => {
    const cartProductIds = new Set(cartItems.map((i) => i.productId));
    return bags.filter((b) => b.isActive && b.productIds.some((id) => cartProductIds.has(id)));
  }, [bags, cartItems]);

  // 何らかの袋が対応している商品の合計個数（カート全体ではなく「袋が必要そうな商品」だけを基準にする）
  const totalBagRelevantQuantity = useMemo(() => {
    const relevantProductIds = new Set(bags.filter((b) => b.isActive).flatMap((b) => b.productIds));
    return cartItems
      .filter((i) => relevantProductIds.has(i.productId))
      .reduce((sum, i) => sum + i.quantity, 0);
  }, [bags, cartItems]);

  // その袋の対応商品だけに絞ったカート内訳（袋ごとに対応商品が異なるため個別に計算する）
  const getBagCoverage = (bag: BagItem) => {
    const bagProductIds = new Set(bag.productIds);
    const covered = cartItems.filter((i) => bagProductIds.has(i.productId));
    const coveredQty = covered.reduce((sum, i) => sum + i.quantity, 0);
    const label = covered.map((i) => `${i.name}×${i.quantity}`).join("、");
    const fullyCovers = coveredQty > 0 && coveredQty === totalBagRelevantQuantity;
    return { coveredQty, label, fullyCovers };
  };

  // カート全体をカバーできる袋を上に出す
  const sortedBags = useMemo(() => {
    return [...applicableBags].sort((a, b) => {
      const aFull = getBagCoverage(a).fullyCovers ? 1 : 0;
      const bFull = getBagCoverage(b).fullyCovers ? 1 : 0;
      return bFull - aFull;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicableBags, totalBagRelevantQuantity]);

  // 対応する袋が無い場合は直接アクセスされても注文確認に進める
  useEffect(() => {
    if (loading) return;
    if (applicableBags.length === 0) {
      router.replace("/customer/takeout/confirm");
    }
  }, [loading, applicableBags.length, router]);

  const selectedBag = applicableBags.find((b) => b.id === selectedBagId) ?? null;

  const handleSelectBag = (bagId: string) => {
    if (selectedBagId === bagId) {
      setSelectedBagId(null);
      return;
    }
    const bag = applicableBags.find((b) => b.id === bagId);
    setSelectedBagId(bagId);
    if (bag) setQuantity(Math.max(1, Math.ceil(getBagCoverage(bag).coveredQty / bag.capacity)));
  };

  const handleProceed = () => {
    try {
      if (selectedBag) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ id: selectedBag.id, name: selectedBag.name, price: selectedBag.price, quantity })
        );
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    router.push("/customer/takeout/confirm");
  };

  if (loading || applicableBags.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        showBack
        onCartClick={() => setCartOpen(true)}
      />

      <StepProgress currentStep={4} steps={steps} maxWidthClassName="md:max-w-2xl md:mx-auto" />

      <div className="px-4 md:px-8 lg:px-12 pb-8 md:max-w-2xl md:mx-auto">
        <h2 className="text-base font-bold mb-4">袋を選択</h2>

        <div className="space-y-2 mb-6">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedBagId(null)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
              selectedBagId === null
                ? "border-amber-400 bg-amber-50"
                : "border-gray-200 bg-white hover:border-amber-200"
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">袋を使わない</p>
            </div>
            {selectedBagId === null && <Check className="w-5 h-5 text-amber-500 shrink-0" />}
          </motion.button>

          {sortedBags.map((bag) => {
            const selected = selectedBagId === bag.id;
            const { label, fullyCovers } = getBagCoverage(bag);
            return (
              <motion.button
                key={bag.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectBag(bag.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                  selected ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-amber-200"
                }`}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                  {bag.imageUrl ? (
                    <img src={bag.imageUrl} alt={bag.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 truncate">{bag.name}</p>
                    {fullyCovers && (
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">
                        ぴったり
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {bag.capacity}個まで　{bag.price === 0 ? "無料" : `+¥${bag.price.toLocaleString()}`}
                  </p>
                  {!fullyCovers && label && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">対象: {label}</p>
                  )}
                </div>
                {selected && <Check className="w-5 h-5 text-amber-500 shrink-0" />}
              </motion.button>
            );
          })}
        </div>

        {selectedBag && (() => {
          const minQuantity = Math.max(1, Math.ceil(getBagCoverage(selectedBag).coveredQty / selectedBag.capacity));
          return (
            <div className="mb-6 border border-amber-200 rounded-xl px-4 py-3 bg-amber-50/60">
              <p className="text-xs font-bold text-amber-700 mb-2">個数</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(minQuantity, q - 1))}
                  disabled={quantity <= minQuantity}
                  className="w-9 h-9 rounded-full border border-amber-300 flex items-center justify-center text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  −
                </button>
                <span className="text-base font-bold w-8 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 rounded-full border border-amber-300 flex items-center justify-center text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-gray-600 ml-1">
                  小計 ¥{(selectedBag.price * quantity).toLocaleString()}
                </span>
              </div>
              {quantity <= minQuantity && (
                <p className="text-xs text-amber-700 mt-1.5">最低{minQuantity}個必要です</p>
              )}
            </div>
          );
        })()}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleProceed}
          className="w-full md:max-w-md md:mx-auto md:block bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors"
        >
          注文内容の確認へ
        </motion.button>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} readOnly hideProceed />
    </div>
  );
}
