"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Trash2, Check, ImagePlus, Plus } from "lucide-react";
import type { ProductCustomOption } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useProductTypes } from "@/hooks/use-product-types";
import { useProductCategories } from "@/hooks/use-product-categories";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";
import { ProductCustomOptionPresetChips } from "@/components/store/product-custom-option-preset-chips";
import { PRODUCT_CUSTOM_OPTION_PRESET_METAS } from "@/lib/constants/product-custom-option-presets";
import { useDecorationGroups, setProductDecorationGroups, getProductGroupIds } from "@/hooks/use-decoration-groups";
import Link from "next/link";

type OrderType = "always" | "sameDay" | "manual" | "reserveOnly" | "todayOnly";

interface ProductRow {
  id: string;
  name: string | null;
  description: string | null;
  base_price: number | null;
  image: string | null;
  cross_section_image: string | null;
  category_name: string | null;
  is_active: boolean | null;
  same_day_order_allowed: boolean | null;
  is_preorder_required: boolean | null;
  min_order_lead_minutes: number | null;
  store_id: string | null;
  display_order: number | null;
  is_takeout: boolean | null;
  is_ec: boolean | null;
  daily_max_quantity: number | null;
  preparation_days: number | null;
  limited_from: string | null;
  limited_until: string | null;
  custom_options: any;
}

function resolveOrderType(row: ProductRow): OrderType {
  if (row.same_day_order_allowed) return "sameDay";
  if (row.is_preorder_required) return "reserveOnly";
  return "always";
}

