"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, Trash2, ImagePlus } from "lucide-react";
import { useProductTypes } from "@/hooks/use-product-types";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";
import type { ProductRegistration } from "@/hooks/use-product-registrations";

interface ProductDetailPanelProps {
  product: ProductRegistration;
  onClose: () => void;
  onSave: (
    id: string,
    updates: Partial<Omit<ProductRegistration, "id" | "store_id">>
  ) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}

export function ProductDetailPanel({
  product,
  onClose,
  onSave,
  onDelete,
}: ProductDetailPanelProps) {
  const { productTypes } = useProductTypes();
  const categories = productTypes.map((t) => t.productType);

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(
    product.description || ""
  );
  const [price, setPrice] = useState(
    product.base_price > 0 ? `¥${product.base_price.toLocaleString()}` : ""
  );
  const [prepDays, setPrepDays] = useState("0");
  const [maxPerOrder, setMaxPerOrder] = useState("10");
  const [dailyMax, setDailyMax] = useState("30");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState(product.image ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(product.name);
    setDescription(product.description || "");
    setPrice(
      product.base_price > 0 ? `¥${product.base_price.toLocaleString()}` : ""
    );
    setPrepDays("0");
    setMaxPerOrder("10");
    setDailyMax("30");
    setImage(product.image ?? "");

    const typeMatch = productTypes.find(
      (t) => t.productType === product.category_name
    );
    setCategory(typeMatch?.productType ?? categories[0] ?? "");
    setError(null);
    setSaved(false);
  }, [product, productTypes]);

  const parsePriceValue = (v: string): number =>
    parseInt(v.replace(/[¥,\s]/g, ""), 10) || 0;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const typeMatch = productTypes.find((t) => t.productType === category);
      void typeMatch;
      void prepDays;
      void maxPerOrder;
      void dailyMax;
      const { error: err } = await onSave(product.id, {
        name: name.trim(),
        description: description.trim(),
        base_price: parsePriceValue(price),
        category_name: category || null,
        image: image || null,
      });
      if (err) throw new Error(err);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (image) await deleteProductImage(image);
      const { error: err } = await onDelete(product.id);
      if (err) throw new Error(err);
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
    setDeleting(false);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const { url, error: err } = await uploadProductImage(
      file,
      product.store_id,
      "product"
    );
    setUploading(false);
    if (err) {
      setError(`画像アップロード失敗: ${err}`);
      return;
    }
    if (url) setImage(url);
  };

  const handleImageRemove = async () => {
    if (image) {
      await deleteProductImage(image);
      setImage("");
    }
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-[280px] bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0 h-full"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold">商品情報</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold block mb-1">商品名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">商品の画像</label>
          <div className="flex items-center gap-2">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              {image ? (
                <img
                  src={image}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImagePlus className="w-6 h-6" />
                </div>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>画像<br />追加</>
              )}
            </motion.button>
            {image && (
              <button
                onClick={handleImageRemove}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">商品の説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">商品の金額</label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">予約締切日数</label>
          <input
            type="number"
            value={prepDays}
            onChange={(e) => setPrepDays(e.target.value)}
            min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">1回の最大注文数</label>
          <input
            type="number"
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
            min={1}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">1日の最大注文数</label>
          <input
            type="number"
            value={dailyMax}
            onChange={(e) => setDailyMax(e.target.value)}
            min={1}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">ケーキのタイプ</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-4 h-4" />
              変更しました
            </>
          ) : (
            "変更"
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full border border-red-300 text-red-500 hover:bg-red-50 font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          商品を削除
        </motion.button>
      </div>

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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8"
            >
              <p className="text-lg font-bold text-center mb-2">
                この商品を削除しますか？
              </p>
              <p className="text-sm text-gray-500 text-center mb-6">
                {product.name || "選択中の商品"}
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

      {/* 変更完了モーダル */}
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
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-xs mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-lg font-bold text-center">変更しました</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
