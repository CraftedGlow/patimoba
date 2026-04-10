"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Plus, Trash2, Check, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useProductTypes } from "@/hooks/use-product-types";

type OrderType = "always" | "sameDay" | "manual" | "reserveOnly" | "todayOnly";

interface ProductRow {
  id: number;
  name: string | null;
  descriprion: string | null;
  description: string | null;
  price: number | null;
  image: string | null;
  product_type_id: number | null;
  always_available: boolean | null;
  cur_same_day: boolean | null;
  preparation_days: number | null;
  order_start_date: string | null;
  order_end_date: string | null;
  is_ec: boolean | null;
  store_id: number | null;
  max_per_day: number | null;
  max_per_order: number | null;
}

function resolveOrderType(row: ProductRow): OrderType {
  if (row.cur_same_day) return "sameDay";
  if (row.preparation_days && row.preparation_days > 0) return "reserveOnly";
  if (row.always_available === false) return "manual";
  return "always";
}

export function CakeTab() {
  const { user } = useAuth();
  const { productTypes } = useProductTypes();

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

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const storeId = user?.storeId ?? null;

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("product_registrations")
      .select("*")
      .eq("store_id", storeId)
      .or("is_ec.is.null,is_ec.eq.false")
      .order("id", { ascending: true });
    const list = (data ?? []) as ProductRow[];
    setProducts(list);
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
    setError(null);
  }, []);

  const selectProduct = useCallback(
    (id: number) => {
      const p = products.find((r) => r.id === id);
      if (!p) return;
      setSelectedId(p.id);
      const typeMatch = productTypes.find((t) => t.id === p.product_type_id);
      setCategory(typeMatch?.productType ?? "");
      setProductName(p.name ?? "");
      setDescription(p.descriprion ?? p.description ?? "");
      setPrice(p.price != null ? `¥${p.price.toLocaleString()}` : "");
      setOrderType(resolveOrderType(p));
      setReserveDays(String(p.preparation_days ?? 10));
      setIsLimited(
        !!(p.order_start_date || p.order_end_date)
      );
      setError(null);
    },
    [products, productTypes]
  );

  const parsePriceValue = (v: string): number => {
    return parseInt(v.replace(/[¥,\s]/g, ""), 10) || 0;
  };

  const buildPayload = () => {
    const typeMatch = productTypes.find((t) => t.productType === category);
    return {
      store_id: storeId!,
      name: productName.trim(),
      descriprion: description.trim(),
      price: parsePriceValue(price),
      product_type_id: typeMatch?.id ?? null,
      always_available: orderType === "always",
      cur_same_day: orderType === "sameDay",
      preparation_days: orderType === "reserveOnly" ? parseInt(reserveDays, 10) || 0 : 0,
      is_ec: false,
      order_start_date: null as string | null,
      order_end_date: null as string | null,
    };
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
      const payload = buildPayload();
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

  const categories = productTypes.map((t) => t.productType);

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

      <div className="bg-[#FFF9C4] rounded-xl p-6 max-w-[640px] space-y-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-[340px] border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
        >
          <option value="">カテゴリを選択</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="商品名"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />

        <div className="flex gap-3">
          <div className="w-[160px] h-[160px] rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 text-center px-2 shrink-0">
            メイン画像をアップロード
          </div>
          <div className="w-[160px] h-[160px] rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 text-center px-2">
            断面の画像をアップロード
          </div>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="商品説明"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none"
        />

        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="¥700"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {([
            { value: "always" as const, label: "常に注文を受け付ける" },
            { value: "sameDay" as const, label: "当日注文を受け付ける" },
            { value: "manual" as const, label: "注文を手動で受け付ける" },
            { value: "reserveOnly" as const, label: "予約のみ受け付ける" },
            { value: "todayOnly" as const, label: "本日限定受付" },
          ]).map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={reserveDays}
              onChange={(e) => setReserveDays(e.target.value)}
              className="w-[100px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-sm">日前</span>
          </div>
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
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            {selectedId ? "商品を更新しました" : "商品を登録しました"}
          </motion.div>
        )}
      </AnimatePresence>

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
