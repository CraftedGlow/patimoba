"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Trash2, Check, X, ImagePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";

const shippingMethods = ["常温便", "冷蔵便", "冷凍便"];
const storageMethods = ["常温保存", "冷蔵保存", "冷凍保存"];
const expiryOptions = [
  "1", "2", "3", "5", "7", "10", "14", "30", "60", "90",
];

interface EcProductRow {
  id: number;
  name: string | null;
  descriprion: string | null;
  description: string | null;
  price: number | null;
  image: string | null;
  cross_section_image: string | null;
  shipping_type: string | null;
  storage_type: string | null;
  ingredients: string | null;
  expiration_days: number | null;
  volume: string | null;
  store_id: string | null;
}

export function EcTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? null;

  const [products, setProducts] = useState<EcProductRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [storageMethod, setStorageMethod] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [expiry, setExpiry] = useState("");
  const [volume, setVolume] = useState("");
  const [price, setPrice] = useState("");

  const [mainImage, setMainImage] = useState<string | null>(null);
  const [crossImage, setCrossImage] = useState<string | null>(null);
  const [extraImage, setExtraImage] = useState<string | null>(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingCross, setUploadingCross] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const crossInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      .eq("is_ec", true)
      .order("id", { ascending: true });
    setProducts((data ?? []) as EcProductRow[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const clearForm = useCallback(() => {
    setSelectedId(null);
    setProductName("");
    setDescription("");
    setShippingMethod("");
    setStorageMethod("");
    setIngredients("");
    setExpiry("");
    setVolume("");
    setPrice("");
    setMainImage(null);
    setCrossImage(null);
    setExtraImage(null);
    setError(null);
  }, []);

  const selectProduct = useCallback(
    (id: number) => {
      const p = products.find((r) => r.id === id);
      if (!p) return;
      setSelectedId(p.id);
      setProductName(p.name ?? "");
      setDescription(p.descriprion ?? p.description ?? "");
      setShippingMethod(p.shipping_type ?? "");
      setStorageMethod(p.storage_type ?? "");
      setIngredients(p.ingredients ?? "");
      setExpiry(p.expiration_days != null ? String(p.expiration_days) : "");
      setVolume(p.volume ?? "");
      setPrice(p.price != null ? `¥${p.price.toLocaleString()}` : "");
      setMainImage(p.image ?? null);
      setCrossImage(p.cross_section_image ?? null);
      setExtraImage(null);
      setError(null);
    },
    [products]
  );

  const handleImageUpload = async (
    file: File,
    type: "main" | "cross" | "extra"
  ) => {
    if (!storeId) return;
    const setters = {
      main: { setImage: setMainImage, setLoading: setUploadingMain },
      cross: { setImage: setCrossImage, setLoading: setUploadingCross },
      extra: { setImage: setExtraImage, setLoading: setUploadingExtra },
    };
    const { setImage, setLoading: setUploading } = setters[type];

    setUploading(true);
    const { url, error: err } = await uploadProductImage(
      file,
      storeId,
      `ec-${type}`
    );
    setUploading(false);

    if (err) {
      setError(`画像アップロード失敗: ${err}`);
      return;
    }
    setImage(url);
  };

  const handleRemoveImage = async (
    type: "main" | "cross" | "extra"
  ) => {
    const urls = { main: mainImage, cross: crossImage, extra: extraImage };
    const setters = { main: setMainImage, cross: setCrossImage, extra: setExtraImage };
    const url = urls[type];
    if (url) await deleteProductImage(url);
    setters[type](null);
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

    setSaving(true);
    try {
      const payload = {
        store_id: storeId,
        name: productName.trim(),
        descriprion: description.trim(),
        price: parsePriceValue(price),
        is_ec: true,
        image: mainImage ?? null,
        cross_section_image: crossImage ?? null,
        shipping_type: shippingMethod || null,
        storage_type: storageMethod || null,
        ingredients: ingredients.trim() || null,
        expiration_days: expiry ? parseInt(expiry, 10) : null,
        volume: volume.trim() || null,
      };

      if (selectedId) {
        const { error: err } = await supabase
          .from("product_registrations")
          .update(payload)
          .eq("id", selectedId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("product_registrations")
          .insert({ ...payload, created_date: new Date().toISOString() });
        if (err) throw err;
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
      if (extraImage) await deleteProductImage(extraImage);
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

  const renderImageSlot = (
    type: "main" | "cross" | "extra",
    label: string,
    image: string | null,
    uploading: boolean,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => (
    <div className="relative group">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f, type);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="relative w-[150px] h-[150px] rounded-lg overflow-hidden border border-gray-200">
          <img
            src={image}
            alt={label}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => handleRemoveImage(type)}
            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02, borderColor: "#f59e0b" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-[150px] h-[150px] rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 gap-2 hover:border-amber-400 hover:text-amber-500 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-8 h-8" />
              <span className="text-center px-2">{label}</span>
            </>
          )}
        </motion.button>
      )}
    </div>
  );

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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-[240px]"
        >
          <option value="">登録済み商品リスト(EC)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || `EC商品 #${p.id}`}
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
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="商品名"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

        {/* 3枚の画像アップロード */}
        <div className="flex gap-3">
          {renderImageSlot(
            "main",
            "メイン画像をアップロード",
            mainImage,
            uploadingMain,
            mainInputRef
          )}
          {renderImageSlot(
            "cross",
            "断面の画像をアップロード",
            crossImage,
            uploadingCross,
            crossInputRef
          )}
          {renderImageSlot(
            "extra",
            "断面の画像をアップロード",
            extraImage,
            uploadingExtra,
            extraInputRef
          )}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="商品説明"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

        <select
          value={shippingMethod}
          onChange={(e) => setShippingMethod(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        >
          <option value="">発送方法を選択</option>
          {shippingMethods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={storageMethod}
          onChange={(e) => setStorageMethod(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        >
          <option value="">保存方法を選択</option>
          {storageMethods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="原材料を選択"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

        <div className="flex items-center gap-2">
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-[160px] border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-300"
          >
            <option value="">賞味期限を選択</option>
            {expiryOptions.map((e) => (
              <option key={e} value={e}>
                {e}日
              </option>
            ))}
          </select>
          <span className="text-sm">発送日からの日数</span>
        </div>

        <textarea
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          placeholder={"内容量を入力\n例) マドレーヌ:3個\n　　フィナンシェ、ドーナツ、チョコパイ:各1個"}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="金額"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />

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
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8"
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
                {selectedId ? "EC商品を更新しました" : "商品登録が完了しました"}
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
