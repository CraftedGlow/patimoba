"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useStores } from "@/hooks/use-stores";
import { useCustomerContext } from "@/lib/customer-context";
import { useEcContext } from "@/lib/ec-context";
import { useCart } from "@/lib/cart-context";
import { Store } from "@/lib/types";
import { Search } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";

const ecSteps = ["店舗選択", "商品選択", "お届け先", "注文確認"];

function StoreCard({
  store,
  onSelect,
}: {
  store: Store;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="h-full flex flex-col rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
    >
      <div className="aspect-[4/3] w-full bg-gray-50 overflow-hidden">
        {store.image ? (
          <img
            src={store.image}
            alt={store.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-medium">
            {store.name.slice(0, 4)}
          </div>
        )}
      </div>
      <div className="p-3 flex-1">
        <p className="font-bold text-sm text-gray-900">{store.name}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{store.address}</p>
      </div>
    </div>
  );
}

export default function ECStorePage() {
  const router = useRouter();
  const { stores, loading } = useStores();
  const { setSelectedStoreId, setSelectedStoreName, profile, userId,
    points } = useCustomerContext();
  const { storeLogoUrl } = useEcContext();
  const { clear: clearCart } = useCart();

  // 店舗選択画面では前回選んだ店舗のロゴ・テーマを引きずらないようにリセットする
  useEffect(() => {
    setSelectedStoreId(null);
  }, []);

  // ゲストがリンクから入り直したときはカートをリセット
  useEffect(() => {
    if (userId) return;
    clearCart();
    // フロー中のsessionStorageもクリア
    try {
      sessionStorage.removeItem("ec_shipping_address");
      sessionStorage.removeItem("ec_delivery_time");
      sessionStorage.removeItem("ec_customer_last_name");
      sessionStorage.removeItem("ec_customer_first_name");
      sessionStorage.removeItem("ec_customer_phone");
      sessionStorage.removeItem("ec_customer_email");
    } catch { /* ignore */ }
  }, []);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStoreClick = (store: Store) => {
    setSelectedStoreId(store.id);
    setSelectedStoreName(store.name);
    router.push(`/customer/ec/products?store=${store.id}`);
  };

  return (
    <div className="min-h-screen bg-[var(--ec-bg,#ffffff)] flex flex-col">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        logoUrl={storeLogoUrl}
        points={points}
        showCart
      />
      <StepProgress currentStep={1} steps={ecSteps} />

      <div className="px-4 pb-8 flex-1">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="店舗名を検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] focus:border-transparent"
          />
          <button className="bg-[var(--ec-400,#fbbf24)] hover:bg-[var(--ec-500,#f59e0b)] text-[var(--ec-button-text,#ffffff)] font-bold px-5 rounded-lg text-sm transition-colors flex items-center gap-1">
            <Search className="w-4 h-4" />
            検索
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LineSpinner size={24} />
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="text-center py-20 text-gray-600 text-sm">
            店舗が見つかりませんでした
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            {filteredStores.map((store, i) => (
              <motion.div
                key={store.id}
                className="h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <StoreCard
                  store={store}
                  onSelect={() => handleStoreClick(store)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
