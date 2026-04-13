"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { useProductRegistrations } from "@/hooks/use-product-registrations";
import type { ProductRegistration } from "@/hooks/use-product-registrations";
import { useStoreContext } from "@/lib/store-context";
import { ToggleSwitch } from "@/components/store/toggle-switch";
import { ProductDetailPanel } from "@/components/store/product-detail-panel";
import { supabase } from "@/lib/supabase";

type Tab = "takeout" | "ec";

export default function StoreProductsPage() {
  const { storeId } = useStoreContext();
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
  const [dailyOrderMax, setDailyOrderMax] = useState(30);
  const [perOrderMax, setPerOrderMax] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    // Note: max_per_day/max_per_order have been removed from schema; kept as UI state only.
    void cancelled;
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSelectedProduct(null);
  }, [tab]);

  useEffect(() => {
    refetch();
  }, [tab]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter((p) => p.name.includes(search));
  }, [products, search]);

  const handleToggleAccept = async (p: ProductRegistration) => {
    await updateProduct(p.id, { is_active: !p.is_active });
  };

  const handleToggleSameDay = async (p: ProductRegistration) => {
    await updateProduct(p.id, { same_day_order_allowed: !p.same_day_order_allowed });
  };

  const handleSaveSettings = async () => {
    if (!storeId) return;
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      // Note: these limits are no longer persisted to DB.
      void dailyOrderMax;
      void perOrderMax;
      setShowSettings(false);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        {/* ヘッダー: 検索 + 注文設定 */}
        <div className="flex items-center justify-between mb-4">
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

          <div
            className="flex items-center gap-3 text-sm"
            ref={settingsRef}
          >
            <span>
              1日の注文可能数 <b>{dailyOrderMax}個</b>
            </span>
            <span>
              1回の注文可能数 <b>{perOrderMax}個</b>
            </span>
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowSettings(!showSettings)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-1.5 rounded-lg transition-colors text-sm"
              >
                変更
              </motion.button>
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-5 z-50 w-[260px]"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-bold block mb-1.5">
                          1日の注文可能数
                        </label>
                        <select
                          value={dailyOrderMax}
                          onChange={(e) =>
                            setDailyOrderMax(Number(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          {Array.from({ length: 80 }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n} 個
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-bold block mb-1.5">
                          1回の注文可能数
                        </label>
                        <select
                          value={perOrderMax}
                          onChange={(e) =>
                            setPerOrderMax(Number(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          {Array.from({ length: 50 }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n} 個
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveSettings}
                        disabled={settingsSaving}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
                      >
                        変更
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* タブ */}
        <div className="flex mb-4 border-b border-gray-200">
          <button
            onClick={() => setTab("takeout")}
            className={`relative px-6 py-2 text-sm font-bold border border-b-0 rounded-t-lg transition-all ${
              tab === "takeout"
                ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                : "bg-gray-50 text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            ケーキ登録
          </button>
          <button
            onClick={() => setTab("ec")}
            className={`relative px-6 py-2 text-sm font-bold border border-b-0 rounded-t-lg transition-all ${
              tab === "ec"
                ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                : "bg-gray-50 text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            EC
          </button>
        </div>

        {/* 商品テーブル */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
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
            <div className="grid grid-cols-[1.2fr_70px_1.8fr_0.6fr_80px_80px_70px_70px] bg-[#FFF176] px-4 py-2.5 text-xs font-bold text-gray-700">
              <span>商品名</span>
              <span>商品画像</span>
              <span>商品の説明</span>
              <span>金額</span>
              <span className="text-center">受付状況</span>
              <span className="text-center">当日状況</span>
              <span className="text-center">1日の最大</span>
              <span className="text-center">準備日数</span>
            </div>
          )}

          {/* データ行 */}
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              {search
                ? "検索結果がありません"
                : "登録された商品がありません"}
            </div>
          ) : (
            filtered.map((product, i) => {
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
                  <span className="text-sm font-medium truncate pr-2">
                    {product.name}
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
                    {product.base_price > 0
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
                  className={`grid grid-cols-[1.2fr_70px_1.8fr_0.6fr_80px_80px_70px_70px] px-4 py-2.5 items-center border-t border-gray-100 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-amber-50"
                      : isInactive
                      ? "bg-pink-50/40 hover:bg-pink-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm font-medium truncate pr-2">
                    {product.name}
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
                    {product.base_price > 0
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
                  <span className="text-sm text-center">
                    {product.daily_max_quantity != null ? product.daily_max_quantity : "-"}
                  </span>
                  <span className="text-sm text-center">
                    {product.preparation_days > 0 ? `${product.preparation_days}日` : "-"}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
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

      {/* 設定変更トースト */}
      <AnimatePresence>
        {settingsSaved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-xs mx-4 p-6"
            >
              <p className="text-lg font-bold text-center">変更しました</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
