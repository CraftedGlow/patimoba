"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, User, X, Loader2 } from "lucide-react";
import { useCustomers } from "@/hooks/use-customers";
import { useStoreContext } from "@/lib/store-context";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/types";

interface CustomerDetail {
  id: string;
  name: string;
  lineName: string;
  phone: string;
  email: string;
  points: number;
  anniversaries: { type: string; date: string }[];
  orders: { id: string; createdAt: string; totalAmount: number; items: string[] }[];
  lastVisitAt: string | null;
  lastPurchaseAt: string | null;
}

function AnniversaryLabel(type: string): string {
  const map: Record<string, string> = {
    birthday: "誕生日",
    wedding: "結婚記念日",
    other: "その他",
  };
  return map[type] ?? type;
}

export default function StoreCustomersPage() {
  const { storeId } = useStoreContext();
  const { customers, loading } = useCustomers({ storeId });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleRowClick = async (customer: Customer) => {
    setDetailLoading(true);
    try {
      // ユーザー詳細（ポイント・記念日）
      const { data: user } = await supabase
        .from("users")
        .select("points, anniversaries, email, phone, name, line_name")
        .eq("id", customer.id)
        .maybeSingle();

      // 購入履歴
      const { data: orders } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, order_items(product_name_snapshot, quantity)")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const orderList = (orders || []).map((o: any) => ({
        id: o.id,
        createdAt: o.created_at,
        totalAmount: Number(o.total_amount) || 0,
        items: (o.order_items || []).map(
          (i: any) => `${i.product_name_snapshot} ×${i.quantity}`
        ),
      }));

      const lastPurchaseAt = orderList.length > 0 ? orderList[0].createdAt : null;

      // 最終来店日（テイクアウトのpickup_date最新）
      const { data: lastVisit } = await supabase
        .from("orders")
        .select("pickup_date")
        .eq("customer_id", customer.id)
        .in("order_type", ["takeout", "pickup", "delivery"])
        .not("pickup_date", "is", null)
        .order("pickup_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const anniversaries = Array.isArray(user?.anniversaries)
        ? (user!.anniversaries as any[])
        : [];

      setSelectedCustomer({
        id: customer.id,
        name: user?.name || customer.name,
        lineName: user?.line_name || customer.lineName,
        phone: user?.phone || customer.phone,
        email: user?.email || customer.email,
        points: Number(user?.points) || 0,
        anniversaries,
        orders: orderList,
        lastVisitAt: lastVisit?.pickup_date ?? null,
        lastPurchaseAt,
      });
    } finally {
      setDetailLoading(false);
    }
  };

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

      <div className="overflow-x-auto">
      <div className="min-w-[560px] border border-gray-200 rounded-lg overflow-hidden">
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
            onClick={() => handleRowClick(customer)}
            className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1.2fr] px-4 py-3 items-center border-t border-gray-100 hover:bg-amber-50 transition-colors cursor-pointer"
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

        {customers.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            顧客がいません
          </div>
        )}
      </div>
      </div>

      {/* 顧客詳細スライドパネル */}
      <AnimatePresence>
        {(selectedCustomer || detailLoading) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => !detailLoading && setSelectedCustomer(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {detailLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
              ) : selectedCustomer ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold">顧客詳細</h2>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  {/* 基本情報 */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-500">{selectedCustomer.lineName}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <DetailRow label="電話番号" value={selectedCustomer.phone || "未登録"} />
                    <DetailRow label="メール" value={selectedCustomer.email || "未登録"} />
                    <DetailRow
                      label="保有ポイント"
                      value={
                        <span className="text-red-500 font-bold text-lg">
                          {selectedCustomer.points.toLocaleString()}
                          <span className="text-sm font-normal text-gray-500 ml-1">pt</span>
                        </span>
                      }
                    />
                    <DetailRow
                      label="最終来店日"
                      value={
                        selectedCustomer.lastVisitAt
                          ? new Date(selectedCustomer.lastVisitAt).toLocaleDateString("ja-JP")
                          : "来店記録なし"
                      }
                    />
                    <DetailRow
                      label="最終購入日"
                      value={
                        selectedCustomer.lastPurchaseAt
                          ? new Date(selectedCustomer.lastPurchaseAt).toLocaleDateString("ja-JP", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "購入記録なし"
                      }
                    />
                  </div>

                  {/* 記念日 */}
                  {selectedCustomer.anniversaries.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-bold text-gray-700 mb-2">登録済み記念日</p>
                      <div className="space-y-2">
                        {selectedCustomer.anniversaries.map((a, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2"
                          >
                            <span className="text-sm text-amber-700 font-medium">
                              {AnniversaryLabel(a.type)}
                            </span>
                            <span className="text-sm text-gray-600">{a.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 購入履歴 */}
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-2">購入履歴（直近10件）</p>
                    {selectedCustomer.orders.length === 0 ? (
                      <p className="text-sm text-gray-400">購入履歴なし</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCustomer.orders.map((order) => (
                          <div
                            key={order.id}
                            className="border border-gray-100 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">
                                {new Date(order.createdAt).toLocaleDateString("ja-JP")}
                              </span>
                              <span className="text-sm font-bold">
                                ¥{order.totalAmount.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-0.5">
                              {order.items.map((item, i) => (
                                <div key={i}>{item}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-gray-500 shrink-0 w-28">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
