"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Send, Ticket, X, Link as LinkIcon, Check, Cake } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStoreContext } from "@/lib/store-context";
import { useCouponAudience } from "@/hooks/use-coupon-audience";
import { LineSpinner } from "@/components/ui/line-spinner";
import { formatDiscount, type Coupon as CouponBase } from "@/lib/coupons";

interface Coupon extends CouponBase {
  created_at: string;
  delivery_count?: number;
}

function formatValidPeriod(c: Coupon) {
  const from = c.valid_from
    ? new Date(c.valid_from).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
    : null;
  const until = c.expires_at
    ? new Date(c.expires_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
    : null;
  if (!from && !until) return "無期限";
  return `${from ?? "今すぐ"}〜${until ?? "無期限"}`;
}

function formatConditions(c: Coupon) {
  const parts: string[] = [];
  if (c.min_order_amount) parts.push(`${c.min_order_amount.toLocaleString()}円以上`);
  if (c.whole_cake_only) parts.push("ホールケーキ限定");
  return parts;
}

export default function StoreCouponsPage() {
  const { storeId } = useStoreContext();
  const { audience: customers, orderedUserIds } = useCouponAudience(storeId);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [wholeCakeOnly, setWholeCakeOnly] = useState(false);

  const [sendTarget, setSendTarget] = useState<Coupon | null>(null);
  const [sendTiming, setSendTiming] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendMode, setSendMode] = useState<"all" | "select">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState("");
  const [limitRecipients, setLimitRecipients] = useState(false);
  const [recipientLimit, setRecipientLimit] = useState("");
  const [selectionMode, setSelectionMode] = useState<"random" | "newest">("random");
  const [filterOrderedOnly, setFilterOrderedOnly] = useState(false);
  const [filterGender, setFilterGender] = useState<"all" | "男性" | "女性">("all");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [scheduledMessage, setScheduledMessage] = useState<string | null>(null);

  const [liffId, setLiffId] = useState<string | null>(null);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  const [anniversaryConfirmTarget, setAnniversaryConfirmTarget] = useState<Coupon | null>(null);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("stores")
      .select("liff_id")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => setLiffId(data?.liff_id ?? null));
  }, [storeId]);

  const copyLink = async (coupon: Coupon) => {
    if (!liffId) return;
    // miniapp.line.me のシンプルなクエリ形式で開く（追加パス付きliff.line.me形式は
    // liff.state経由の状態受け渡しが不安定なため使用しない）。storeはキャッシュが
    // 無い初回アクセスでもliffIdをDB解決できるようクエリとして残す。
    const url = `https://miniapp.line.me/${liffId}?coupon=${coupon.share_token}&store=${coupon.store_id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCouponId(coupon.id);
      setTimeout(() => setCopiedCouponId((cur) => (cur === coupon.id ? null : cur)), 2000);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  };

  const applyAnniversaryCoupon = async (coupon: Coupon) => {
    if (!storeId) return;
    if (!coupon.is_anniversary_coupon) {
      // 記念日リマインダー用クーポンは店舗ごとに常に1件になるよう、既存の他クーポンのフラグを下ろす
      await supabase.from("coupons").update({ is_anniversary_coupon: false }).eq("store_id", storeId).eq("is_anniversary_coupon", true);
    }
    await supabase.from("coupons").update({ is_anniversary_coupon: !coupon.is_anniversary_coupon }).eq("id", coupon.id);
    fetchCoupons();
  };

  const handleAnniversaryButtonClick = (coupon: Coupon) => {
    if (coupon.is_anniversary_coupon) {
      // 自分自身の解除は確認なしでそのまま反映する
      applyAnniversaryCoupon(coupon);
      return;
    }
    const current = coupons.find((c) => c.is_anniversary_coupon && c.id !== coupon.id);
    if (current) {
      setAnniversaryConfirmTarget(coupon);
    } else {
      applyAnniversaryCoupon(coupon);
    }
  };

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
    if (!title.trim() || !discountValue) return;
    setCreating(true);
    await supabase.from("coupons").insert({
      store_id: storeId,
      title: title.trim(),
      discount_type: discountType,
      discount_value: parseInt(discountValue),
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      expires_at: expiresAt || null,
      min_order_amount: minOrderAmount ? parseInt(minOrderAmount) : null,
      whole_cake_only: wholeCakeOnly,
    });
    setCreating(false);
    setShowCreate(false);
    setTitle("");
    setDiscountValue("");
    setValidFrom("");
    setExpiresAt("");
    setMinOrderAmount("");
    setWholeCakeOnly(false);
    fetchCoupons();
  };

  const openSend = (coupon: Coupon) => {
    setSendTarget(coupon);
    setSendTiming("now");
    setScheduledAt("");
    setSendMode("all");
    setSelectedUserIds(new Set());
    setCustomerSearch("");
    setLimitRecipients(false);
    setRecipientLimit("");
    setSelectionMode("random");
    setFilterOrderedOnly(false);
    setFilterGender("all");
    setSendResult(null);
    setScheduledMessage(null);
  };

  const pickRecipients = (pool: typeof customers, limit: number, mode: "random" | "newest") => {
    // customers は created_at 降順に取得済みのため、「登録が新しい順」はそのままスライスするだけでよい
    if (mode === "newest") return pool.slice(0, limit);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  };

  // 「全顧客」モードで実際に対象となる母集団（注文実績・性別の任意条件を適用したもの）
  const audienceForAll = customers.filter((c) => {
    if (filterOrderedOnly && !orderedUserIds.has(c.id)) return false;
    if (filterGender !== "all" && c.gender !== filterGender) return false;
    return true;
  });

  const handleSend = async () => {
    if (!sendTarget || !storeId) return;

    if (sendTiming === "scheduled") {
      if (!scheduledAt) return;
      setSending(true);
      const userIds = sendMode === "select" ? Array.from(selectedUserIds) : null;
      if (sendMode === "select" && (!userIds || userIds.length === 0)) {
        setSending(false);
        return;
      }
      const { error } = await supabase.from("coupon_sends").insert({
        coupon_id: sendTarget.id,
        store_id: storeId,
        target_type: sendMode === "all" ? "all" : "selected",
        target_user_ids: userIds,
        recipient_limit: sendMode === "all" && limitRecipients && recipientLimit ? parseInt(recipientLimit) : null,
        selection_mode: sendMode === "all" && limitRecipients ? selectionMode : null,
        filter_ordered_only: sendMode === "all" ? filterOrderedOnly : false,
        filter_gender: sendMode === "all" && filterGender !== "all" ? filterGender : null,
        scheduled_at: new Date(scheduledAt).toISOString(),
      });
      setSending(false);
      if (!error) {
        setScheduledMessage("配信を予約しました");
        fetchCoupons();
      }
      return;
    }

    setSending(true);
    const pool = sendMode === "all" ? audienceForAll : customers.filter((c) => selectedUserIds.has(c.id));
    const targetPool =
      sendMode === "all" && limitRecipients && recipientLimit
        ? pickRecipients(pool, parseInt(recipientLimit), selectionMode)
        : pool;
    const userIds = targetPool.map((c) => c.id);

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
          onClick={() => setShowCreate(true)}
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-gray-900 text-sm truncate">{coupon.title}</p>
                  {coupon.is_anniversary_coupon && (
                    <span className="text-[10px] bg-pink-50 text-pink-600 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      🎂 記念日リマインダー用
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                    {formatDiscount(coupon)}
                  </span>
                  <span className="text-xs text-gray-400">{formatValidPeriod(coupon)}</span>
                  <span className="text-xs text-gray-400">送信済 {coupon.delivery_count ?? 0}件</span>
                </div>
                {formatConditions(coupon).length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {formatConditions(coupon).map((cond) => (
                      <span key={cond} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {cond}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openSend(coupon)}
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  配信設定
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyLink(coupon)}
                  disabled={!liffId}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  {copiedCouponId === coupon.id ? (
                    <><Check className="w-3.5 h-3.5" /> コピー済</>
                  ) : (
                    <><LinkIcon className="w-3.5 h-3.5" /> リンク</>
                  )}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnniversaryButtonClick(coupon)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
                    coupon.is_anniversary_coupon
                      ? "bg-pink-100 hover:bg-pink-200 text-pink-700"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <Cake className="w-3.5 h-3.5" />
                  {coupon.is_anniversary_coupon ? "記念日用を解除" : "記念日用にする"}
                </motion.button>
              </div>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">開始日（任意・今すぐ）</label>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">終了日（任意・無期限）</label>
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-bold text-gray-600">利用条件（任意）</p>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">最低利用金額（円）</label>
                    <input
                      type="number"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                      placeholder="3000"
                      min={1}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wholeCakeOnly}
                      onChange={(e) => setWholeCakeOnly(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm text-gray-700">ホールケーキ限定</span>
                  </label>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={creating || !title.trim() || !discountValue}
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
                <h2 className="text-base font-bold text-gray-900">配信設定</h2>
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
                    {sendResult.skipped > 0 && `　スキップ: ${sendResult.skipped}件`}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSendTarget(null)}
                    className="mt-5 px-6 py-2 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    閉じる
                  </motion.button>
                </div>
              ) : scheduledMessage ? (
                <div className="text-center py-6">
                  <p className="text-2xl mb-3">🗓️</p>
                  <p className="font-bold text-gray-900 mb-1">{scheduledMessage}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(scheduledAt).toLocaleString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} に配信されます
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
                    <p className="text-xs text-amber-600">{formatDiscount(sendTarget)}</p>
                  </div>

                  <div className="flex gap-2 mb-4">
                    {(["now", "scheduled"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSendTiming(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                          sendTiming === t
                            ? "bg-amber-400 border-amber-400 text-white"
                            : "border-gray-300 text-gray-600"
                        }`}
                      >
                        {t === "now" ? "今すぐ配信" : "日時を指定"}
                      </button>
                    ))}
                  </div>

                  {sendTiming === "scheduled" && (
                    <div className="mb-4">
                      <label className="text-xs font-bold text-gray-600 block mb-1">配信日時</label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                  )}

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
                        {m === "all" ? `全顧客 (${audienceForAll.length}人)` : "顧客を選択"}
                      </button>
                    ))}
                  </div>

                  {sendMode === "all" && (
                    <div className="mb-4 border border-gray-200 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-bold text-gray-600">対象を絞り込む（任意）</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterOrderedOnly}
                          onChange={(e) => setFilterOrderedOnly(e.target.checked)}
                          className="accent-green-500"
                        />
                        <span className="text-sm text-gray-700">この店舗で注文実績がある人のみ</span>
                      </label>
                      <div className="flex gap-2">
                        {(["all", "男性", "女性"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setFilterGender(g)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              filterGender === g
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-gray-300 text-gray-600"
                            }`}
                          >
                            {g === "all" ? "性別問わず" : g}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={limitRecipients}
                            onChange={(e) => setLimitRecipients(e.target.checked)}
                            className="accent-green-500"
                          />
                          <span className="text-sm text-gray-700">人数を制限する</span>
                        </label>
                      </div>
                      {limitRecipients && (
                        <>
                          <input
                            type="number"
                            value={recipientLimit}
                            onChange={(e) => setRecipientLimit(e.target.value)}
                            placeholder="人数（例: 100）"
                            min={1}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                          />
                          <div className="flex gap-2">
                            {(["random", "newest"] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setSelectionMode(m)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                  selectionMode === m
                                    ? "bg-green-500 border-green-500 text-white"
                                    : "border-gray-300 text-gray-600"
                                }`}
                              >
                                {m === "random" ? "ランダム" : "登録が新しい順"}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

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
                      (sendMode === "all" && audienceForAll.length === 0) ||
                      (sendMode === "all" && limitRecipients && !recipientLimit) ||
                      (sendTiming === "scheduled" && !scheduledAt)
                    }
                    className="mt-4 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <><LineSpinner size={16} /> 処理中...</>
                    ) : sendTiming === "scheduled" ? (
                      <><Send className="w-4 h-4" /> 配信を予約する</>
                    ) : (
                      <><Send className="w-4 h-4" /> 今すぐ配信する</>
                    )}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 記念日リマインダー用クーポン変更確認モーダル */}
      <AnimatePresence>
        {anniversaryConfirmTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setAnniversaryConfirmTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <p className="text-sm text-gray-700 leading-relaxed mb-3">
                記念日リマインダー用のクーポンを変更しますか？
              </p>

              {(() => {
                const current = coupons.find((c) => c.is_anniversary_coupon);
                return (
                  <div className="space-y-2">
                    {current && (
                      <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 font-bold mb-1">現在の設定</p>
                        <p className="font-bold text-gray-900 text-sm truncate">{current.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                            {formatDiscount(current)}
                          </span>
                          <span className="text-xs text-gray-400">{formatValidPeriod(current)}</span>
                        </div>
                        {formatConditions(current).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {formatConditions(current).map((cond) => (
                              <span key={cond} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                                {cond}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="border border-pink-200 bg-pink-50/50 rounded-xl p-3">
                      <p className="text-[10px] text-pink-500 font-bold mb-1">変更後</p>
                      <p className="font-bold text-gray-900 text-sm truncate">{anniversaryConfirmTarget.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                          {formatDiscount(anniversaryConfirmTarget)}
                        </span>
                        <span className="text-xs text-gray-400">{formatValidPeriod(anniversaryConfirmTarget)}</span>
                      </div>
                      {formatConditions(anniversaryConfirmTarget).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {formatConditions(anniversaryConfirmTarget).map((cond) => (
                            <span key={cond} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                              {cond}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setAnniversaryConfirmTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  いいえ
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    applyAnniversaryCoupon(anniversaryConfirmTarget);
                    setAnniversaryConfirmTarget(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-pink-500 hover:bg-pink-600 text-white transition-colors"
                >
                  はい
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
