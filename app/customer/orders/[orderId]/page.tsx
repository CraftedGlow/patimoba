"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { Calendar, ShoppingBag, CreditCard, Package, Download } from "lucide-react";

type OrderItemOption = {
  option_group_name_snapshot: string | null;
  option_item_name_snapshot: string | null;
  price_delta: number | null;
  quantity: number | null;
};

type OrderItem = {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  order_item_options: OrderItemOption[];
};

type OrderDetail = {
  id: string;
  order_no: string | null;
  order_type: string;
  pickup_date: string | null;
  pickup_time: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  customer_name_snapshot: string | null;
  order_status: string;
  payment_status: string;
  cancel_deadline_at: string | null;
  payjp_charge_id: string | null;
  customer_id: string | null;
  stores: { name: string; address: string; phone: string | null; invoice_num: string | null } | null;
  order_items: OrderItem[];
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  takeout: "店頭受け取り",
  ec: "配送",
};

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function formatPickupDateTime(date: string | null, time: string | null): string {
  if (!date) return "未定";
  const d = new Date(date);
  const wday = WEEKDAY[d.getDay()];
  const base = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wday}）`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
}

function getOptionPrice(opt: OrderItemOption): number {
  const price = opt.price_delta ?? 0;
  const qty = opt.quantity ?? 1;
  return opt.option_group_name_snapshot === "ろうそく" ? price * qty : price;
}

function getOptionLabel(opt: OrderItemOption): string {
  const group = opt.option_group_name_snapshot ?? "";
  const name = opt.option_item_name_snapshot ?? "";
  const qty = opt.quantity ?? 1;
  if (group === "サイズ") return `サイズ：${name}`;
  if (group === "ろうそく") return qty > 1 ? `ろうそく：${name} ×${qty}` : `ろうそく：${name}`;
  return name;
}

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [description, setDescription] = useState("お品代として");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.status === 404) {
          setError("注文が見つかりませんでした");
        } else if (!res.ok) {
          setError("注文情報の取得に失敗しました");
        } else {
          setOrder(await res.json());
        }
      } catch {
        setError("注文情報の取得に失敗しました");
      }
      setLoading(false);
    })();
  }, [orderId]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      // 「この注文はキャンセルできません」は既にキャンセル済みの可能性があるので最新データを取得
      if (data.error === "この注文はキャンセルできません") {
        const freshRes = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (freshRes.ok) {
          const freshOrder = await freshRes.json();
          setOrder(freshOrder);
          if (freshOrder.order_status === "cancelled") {
            setShowCancelConfirm(false);
            setCancelling(false);
            return;
          }
        }
      }
      setCancelError(data.error ?? "キャンセルに失敗しました");
      setCancelling(false);
      return;
    }
    setShowCancelConfirm(false);
    // キャンセル成功が確定しているので即座に状態を更新（read-after-write の遅延を回避）
    setOrder((prev) => prev ? { ...prev, order_status: "cancelled" } : prev);
    setCancelling(false);
    // バックグラウンドで最新データを取得（他フィールドの更新を反映）
    fetch(`/api/orders/${orderId}`, { cache: "no-store" }).then(async (freshRes) => {
      if (freshRes.ok) {
        const freshOrder = await freshRes.json();
        setOrder(freshOrder.order_status === "cancelled" ? freshOrder : { ...freshOrder, order_status: "cancelled" });
      }
    }).catch(() => {});
  };

  const handleOpenReceipt = async () => {
    const path = `/api/receipt/${orderId}?recipient=${encodeURIComponent(recipientName)}&description=${encodeURIComponent(description)}`;
    const absoluteUrl = `${window.location.origin}${path}`;
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) {
        // LINEミニアプリ内では外部ブラウザで開く（保存ボタンが使える）
        liff.openWindow({ url: absoluteUrl, external: true });
        return;
      }
    } catch {
      // LIFF未初期化やLIFF外の場合はフォールバック
    }
    window.location.href = absoluteUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LineSpinner />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <p className="text-gray-500 text-sm text-center">{error ?? "注文が見つかりませんでした"}</p>
      </div>
    );
  }

  const pickupLabel = ORDER_TYPE_LABELS[order.order_type] ?? order.order_type;
  const datetimeStr = formatPickupDateTime(order.pickup_date, order.pickup_time);
  const hasDiscount = order.discount_amount != null && Number(order.discount_amount) > 0;

  const isCancelled = order.order_status === "cancelled";
  const isCompleted = order.order_status === "completed";
  const deadlinePassed = order.cancel_deadline_at
    ? new Date(order.cancel_deadline_at) < new Date()
    : false;
  const canCancel = !isCancelled && !isCompleted && !deadlinePassed;
  const deadlineLabel = order.cancel_deadline_at
    ? new Date(order.cancel_deadline_at).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 text-center">注文詳細</h1>
        {order.order_no && (
          <p className="text-xs text-gray-600 text-center mt-0.5">
            注文番号：{order.order_no}
          </p>
        )}
      </div>

      {/* キャンセル済みバナー */}
      {isCancelled && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-center gap-2">
          <span className="text-sm font-bold text-red-500">この注文はキャンセル済みです</span>
        </div>
      )}

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* 来店日時 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#FEBC2F] flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">来店日時</span>
          </div>
          <p className="text-base font-bold text-gray-900 pl-6">{datetimeStr}</p>
        </div>

        {/* 注文内容 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-[#FEBC2F] flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">注文内容</span>
          </div>
          <div className="pl-6 space-y-3">
            {order.order_items.map((item, i) => {
              const opts = (item.order_item_options ?? []).filter(
                (o) => o.option_group_name_snapshot !== "アレルギー"
              );
              const hasOptions = opts.length > 0;

              if (!hasOptions) {
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 leading-snug">
                      {item.product_name_snapshot}
                    </span>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      ×{item.quantity}　¥{Number(item.subtotal).toLocaleString()}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className="space-y-1 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {item.product_name_snapshot}
                    </span>
                    <span className="text-sm text-gray-500 whitespace-nowrap">×{item.quantity}</span>
                  </div>
                  <div className="pl-2 space-y-0.5">
                    {(() => {
                      const plateOpt = opts.find(o => o.option_group_name_snapshot === "メッセージプレート");
                      const messageOpt = opts.find(o => o.option_group_name_snapshot === "メッセージ");
                      const noshiOpt = opts.find(o => o.option_group_name_snapshot === "のし");
                      const noshiPurposeOpt = opts.find(o => o.option_group_name_snapshot === "のし用途");
                      const noshiNameOpt = opts.find(o => o.option_group_name_snapshot === "のし名前");
                      const filteredOpts = opts.filter(o =>
                        !["メッセージプレート", "メッセージ", "のし", "のし用途", "のし名前"].includes(o.option_group_name_snapshot ?? "")
                      );
                      const combinedMessageLabel = (() => {
                        if (!plateOpt && !messageOpt) return null;
                        const plate = plateOpt?.option_item_name_snapshot ?? "";
                        const msg = messageOpt?.option_item_name_snapshot ?? "";
                        return `メッセージ：${plate}${msg ? `「${msg}」` : ""}`;
                      })();
                      const combinedNoshiLabel = (() => {
                        if (!noshiOpt) return null;
                        const purpose = noshiPurposeOpt?.option_item_name_snapshot ?? "";
                        const name = noshiNameOpt?.option_item_name_snapshot ?? "";
                        return `のし：${noshiOpt.option_item_name_snapshot ?? ""}${purpose ? `（${purpose}）` : ""}${name ? `「${name}」` : ""}`;
                      })();
                      return (
                        <>
                          {filteredOpts.map((opt, j) => {
                            const label = getOptionLabel(opt);
                            const price = getOptionPrice(opt);
                            return (
                              <div key={j} className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-500">{label}</span>
                                {price > 0 && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    ¥{price.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {combinedMessageLabel && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-500">{combinedMessageLabel}</span>
                              {(plateOpt?.price_delta ?? 0) > 0 && (
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  ¥{Number(plateOpt?.price_delta).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                          {combinedNoshiLabel && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-500">{combinedNoshiLabel}</span>
                              {(noshiOpt?.price_delta ?? 0) > 0 && (
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  ¥{Number(noshiOpt?.price_delta).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
                    <span className="text-xs text-gray-600">小計</span>
                    <span className="text-sm font-medium text-gray-700">
                      ¥{Number(item.subtotal).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 合計金額 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-[#FEBC2F] flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">合計金額</span>
          </div>
          <div className="pl-6 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>小計</span>
              <span>¥{Number(order.subtotal).toLocaleString()}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-sm text-green-600">
                <span>ポイント割引</span>
                <span>−¥{Number(order.discount_amount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-100 mt-0.5">
              <span>合計</span>
              <span>¥{Number(order.total_amount).toLocaleString()}<span className="text-sm font-normal text-gray-500">（税込）</span></span>
            </div>
          </div>
        </div>

        {/* 受け取り方法 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[#FEBC2F] flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">受け取り方法</span>
          </div>
          <p className="text-sm text-gray-800 pl-6">{pickupLabel}</p>
          {order.stores?.name && (
            <p className="text-xs text-gray-500 pl-6 mt-0.5">{order.stores.name}</p>
          )}
          <p className="text-xs text-gray-500 pl-6 mt-2 leading-relaxed">
            {order.order_type === "takeout"
              ? "受け取り日時に、こちらの画面を店頭スタッフへご提示ください。"
              : "発送完了後、改めてご案内いたします。商品到着まで今しばらくお待ちください。"}
          </p>
        </div>

        {/* 宛名入力モーダル */}
        {showReceiptForm && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setShowReceiptForm(false)}
          >
            <div
              style={{ width: "100%", maxWidth: "480px", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ width: "40px", height: "4px", backgroundColor: "#e0e0e0", borderRadius: "2px", margin: "0 auto 20px" }} />
              <h2 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px", textAlign: "center" }}>領収書の発行</h2>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "6px" }}>
                  宛名
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="例：山田太郎　/ 株式会社〇〇"
                  style={{ width: "100%", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "6px" }}>
                  但し書き
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="お品代として"
                  style={{ width: "100%", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
                />
              </div>

              <button
                onClick={() => { setShowReceiptForm(false); handleOpenReceipt(); }}
                style={{ width: "100%", padding: "14px", backgroundColor: "#FEBC2F", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}
              >
                領収書を出力
              </button>
            </div>
          </div>
        )}

        {/* 領収書ボタン */}
        <button
          onClick={() => setShowReceiptForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-[#FEBC2F] hover:bg-[#f0b020] active:bg-[#e0a010] rounded-xl px-4 py-4 shadow-sm text-sm font-bold text-white transition-colors"
        >
          <Download className="w-4 h-4 text-white" />
          <span>領収書を発行</span>
        </button>

        {/* キャンセルボタン（キャンセル済みの場合は非表示） */}
        {!isCancelled && canCancel ? (
          <div>
            {deadlineLabel && (
              <p className="text-xs text-gray-400 text-center mb-2">
                キャンセル期限：{deadlineLabel}まで
              </p>
            )}
            <button
              onClick={() => { setCancelError(null); setShowCancelConfirm(true); }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 rounded-xl px-4 py-4 shadow-sm text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              注文をキャンセルする
            </button>
          </div>
        ) : null}

        {/* キャンセル確認モーダル */}
        {showCancelConfirm && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => !cancelling && setShowCancelConfirm(false)}
          >
            <div
              style={{ width: "100%", maxWidth: "480px", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ width: "40px", height: "4px", backgroundColor: "#e0e0e0", borderRadius: "2px", margin: "0 auto 20px" }} />
              <h2 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", textAlign: "center" }}>注文をキャンセルしますか？</h2>
              <p style={{ fontSize: "13px", color: "#666", textAlign: "center", marginBottom: "8px", lineHeight: "1.6" }}>
                この操作は取り消せません。
                {order.payment_status === "paid" && (
                  <> クレジットカードへの返金は数営業日以内に行われます。</>
                )}
              </p>
              {cancelError && (
                <p style={{ fontSize: "12px", color: "#dc2626", textAlign: "center", marginBottom: "8px" }}>{cancelError}</p>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelling}
                  style={{ flex: 1, padding: "13px", backgroundColor: "#f3f4f6", color: "#374151", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
                >
                  戻る
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{ flex: 1, padding: "13px", backgroundColor: cancelling ? "#fca5a5" : "#ef4444", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", cursor: cancelling ? "not-allowed" : "pointer" }}
                >
                  {cancelling ? "処理中..." : "キャンセルする"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
