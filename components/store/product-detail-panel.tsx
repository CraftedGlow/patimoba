"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2, ImagePlus, Plus, GripVertical } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { useProductTypes } from "@/hooks/use-product-types";
import { uploadProductImage, deleteProductImage } from "@/lib/upload-image";
import { supabase } from "@/lib/supabase";
import { useNoshi } from "@/hooks/use-noshi";
import type { ProductRegistration, ProductCustomOption } from "@/hooks/use-product-registrations";
import { ProductCustomOptionPresetChips } from "@/components/store/product-custom-option-preset-chips";

const PANEL_WIDTH_KEY = "patimoba-store-product-panel-width";
const PANEL_MIN_W = 260;
const PANEL_MAX_W = 780;
const PANEL_DEFAULT_W = 380;

const PRODUCT_TAGS = [
  "クリスマス", "バレンタイン", "ホワイトデー",
  "母の日", "父の日", "こどもの日", "ハロウィン",
  "卒業・入学", "結婚記念日", "お中元", "お歳暮",
];

const SHIPPING_OPTIONS = ["常温", "冷蔵", "冷凍"];

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
  const { noshiList } = useNoshi(product.store_id);

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(
    product.base_price > 0 ? `¥${product.base_price.toLocaleString()}` : ""
  );
  const [prepDays, setPrepDays] = useState(String(product.preparation_days ?? 0));
  const [dailyMax, setDailyMax] = useState(product.daily_max_quantity != null ? String(product.daily_max_quantity) : "");
  const [isActive, setIsActive] = useState(product.is_active);
  const [isTakeout, setIsTakeout] = useState(product.is_takeout);
  const [isEc, setIsEc] = useState(product.is_ec);
  const [sameDayOrderAllowed, setSameDayOrderAllowed] = useState(product.same_day_order_allowed);
  const [customOptions, setCustomOptions] = useState<ProductCustomOption[]>(product.custom_options);
  const [category, setCategory] = useState("");
  const [image, setImage] = useState(product.image ?? "");
  const [crossImage, setCrossImage] = useState(product.cross_section_image ?? "");
  const [sizes, setSizes] = useState<{ id?: string; name: string; price: string }[]>([]);
  const [printDecorationEnabled, setPrintDecorationEnabled] = useState(product.print_decoration_enabled);

  // 期間限定
  const [isLimited, setIsLimited] = useState(!!(product.limited_from || product.limited_until));
  const [limitedFrom, setLimitedFrom] = useState(product.limited_from ?? "");
  const [limitedUntil, setLimitedUntil] = useState(product.limited_until ?? "");

  // タグ
  const [selectedTags, setSelectedTags] = useState<string[]>(Array.isArray(product.tags) ? product.tags : []);

  // のし
  const [noshiEnabled, setNoshiEnabled] = useState(product.noshi_enabled);
  const [noshiIds, setNoshiIds] = useState<string[]>(product.noshi_ids);

  // EC商品情報
  const [shippingMethod, setShippingMethod] = useState(product.shipping_method ?? "");
  const [storageMethod, setStorageMethod] = useState(product.storage_method ?? "");
  const [ingredients, setIngredients] = useState(product.ingredients ?? "");
  const [bestBeforeDays, setBestBeforeDays] = useState(product.best_before_days != null ? String(product.best_before_days) : "");
  const [contentQuantity, setContentQuantity] = useState(product.content_quantity ?? "");

  const isHole = category === "ホール";

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCross, setUploadingCross] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const crossInputRef = useRef<HTMLInputElement>(null);

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
    setPrice(product.base_price > 0 ? `¥${product.base_price.toLocaleString()}` : "");
    setPrepDays(String(product.preparation_days ?? 0));
    setDailyMax(product.daily_max_quantity != null ? String(product.daily_max_quantity) : "");
    setIsActive(product.is_active);
    setIsTakeout(product.is_takeout);
    setIsEc(product.is_ec);
    setSameDayOrderAllowed(product.same_day_order_allowed);
    setCustomOptions(product.custom_options);
    setImage(product.image ?? "");
    setCrossImage(product.cross_section_image ?? "");
    setPrintDecorationEnabled(product.print_decoration_enabled);
    setIsLimited(!!(product.limited_from || product.limited_until));
    setLimitedFrom(product.limited_from ?? "");
    setLimitedUntil(product.limited_until ?? "");
    setSelectedTags(Array.isArray(product.tags) ? product.tags : []);
    setNoshiEnabled(product.noshi_enabled);
    setNoshiIds(product.noshi_ids);
    setShippingMethod(product.shipping_method ?? "");
    setStorageMethod(product.storage_method ?? "");
    setIngredients(product.ingredients ?? "");
    setBestBeforeDays(product.best_before_days != null ? String(product.best_before_days) : "");
    setContentQuantity(product.content_quantity ?? "");
    setError(null);
    setSaved(false);

    const typeMatch = productTypes.find((t) => t.productType === product.category_name);
    setCategory(typeMatch?.productType ?? categories[0] ?? "");

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
      const { error: err } = await onSave(product.id, {
        name: name.trim(),
        description: description.trim(),
        base_price: isHole ? 0 : parsePriceValue(price),
        category_name: category || null,
        image: image || null,
        cross_section_image: crossImage || null,
        preparation_days: Number(prepDays) || 0,
        daily_max_quantity: dailyMax.trim() ? Number(dailyMax) : null,
        is_active: isActive,
        is_takeout: isTakeout,
        is_ec: isEc,
        same_day_order_allowed: sameDayOrderAllowed,
        custom_options: customOptions as any,
        print_decoration_enabled: isHole ? printDecorationEnabled : false,
        limited_from: isLimited && limitedFrom ? limitedFrom : null,
        limited_until: isLimited && limitedUntil ? limitedUntil : null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        noshi_enabled: noshiEnabled,
        noshi_ids: noshiEnabled ? noshiIds : [],
        shipping_method: isEc ? shippingMethod.trim() || null : undefined,
        storage_method: isEc ? storageMethod.trim() || null : undefined,
        ingredients: isEc ? ingredients.trim() || null : undefined,
        best_before_days: isEc && bestBeforeDays.trim() ? parseInt(bestBeforeDays, 10) || null : (isEc ? null : undefined),
        content_quantity: isEc ? contentQuantity.trim() || null : undefined,
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
      if (crossImage) await deleteProductImage(crossImage);
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
    const { url, error: err } = await uploadProductImage(file, product.store_id, "product");
    setUploading(false);
    if (err) { setError(`画像アップロード失敗: ${err}`); return; }
    if (url) setImage(url);
  };

  const handleCrossImageUpload = async (file: File) => {
    setUploadingCross(true);
    const { url, error: err } = await uploadProductImage(file, product.store_id, "cross");
    setUploadingCross(false);
    if (err) { setError(`画像アップロード失敗: ${err}`); return; }
    if (url) setCrossImage(url);
  };

  const handleImageRemove = async () => {
    if (image) { await deleteProductImage(image); setImage(""); }
  };

  const handleCrossImageRemove = async () => {
    if (crossImage) { await deleteProductImage(crossImage); setCrossImage(""); }
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
      {/* リサイズハンドル */}
      <button
        type="button"
        aria-label="パネル幅を調整"
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
        {/* hidden inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
        <input ref={crossInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCrossImageUpload(f); e.target.value = ""; }} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">商品情報</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 公開/非公開 */}
          <div className="flex items-center justify-between py-1 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700">公開</span>
            <div
              onClick={() => setIsActive((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${isActive ? "bg-amber-400" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-4" : ""}`} />
            </div>
          </div>

          {/* 商品名 */}
          <div>
            <label className="text-sm font-bold block mb-1">商品名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
            />
          </div>

          {/* 画像（メイン + 断面） */}
          <div>
            <label className="text-sm font-bold block mb-1.5">画像</label>
            <div className="flex gap-3">
              {/* メイン画像 */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500">メイン</p>
                <div className="relative group w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {image ? (
                    <>
                      <img src={image} alt={name} className="w-full h-full object-cover" />
                      <button
                        onClick={handleImageRemove}
                        className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-full flex items-center justify-center text-gray-300 hover:text-amber-400 transition-colors"
                    >
                      {uploading ? <LineSpinner size={20} /> : <ImagePlus className="w-6 h-6" />}
                    </button>
                  )}
                </div>
                {image && (
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="text-xs text-gray-400 hover:text-amber-600">
                    {uploading ? "..." : "変更"}
                  </button>
                )}
              </div>

              {/* 断面画像 */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500">断面</p>
                <div className="relative group w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {crossImage ? (
                    <>
                      <img src={crossImage} alt="断面" className="w-full h-full object-cover" />
                      <button
                        onClick={handleCrossImageRemove}
                        className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => crossInputRef.current?.click()}
                      disabled={uploadingCross}
                      className="w-full h-full flex items-center justify-center text-gray-300 hover:text-amber-400 transition-colors"
                    >
                      {uploadingCross ? <LineSpinner size={20} /> : <ImagePlus className="w-6 h-6" />}
                    </button>
                  )}
                </div>
                {crossImage && (
                  <button onClick={() => crossInputRef.current?.click()} disabled={uploadingCross}
                    className="text-xs text-gray-400 hover:text-amber-600">
                    {uploadingCross ? "..." : "変更"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 商品説明 */}
          <div>
            <label className="text-sm font-bold block mb-1">商品の説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
            />
          </div>

          {/* 金額 / サイズ */}
          {isHole ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-bold">サイズごとの金額</label>
                <button type="button" onClick={() => setSizes((prev) => [...prev, { name: "", price: "" }])}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> サイズ追加
                </button>
              </div>
              <div className="space-y-2">
                {sizes.map((s, i) => (
                  <div key={s.id ?? i} className="flex gap-2">
                    <input type="text" value={s.name}
                      onChange={(e) => { const next = [...sizes]; next[i] = { ...next[i], name: e.target.value }; setSizes(next); }}
                      placeholder="サイズ名（例: 5号）"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
                    <input type="text" value={s.price}
                      onChange={(e) => { const next = [...sizes]; next[i] = { ...next[i], price: e.target.value }; setSizes(next); }}
                      placeholder="¥金額"
                      className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
                    <button type="button" onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {sizes.length === 0 && <p className="text-xs text-gray-400">サイズが登録されていません</p>}
              </div>
              <div className="pt-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={printDecorationEnabled} onChange={(e) => setPrintDecorationEnabled(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                  プリントデコレーション対応
                </label>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-bold block mb-1">商品の金額</label>
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all" />
            </div>
          )}

          {/* 最大個数 / 準備日数 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold block mb-1">最大個数（/日）</label>
              <input type="number" value={dailyMax} onChange={(e) => setDailyMax(e.target.value)} min={1}
                placeholder="無制限"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">準備日数</label>
              <div className="flex items-center gap-1">
                <input type="number" value={prepDays} onChange={(e) => setPrepDays(e.target.value)} min={0}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
                <span className="text-xs text-gray-500">日</span>
              </div>
            </div>
          </div>

          {/* 販売チャネル / 当日注文 */}
          <div>
            <label className="text-sm font-bold block mb-2">販売チャネル</label>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isTakeout} onChange={(e) => setIsTakeout(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                テイクアウト
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isEc} onChange={(e) => setIsEc(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                EC
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={sameDayOrderAllowed} onChange={(e) => setSameDayOrderAllowed(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                当日注文可
              </label>
            </div>
          </div>

          {/* 期間限定 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer mb-1">
              <input type="checkbox" checked={isLimited} onChange={(e) => { setIsLimited(e.target.checked); if (!e.target.checked) { setLimitedFrom(""); setLimitedUntil(""); } }} className="w-4 h-4 accent-amber-500" />
              期間限定
            </label>
            <AnimatePresence>
              {isLimited && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pl-6 space-y-2 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-[72px] shrink-0">受取開始日</label>
                    <input type="date" value={limitedFrom} onChange={(e) => setLimitedFrom(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-[72px] shrink-0">受取終了日</label>
                    <input type="date" value={limitedUntil} onChange={(e) => setLimitedUntil(e.target.value)}
                      min={limitedFrom || undefined}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-300" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* タグ */}
          <div>
            <label className="text-sm font-bold block mb-2">タグ（シーズン・用途）</label>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button key={tag} type="button"
                    onClick={() => setSelectedTags((prev) => active ? prev.filter((t) => t !== tag) : [...prev, tag])}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${active ? "bg-amber-400 text-white border-amber-400" : "bg-white text-gray-500 border-gray-300 hover:border-amber-300"}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ケーキタイプ */}
          <div>
            <label className="text-sm font-bold block mb-1">ケーキのタイプ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* EC商品情報 */}
          {isEc && (
            <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/30 space-y-3">
              <p className="text-sm font-bold text-amber-800">EC商品情報</p>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">内容量</label>
                <input type="text" value={contentQuantity} onChange={(e) => setContentQuantity(e.target.value)} placeholder="例：2個入り"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">発送方法</label>
                <div className="flex gap-2 flex-wrap">
                  {SHIPPING_OPTIONS.map((opt) => (
                    <button key={opt} type="button" onClick={() => setShippingMethod((prev) => prev === opt ? "" : opt)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${shippingMethod === opt ? "bg-amber-400 text-white border-amber-400" : "bg-white text-gray-600 border-gray-300 hover:border-amber-300"}`}>
                      {opt}
                    </button>
                  ))}
                  <input type="text" value={SHIPPING_OPTIONS.includes(shippingMethod) ? "" : shippingMethod}
                    onChange={(e) => setShippingMethod(e.target.value)} placeholder="その他"
                    className="flex-1 min-w-[70px] border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">保存方法</label>
                <select value={storageMethod} onChange={(e) => setStorageMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300">
                  <option value="">選択</option>
                  <option value="常温">常温</option>
                  <option value="冷蔵">冷蔵</option>
                  <option value="冷凍">冷凍</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">原材料</label>
                <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={2} placeholder="例：小麦粉、砂糖、バター"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">賞味期限（発送日からの日数）</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={bestBeforeDays} onChange={(e) => setBestBeforeDays(e.target.value)} placeholder="7" min={1}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300" />
                  <span className="text-sm text-gray-500">日</span>
                </div>
              </div>
            </div>
          )}

          {/* カスタムオプション */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-bold">カスタムオプション</label>
              <button type="button"
                onClick={() => setCustomOptions((prev) => [...prev, { name: "", type: "single", required: false, values: [] }])}
                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> 追加
              </button>
            </div>
            <ProductCustomOptionPresetChips compact className="mb-3 pb-3 border-b border-gray-100"
              customOptions={customOptions} onAdd={(opt) => setCustomOptions((prev) => [...prev, opt])} />
            <div className="space-y-3">
              {customOptions.map((opt, oi) => (
                <div key={oi} className="border border-gray-200 rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={opt.name}
                      onChange={(e) => { const next = [...customOptions]; next[oi] = { ...next[oi], name: e.target.value }; setCustomOptions(next); }}
                      placeholder="オプション名" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" />
                    <select value={opt.type}
                      onChange={(e) => { const next = [...customOptions]; next[oi] = { ...next[oi], type: e.target.value as any }; setCustomOptions(next); }}
                      className="border border-gray-300 rounded px-1 py-1 text-xs">
                      <option value="single">単一</option>
                      <option value="multiple">複数</option>
                      <option value="text">記入</option>
                    </select>
                    <button type="button" onClick={() => setCustomOptions(customOptions.filter((_, i) => i !== oi))} className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {opt.type === "text" && (
                    <textarea disabled rows={2} placeholder="（お客様が入力するフォームのプレビュー）"
                      className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs resize-none text-gray-400" />
                  )}
                  {opt.type !== "text" && (
                    <div className="space-y-1">
                      {opt.values.map((v, vi) => (
                        <div key={vi} className="flex gap-1">
                          <input type="text" value={v.label}
                            onChange={(e) => { const next = [...customOptions]; const values = [...next[oi].values]; values[vi] = { ...values[vi], label: e.target.value }; next[oi] = { ...next[oi], values }; setCustomOptions(next); }}
                            placeholder="選択肢" className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs" />
                          <input type="number" value={v.additional_price}
                            onChange={(e) => { const next = [...customOptions]; const values = [...next[oi].values]; values[vi] = { ...values[vi], additional_price: Number(e.target.value) || 0 }; next[oi] = { ...next[oi], values }; setCustomOptions(next); }}
                            placeholder="+¥" className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs" />
                          <button type="button"
                            onClick={() => { const next = [...customOptions]; next[oi] = { ...next[oi], values: next[oi].values.filter((_, i) => i !== vi) }; setCustomOptions(next); }}
                            className="text-gray-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => { const next = [...customOptions]; next[oi] = { ...next[oi], values: [...next[oi].values, { label: "", additional_price: 0 }] }; setCustomOptions(next); }}
                        className="text-xs text-gray-500 hover:text-gray-700">+ 選択肢追加</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* のし設定 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer mb-1">
              <input type="checkbox" checked={noshiEnabled}
                onChange={(e) => { setNoshiEnabled(e.target.checked); if (!e.target.checked) setNoshiIds([]); }}
                className="w-4 h-4 accent-amber-500" />
              のしを使用する
            </label>
            {noshiEnabled && (
              <div className="pl-6 space-y-1.5">
                {noshiList.length === 0 ? (
                  <p className="text-xs text-gray-400">のしが未登録です。のし管理タブから登録してください。</p>
                ) : (
                  noshiList.map((n) => (
                    <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={noshiIds.includes(n.id)}
                        onChange={(e) => setNoshiIds((prev) => e.target.checked ? [...prev, n.id] : prev.filter((id) => id !== n.id))}
                        className="w-4 h-4 accent-amber-500" />
                      <img src={n.imageUrl || "/noshi-default.jpg"} alt="" className="w-6 h-6 rounded object-cover" />
                      <span>{n.name}</span>
                      {n.price > 0 && <span className="text-xs text-gray-400">+¥{n.price.toLocaleString()}</span>}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-red-500">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
            {saving ? <LineSpinner size={20} /> : saved ? <><Check className="w-4 h-4" />変更しました</> : "変更"}
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowDeleteConfirm(true)}
            className="w-full border border-red-300 text-red-500 hover:bg-red-50 font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />商品を削除
          </motion.button>
        </div>
      </div>

      {/* 削除確認モーダル */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8">
              <p className="text-lg font-bold text-center mb-2">この商品を削除しますか？</p>
              <p className="text-sm text-gray-500 text-center mb-2">{product.name || "選択中の商品"}</p>
              {error && (
                <p className="text-sm text-red-500 text-center mb-4">
                  {error.includes("foreign key") || error.includes("violates")
                    ? "この商品は注文履歴があるため削除できません。販売を停止する場合は「公開」をオフにしてください。"
                    : error}
                </p>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleDelete} disabled={deleting}
                  className="px-8 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {deleting && <LineSpinner size={20} />}削除する
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowDeleteConfirm(false)}
                  className="px-8 py-2 rounded-lg border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors">
                  キャンセル
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
