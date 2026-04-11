"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { ProductCard } from "@/components/customer/product-card";
import { useProducts } from "@/hooks/use-products";
import { useProductTypes } from "@/hooks/use-product-types";
import { useCustomerContext } from "@/lib/customer-context";
import { Product } from "@/lib/types";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

export default function ECProductsPage() {
  const { selectedStoreId, selectedStoreName } = useCustomerContext();
  const { products, loading: productsLoading } = useProducts({ storeId: selectedStoreId ?? undefined, ecOnly: true });
  const { categories, loading: categoriesLoading } = useProductTypes();
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loading = productsLoading || categoriesLoading;

  const filtered =
    selectedCategory === "すべて"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} showCart />

      <div className="px-4 pt-2">
        <Link
          href="/customer/ec"
          className="inline-flex items-center text-gray-600 mb-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <StepProgress currentStep={2} steps={ecSteps} />

      <div className="px-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">EC商品一覧</h2>
            <div className="h-1 w-20 bg-amber-400 rounded mt-1" />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {selectedCategory}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                >
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-2"
                    >
                      {selectedCategory === cat && (
                        <span className="text-gray-900">&#10003;</span>
                      )}
                      <span
                        className={
                          selectedCategory === cat ? "font-medium" : ""
                        }
                      >
                        {cat}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
    </div>
  );
}