export function CakeTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? null;
  const { productTypes } = useProductTypes();
  const { categories: productCategories } = useProductCategories(storeId ?? undefined);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("always");
  const [reserveDays, setReserveDays] = useState("10");
  const [isLimited, setIsLimited] = useState(false);
  const [limitedFrom, setLimitedFrom] = useState("");
  const [limitedUntil, setLimitedUntil] = useState("");
  const [isTakeout, setIsTakeout] = useState(true);
  const [isEc, setIsEc] = useState(false);
  const [dailyMaxQuantity, setDailyMaxQuantity] = useState("");
  const [preparationDays, setPreparationDays] = useState("");
  const [customOptions, setCustomOptions] = useState<ProductCustomOption[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [mainImage, setMainImage] = useState<string | null>(null);
  const [crossImage, setCrossImage] = useState<string | null>(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingCross, setUploadingCross] = useState(false);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const crossInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isHole = category === "ホール";

  const { groups: allDecorationGroups } = useDecorationGroups(storeId ?? undefined);

  // ホールカテゴリ選択時、未登録ならカスタムオプションにホール用プリセットを自動投入
  useEffect(() => {
    if (!isHole || selectedId) return;
    setCustomOptions((prev) => {
      if (prev.length > 0) return prev;
      const ids = ["size", "candles", "message"] as const;
      return PRODUCT_CUSTOM_OPTION_PRESET_METAS
        .filter((m) => ids.includes(m.id as any))
        .map((m) => m.create());
    });
  }, [isHole, selectedId]);

  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("display_order", { ascending: true });
    const rows = (data ?? []) as ProductRow[];

    // 期間限定商品の自動オフ: 受取終了日 - 準備日数 <= 今日 なら is_active を false に
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDeactivate = rows.filter((p) => {
      if (!p.is_active || !p.limited_until) return false;
      const prepDays = p.preparation_days ?? 0;
      const cutoff = new Date(p.limited_until);
      cutoff.setDate(cutoff.getDate() - prepDays);
      return cutoff <= today;
    });
    if (toDeactivate.length > 0) {
      await supabase
        .from("products")
        .update({ is_active: false })
        .in("id", toDeactivate.map((p) => p.id));
      for (const p of toDeactivate) p.is_active = false;
    }

    setProducts(rows);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const clearForm = useCallback(() => {
    setSelectedId(null);
    setCategory("");
    setProductName("");
    setDescription("");
    setPrice("");
    setOrderType("always");
    setReserveDays("10");
    setIsLimited(false);
    setLimitedFrom("");
    setLimitedUntil("");
    setIsTakeout(true);
    setIsEc(false);
    setDailyMaxQuantity("");
    setPreparationDays("");
    setCustomOptions([]);
    setSelectedGroupIds([]);
    setMainImage(null);
    setCrossImage(null);
    setError(null);
  }, []);

  const selectProduct = useCallback(
    (id: string) => {
      const p = products.find((r) => r.id === id);
      if (!p) return;
      setSelectedId(p.id);
      setCategory(p.category_name ?? "");
      setProductName(p.name ?? "");
      setDescription(p.description ?? "");
      setPrice(p.base_price != null ? `¥${p.base_price.toLocaleString()}` : "");
      setOrderType(resolveOrderType(p));
      setReserveDays(String(p.min_order_lead_minutes ?? 0));
      setIsLimited(p.limited_until != null || p.limited_from != null);
      setLimitedFrom(p.limited_from ?? "");
      setLimitedUntil(p.limited_until ?? "");
      setIsTakeout(p.is_takeout ?? true);
      setIsEc(p.is_ec ?? false);
      setDailyMaxQuantity(p.daily_max_quantity != null ? String(p.daily_max_quantity) : "");
      setPreparationDays(p.preparation_days != null ? String(p.preparation_days) : "");
      setCustomOptions(Array.isArray(p.custom_options) ? (p.custom_options as ProductCustomOption[]) : []);
      setMainImage(p.image ?? null);
      setCrossImage(p.cross_section_image ?? null);
      setError(null);
      // デコレーショングループ紐付けを取得
      getProductGroupIds(p.id).then((ids) => setSelectedGroupIds(ids));
    },
    [products, productTypes]
  );

  const handleImageUpload = async (file: File, type: "main" | "cross") => {
    if (!storeId) return;
    const setter = type === "main" ? setMainImage : setCrossImage;
    const loadingSetter =
      type === "main" ? setUploadingMain : setUploadingCross;
    loadingSetter(true);
    const { url, error: err } = await uploadProductImage(
      file,
      storeId,
      type === "main" ? "main" : "cross"
    );
    loadingSetter(false);
    if (err) {
      setError(`画像アップロード失敗: ${err}`);
      return;
    }
    setter(url);
  };

  const handleRemoveImage = async (type: "main" | "cross") => {
    const url = type === "main" ? mainImage : crossImage;
    const setter = type === "main" ? setMainImage : setCrossImage;
    if (url) await deleteProductImage(url);
    setter(null);
  };

  const parsePriceValue = (v: string): number =>
    parseInt(v.replace(/[¥,\s]/g, ""), 10) || 0;

  const handleSave = async () => {
    setError(null);
    if (!productName.trim()) {
      setError("商品名を入力してください");
      return;
    }
    if (!price.trim()) {
      setError("金額を入力してください");
      return;
    }
    if (!storeId) {
      setError("店舗情報が取得できません");
      return;
    }
    if (!isTakeout && !isEc) {
      setError("テイクアウトまたはECのいずれかを選択してください");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        store_id: storeId,
        name: productName.trim(),
        description: description.trim(),
        base_price: parsePriceValue(price),
        category_name: category || null,
        image: mainImage ?? null,
        cross_section_image: crossImage ?? null,
        same_day_order_allowed: orderType === "sameDay",
        is_preorder_required: isHole || orderType === "reserveOnly",
        min_order_lead_minutes:
          orderType === "reserveOnly" ? parseInt(reserveDays, 10) || 0 : 0,
        is_active: true,
        is_takeout: isTakeout,
        is_ec: isEc,
        daily_max_quantity: dailyMaxQuantity.trim() === "" ? null : parseInt(dailyMaxQuantity, 10) || null,
        preparation_days: preparationDays.trim() === "" ? 0 : parseInt(preparationDays, 10) || 0,
        custom_options: customOptions,
        limited_from: isLimited && limitedFrom ? limitedFrom : null,
        limited_until: isLimited && limitedUntil ? limitedUntil : null,
      };

      let savedProductId = selectedId
      if (selectedId) {
        const { error: err } = await supabase
          .from("products")
          .update(payload)
          .eq("id", selectedId);
        if (err) throw err;
      } else {
        const { data: newProduct, error: err } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        savedProductId = newProduct?.id ?? null;
      }

      // デコレーショングループ紐付けを保存
      if (savedProductId) {
        await setProductDecorationGroups(savedProductId, selectedGroupIds);
      }

      await fetchProducts();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (!selectedId) clearForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      if (mainImage) await deleteProductImage(mainImage);
      if (crossImage) await deleteProductImage(crossImage);
      await supabase.from("product_variants").delete().eq("product_id", selectedId);
      const { error: err } = await supabase
        .from("products")
        .delete()
        .eq("id", selectedId);
      if (err) throw err;
      await fetchProducts();
      clearForm();
      setShowDeleteConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const typeCategories = productTypes.map((t) => t.productType);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-lg font-bold">商品登録画面</h2>
        <select
          value={selectedId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              clearForm();
            } else {
              selectProduct(v);
            }
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-[220px]"
        >
          <option value="">＋ 新規登録</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || `商品 #${p.id}`}
            </option>
          ))}
        </select>
        {selectedId && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            削除
          </motion.button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#FFF9C4] rounded-xl p-6 max-w-[640px] space-y-4"
      >
        {/* ケーキの種類 (product_types) */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        >
          <option value="">ケーキの種類を選択</option>
          {typeCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* 商品名 (product_categories からドロップダウン + 自由入力) */}
        <div className="relative">
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="商品名"
            list="product-name-list"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
          <datalist id="product-name-list">
            {productCategories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>

        {/* 画像アップロード */}
        <div className="flex gap-3">
          <input
            ref={mainInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f, "main");
              e.target.value = "";
            }}
          />
          <input
            ref={crossInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f, "cross");
              e.target.value = "";
            }}
          />
          <div className="relative group">
            {mainImage ? (
              <div className="relative w-[160px] h-[160px] rounded-lg overflow-hidden border border-gray-200">
                <img src={mainImage} alt="メイン" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemoveImage("main")}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "#f59e0b" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => mainInputRef.current?.click()}
                disabled={uploadingMain}
                className="w-[160px] h-[160px] rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 gap-2 hover:border-amber-400 hover:text-amber-500 transition-colors"
              >
                {uploadingMain ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8" />
                    <span>メイン画像を<br />アップロード</span>
                  </>
                )}
              </motion.button>
            )}
          </div>
          <div className="relative group">
            {crossImage ? (
              <div className="relative w-[160px] h-[160px] rounded-lg overflow-hidden border border-gray-200">
                <img src={crossImage} alt="断面" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemoveImage("cross")}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "#f59e0b" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => crossInputRef.current?.click()}
                disabled={uploadingCross}
                className="w-[160px] h-[160px] rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 gap-2 hover:border-amber-400 hover:text-amber-500 transition-colors"
              >
                {uploadingCross ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8" />
                    <span>断面の画像を<br />アップロード</span>
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* 商品説明 */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="商品説明"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

        {/* 金額 */}
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="¥700"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

        {/* 販売チャネル (テイクアウト / EC) */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isTakeout}
              onChange={(e) => setIsTakeout(e.target.checked)}
              className="w-4 h-4"
            />
            テイクアウト
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isEc}
              onChange={(e) => setIsEc(e.target.checked)}
              className="w-4 h-4"
            />
            EC
          </label>
        </div>

        {/* 1日の最大数 / 準備日数 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">1日の最大数</label>
            <input
              type="number"
              min={0}
              value={dailyMaxQuantity}
              onChange={(e) => setDailyMaxQuantity(e.target.value)}
              placeholder="未設定"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">準備日数（日）</label>
            <input
              type="number"
              min={0}
              value={preparationDays}
              onChange={(e) => setPreparationDays(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
            />
          </div>
        </div>

        {/* カスタムオプション */}
        <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-amber-800">カスタムオプション</span>
            <button
              type="button"
              onClick={() =>
                setCustomOptions((prev) => [
                  ...prev,
                  { name: "", type: "single", required: false, values: [] },
                ])
              }
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 font-medium"
            >
              <Plus className="w-4 h-4" />
              空のオプションを追加
            </button>
          </div>

          <ProductCustomOptionPresetChips
            customOptions={customOptions}
            onAdd={(opt) => setCustomOptions((prev) => [...prev, opt])}
          />

          {customOptions.length === 0 && (
            <p className="text-sm text-gray-500">
              上の定番から追加するか、「空のオプションを追加」で自由に設定できます
            </p>
          )}

          {customOptions.map((opt, oi) => {
            const typeLabels = {
              single: "単一選択",
              multiple: "複数選択",
              text: "自由入力",
            } as const;
            const typeList: ProductCustomOption["type"][] = ["single", "multiple", "text"];
            return (
              <div
                key={oi}
                className="border border-amber-200 rounded-xl p-4 bg-white space-y-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) =>
                      setCustomOptions((prev) =>
                        prev.map((o, i) => (i === oi ? { ...o, name: e.target.value } : o))
                      )
                    }
                    placeholder="オプション名（例: サイズ、ろうそく）"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCustomOptions((prev) => prev.filter((_, i) => i !== oi))
                    }
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                    aria-label="このオプションを削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">入力形式</span>
                  {typeList.map((t) => {
                    const active = opt.type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setCustomOptions((prev) =>
                            prev.map((o, i) =>
                              i === oi
                                ? {
                                    ...o,
                                    type: t,
                                    values: t === "text" ? [] : o.values,
                                  }
                                : o
                            )
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          active
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                        }`}
                      >
                        {typeLabels[t]}
                      </button>
                    );
                  })}
                  <label className="flex items-center gap-1.5 text-sm ml-auto cursor-pointer">
                    <input
                      type="checkbox"
                      checked={opt.required}
                      onChange={(e) =>
                        setCustomOptions((prev) =>
                          prev.map((o, i) =>
                            i === oi ? { ...o, required: e.target.checked } : o
                          )
                        )
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                    必須
                  </label>
                </div>

                {opt.type !== "text" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 block">選択肢</label>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((v, vi) => (
                        <div
                          key={vi}
                          className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-full pl-3 pr-1 py-1"
                        >
                          <input
                            type="text"
                            value={v.label}
                            onChange={(e) =>
                              setCustomOptions((prev) =>
                                prev.map((o, i) =>
                                  i === oi
                                    ? {
                                        ...o,
                                        values: o.values.map((vv, vj) =>
                                          vj === vi ? { ...vv, label: e.target.value } : vv
                                        ),
                                      }
                                    : o
                                )
                              )
                            }
                            placeholder="選択肢名"
                            className="bg-transparent outline-none text-sm font-medium w-28"
                          />
                          <span className="text-xs text-gray-500">+¥</span>
                          <input
                            type="number"
                            value={v.additional_price}
                            onChange={(e) =>
                              setCustomOptions((prev) =>
                                prev.map((o, i) =>
                                  i === oi
                                    ? {
                                        ...o,
                                        values: o.values.map((vv, vj) =>
                                          vj === vi
                                            ? {
                                                ...vv,
                                                additional_price:
                                                  parseInt(e.target.value, 10) || 0,
                                              }
                                            : vv
                                        ),
                                      }
                                    : o
                                )
                              )
                            }
                            placeholder="0"
                            className="bg-transparent outline-none text-sm w-14 text-right"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCustomOptions((prev) =>
                                prev.map((o, i) =>
                                  i === oi
                                    ? {
                                        ...o,
                                        values: o.values.filter((_, vj) => vj !== vi),
                                      }
                                    : o
                                )
                              )
                            }
                            className="w-6 h-6 rounded-full bg-white/70 hover:bg-red-100 text-red-500 flex items-center justify-center"
                            aria-label="選択肢を削除"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setCustomOptions((prev) =>
                            prev.map((o, i) =>
                              i === oi
                                ? {
                                    ...o,
                                    values: [
                                      ...o.values,
                                      { label: "", additional_price: 0 },
                                    ],
                                  }
                                : o
                            )
                          )
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-amber-400 text-sm text-amber-700 hover:bg-amber-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        選択肢を追加
                      </button>
                    </div>
                  </div>
                )}

                {opt.type === "text" && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500">
                      購入者がメッセージを自由に入力できます（例: メッセージプレート、アレルギー）
                    </p>
                    <textarea
                      disabled
                      rows={2}
                      placeholder="（お客様が入力するフォームのプレビュー）"
                      className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm resize-none text-gray-400"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 注文タイプ */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {([
            { value: "always" as const, label: "常に注文を受け付ける" },
            { value: "sameDay" as const, label: "当日注文を受け付ける" },
            { value: "manual" as const, label: "注文を手動で受け付ける" },
            { value: "reserveOnly" as const, label: "予約のみ受け付ける" },
            { value: "todayOnly" as const, label: "本日限定受付" },
          ] as const).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="orderType"
                checked={orderType === opt.value}
                onChange={() => setOrderType(opt.value)}
                className="accent-blue-600 w-4 h-4"
              />
              {opt.label}
            </label>
          ))}
        </div>

        {orderType === "reserveOnly" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-2"
          >
            <input
              type="number"
              value={reserveDays}
              onChange={(e) => setReserveDays(e.target.value)}
              min={1}
              className="w-[100px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
            />
            <span className="text-sm">日前</span>
          </motion.div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isLimited}
              onChange={(e) => {
                setIsLimited(e.target.checked);
                if (!e.target.checked) { setLimitedFrom(""); setLimitedUntil(""); }
              }}
              className="w-4 h-4"
            />
            期間限定
          </label>
          <AnimatePresence>
            {isLimited && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-2 pl-6"
              >
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-[80px] shrink-0">受取開始日</label>
                  <input
                    type="date"
                    value={limitedFrom}
                    onChange={(e) => setLimitedFrom(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-[80px] shrink-0">受取終了日</label>
                  <input
                    type="date"
                    value={limitedUntil}
                    onChange={(e) => setLimitedUntil(e.target.value)}
                    min={limitedFrom || new Date().toISOString().split("T")[0]}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  準備日数が設定されている場合、受取終了日の準備日数前に自動で受付停止になります
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* デコレーション設定 */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-gray-700">デコレーション設定</label>
            <Link
              href="/store/decorations"
              className="text-xs text-amber-600 hover:text-amber-700 underline"
            >
              デコレーション管理 ↗
            </Link>
          </div>
          {allDecorationGroups.length === 0 ? (
            <p className="text-xs text-gray-400">
              グループが未登録です。{" "}
              <Link href="/store/decorations" className="text-amber-600 underline">
                デコレーション管理
              </Link>
              から作成してください。
            </p>
          ) : (
            <div className="space-y-1.5">
              {allDecorationGroups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroupIds((prev) => [...prev, group.id]);
                      } else {
                        setSelectedGroupIds((prev) => prev.filter((id) => id !== group.id));
                      }
                    }}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>{group.name}</span>
                  <span className="text-xs text-gray-400">
                    ({group.selectionType === "single" ? "単一" : "複数"}
                    {group.required ? "/必須" : "/任意"}
                    · {group.items.length}種)
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {selectedId ? "商品を更新する" : "商品を登録する"}
        </motion.button>
      </motion.div>

      {/* 完了モーダル */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
            onClick={() => setSaved(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSaved(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-lg font-bold text-center flex items-center justify-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                {selectedId ? "商品を更新しました" : "商品登録が完了しました"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 削除確認モーダル */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8"
            >
              <p className="text-lg font-bold text-center mb-2">
                この商品を削除しますか？
              </p>
              <p className="text-sm text-gray-500 text-center mb-6">
                {productName || "選択中の商品"}
              </p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-8 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  削除する
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-8 py-2 rounded-lg border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
