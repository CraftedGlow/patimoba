"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Check, ImagePlus, Plus } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import type { ProductCustomOption, ProductCustomOptionValue } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useProductTypes } from "@/hooks/use-product-types";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";
import { useDecorationGroups, setProductDecorationGroups, getProductGroupIds } from "@/hooks/use-decoration-groups";
import { useNoshi } from "@/hooks/use-noshi";
import { CANDLE_OPTIONS } from "@/lib/constants/product-master";
import { toLocalDateString } from "@/lib/date-utils";
import { getStoreIdsWithParent } from "@/lib/store-hierarchy";
import Link from "next/link";

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
  noshi_enabled: boolean | null;
  noshi_ids: string[] | null;
  tags: string[] | null;
  isMasterProduct?: boolean;
}

const PRODUCT_TAGS = [
  "クリスマス", "バレンタイン", "ホワイトデー",
  "母の日", "父の日", "こどもの日", "ハロウィン",
  "卒業・入学", "結婚記念日", "お中元", "お歳暮",
];

export function CakeTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? null;
  const { productTypes } = useProductTypes();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
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

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [noshiEnabled, setNoshiEnabled] = useState(false);
  const [noshiIds, setNoshiIds] = useState<string[]>([]);
  const [printDecorationEnabled, setPrintDecorationEnabled] = useState(false);
  // ホール用サイズ (product_variants)
  const [sizes, setSizes] = useState<{ id?: string; name: string; price: string }[]>([]);

  const isHole = category === "ホール";

  const PREDEFINED_SIZES = [
    { name: "4号", desc: "2〜4名分" },
    { name: "5号", desc: "4〜6名分" },
    { name: "6号", desc: "6〜8名分" },
    { name: "7号", desc: "8〜10名分" },
  ];

  const { groups: allDecorationGroups } = useDecorationGroups(storeId ?? undefined);
  const { noshiList } = useNoshi(storeId ?? undefined);

  useEffect(() => {
    if (selectedId) return;
    if (isHole) {
      setCustomOptions((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            name: "ろうそく",
            type: "multiple",
            required: false,
            values: CANDLE_OPTIONS.map((c) => ({ label: c.name, additional_price: c.price })),
          },
          {
            name: "メッセージプレート",
            type: "text",
            required: false,
            values: [],
          },
        ];
      });
    } else {
      setCustomOptions([]);
      setSelectedGroupIds([]);
    }
  }, [isHole, selectedId]);

  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { storeIds, parentStoreId } = await getStoreIdsWithParent(storeId);
    const { data } = await supabase
      .from("products")
      .select("*")
      .in("store_id", storeIds)
      .order("display_order", { ascending: true });
    const rows = ((data ?? []) as unknown as ProductRow[])
      .filter((p) => p.category_name !== "ec")
      .map((p) => ({ ...p, isMasterProduct: parentStoreId !== null && p.store_id === parentStoreId }));

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
    setIsLimited(false);
    setLimitedFrom("");
    setLimitedUntil("");
    setIsTakeout(true);
    setIsEc(false);
    setDailyMaxQuantity("");
    setPreparationDays("");
    setCustomOptions([]);
    setSelectedGroupIds([]);
    setNoshiEnabled(false);
    setNoshiIds([]);
    setPrintDecorationEnabled(false);
    setSelectedTags([]);
    setSizes([]);
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
      setIsLimited(p.limited_until != null || p.limited_from != null);
      setLimitedFrom(p.limited_from ?? "");
      setLimitedUntil(p.limited_until ?? "");
      setIsTakeout(p.is_takeout ?? true);
      setIsEc(p.is_ec ?? false);
      setDailyMaxQuantity(p.daily_max_quantity != null ? String(p.daily_max_quantity) : "");
      setPreparationDays(p.preparation_days != null ? String(p.preparation_days) : "");
      setCustomOptions(Array.isArray(p.custom_options) ? (p.custom_options as ProductCustomOption[]) : []);
      setNoshiEnabled(p.noshi_enabled ?? false);
      setNoshiIds(Array.isArray(p.noshi_ids) ? p.noshi_ids : []);
      setPrintDecorationEnabled((p as any).print_decoration_enabled ?? false);
      setSelectedTags(Array.isArray(p.tags) ? p.tags as string[] : []);
      setMainImage(p.image ?? null);
      setCrossImage(p.cross_section_image ?? null);
      setError(null);
      // デコレーショングループ紐付けを取得
      getProductGroupIds(p.id).then((ids) => setSelectedGroupIds(ids));
      // サイズ (product_variants) を取得
      setSizes([]);
      supabase
        .from("product_variants")
        .select("id, name, price")
        .eq("product_id", p.id)
        .order("display_order", { ascending: true })
        .then(({ data: variants }) => {
          setSizes(
            (variants || []).map((v: any) => ({
              id: v.id,
              name: v.name ?? "",
              price: String(v.price ?? ""),
            }))
          );
        });
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
    if (!isHole && !price.trim()) {
      setError("金額を入力してください");
      return;
    }
    if (!storeId) {
      setError("店舗情報が取得できません");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        store_id: storeId,
        name: productName.trim(),
        description: description.trim(),
        base_price: isHole ? 0 : parsePriceValue(price),
        category_name: category || null,
        image: mainImage ?? null,
        cross_section_image: crossImage ?? null,
        same_day_order_allowed: false,
        is_preorder_required: isHole,
        min_order_lead_minutes: 0,
        is_active: true,
        is_takeout: true,
        is_ec: false,
        daily_max_quantity: dailyMaxQuantity.trim() === "" ? null : parseInt(dailyMaxQuantity, 10) || null,
        preparation_days: preparationDays.trim() === "" ? 0 : parseInt(preparationDays, 10) || 0,
        custom_options: customOptions,
        limited_from: isLimited && limitedFrom ? limitedFrom : null,
        limited_until: isLimited && limitedUntil ? limitedUntil : null,
        noshi_enabled: noshiEnabled,
        noshi_ids: noshiEnabled ? noshiIds : [],
        print_decoration_enabled: isHole ? printDecorationEnabled : false,
        tags: selectedTags.length > 0 ? selectedTags : null,
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

      // ホールケーキのサイズ (product_variants) を保存
      if (isHole && savedProductId) {
        await supabase.from("product_variants").delete().eq("product_id", savedProductId);
        const validSizes = sizes.filter((s) => s.name.trim());
        if (validSizes.length > 0) {
          await (supabase as any).from("product_variants").insert(
            validSizes.map((s, idx) => ({
              product_id: savedProductId,
              name: s.name.trim(),
              price: parseInt(s.price, 10) || 0,
              is_active: true,
              display_order: idx,
            }))
          );
        }
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

      // バリアントIDを先に取得
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", selectedId);
      const variantIds = (variants ?? []).map((v: any) => v.id);

      // order_items のFK参照をnullにしてからでないと削除できない
      await supabase
        .from("order_items")
        .update({ product_id: null, product_variant_id: null })
        .eq("product_id", selectedId);
      if (variantIds.length > 0) {
        await supabase
          .from("order_items")
          .update({ product_variant_id: null })
          .in("product_variant_id", variantIds);
      }

      // 関連テーブルを削除してから本体を削除
      await supabase.from("product_decoration_groups").delete().eq("product_id", selectedId);
      await supabase.from("product_variants").delete().eq("product_id", selectedId);
      const { error: err } = await supabase.from("products").delete().eq("id", selectedId);
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
        <LineSpinner size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-[220px]"
        >
          <option value="">＋ 新規登録</option>
          {products.map((p) => (
            <option key={p.id} value={p.id} disabled={p.isMasterProduct}>
              {p.name || `商品 #${p.id}`}{p.isMasterProduct ? "（共有・編集不可）" : ""}
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
        className="bg-[#FFF9C4] rounded-xl p-4 lg:p-6 max-w-[640px] space-y-4"
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

        {/* 商品名 */}
        <div className="relative">
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="商品名"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
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
          <div className="relative group flex-1 max-w-[220px]">
            {mainImage ? (
              <div className="relative w-full h-[160px] sm:h-[180px] rounded-lg overflow-hidden border border-gray-200">
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
                className="w-full h-[160px] sm:h-[180px] rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-600 gap-2 hover:border-amber-400 hover:text-amber-500 transition-colors"
              >
                {uploadingMain ? (
                  <LineSpinner size={24} />
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-center">メイン画像を<br />アップロード</span>
                  </>
                )}
              </motion.button>
            )}
          </div>
          <div className="relative group flex-1 max-w-[220px]">
            {crossImage ? (
              <div className="relative w-full h-[160px] sm:h-[180px] rounded-lg overflow-hidden border border-gray-200">
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
                className="w-full h-[160px] sm:h-[180px] rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-600 gap-2 hover:border-amber-400 hover:text-amber-500 transition-colors"
              >
                {uploadingCross ? (
                  <LineSpinner size={24} />
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-center">断面の画像を<br />アップロード</span>
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

        {/* 金額（ホール以外のみ。ホールはサイズ別価格で管理） */}
        {!isHole && (
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="¥700"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        )}

        {/* 1日の最大数 / 準備日数 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* ホールケーキ サイズ管理 */}
        {isHole && (
          <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-3">
            <span className="text-base font-bold text-amber-800">サイズ設定</span>
            {PREDEFINED_SIZES.map((ps) => {
              const existing = sizes.find((s) => s.name === ps.name);
              const checked = !!existing;
              return (
                <div key={ps.name} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer min-w-[110px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSizes((prev) => [...prev, { name: ps.name, price: "" }]);
                        } else {
                          setSizes((prev) => prev.filter((s) => s.name !== ps.name));
                        }
                      }}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-sm font-medium text-gray-800">{ps.name}</span>
                    <span className="text-xs text-gray-500">({ps.desc})</span>
                  </label>
                  {checked && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={existing?.price ?? ""}
                        onChange={(e) => setSizes((prev) => prev.map((s) => s.name === ps.name ? { ...s, price: e.target.value } : s))}
                        placeholder="金額"
                        className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                      />
                      <span className="text-sm text-gray-500">円</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ろうそく・メッセージプレート設定（ホールのみ） */}
        {isHole && (() => {
          const candleOpt = customOptions.find((o) => o.name === "ろうそく");
          const hasCandles = !!candleOpt;
          const candleValues = candleOpt?.values ?? [];
          const msgOpt = customOptions.find((o) => o.name === "メッセージプレート");
          const hasMessagePlate = !!msgOpt;
          const msgRequired = msgOpt?.required ?? false;

          const toggleCandles = (enabled: boolean) => {
            if (enabled) {
              setCustomOptions((prev) => {
                if (prev.some((o) => o.name === "ろうそく")) return prev;
                return [...prev, { name: "ろうそく", type: "multiple", required: false, values: CANDLE_OPTIONS.map((c) => ({ label: c.name, additional_price: c.price })) }];
              });
            } else {
              setCustomOptions((prev) => prev.filter((o) => o.name !== "ろうそく"));
            }
          };

          const updateCandleValues = (values: ProductCustomOptionValue[]) => {
            setCustomOptions((prev) => prev.map((o) => o.name === "ろうそく" ? { ...o, values } : o));
          };

          const msgValues = msgOpt?.values ?? [];

          const toggleMessagePlate = (enabled: boolean) => {
            if (enabled) {
              setCustomOptions((prev) => {
                if (prev.some((o) => o.name === "メッセージプレート")) return prev;
                return [...prev, { name: "メッセージプレート", type: "single", required: false, values: [] }];
              });
            } else {
              setCustomOptions((prev) => prev.filter((o) => o.name !== "メッセージプレート"));
            }
          };

          const updateMessagePlateValues = (values: ProductCustomOptionValue[]) => {
            setCustomOptions((prev) => prev.map((o) => o.name === "メッセージプレート" ? { ...o, values } : o));
          };

          const setMsgRequired = (required: boolean) => {
            setCustomOptions((prev) => prev.map((o) => o.name === "メッセージプレート" ? { ...o, required } : o));
          };

          return (
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-4">
              <span className="text-base font-bold text-amber-800">オプション設定</span>

              {/* ろうそく */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasCandles}
                    onChange={(e) => toggleCandles(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  ろうそくを使用する
                </label>
                {hasCandles && (
                  <div className="pl-6 space-y-2">
                    <p className="text-xs text-gray-500">種類と追加料金を設定してください</p>
                    {candleValues.map((v, vi) => (
                      <div key={vi} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.label}
                          onChange={(e) => updateCandleValues(candleValues.map((vv, j) => j === vi ? { ...vv, label: e.target.value } : vv))}
                          placeholder="ろうそく名"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                        />
                        <span className="text-xs text-gray-500 shrink-0">+¥</span>
                        <input
                          type="number"
                          value={v.additional_price}
                          onChange={(e) => updateCandleValues(candleValues.map((vv, j) => j === vi ? { ...vv, additional_price: parseInt(e.target.value, 10) || 0 } : vv))}
                          placeholder="0"
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => updateCandleValues(candleValues.filter((_, j) => j !== vi))}
                          className="text-red-400 hover:text-red-600 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateCandleValues([...candleValues, { label: "", additional_price: 0 }])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-amber-400 text-sm text-amber-700 hover:bg-amber-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      ろうそく種類を追加
                    </button>
                    <p className="text-xs text-gray-600">※「ナンバーキャンドル」という名前の種類は、顧客画面で数字（0〜9）を指定できます</p>
                  </div>
                )}
              </div>

              {/* メッセージプレート */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasMessagePlate}
                    onChange={(e) => toggleMessagePlate(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  メッセージプレートを使用する（無料）
                </label>
                {hasMessagePlate && (
                  <div className="pl-6 space-y-2">
                    <p className="text-xs text-gray-500">種類と追加料金を設定してください（種類なしの場合はテキスト入力のみ）</p>
                    {msgValues.map((v, vi) => (
                      <div key={vi} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.label}
                          onChange={(e) => updateMessagePlateValues(msgValues.map((vv, j) => j === vi ? { ...vv, label: e.target.value } : vv))}
                          placeholder="プレート名"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => updateMessagePlateValues(msgValues.filter((_, j) => j !== vi))}
                          className="text-red-400 hover:text-red-600 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateMessagePlateValues([...msgValues, { label: "", additional_price: 0 }])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-amber-400 text-sm text-amber-700 hover:bg-amber-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      プレート種類を追加
                    </button>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={msgRequired}
                        onChange={(e) => setMsgRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      {msgValues.length > 0 ? "種類の選択を必須にする" : "メッセージの入力を必須にする"}
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">タグ（シーズン・用途）</label>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelectedTags((prev) =>
                      active ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                    active
                      ? "bg-amber-400 text-white border-amber-400"
                      : "bg-white text-gray-500 border-gray-300 hover:border-amber-300"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

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
                    min={toLocalDateString(new Date())}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-[80px] shrink-0">受取終了日</label>
                  <input
                    type="date"
                    value={limitedUntil}
                    onChange={(e) => setLimitedUntil(e.target.value)}
                    min={limitedFrom || toLocalDateString(new Date())}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <p className="text-xs text-gray-600">
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

        {/* デコレーション設定（ホールのみ） */}
        {isHole && (
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
              <p className="text-xs text-gray-600">
                グループが未登録です。{" "}
                <Link href="/store/decorations" className="text-amber-600 underline">
                  デコレーション管理
                </Link>
                から作成してください。
              </p>
            ) : (
              <div className="space-y-1.5">
                {allDecorationGroups.filter((group) => group.items.length > 0).map((group) => (
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
                    <span className="text-xs text-gray-600">
                      ({group.selectionType === "single" ? "単一" : "複数"}
                      {group.required ? "/必須" : "/任意"}
                      · {group.items.length}種)
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* プリントデコレーション対応（ホールのみ） */}
        {isHole && (
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={printDecorationEnabled}
                onChange={(e) => setPrintDecorationEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              プリントデコレーション対応
            </label>
            {printDecorationEnabled && (
              <p className="text-xs text-gray-600 pl-6">
                プリントデコレーションの注文フローでこのケーキが選択できるようになります
              </p>
            )}
          </div>
        )}

        {/* のし設定 */}
        <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={noshiEnabled}
                onChange={(e) => {
                  setNoshiEnabled(e.target.checked);
                  if (!e.target.checked) setNoshiIds([]);
                }}
                className="w-4 h-4 accent-amber-500"
              />
              のしを使用する
            </label>
            {noshiEnabled && (
              <div className="pl-6 space-y-1.5">
                {noshiList.length === 0 ? (
                  <p className="text-xs text-gray-600">
                    のしが未登録です。{" "}
                    <Link href="/store/register" className="text-amber-600 underline">
                      のし管理
                    </Link>
                    タブから登録してください。
                  </p>
                ) : (
                  noshiList.map((n) => (
                    <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noshiIds.includes(n.id)}
                        onChange={(e) => {
                          setNoshiIds((prev) =>
                            e.target.checked ? [...prev, n.id] : prev.filter((id) => id !== n.id)
                          );
                        }}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <img src={n.imageUrl || "/noshi-default.jpg"} alt="" className="w-6 h-6 rounded object-cover" />
                      <span>{n.name}</span>
                      {n.price > 0 && (
                        <span className="text-xs text-gray-600">+¥{n.price.toLocaleString()}</span>
                      )}
                    </label>
                  ))
                )}
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
          {saving && <LineSpinner size={16} />}
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
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-600"
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
                  {deleting && <LineSpinner size={16} />}
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
