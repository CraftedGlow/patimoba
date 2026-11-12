"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { useProductRegistrations } from "@/hooks/use-product-registrations";
import type { ProductRegistration } from "@/hooks/use-product-registrations";
import { useStoreContext } from "@/lib/store-context";
import { ToggleSwitch } from "@/components/store/toggle-switch";
import { ProductDetailPanel } from "@/components/store/product-detail-panel";
import { supabase } from "@/lib/supabase";

type Tab = "takeout" | "ec";

export default function StoreProductsPage() {
  const { storeId: ownStoreId, isMaster, childStores } = useStoreContext();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const storeId = isMaster ? (selectedChildId ?? ownStoreId) : ownStoreId;
  const [tab, setTab] = useState<Tab>("takeout");
  const isEc = tab === "ec";

  const {
    products,
    loading,
    refetch,
    updateProduct,
    deleteProduct,
  } = useProductRegistrations({ storeId });

  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductRegistration | null>(null);
  const [acceptsWalkin, setAcceptsWalkin] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("accepts_walkin")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAcceptsWalkin(data?.accepts_walkin ?? true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    setSelectedProduct(null);
  }, [tab]);

  useEffect(() => {
    refetch();
  }, [tab]);

  // 保存・再取得後も一覧とパネルの値を一致させる
  useEffect(() => {
    setSelectedProduct((prev) => {
      if (!prev) return null;
      const next = products.find((p) => p.id === prev.id);
      return next ?? null;
    });
  }, [products]);

  const filtered = useMemo(() => {
    let list = tab === "ec" ? products.filter((p) => p.is_ec) : products.filter((p) => p.is_takeout);
    if (search.trim()) list = list.filter((p) => p.name.includes(search));
    // 受付状況がオフの商品は一覧の下に固定する（当日状況は並び替えに影響させない）
    return [...list].sort((a, b) => (a.is_active === false ? 1 : 0) - (b.is_active === false ? 1 : 0));
  }, [products, search, tab]);

  const handleToggleAccept = async (p: ProductRegistration) => {
    await updateProduct(p.id, { is_active: !p.is_active });
  };

  const handleToggleSameDay = async (p: ProductRegistration) => {
    await updateProduct(p.id, { same_day_order_allowed: !p.same_day_order_allowed });
  };

  if (isMaster && childStores.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-600">
        子店舗が登録されていません。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <LineSpinner size={28} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        {isMaster && childStores.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSelectedChildId(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedChildId === null
                  ? "bg-amber-400 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              全店舗（共有）
            </button>
            {childStores.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setSelectedChildId(s.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedChildId === s.id
                    ? "bg-amber-400 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {/* ヘッダー: 検索 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="商品名"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-[240px] focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              検索
            </motion.button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex mb-4 border-b border-gray-200">
          <button
            onClick={() => setTab("takeout")}
            className={`relative px-6 py-2 text-sm font-bold border border-b-0 rounded-t-lg transition-all ${
              tab === "takeout"
                ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                : "bg-gray-50 text-gray-600 border-transparent hover:text-gray-600"
            }`}
          >
            テイクアウト
          </button>
          <button
            onClick={() => setTab("ec")}
            className={`relative px-6 py-2 text-sm font-bold border border-b-0 rounded-t-lg transition-all ${
              tab === "ec"
                ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                : "bg-gray-50 text-gray-600 border-transparent hover:text-gray-600"
            }`}
          >
            EC
          </button>
        </div>

        {/* 商品一覧 */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-600 text-sm border border-gray-200 rounded-lg">
            {search
              ? "検索結果がありません"
              : "登録された商品がありません"}
          </div>
        ) : (
          <>
            {/* モバイル: カード形式 */}
            <div className="lg:hidden space-y-0">
              {filtered.map((product, i) => {
                const isSelected = selectedProduct?.id === product.id;
                const isInactive = !product.is_active;
                const isMaster = product.isMasterProduct ?? false;
                const price = product.minVariantPrice != null
                  ? `¥${product.minVariantPrice.toLocaleString()}~`
                  : product.base_price > 0
                  ? `¥${product.base_price.toLocaleString()}`
                  : "";

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedProduct(product)}
                    className={`border border-gray-200 rounded-lg p-3 mb-2 flex gap-3 items-start transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 hover:bg-gray-50"
                        : isMaster
                        ? "bg-blue-50/40 hover:bg-blue-50"
                        : isInactive
                        ? "bg-pink-50/40 hover:bg-gray-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* 商品画像 */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>

                    {/* 右側コンテンツ */}
                    <div className="flex-1 min-w-0">
                      {/* 商品名 + 価格 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-bold truncate">{product.name}</span>
                          {isMaster && (
                            <span className="shrink-0 text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">共有</span>
                          )}
                        </div>
                        {price && <span className="text-sm shrink-0">{price}</span>}
                      </div>

                      {/* 説明文 */}
                      {product.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                          {product.description}
                        </p>
                      )}

                      {/* トグル・詳細情報 */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {/* 受付状況トグル */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <ToggleSwitch
                            enabled={product.is_active}
                            onToggle={() => handleToggleAccept(product)}
                            colorOn="bg-green-500"
                          />
                        </div>

                        {!isEc && (
                          <>
                            {/* 当日状況トグル（当日受付あり店舗のみ表示） */}
                            {acceptsWalkin && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <ToggleSwitch
                                  enabled={product.same_day_order_allowed}
                                  onToggle={() => handleToggleSameDay(product)}
                                  colorOn="bg-red-500"
                                />
                              </div>
                            )}

                            {/* 最大個数・準備日数 */}
                            <span className="text-xs text-gray-500">
                              最大{product.daily_max_quantity != null ? product.daily_max_quantity : "-"}個
                            </span>
                            <span className="text-xs text-gray-500">
                              {product.preparation_days > 0 ? `${product.preparation_days}日` : "当日"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* デスクトップ: グリッド形式 */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
              <div className="min-w-[700px] border border-gray-200 rounded-lg overflow-hidden">
                {/* ヘッダー行 */}
                {isEc ? (
                  <div className="grid grid-cols-[1.2fr_70px_1.5fr_0.8fr_0.6fr_80px_80px] bg-[#FFF176] px-4 py-2.5 text-xs font-bold text-gray-700">
                    <span>商品名</span>
                    <span>商品画像</span>
                    <span>商品の説明</span>
                    <span>原材料</span>
                    <span>金額</span>
                    <span className="text-center">賞味期限</span>
                    <span className="text-center">受付状況</span>
                  </div>
                ) : (
                  <div className={`${acceptsWalkin ? "grid-cols-[1.2fr_70px_1.8fr_0.6fr_80px_80px_8.75rem_4.5rem]" : "grid-cols-[1.2fr_70px_1.8fr_0.6fr_80px_8.75rem_4.5rem]"} grid bg-[#FFF176] px-4 py-2.5 text-xs font-bold text-gray-700`}>
                    <span>商品名</span>
                    <span>商品画像</span>
                    <span>商品の説明</span>
                    <span>金額</span>
                    <span className="text-center">受付状況</span>
                    {acceptsWalkin && <span className="text-center">当日状況</span>}
                    <span className="text-center whitespace-nowrap px-0.5">最大個数（/日）</span>
                    <span className="text-center">準備日数</span>
                  </div>
                )}

                {/* データ行 */}
                {filtered.map((product, i) => {
                  const isSelected = selectedProduct?.id === product.id;
                  const isInactive = !product.is_active;

                  return isEc ? (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setSelectedProduct(product)}
                      className={`grid grid-cols-[1.2fr_70px_1.5fr_0.8fr_0.6fr_80px_80px] px-4 py-2.5 items-center border-t border-gray-100 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-amber-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-sm font-medium truncate pr-2 flex items-center gap-1.5">
                        <span className="truncate">{product.name}</span>
                        {product.isMasterProduct && (
                          <span className="shrink-0 text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">共有</span>
                        )}
                      </span>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 line-clamp-2 pr-2">
                        {product.description}
                      </span>
                      <span className="text-xs text-gray-500 truncate pr-2">

                      </span>
                      <span className="text-sm">
                        {product.minVariantPrice != null
                          ? `¥${product.minVariantPrice.toLocaleString()}~`
                          : product.base_price > 0
                          ? `¥${product.base_price.toLocaleString()}`
                          : ""}
                      </span>
                      <span className="text-sm text-center">

                      </span>
                      <div
                        className="flex justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ToggleSwitch
                          enabled={product.is_active}
                          onToggle={() => handleToggleAccept(product)}
                          colorOn="bg-green-500"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setSelectedProduct(product)}
                      className={`${acceptsWalkin ? "grid-cols-[1.2fr_70px_1.8fr_0.6fr_80px_80px_8.75rem_4.5rem]" : "grid-cols-[1.2fr_70px_1.8fr_0.6fr_80px_8.75rem_4.5rem]"} grid px-4 py-2.5 items-center border-t border-gray-100 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-amber-50"
                          : isInactive
                          ? "bg-pink-50/40 hover:bg-pink-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-sm font-medium truncate pr-2 flex items-center gap-1.5">
                        <span className="truncate">{product.name}</span>
                        {product.isMasterProduct && (
                          <span className="shrink-0 text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">共有</span>
                        )}
                      </span>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 line-clamp-2 pr-2">
                        {product.description}
                      </span>
                      <span className="text-sm">
                        {product.minVariantPrice != null
                          ? `¥${product.minVariantPrice.toLocaleString()}~`
                          : product.base_price > 0
                          ? `¥${product.base_price.toLocaleString()}`
                          : ""}
                      </span>
                      <div
                        className="flex justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ToggleSwitch
                          enabled={product.is_active}
                          onToggle={() => handleToggleAccept(product)}
                          colorOn="bg-green-500"
                        />
                      </div>
                      {acceptsWalkin && (
                        <div
                          className="flex justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ToggleSwitch
                            enabled={product.same_day_order_allowed}
                            onToggle={() => handleToggleSameDay(product)}
                            colorOn="bg-red-500"
                          />
                        </div>
                      )}
                      <span className="text-sm text-center">
                        {product.daily_max_quantity != null ? product.daily_max_quantity : "-"}
                      </span>
                      <span className="text-sm text-center">
                        {product.preparation_days > 0 ? `${product.preparation_days}日` : "-"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右サイドパネル */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailPanel
            key={selectedProduct.id}
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onSave={async (id, updates) => {
              const result = await updateProduct(id, updates);
              return result;
            }}
            onDelete={async (id) => {
              const result = await deleteProduct(id);
              setSelectedProduct(null);
              return result;
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
