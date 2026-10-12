"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, User, X, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";

import { useCustomers } from "@/hooks/use-customers";
import { useStoreContext } from "@/lib/store-context";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/types";

interface CustomerDetail {
  id: string;
  name: string;
  lineName: string;
  avatarUrl: string | null;
  phone: string;
  email: string;
  points: number;
  anniversaries: { label: string; date: string }[];
  orders: { id: string; createdAt: string; totalAmount: number; items: string[] }[];
  lastVisitAt: string | null;
  lastPurchaseAt: string | null;
}

export default function StoreCustomersPage() {
  const { storeId, isMaster, childStores } = useStoreContext();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const activeStoreId = isMaster ? selectedChildId ?? undefined : storeId;
  const activeStoreIds = isMaster && selectedChildId === null
    ? childStores.map((s) => s.id)
    : undefined;
  const { customers, customerStoreMap, loading } = useCustomers({ storeId: activeStoreId, storeIds: activeStoreIds });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageTarget, setMessageTarget] = useState<Customer | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentCustomer, setSentCustomer] = useState<Customer | null>(null);

  const handleRowClick = async (customer: Customer) => {
    setDetailLoading(true);
    try {
      // ユーザー詳細（ポイント・記念日）
      const { data: user } = await supabase
        .from("users")
        .select("points, anniversaries, email, phone, name, line_name, avatar_url")
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
        avatarUrl: (user as any)?.avatar_url || customer.avatarUrl || null,
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

  const openMessageModal = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSendError(null);
    setMessageText("");
    setMessageTarget(customer);
  };

  const handleSendMessage = async () => {
    // 顧客が実際に注文した店舗のLINEチャネルから送信する(マスターの「全店舗」表示では店舗ごとに公式LINEが異なるため)
    const targetStoreId = (messageTarget && customerStoreMap[messageTarget.id]) || storeId;
    if (!messageTarget || !messageText.trim() || !targetStoreId) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/line/send-customer-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: targetStoreId,
          customerId: messageTarget.id,
          message: messageText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(
          data.error === "no_line_user_id"
            ? "この顧客はLINE連携されていないため送信できません"
            : data.error === "not_friend"
            ? "この顧客は公式LINEを友だち追加していない、またはブロックしているため送信できません"
            : "送信に失敗しました。時間をおいて再度お試しください"
        );
        return;
      }
      setSentCustomer(messageTarget);
      setMessageTarget(null);
      setMessageText("");
    } catch {
      setSendError("送信に失敗しました。時間をおいて再度お試しください");
    } finally {
      setSending(false);
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
    <div className="p-4 lg:p-6">
      {/* マスター店舗: 全店舗／子店舗ごとの切り替え */}
      {isMaster && childStores.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSelectedChildId(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedChildId === null
                ? "bg-amber-400 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            全店舗
          </button>
          {childStores.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedChildId(s.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedChildId === s.id
                  ? "bg-amber-400 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {isMaster && childStores.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-600">子店舗がありません</div>
      ) : (
      <>
      <div className="flex items-center gap-3 mb-6 bg-[#FFF9C4] rounded-xl p-4">
        <div className="w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">顧客数</p>
          <p className="text-2xl font-bold">{customers.length}人</p>
        </div>
      </div>

      {/* モバイルカード表示 */}
      <div className="lg:hidden">
        {customers.map((customer, i) => (
          <motion.div
            key={customer.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => handleRowClick(customer)}
            className="border border-gray-100 rounded-lg p-3 mb-2 hover:bg-amber-50 cursor-pointer transition-colors flex items-center gap-3"
          >
            {customer.avatarUrl ? (
              <img src={customer.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{customer.lineName || customer.name || "-"}</p>
              {customer.phone && (
                <p className="text-xs text-gray-600 truncate">{customer.phone}</p>
              )}
              {customer.email && (
                <p className="text-xs text-gray-600 truncate">{customer.email}</p>
              )}
            </div>
            <button
              onClick={(e) => openMessageModal(e, customer)}
              className="shrink-0 w-9 h-9 rounded-full bg-[#06C755] flex items-center justify-center hover:bg-[#05b34c] transition-colors"
              aria-label="LINEメッセージを送信"
            >
              <MessageCircle className="w-4 h-4 text-white" />
            </button>
          </motion.div>
        ))}
        {customers.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-600">
            顧客がいません
          </div>
        )}
      </div>

      {/* デスクトップグリッド表示 */}
      <div className="hidden lg:block overflow-x-auto">
      <div className="min-w-[560px] border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1.3fr_1.5fr_auto] bg-[#FFF176] px-4 py-2.5 text-xs font-bold text-gray-700">
          <span>LINEアカウント名</span>
          <span>電話番号</span>
          <span>メール</span>
          <span></span>
        </div>

        {customers.map((customer, i) => (
          <motion.div
            key={customer.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => handleRowClick(customer)}
            className="grid grid-cols-[2fr_1.3fr_1.5fr_auto] px-4 py-3 items-center border-t border-gray-100 hover:bg-amber-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {customer.avatarUrl ? (
                <img src={customer.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="text-sm font-medium">{customer.lineName || customer.name || "-"}</span>
            </div>
            <span className="text-sm text-gray-600">{customer.phone}</span>
            <span className="text-sm text-gray-600">{customer.email}</span>
            <button
              onClick={(e) => openMessageModal(e, customer)}
              className="justify-self-end flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#06C755] text-white text-xs font-bold hover:bg-[#05b34c] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              LINE送信
            </button>
          </motion.div>
        ))}

        {customers.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-600">
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
                  <LineSpinner size={30} />
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
                    {selectedCustomer.avatarUrl ? (
                      <img src={selectedCustomer.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                        <User className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-bold">{selectedCustomer.lineName || "-"}</p>
                      {selectedCustomer.name && selectedCustomer.name !== selectedCustomer.lineName && (
                        <p className="text-xs text-gray-600">{selectedCustomer.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <DetailRow label="本名" value={selectedCustomer.name || "未登録"} />
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
                      label="来店回数"
                      value={
                        <span>
                          <span className="font-bold text-lg text-gray-900">{selectedCustomer.orders.length}</span>
                          <span className="text-sm text-gray-500 ml-1">回</span>
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
                              {a.label}
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
                      <p className="text-sm text-gray-600">購入履歴なし</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCustomer.orders.map((order) => (
                          <div
                            key={order.id}
                            className="border border-gray-100 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">
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
      </>
      )}

      {/* LINEメッセージ作成モーダル */}
      <AnimatePresence>
        {messageTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => !sending && setMessageTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">LINEメッセージ送信</h2>
                      <p className="text-xs text-gray-500">
                        {messageTarget.lineName || messageTarget.name || "お客様"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !sending && setMessageTarget(null)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="メッセージを入力してください"
                  maxLength={1000}
                  rows={5}
                  disabled={sending}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#06C755] disabled:bg-gray-50"
                />

                {sendError && (
                  <p className="text-xs text-red-500 mt-2">{sendError}</p>
                )}

                <button
                  onClick={handleSendMessage}
                  disabled={sending || !messageText.trim()}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-[#06C755] text-white font-bold py-2.5 rounded-lg hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <LineSpinner size={18} />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      送信する
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 送信完了モーダル */}
      <AnimatePresence>
        {sentCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSentCustomer(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#06C755] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-1">送信完了</h2>
                <p className="text-sm text-gray-600 mb-5">
                  {sentCustomer.lineName || sentCustomer.name || "お客様"}へメッセージを送信しました
                </p>
                <button
                  onClick={() => setSentCustomer(null)}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  閉じる
                </button>
              </div>
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
