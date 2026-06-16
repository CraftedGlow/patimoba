"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Printer, Check } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import type { Order } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface OrderItemWithOptions {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  options: {
    groupName: string;
    itemName: string;
    priceDelta: number;
    quantity: number | null;
  }[];
}

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onConfirmed?: () => void;
}

export function OrderDetailModal({ order, onClose, onConfirmed }: OrderDetailModalProps) {
  const [items, setItems] = useState<OrderItemWithOptions[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [printDone, setPrintDone] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItemsLoading(true);
    setItems([]);

    (async () => {
      const { data } = await supabase
        .from("order_items")
        .select(`
          id,
          product_name_snapshot,
          variant_name_snapshot,
          quantity,
          unit_price,
          order_item_options (
            option_group_name_snapshot,
            option_item_name_snapshot,
            price_delta,
            quantity
          )
        `)
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (data) {
        setItems(
          data.map((row: any) => ({
            id: row.id,
            productName: row.product_name_snapshot ?? "",
            variantName: row.variant_name_snapshot ?? null,
            quantity: row.quantity ?? 1,
            unitPrice: row.unit_price ?? 0,
            options: (row.order_item_options ?? []).map((opt: any) => ({
              groupName: opt.option_group_name_snapshot ?? "",
              itemName: opt.option_item_name_snapshot ?? "",
              priceDelta: opt.price_delta ?? 0,
              quantity: opt.quantity ?? null,
            })),
          }))
        );
      }
      setItemsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [order.id]);

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    setPrintError(null);
    setPrintDone(false);
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          lineName: order.lineName || null,
          phone: order.phone || null,
          orderDate: order.orderDate || null,
          paymentStatus: order.paymentStatus || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await supabase
        .from("orders")
        .update({ fulfillment_status: "fulfilled", fulfilled_at: new Date().toISOString() })
        .eq("id", order.id);
      setPrintDone(true);
      onConfirmed?.();
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : "印刷に失敗しました");
    } finally {
      setPrinting(false);
    }
  };

  const pickupDisplay =
    order.pickupDate
      ? `${order.pickupDate}${order.pickupTime ? " " + String(order.pickupTime).slice(0, 5) : ""}`
      : "-";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-xl w-full max-w-md relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>

        <div className="p-6 pt-8">
          {/* 印刷ボタン */}
          <div className="flex flex-col items-center gap-1.5 mb-4">
            <button
              onClick={handlePrint}
              disabled={printing || itemsLoading}
              className={`inline-flex items-center gap-1.5 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                printDone
                  ? "bg-green-600"
                  : "hover:opacity-90"
              }`}
              style={!printDone ? { backgroundColor: "#FEBC2F" } : undefined}
            >
              {printing ? (
                <LineSpinner size={20} />
              ) : printDone ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              {printing ? "送信中..." : printDone ? "印刷済み" : "印刷"}
            </button>
            {printError && (
              <p className="text-xs text-red-500">{printError}</p>
            )}
          </div>

          {/* 顧客情報 */}
          <div className="space-y-1.5 mb-5">
            <InfoRow label="名前" value={`${order.customerName || "-"}様`} />
            {order.lineName && <InfoRow label="LINE" value={order.lineName} />}
            {order.phone && <InfoRow label="電話番号" value={order.phone} />}
            <InfoRow label="注文日時" value={order.orderDate} />
            <InfoRow label="受取日時" value={pickupDisplay} bold />
            <InfoRow label="お支払い" value={order.paymentStatus} />
          </div>

          {/* 商品一覧 */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-3 pb-1.5 border-b border-gray-100">
              <span>商品名</span>
              <span>個数</span>
            </div>

            {itemsLoading ? (
              <div className="flex justify-center py-6">
                <LineSpinner size={20} />
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="pb-3 border-b border-dashed border-gray-100 last:border-0 last:pb-0"
                  >
                    {/* 商品名 + 個数 */}
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold leading-tight">{item.productName}</span>
                      <span className="text-sm font-bold ml-3 shrink-0">×{item.quantity}</span>
                    </div>

                    {/* サイズ（バリアント） */}
                    {item.variantName && (
                      <div className="text-xs text-gray-500 mt-0.5 ml-2">
                        サイズ：{item.variantName}
                      </div>
                    )}

                    {/* ろうそく */}
                    {item.options.filter(opt => opt.groupName === "ろうそく").map((opt, j) => (
                      <div key={`candle-${j}`} className="text-xs text-gray-500 mt-0.5 ml-2">
                        ろうそく：{opt.itemName}{opt.quantity != null && `×${opt.quantity}本`}
                        {opt.priceDelta > 0 && <span className="text-gray-400 ml-1">+¥{opt.priceDelta.toLocaleString()}</span>}
                      </div>
                    ))}

                    {/* メッセージプレート種類 + メッセージ（1行表示） */}
                    {(() => {
                      const plateOpt = item.options.find(opt => opt.groupName === "メッセージプレート");
                      const messageOpt = item.options.find(opt => opt.groupName === "メッセージ");
                      if (!plateOpt && !messageOpt) return null;
                      const plate = plateOpt?.itemName ?? "";
                      const msg = messageOpt?.itemName ?? "";
                      return (
                        <div className="text-xs text-gray-500 mt-0.5 ml-2">
                          メッセージ：{plate}{msg && `「${msg}」`}
                        </div>
                      );
                    })()}

                    {/* その他オプション（ろうそく・メッセージ・プレート・アレルギー・サイズ以外） */}
                    {item.options.filter(opt =>
                      !["ろうそく", "メッセージプレート", "メッセージ", "アレルギー", "サイズ"].includes(opt.groupName)
                    ).map((opt, j) => (
                      <div key={`other-${j}`} className="text-xs text-gray-500 mt-0.5 ml-2">
                        {opt.groupName}：{opt.itemName}
                        {opt.priceDelta > 0 && <span className="text-gray-400 ml-1">+¥{opt.priceDelta.toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 金額 */}
          <div className="space-y-1.5 mb-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">小計</span>
              <span className="font-bold">¥{order.subtotal.toLocaleString()}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">値引き</span>
                <span className="font-bold text-red-500">
                  -¥{order.discountAmount.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
              <span className="text-sm text-gray-600">お支払金額</span>
              <span className="text-2xl font-bold">¥{order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <p className="text-sm">
      <span className="font-bold">{label}：</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </p>
  );
}
