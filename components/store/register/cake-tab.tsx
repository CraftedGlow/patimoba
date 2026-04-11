"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Trash2, Check, ImagePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useProductTypes } from "@/hooks/use-product-types";
import { useProductCategories } from "@/hooks/use-product-categories";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";

type OrderType = "always" | "sameDay" | "manual" | "reserveOnly" | "todayOnly";

interface ProductRow {
  id: number;
  name: string | null;
  descriprion: string | null;
  description: string | null;
  price: number | null;
  image: string | null;
  cross_section_image: string | null;
  product_type_id: string | null;
  always_available: boolean | null;
  cur_same_day: boolean | null;
  preparation_days: number | null;
  order_start_date: string | null;
  order_end_date: string | null;
  is_ec: boolean | null;
  store_id: string | null;
  max_per_day: number | null;
  max_per_order: number | null;
}

interface CandleRow {
  id: string;
  name: string;
  price: number;
}

interface OptionRow {
  id: string;
  name: string;
  price: number;
  multiple_allowed: boolean;
}

function resolveOrderType(row: ProductRow): OrderType {
  if (row.cur_same_day) return "sameDay";
  if (row.preparation_days && row.preparation_days > 0) return "reserveOnly";
  if (row.always_available === false) return "manual";
  return "always";
}

