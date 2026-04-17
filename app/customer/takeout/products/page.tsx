"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useProductRegistrations, type ProductRegistration } from "@/hooks/use-product-registrations";
import { useWholeCakes } from "@/hooks/use-whole-cakes";
import type { WholeCakeProduct } from "@/lib/types";
import { useCustomerContext } from "@/lib/customer-context";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

function RegistrationCard({ product, basePath }: { product: ProductRegistration; basePath: string }) {
  const href = `${basePath}/product/${product.id}`;

  return (
    <Link href={href}>
      <motion.div
        className="group cursor-pointer"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No Image
            </div>
          )}
          {false && null}
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">
          {product.name}
        </h3>
        <p className="text-sm text-gray-900">
          &yen;{product.base_price.toLocaleString()}
        </p>
      </motion.div>
    </Link>
  );
}

function WholeCakeCard({ cake }: { cake: WholeCakeProduct }) {
  const fromPrice = cake.sizes.length
    ? Math.min(...cake.sizes.map((s) => Number(s.price) || 0))
    : 0;

  return (
    <Link href={`/customer/takeout/whole-cake?cakeId=${cake.id}`}>
      <motion.div
        className="group cursor-pointer"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          {cake.image ? (
            <img
              src={cake.image}
              alt={cake.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No Image
            </div>
          )}
          <span className="absolute top-2 left-2 bg-amber-400 text-white text-xs font-bold px-3 py-1 rounded">
            ホールケーキ
          </span>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">
          {cake.name}
        </h3>
        <p className="text-sm text-gray-900">
          &yen;{fromPrice.toLocaleString()}〜
        </p>
      </motion.div>
    </Link>
  );
}

export default function TakeoutProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeParam = searchParams.get("store");
  const orderTypeParam = searchParams.get("type") ?? "reservation";
  const { selectedStoreId, selectedStoreName, profile } = useCustomerContext();
  const storeId = selectedStoreId || storeParam || undefined;
  const pickupPath = `/customer/takeout/pickup?store=${storeId ?? ""}&type=${orderTypeParam}`;

  const { products, categories, loading } = useProductRegistrations({
    storeId,
  });
  const { wholeCakes, loading: cakesLoading } = useWholeCakes(storeId);
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const isLimited = (_p: ProductRegistration) => false;

  const filtered =
    selectedCategory === "すべて"
      ? products
      : selectedCategory === "期間限定"
        ? products.filter(isLimited)
        : selectedCategory === "ホールケーキ"
          ? []
          : products.filter((p) => p.category_name === selectedCategory);

  const visibleWholeCakes =
    selectedCategory === "すべて" || selectedCategory === "ホールケーキ"
      ? wholeCakes
      : [];

  const displayCategories = (() => {
    const base = categories.some((c) => c === "期間限定")
      ? categories
      : [...categories, "期間限定"];
    return wholeCakes.length > 0 && !base.includes("ホールケーキ")
      ? [...base, "ホールケーキ"]
      : base;
  })();

  const handleStepClick = (step: number) => {
    if (step === 1) {
      router.push("/customer/takeout");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
      />

      <StepProgress currentStep={2} steps={steps} onStepClick={handleStepClick} />

      <div className="px-4 md:px-8 lg:px-12 pb-8 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">商品一覧</h2>
            <div className="h-1 w-16 bg-amber-400 rounded-full mt-1" />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors"
            >
              {selectedCategory}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50"
                  >
                    {displayCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-2"
                      >
                        {selectedCategory === cat ? (
                          <Check className="w-4 h-4 text-gray-700 flex-shrink-0" />
                        ) : (
                          <span className="w-4 flex-shrink-0" />
                        )}
                        <span className={selectedCategory === cat ? "font-medium text-gray-900" : "text-gray-700"}>
                          {cat}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {loading || cakesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : filtered.length === 0 && visibleWholeCakes.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            商品が見つかりませんでした
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
            {visibleWholeCakes.map((cake, i) => (
              <motion.div
                key={`wc-${cake.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <WholeCakeCard cake={cake} />
              </motion.div>
            ))}
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (i + visibleWholeCakes.length) * 0.04 }}
              >
                <RegistrationCard product={product} basePath="/customer/takeout" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} proceedPath={pickupPath} />
    </div>
  );
}
