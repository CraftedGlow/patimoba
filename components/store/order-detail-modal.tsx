"use client";

import { motion } from "framer-motion";
import { X, Bluetooth, ClipboardList } from "lucide-react";
import type { Order } from "@/lib/types";

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
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
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
              <Bluetooth className="w-3.5 h-3.5" />
              接続
            </span>
          </div>

          <div className="bg-[#FFF9C4] rounded-lg py-2.5 px-4 text-center mb-5">
            <p className="font-bold text-sm">注文を受け付けました</p>
          </div>

          <div className="space-y-2 mb-5">
            <InfoRow label="名前" value={`${order.customerName}様`} />
            <InfoRow label="LINE" value={order.lineName} />
            <InfoRow label="電話番号" value={order.phone} />
            <InfoRow label="注文日時" value={order.orderDate} />
            <InfoRow
              label="受取日時"
              value={order.pickupDate || "-"}
            />
            <InfoRow label="お支払い" value={order.paymentStatus} />
          </div>

          <div className="border-t border-gray-300 pt-3 mb-4">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span>商品名</span>
              <span>個数</span>
            </div>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5">
                <span className="pl-2">{item.name}</span>
                <span>&times;{item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">小計</span>
              <span className="text-base font-bold">
                &yen;{order.totalAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">お支払金額</span>
              <span className="text-2xl font-bold">
                &yen;{order.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-5">
            <ClipboardList className="w-6 h-6 text-amber-500" />
            <span className="text-base font-bold text-gray-700">パティモバ</span>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-[#FFF176] hover:bg-[#FFEE58] text-gray-800 font-bold py-3 rounded-lg transition-colors text-sm"
          >
            閉じる
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="font-bold">{label}：</span>
      {value}
    </p>
  );
}