export function CakeTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? null;
  const { productTypes } = useProductTypes();
  const { categories: productCategories } = useProductCategories(storeId ?? undefined);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("always");
  const [reserveDays, setReserveDays] = useState("10");
  const [isLimited, setIsLimited] = useState(false);

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

  // ホールケーキ用カスタム情報
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [selectedCandleId, setSelectedCandleId] = useState<string>("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [messagePlate, setMessagePlate] = useState("");

  const isHole = category === "ホール";

  const fetchCandles = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("candle_options")
      .select("id, name, price")
      .eq("store_id", storeId)
      .order("sort_order");
    setCandles((data ?? []) as CandleRow[]);
  }, [storeId]);

  const fetchOptions = useCallback(async () => {
    const { data } = await supabase
      .from("whole_cake_options")
      .select("id, name, price, multiple_allowed")
      .order("sort_order");
    setOptions(
      (data ?? []).map((o: any) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        multiple_allowed: o.multiple_allowed ?? false,
      }))
    );
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("product_registrations")
      .select("*")
      .eq("store_id", storeId)
      .or("is_ec.is.null,is_ec.eq.false")
      .order("id", { ascending: true });
    setProducts((data ?? []) as ProductRow[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
    fetchCandles();
    fetchOptions();
  }, [fetchProducts, fetchCandles, fetchOptions]);

  const clearForm = useCallback(() => {
    setSelectedId(null);
    setCategory("");
    setProductName("");
    setDescription("");
    setPrice("");
    setOrderType("always");
    setReserveDays("10");
    setIsLimited(false);
    setMainImage(null);
    setCrossImage(null);
    setSelectedCandleId("");
    setSelectedOptionIds(new Set());
    setMessagePlate("");
    setError(null);
  }, []);

  const selectProduct = useCallback(
    (id: number) => {
      const p = products.find((r) => r.id === id);
      if (!p) return;
      setSelectedId(p.id);
      const typeMatch = productTypes.find(
        (t) => t.id === String(p.product_type_id)
      );
      setCategory(typeMatch?.productType ?? "");
      setProductName(p.name ?? "");
      setDescription(p.descriprion ?? p.description ?? "");
      setPrice(p.price != null ? `¥${p.price.toLocaleString()}` : "");
      setOrderType(resolveOrderType(p));
      setReserveDays(String(p.preparation_days ?? 10));
      setIsLimited(!!(p.order_start_date || p.order_end_date));
      setMainImage(p.image ?? null);
      setCrossImage(p.cross_section_image ?? null);
      setSelectedCandleId("");
      setSelectedOptionIds(new Set());
      setMessagePlate("");
      setError(null);
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

  const toggleOption = (id: string) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

    setSaving(true);
    try {
      const typeMatch = productTypes.find((t) => t.productType === category);
      const payload: any = {
        store_id: storeId,
        name: productName.trim(),
        descriprion: description.trim(),
        price: parsePriceValue(price),
        product_type_id: typeMatch?.id ?? null,
        image: mainImage ?? null,
        cross_section_image: crossImage ?? null,
        always_available: orderType === "always",
        cur_same_day: orderType === "sameDay",
        preparation_days:
          orderType === "reserveOnly" ? parseInt(reserveDays, 10) || 0 : 0,
        is_ec: false,
        order_start_date: null,
        order_end_date: null,
      };

      let productRegId: number | null = selectedId;

      if (selectedId) {
        const { error: err } = await supabase
          .from("product_registrations")
          .update(payload)
          .eq("id", selectedId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from("product_registrations")
          .insert({ ...payload, created_date: new Date().toISOString() })
          .select("id")
          .single();
        if (err) throw err;
        productRegId = data?.id ?? null;
      }

      // ホール選択時: whole_cake_products にも登録し、カスタム情報を紐づけ
      if (isHole && productRegId) {
        const existingWcp = await supabase
          .from("whole_cake_products")
          .select("id")
          .eq("store_id", storeId)
          .eq("name", productName.trim())
          .maybeSingle();

        let wcpId: string;
        if (existingWcp.data) {
          wcpId = existingWcp.data.id;
          await supabase
            .from("whole_cake_products")
            .update({
              name: productName.trim(),
              image: mainImage ?? "",
            })
            .eq("id", wcpId);
        } else {
          const { data: newWcp, error: wcpErr } = await supabase
            .from("whole_cake_products")
            .insert({
              store_id: storeId,
              name: productName.trim(),
              image: mainImage ?? "",
            })
            .select("id")
            .single();
          if (wcpErr) throw wcpErr;
          wcpId = newWcp.id;
        }

        // 選択されたオプションを紐づけ（既存のオプションが別の whole_cake_product_id の場合でも、情報をログに記録）
        if (selectedCandleId) {
          // ろうそく選択情報はorder_item_detailsに注文時保存されるため、ここではログのみ
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
      const { error: err } = await supabase
        .from("product_registrations")
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
              selectProduct(Number(v));
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

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isLimited}
            onChange={(e) => setIsLimited(e.target.checked)}
            className="w-4 h-4"
          />
          期間限定
        </label>

        {/* ホール選択時のカスタム情報 */}
        <AnimatePresence>
          {isHole && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-amber-300 pt-4 mt-2 space-y-4">
                <h3 className="text-sm font-bold text-amber-700">
                  ホールケーキ カスタム情報
                </h3>

                {/* ろうそく選択 */}
                <div>
                  <label className="text-sm font-medium block mb-2">ろうそく</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCandleId("")}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        selectedCandleId === ""
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                      }`}
                    >
                      なし
                    </button>
                    {candles.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCandleId(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          selectedCandleId === c.id
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                        }`}
                      >
                        {c.name}
                        {c.price > 0 && (
                          <span className="ml-1 text-xs opacity-75">
                            +¥{c.price}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* オプション選択 */}
                <div>
                  <label className="text-sm font-medium block mb-2">オプション</label>
                  <div className="flex flex-wrap gap-2">
                    {options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggleOption(o.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          selectedOptionIds.has(o.id)
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                        }`}
                      >
                        {o.name}
                        {o.price > 0 && (
                          <span className="ml-1 text-xs opacity-75">
                            +¥{o.price.toLocaleString()}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* メッセージプレート */}
                <div>
                  <label className="text-sm font-medium block mb-1">
                    メッセージプレート
                  </label>
                  <input
                    type="text"
                    value={messagePlate}
                    onChange={(e) => setMessagePlate(e.target.value)}
                    placeholder="例: お誕生日おめでとう"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
