"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Send, Ticket, X, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStoreContext } from "@/lib/store-context";
import { useCustomers } from "@/hooks/use-customers";
import { LineSpinner } from "@/components/ui/line-spinner";

interface Coupon {
  id: string;
  title: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  delivery_count?: number;
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg()}-${seg()}`;
}

function formatDiscount(c: Coupon) {
  return c.discount_type === "percentage"
    ? `${c.discount_value}% OFF`
    : `${c.discount_value.toLocaleString()}円引き`;
}

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "期限なし";
  return new Date(expiresAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function StoreCouponsPage() {
  const { storeId } = useStoreContext();
  const { customers } = useCustomers({ storeId });

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [code, setCode] = useState(generateCode());

  const [sendTarget, setSendTarget] = useState<Coupon | null>(null);
  const [sendMode, setSendMode] = useState<"all" | "select">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const fetchCoupons = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("coupons")
      .select("*, coupon_deliveries(count)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    setCoupons(
      (data ?? []).map((row: any) => ({
        ...row,
        delivery_count: row.coupon_deliveries?.[0]?.count ?? 0,
      }))
    );
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleCreate = async () => {
    if (!title.trim() || !discountValue || !code.trim()) return;
    setCreating(true);
    await supabase.from("coupons").insert({
      store_id: storeId,
      title: title.trim(),
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: parseInt(discountValue),
      expires_at: expiresAt || null,
    });
    setCreating(false);
    setShowCreate(false);
    setTitle("");
    setDiscountValue("");
    setExpiresAt("");
    setCode(generateCode());
    fetchCoupons();
  };

  const openSend = (coupon: Coupon) => {
    setSendTarget(coupon);
    setSendMode("all");
    setSelectedUserIds(new Set());
    setCustomerSearch("");
    setSendResult(null);
  };

  const handleSend = async () => {
    if (!sendTarget) return;
    setSending(true);
    const userIds =
      sendMode === "all"
        ? customers.map((c) => c.id)
        : Array.from(selectedUserIds);

    if (userIds.length === 0) {
      setSending(false);
      return;
    }

    const res = await fetch("/api/line/send-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponId: sendTarget.id, storeId, userIds }),
    });
    const data = await res.json();
    setSendResult(data);
    setSending(false);
    fetchCoupons();
  };

  const toggleUserId = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredCustomers = customers.filter((c) =>
    (c.name + c.lineName).includes(customerSearch)
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg font-bold text-gray-900">クーポン管理</h1>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowCreate(true); setCode(generateCode()); }}
          className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </motion.button>
      </div>

      {/* クーポン一覧 */}
      {loading ? (
        <div className="flex justify-center py-16"><LineSpinner size={28} /></div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">クーポンがまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{coupon.title}</p>
                <p className="text-xs text-amber-600 font-mono mt-0.5">{coupon.code}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                    {formatDiscount(coupon)}
                  </span>
                  <span className="text-xs text-gray-400">{formatExpiry(coupon.expires_at)}</span>
                  <span className="text-xs text-gray-400">送信済 {coupon.delivery_count ?? 0}件</span>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => openSend(coupon)}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                LINE送信
              </motion.button>
            </div>
          ))}
        </div>
      )}

      {/* 新規作成モーダル */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">クーポンを作成</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">タイトル</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="誕生日10%オフクーポン"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">割引タイプ</label>
                  <div className="flex gap-3">
                    {(["percentage", "fixed"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDiscountType(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                          discountType === t
                            ? "bg-amber-400 border-amber-400 text-white"
                            : "border-gray-300 text-gray-600"
                        }`}
                      >
                        {t === "percentage" ? "% OFF" : "円引き"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    割引値 {discountType === "percentage" ? "(%)" : "(円)"}
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percentage" ? "10" : "500"}
                    min={1}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">有効期限（任意）</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    クーポンコード
                    <button
                      type="button"
                      onClick={() => setCode(generateCode())}
                      className="ml-2 text-amber-500 hover:text-amber-600"
                    >
                      <RefreshCw className="w-3 h-3 inline" />
                    </button>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={creating || !title.trim() || !discountValue || !code.trim()}
                className="mt-6 w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                {creating ? "作成中..." : "作成する"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LINE送信モーダル */}
      <AnimatePresence>
        {sendTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => { if (!sending) setSendTarget(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">LINEで送信</h2>
                {!sending && (
                  <button onClick={() => setSendTarget(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {sendResult ? (
                <div className="text-center py-6">
                  <p className="text-2xl mb-3">✅</p>
                  <p className="font-bold text-gray-900 mb-1">送信完了</p>
                  <p className="text-sm text-gray-500">
                    送信: {sendResult.sent}件　失敗: {sendResult.failed}件
                    {sendResult.skipped > 0 && `　LINE未登録: ${sendResult.skipped}件`}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSendTarget(null)}
                    className="mt-5 px-6 py-2 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    閉じる
                  </motion.button>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 rounded-xl p-3 mb-4">
                    <p className="text-sm font-bold text-amber-800">{sendTarget.title}</p>
                    <p className="text-xs text-amber-600 font-mono">{sendTarget.code}　{formatDiscount(sendTarget)}</p>
                  </div>

                  <div className="flex gap-2 mb-4">
                    {(["all", "select"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSendMode(m)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                          sendMode === m
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 text-gray-600"
                        }`}
                      >
                        {m === "all" ? `全顧客 (${customers.length}人)` : "顧客を選択"}
                      </button>
                    ))}
                  </div>

                  {sendMode === "select" && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="名前で検索"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <div className="overflow-y-auto border border-gray-200 rounded-lg">
                        {filteredCustomers.length === 0 ? (
                          <p className="text-center text-xs text-gray-400 py-6">顧客が見つかりません</p>
                        ) : (
                          filteredCustomers.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(c.id)}
                                onChange={() => toggleUserId(c.id)}
                                className="accent-amber-500"
                              />
                              <span className="text-sm text-gray-800">{c.name || c.lineName || "名前なし"}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 text-right">
                        {selectedUserIds.size}人を選択中
                      </p>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSend}
                    disabled={
                      sending ||
                      (sendMode === "select" && selectedUserIds.size === 0) ||
                      (sendMode === "all" && customers.length === 0)
                    }
                    className="mt-4 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <><LineSpinner size={16} /> 送信中...</>
                    ) : (
                      <><Send className="w-4 h-4" /> LINEで送信する</>
                    )}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
