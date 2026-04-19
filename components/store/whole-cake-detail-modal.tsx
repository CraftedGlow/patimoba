"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types";

interface WholeCakeOption {
  group: string;
  item: string;
  price: number;
  quantity: number | null;
}

interface Props {
  order: Order;
  onClose: () => void;
}

export function WholeCakeDetailModal({ order, onClose }: Props) {
  const [options, setOptions] = useState<WholeCakeOption[]>([]);
  const [loading, setLoading] = useState(true);

  const wholeCakeItem = order.items.find((it) => !!it.variantName);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data: itemRows } = await supabase
        .from("order_items")
        .select("id, variant_name_snapshot, order_item_options(option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity)")
        .eq("order_id", order.id);

      const opts: WholeCakeOption[] = [];
      for (const row of itemRows ?? []) {
        if (row.variant_name_snapshot) {
          opts.push({ group: "サイズ", item: row.variant_name_snapshot, price: 0, quantity: null });
        }
        for (const o of row.order_item_options ?? []) {
          if (o.option_group_name_snapshot === "サイズ") continue;
          opts.push({
            group: o.option_group_name_snapshot ?? "",
            item: o.option_item_name_snapshot ?? "",
            price: o.price_delta ?? 0,
            quantity: o.quantity ?? null,
          });
        }
      }
      setOptions(opts);
      setLoading(false);
    }
    fetch();
  }, [order.id]);

  const handlePrint = () => {
    const name = order.customerName || order.lineName || "-";
    const rows = options.map((o) => {
      const qtyStr = o.quantity != null ? `×${o.quantity}` : "";
      const priceStr = o.price > 0 ? `+¥${o.price.toLocaleString()}` : "";
      return `<tr><td>${o.group}</td><td>${o.item}${qtyStr ? " " + qtyStr : ""}${priceStr ? "　" + priceStr : ""}</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>ホールケーキ注文詳細</title>
<style>
body{font-family:"Hiragino Kaku Gothic Pro",sans-serif;font-size:12px;margin:15mm;color:#111}
h2{font-size:14px;margin:0 0 6px}p.sub{font-size:11px;color:#555;margin:0 0 12px}
table{width:100%;border-collapse:collapse}
th{background:#fffde7;text-align:left;padding:5px 8px;border:1px solid #ccc;font-size:11px}
td{padding:5px 8px;border:1px solid #ddd;font-size:12px}
@media print{@page{margin:10mm}}
</style></head><body>
<h2>ホールケーキ注文詳細</h2>
<p class="sub">顧客名: ${name}　受取日: ${order.pickupDate || "-"}　${order.pickupTime ? order.pickupTime.slice(0, 5) : ""}</p>
<table><thead><tr><th>項目</th><th>内容</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:12px;font-size:11px;color:#555">合計: ¥${order.totalAmount.toLocaleString()}　${order.paymentStatus}</p>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("ポップアップがブロックされています"); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[110]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{ x: "-50%", y: "-50%" }}
        className="fixed left-1/2 top-1/2 bg-white rounded-2xl shadow-2xl z-[120] w-[92%] max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">
              {wholeCakeItem?.name || "ホールケーキ"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.customerName || order.lineName || "-"}
              {order.pickupDate ? `受取: ${order.pickupDate}` : ""}
              {order.pickupTime ? ` ${order.pickupTime.slice(0, 5)}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">詳細情報がありません</p>
          ) : (
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded mr-2">
                      {o.group}
                    </span>
                    <span className="text-sm text-gray-900">
                      {o.item}
                      {o.quantity != null && ` ×${o.quantity}`}
                    </span>
                  </div>
                  {o.price > 0 && (
                    <span className="text-xs text-gray-500 shrink-0 ml-2">+¥{o.price.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">¥{order.totalAmount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{order.paymentStatus}</p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            印刷
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
