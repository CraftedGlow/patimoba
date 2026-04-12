"use client";

import { motion } from "framer-motion";
import { Heart, User } from "lucide-react";
import { useCustomers } from "@/hooks/use-customers";
import { useStoreContext } from "@/lib/store-context";
export default function StoreCustomersPage() {
  const { storeId } = useStoreContext();
  const { customers, loading } = useCustomers({ storeId });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6 bg-[#FFF9C4] rounded-xl p-4">
        <div className="w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">お気に入り合計数</p>
          <p className="text-2xl font-bold">{customers.length}人</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1.2fr] bg-[#FFF176] px-4 py-2.5 text-sm font-bold text-gray-700">
          <span>お名前</span>
          <span>LINEアカウント名</span>
          <span>電話番号</span>
          <span>メール</span>
        </div>

        {customers.map((customer, i) => (
          <motion.div
            key={customer.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1.2fr] px-4 py-3 items-center border-t border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-sm">{customer.name}</span>
            </div>

            <span className="text-sm">{customer.lineName}</span>
            <span className="text-sm text-gray-600">{customer.phone}</span>
            <span className="text-sm text-gray-600">{customer.email}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
