"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShoppingCart } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { ProductCard } from "@/components/customer/product-card";
import { useProducts } from "@/hooks/use-products";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

export default function ECProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const storeFromUrl = searchParams.get("store");
  const { selectedStoreId, setSelectedStoreId, selectedStoreName, profile,
    points, } = useCustomerContext();

  // URLパラメータからstoreIdをセット（直リンク対応）
  useEffect(() => {
    if (storeFromUrl && !selectedStoreId) {
      setSelectedStoreId(storeFromUrl);
    }
  }, [storeFromUrl, selectedStoreId, setSelectedStoreId]);

  const effectiveStoreId = selectedStoreId ?? storeFromUrl;
  const { itemCount } = useCart();
  const { products, loading: productsLoading } = useProducts({ storeId: effectiveStoreId ?? undefined, ecOnly: true, publishedOnly: true });

  const [cartOpen, setCartOpen] = useState(false);

  const loading = productsLoading;
  const filtered = products;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
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
        showBack
      />

      <StepProgress currentStep={2} steps={ecSteps} />

      <div className={`px-4 ${itemCount > 0 ? "pb-28" : "pb-8"}`}>
        <div className="mb-4">
          <h2 className="text-lg font-bold">EC商品一覧</h2>
          <div className="h-1 w-20 bg-amber-400 rounded mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProductCard product={product} basePath="/customer/ec" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* 下部固定バー */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex-1 flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-full text-sm hover:bg-amber-50 transition-colors"
          >
            <span className="absolute -top-2 left-2 bg-red-500 text-white text-[11px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 leading-none">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
            <ShoppingCart className="w-4 h-4" />
            カートを見る
          </button>
          <button
            onClick={() => router.push("/customer/ec/shipping")}
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm transition-colors"
          >
            住所入力に進む
          </button>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        proceedPath="/customer/ec/shipping"
        proceedLabel="配送先を入力する"
      />
    </div>
  );
}
