"use client";

import { useState, useEffect, useRef } from "react";
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
  stores: { name: string; address: string; phone: string | null; invoice_number: string | null } | null;
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

function formatDate(date: Date): string {
  const wday = WEEKDAY[date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${wday}）`;
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

function ReceiptView({ order, recipientName, description }: { order: OrderDetail; recipientName: string; description: string }) {
  const total = Number(order.total_amount);
  const tax = Math.floor(total * 10 / 110);
  const pretax = total - tax;
  const hasDiscount = order.discount_amount != null && Number(order.discount_amount) > 0;
  const store = order.stores;

  return (
    <div
      style={{
        width: "560px",
        backgroundColor: "#ffffff",
        fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        padding: "48px 56px",
        boxSizing: "border-box",
        color: "#1a1a1a",
      }}
    >
      {/* タイトル */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "0.12em", borderTop: "2px solid #1a1a1a", borderBottom: "2px solid #1a1a1a", padding: "8px 0" }}>
          領　収　書
        </div>
      </div>

      {/* 宛名 */}
      <div style={{ marginBottom: "24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "700", borderBottom: "1px solid #1a1a1a", paddingBottom: "4px" }}>
          {recipientName || "　"}
        </span>
        <span style={{ fontSize: "14px", marginLeft: "4px" }}>御中</span>
      </div>

      {/* 金額 */}
      <div style={{ marginBottom: "8px", display: "flex", alignItems: "baseline", gap: "4px" }}>
        <span style={{ fontSize: "14px" }}>金額</span>
        <span style={{ fontSize: "32px", fontWeight: "700", letterSpacing: "0.04em" }}>
          ¥{total.toLocaleString()}
        </span>
        <span style={{ fontSize: "13px", color: "#555" }}>（税込）</span>
      </div>

      {/* 但し書き */}
      <div style={{ fontSize: "13px", color: "#444", marginBottom: "24px" }}>
        但し、{description || "お品代として"}
      </div>

      <div style={{ borderTop: "1px solid #ccc", marginBottom: "20px" }} />

      {/* 内訳 */}
      <div style={{ marginBottom: "8px", fontSize: "13px", color: "#555" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>10% 対象</span>
          <span>¥{pretax.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>消費税（10%）</span>
          <span>¥{tax.toLocaleString()}</span>
        </div>
        {hasDiscount && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#2a7a2a" }}>
            <span>ポイント割引</span>
            <span>−¥{Number(order.discount_amount).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #ccc", marginBottom: "24px" }} />

      {/* 発行日 */}
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "13px", color: "#444", marginBottom: "28px" }}>
        発行日：{formatDate(new Date())}
      </div>

      {/* 発行者情報 */}
      <div style={{ borderTop: "1px dashed #ccc", paddingTop: "20px", fontSize: "13px", color: "#444", lineHeight: "2" }}>
        <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "4px" }}>{store?.name ?? ""}</div>
        {store?.address && <div>{store.address}</div>}
        {store?.phone && <div>TEL：{store.phone}</div>}
        {store?.invoice_number && (
          <div style={{ marginTop: "4px", fontSize: "12px", color: "#666" }}>
            登録番号：{store.invoice_number}
          </div>
        )}
      </div>
    </div>
  );
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
  const [downloading, setDownloading] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
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

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current || !order) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");

      const el = receiptRef.current;
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: el.offsetWidth,
        height: el.scrollHeight,
      });

      setReceiptImageUrl(dataUrl);
    } catch (e) {
      console.error("領収書生成エラー:", e);
      alert("領収書の生成に失敗しました。もう一度お試しください。");
    } finally {
      setDownloading(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 領収書生成用の非表示要素 */}
      <div style={{ position: "absolute", top: "-9999px", left: 0, pointerEvents: "none" }}>
        <div ref={receiptRef}>
          <ReceiptView order={order} recipientName={recipientName} description={description} />
        </div>
      </div>

      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 text-center">注文詳細</h1>
        {order.order_no && (
          <p className="text-xs text-gray-600 text-center mt-0.5">
            注文番号：{order.order_no}
          </p>
        )}
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* 来店日時 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-pink-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">来店日時</span>
          </div>
          <p className="text-base font-bold text-gray-900 pl-6">{datetimeStr}</p>
        </div>

        {/* 注文内容 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-pink-400 flex-shrink-0" />
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
            <CreditCard className="w-4 h-4 text-pink-400 flex-shrink-0" />
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
            <Package className="w-4 h-4 text-pink-400 flex-shrink-0" />
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
                onClick={() => { setShowReceiptForm(false); handleDownloadReceipt(); }}
                disabled={downloading}
                style={{ width: "100%", padding: "14px", backgroundColor: "#f472b6", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}
              >
                {downloading ? "生成中..." : "領収書を出力"}
              </button>
            </div>
          </div>
        )}

        {/* 領収書画像モーダル */}
        {receiptImageUrl && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", overflowY: "auto", padding: "16px" }}
            onClick={() => setReceiptImageUrl(null)}
          >
            <div style={{ width: "100%", maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
              <p style={{ color: "#fff", fontSize: "12px", textAlign: "center", marginBottom: "8px", opacity: 0.8 }}>
                画像を長押しして保存できます
              </p>
              <img src={receiptImageUrl} style={{ width: "100%", height: "auto", borderRadius: "8px", display: "block" }} />
              <button
                onClick={() => setReceiptImageUrl(null)}
                style={{ marginTop: "16px", width: "100%", padding: "12px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* 領収書ボタン */}
        <button
          onClick={() => setShowReceiptForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-4 shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <Download className="w-4 h-4 text-pink-400" />
          <span>領収書を発行</span>
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
