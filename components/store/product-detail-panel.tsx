"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2, ImagePlus, Plus, GripVertical } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { useProductTypes } from "@/hooks/use-product-types";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";
import { supabase } from "@/lib/supabase";
import type { ProductRegistration, ProductCustomOption } from "@/hooks/use-product-registrations";
import { ProductCustomOptionPresetChips } from "@/components/store/product-custom-option-preset-chips";

const PANEL_WIDTH_KEY = "patimoba-store-product-panel-width";
const PANEL_MIN_W = 260;
const PANEL_MAX_W = 720;
const PANEL_DEFAULT_W = 320;

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
  const [prepDays, setPrepDays] = useState(String(product.preparation_days ?? 0));
  const [maxPerOrder, setMaxPerOrder] = useState("10");
  const [dailyMax, setDailyMax] = useState(product.daily_max_quantity != null ? String(product.daily_max_quantity) : "");
  const [isTakeout, setIsTakeout] = useState(product.is_takeout);
  const [isEc, setIsEc] = useState(product.is_ec);
  const [customOptions, setCustomOptions] = useState<ProductCustomOption[]>(product.custom_options);
  const [category, setCategory] = useState("");
  const [image, setImage] = useState(product.image ?? "");
  const [sizes, setSizes] = useState<{ id?: string; name: string; price: string }[]>([]);
  const [printDecorationEnabled, setPrintDecorationEnabled] = useState(
    product.print_decoration_enabled
  );

  const isHole = category === "ホール";

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_W);
  const dragStartRef = useRef<{ x: number; w: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(PANEL_WIDTH_KEY);
    if (raw == null) return;
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      setPanelWidth(Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, n)));
    }
  }, []);

  const persistPanelWidth = useCallback((w: number) => {
    const clamped = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, w));
    setPanelWidth(clamped);
    localStorage.setItem(PANEL_WIDTH_KEY, String(clamped));
  }, []);

  useEffect(() => {
    setName(product.name);
    setDescription(product.description || "");
    setPrice(
      product.base_price > 0 ? `¥${product.base_price.toLocaleString()}` : ""
    );
    setPrepDays(String(product.preparation_days ?? 0));
    setMaxPerOrder("10");
    setDailyMax(product.daily_max_quantity != null ? String(product.daily_max_quantity) : "");
    setIsTakeout(product.is_takeout);
    setIsEc(product.is_ec);
    setCustomOptions(product.custom_options);
    setImage(product.image ?? "");
    setPrintDecorationEnabled(product.print_decoration_enabled);

    const typeMatch = productTypes.find(
      (t) => t.productType === product.category_name
    );
    setCategory(typeMatch?.productType ?? categories[0] ?? "");
    setError(null);
    setSaved(false);

    setSizes([]);
    supabase
      .from("product_variants")
      .select("id, name, price")
      .eq("product_id", product.id)
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
  }, [product, productTypes]);

  const parsePriceValue = (v: string): number =>
    parseInt(v.replace(/[¥,\s]/g, ""), 10) || 0;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const typeMatch = productTypes.find((t) => t.productType === category);
      void typeMatch;
      void maxPerOrder;
      const { error: err } = await onSave(product.id, {
        name: name.trim(),
        description: description.trim(),
        base_price: isHole ? 0 : parsePriceValue(price),
        category_name: category || null,
        image: image || null,
        preparation_days: Number(prepDays) || 0,
        daily_max_quantity: dailyMax.trim() ? Number(dailyMax) : null,
        is_takeout: isTakeout,
        is_ec: isEc,
        custom_options: customOptions as any,
        print_decoration_enabled: isHole ? printDecorationEnabled : false,
      });
      if (err) throw new Error(err);

      if (isHole) {
        await supabase.from("product_variants").delete().eq("product_id", product.id);
        const validSizes = sizes.filter((s) => s.name.trim());
        if (validSizes.length > 0) {
          await supabase.from("product_variants").insert(
            validSizes.map((s, idx) => ({
              product_id: product.id,
              name: s.name.trim(),
              price: parsePriceValue(s.price),
              is_active: true,
              display_order: idx,
            })) as any
          );
        }
      }

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
      initial={{ x: 48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 48, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className={
        isMobile
          ? "fixed inset-0 z-50 bg-white overflow-y-auto"
          : "flex h-full shrink-0 bg-white border-l border-gray-200 shadow-[inset_1px_0_0_rgba(0,0,0,0.04)]"
      }
      style={{ width: isMobile ? "100%" : panelWidth }}
    >
      <button
        type="button"
        aria-label="パネル幅を調整"
        title="ドラッグで幅を変更"
        onMouseDown={(e) => {
          e.preventDefault();
          dragStartRef.current = { x: e.clientX, w: panelWidth };
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          const onMove = (ev: MouseEvent) => {
            const d = dragStartRef.current;
            if (!d) return;
            persistPanelWidth(d.w + (ev.clientX - d.x));
          };
          const onUp = () => {
            dragStartRef.current = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        className="hidden lg:flex group w-3 shrink-0 flex-col items-center justify-center cursor-col-resize border-r border-transparent hover:border-amber-200 hover:bg-amber-50/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-inset"
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
      </button>
      <div className="flex-1 min-w-0 overflow-y-auto p-5">
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
                <LineSpinner size={20} />
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

        {isHole ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-bold">サイズごとの金額</label>
              <button
                type="button"
                onClick={() =>
                  setSizes((prev) => [...prev, { name: "", price: "" }])
                }
                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> サイズ追加
              </button>
            </div>
            <div className="space-y-2">
              {sizes.map((s, i) => (
                <div key={s.id ?? i} className="flex gap-2">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => {
                      const next = [...sizes];
                      next[i] = { ...next[i], name: e.target.value };
                      setSizes(next);
                    }}
                    placeholder="サイズ名（例: 5号）"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
                  />
                  <input
                    type="text"
                    value={s.price}
                    onChange={(e) => {
                      const next = [...sizes];
                      next[i] = { ...next[i], price: e.target.value };
                      setSizes(next);
                    }}
                    placeholder="¥金額"
                    className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {sizes.length === 0 && (
                <p className="text-xs text-gray-400">サイズが登録されていません</p>
              )}
            </div>

            <div className="space-y-2 pt-3">
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
                <p className="text-xs text-gray-400 pl-6">
                  プリントデコレーションの注文フローでこのケーキが選択できるようになります
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm font-bold block mb-1">商品の金額</label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-bold block mb-1">最大個数（/日）</label>
          <input
            type="number"
            value={dailyMax}
            onChange={(e) => setDailyMax(e.target.value)}
            min={1}
            placeholder="空欄は上限なし（一覧は「-」）"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">準備日数</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={prepDays}
              onChange={(e) => setPrepDays(e.target.value)}
              min={0}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
            />
            <span className="text-sm text-gray-600 shrink-0">日</span>
          </div>
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
          <label className="text-sm font-bold block mb-1">販売チャネル</label>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isTakeout}
                onChange={(e) => setIsTakeout(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              テイクアウト
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isEc}
                onChange={(e) => setIsEc(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              EC
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-bold">カスタムオプション</label>
            <button
              type="button"
              onClick={() =>
                setCustomOptions((prev) => [
                  ...prev,
                  { name: "", type: "single", required: false, values: [] },
                ])
              }
              className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> 空のオプションを追加
            </button>
          </div>
          <ProductCustomOptionPresetChips
            compact
            className="mb-3 pb-3 border-b border-gray-100"
            customOptions={customOptions}
            onAdd={(opt) => setCustomOptions((prev) => [...prev, opt])}
          />
          <div className="space-y-3">
            {customOptions.map((opt, oi) => (
              <div key={oi} className="border border-gray-200 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) => {
                      const next = [...customOptions];
                      next[oi] = { ...next[oi], name: e.target.value };
                      setCustomOptions(next);
                    }}
                    placeholder="オプション名"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <select
                    value={opt.type}
                    onChange={(e) => {
                      const next = [...customOptions];
                      next[oi] = { ...next[oi], type: e.target.value as any };
                      setCustomOptions(next);
                    }}
                    className="border border-gray-300 rounded px-1 py-1 text-xs"
                  >
                    <option value="single">単一</option>
                    <option value="multiple">複数</option>
                    <option value="text">記入</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setCustomOptions(customOptions.filter((_, i) => i !== oi))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {opt.type === "text" && (
                  <textarea
                    disabled
                    rows={2}
                    placeholder="（お客様が入力するフォームのプレビュー）"
                    className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs resize-none text-gray-400"
                  />
                )}
                {opt.type !== "text" && (
                  <div className="space-y-1">
                    {opt.values.map((v, vi) => (
                      <div key={vi} className="flex gap-1">
                        <input
                          type="text"
                          value={v.label}
                          onChange={(e) => {
                            const next = [...customOptions];
                            const values = [...next[oi].values];
                            values[vi] = { ...values[vi], label: e.target.value };
                            next[oi] = { ...next[oi], values };
                            setCustomOptions(next);
                          }}
                          placeholder="選択肢"
                          className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs"
                        />
                        <input
                          type="number"
                          value={v.additional_price}
                          onChange={(e) => {
                            const next = [...customOptions];
                            const values = [...next[oi].values];
                            values[vi] = { ...values[vi], additional_price: Number(e.target.value) || 0 };
                            next[oi] = { ...next[oi], values };
                            setCustomOptions(next);
                          }}
                          placeholder="+¥"
                          className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...customOptions];
                            next[oi] = { ...next[oi], values: next[oi].values.filter((_, i) => i !== vi) };
                            setCustomOptions(next);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...customOptions];
                        next[oi] = { ...next[oi], values: [...next[oi].values, { label: "", additional_price: 0 }] };
                        setCustomOptions(next);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      + 選択肢追加
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
            <LineSpinner size={20} />
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
              <p className="text-sm text-gray-500 text-center mb-2">
                {product.name || "選択中の商品"}
              </p>
              {error && (
                <p className="text-sm text-red-500 text-center mb-4">
                  {error.includes("foreign key") || error.includes("violates")
                    ? "この商品は注文履歴があるため削除できません。販売を停止する場合は「販売チャネル」のチェックを外してください。"
                    : error}
                </p>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-8 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting && <LineSpinner size={20} />}
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
