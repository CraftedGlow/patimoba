"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Mail,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { fetchStores, deleteStore, type Store } from "@/lib/admin-api";

const PLAN_LABELS: Record<number, string> = {
  1: "ベーシック",
  2: "スタンダード",
  3: "プレミアム",
};

function planLabel(plan: number | null) {
  if (!plan) return "ベーシック";
  return PLAN_LABELS[plan] ?? "ベーシック";
}

function PlanBadge({ plan }: { plan: number | null }) {
  const label = planLabel(plan);
  const colors =
    label === "プレミアム"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : label === "スタンダード"
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors}`}>
      {label}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {active ? "稼働中" : "リスク"}
    </span>
  );
}

function mrrFromPlan(plan: number | null) {
  if (plan === 3) return 150000;
  if (plan === 2) return 98000;
  return 58000;
}

type FilterState = {
  status: "all" | "active" | "risk";
  plan: "all" | "1" | "2" | "3";
};

export default function AdminStoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filter, setFilter] = useState<FilterState>({ status: "all", plan: "all" });
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStores(searchQuery || undefined);
      setStores(data);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStore(deleteTarget.id);
      setDeleteTarget(null);
      load();
      showToast("店舗を削除しました");
    } catch {
      showToast("削除に失敗しました");
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleMailClick = (store: Store) => {
    if (store.mail) {
      window.open(`mailto:${store.mail}`, "_blank");
    } else {
      showToast("メールアドレスが登録されていません");
    }
  };

  const handlePhoneClick = (store: Store) => {
    if (store.phone_num) {
      window.open(`tel:${store.phone_num}`, "_blank");
    } else {
      showToast("電話番号が登録されていません");
    }
  };

  const filteredStores = stores.filter((s) => {
    if (filter.status === "active" && s.notification === false) return false;
    if (filter.status === "risk" && s.notification !== false) return false;
    if (filter.plan !== "all" && (s.plan ?? 1) !== Number(filter.plan)) return false;
    return true;
  });

  const total = stores.length;
  const activeCount = stores.filter((s) => s.notification !== false).length;
  const riskCount = stores.filter((s) => s.notification === false).length;

  const summaryCards = [
    { label: "総店舗数", value: `${total}店舗`, color: "text-gray-900", filterVal: "all" as const },
    { label: "稼働中", value: `${activeCount}店舗`, color: "text-green-600", filterVal: "active" as const },
    { label: "リスク", value: `${riskCount}店舗`, color: "text-red-600", filterVal: "risk" as const },
    { label: "非稼働", value: `${total - activeCount - riskCount}店舗`, color: "text-gray-900", filterVal: "all" as const },
  ];

  return (
    <>
      <header className="bg-[#FFF9C4] px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">店舗一覧</h1>
          <p className="text-xs text-gray-600">全{total}店舗</p>
        </div>
        <Link href="/admin/stores/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            店舗を追加
          </motion.button>
        </Link>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="店舗名、オーナー名、所在地で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-1.5 border rounded-lg px-4 py-2.5 text-sm transition-colors ${
                showFilter || filter.status !== "all" || filter.plan !== "all"
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              フィルター
              {(filter.status !== "all" || filter.plan !== "all") && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>

            <AnimatePresence>
              {showFilter && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-12 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-5 w-72"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm">フィルター</h3>
                    <button
                      onClick={() => {
                        setFilter({ status: "all", plan: "all" });
                        setShowFilter(false);
                      }}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      リセット
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">ステータス</p>
                    <div className="flex gap-2">
                      {([
                        { val: "all", label: "すべて" },
                        { val: "active", label: "稼働中" },
                        { val: "risk", label: "リスク" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => setFilter((f) => ({ ...f, status: opt.val }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            filter.status === opt.val
                              ? "bg-amber-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">プラン</p>
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { val: "all", label: "すべて" },
                        { val: "1", label: "ベーシック" },
                        { val: "2", label: "スタンダード" },
                        { val: "3", label: "プレミアム" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => setFilter((f) => ({ ...f, plan: opt.val }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            filter.plan === opt.val
                              ? "bg-amber-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowFilter(false)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                  >
                    適用する
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (card.filterVal !== "all") {
                  setFilter((f) => ({ ...f, status: card.filterVal }));
                } else {
                  setFilter((f) => ({ ...f, status: "all" }));
                }
              }}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-amber-300 transition-colors"
            >
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </motion.div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            店舗が見つかりません
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStores.map((store, i) => {
              const mrr = mrrFromPlan(store.plan);
              const isActive = store.notification !== false;
              return (
                <motion.div
                  key={store.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-base">{store.name ?? "未設定"}</h3>
                        <StatusBadge active={isActive} />
                        <PlanBadge plan={store.plan} />
                      </div>

                      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-4 items-start">
                        <div>
                          <p className="text-xs text-gray-500">オーナー</p>
                          <p className="text-sm">{store.creater ?? "-"}</p>
                        </div>
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">所在地</p>
                            <p className="text-sm">{store.address_url ?? "-"}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">MRR</p>
                          <p className="text-sm font-bold">&yen;{mrr.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">メール</p>
                          <p className="text-sm">{store.mail ?? "-"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span>登録日: {store.created_date ? new Date(store.created_date).toLocaleDateString("ja-JP") : "-"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => handleMailClick(store)}
                        title={store.mail ? `${store.mail} にメール` : "メール未登録"}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                      >
                        <Mail className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                      </button>
                      <button
                        onClick={() => handlePhoneClick(store)}
                        title={store.phone_num ? `${store.phone_num} に電話` : "電話番号未登録"}
                        className="p-2 hover:bg-green-50 rounded-lg transition-colors group"
                      >
                        <Phone className="w-4 h-4 text-gray-400 group-hover:text-green-500" />
                      </button>
                      <button
                        onClick={() => router.push(`/admin/stores/${store.id}/edit`)}
                        title="編集"
                        className="p-2 hover:bg-amber-50 rounded-lg transition-colors group"
                      >
                        <Pencil className="w-4 h-4 text-gray-400 group-hover:text-amber-500" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(store)}
                        title="削除"
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 削除確認ダイアログ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 relative"
            >
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-bold text-lg mb-2">店舗を削除</h2>
              <p className="text-sm text-gray-600 mb-4">
                <strong>{deleteTarget.name}</strong> を削除しますか？この操作は取り消せません。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  onClick={() => setDeleteTarget(null)}
                >
                  キャンセル
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold"
                  onClick={handleDelete}
                >
                  削除する
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* トースト通知 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
