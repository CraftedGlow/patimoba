"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { OrderTypeModal } from "@/components/customer/order-type-modal";
import { useStores } from "@/hooks/use-stores";
import { useCustomerContext } from "@/lib/customer-context";
import { Store } from "@/lib/types";
import { MapPin, Heart } from "lucide-react";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

const tabs = ["店舗一覧", "お気に入り", "履歴"] as const;

const favoriteStores: { id: string; name: string; logo: string }[] = [];

const historyStores: { id: string; name: string; logo: string; lastOrder: string }[] = [];

export default function TakeoutStorePage() {
  const router = useRouter();
  const { selectedStoreName, setSelectedStoreId, setSelectedStoreName } = useCustomerContext();
  const { stores, loading } = useStores();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("店舗一覧");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<{ id: string; name: string } | null>(null);

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStoreClick = (storeId: string, storeName: string) => {
    setSelectedStore({ id: storeId, name: storeName });
    setSelectedStoreId(storeId);
    setSelectedStoreName(storeName);
  };

  const handleReservation = () => {
    if (selectedStore) {
      router.push(`/customer/takeout/products?store=${selectedStore.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} />
      <StepProgress currentStep={1} steps={steps} />

      <div className="px-4">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-bold text-center relative transition-colors ${
                activeTab === tab ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="store-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[3px] bg-amber-400 rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-8">
        <AnimatePresence mode="wait">
          {activeTab === "店舗一覧" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="店舗名を検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 rounded-lg text-sm transition-colors">
                  検索
                </button>
              </div>

              <div className="space-y-3">
                {filteredStores.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <button
                      onClick={() => handleStoreClick(store.id, store.name)}
                      className="w-full text-left"
                    >
                      <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                        <div className="h-36 bg-gray-100">
                          <img
                            src={store.image}
                            alt={store.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900">{store.name}</h3>
                          <div className="flex items-center gap-1 mt-1 text-gray-500 text-sm">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{store.address}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "お気に入り" && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="店舗名を検索"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 rounded-lg text-sm transition-colors">
                  検索
                </button>
              </div>

              <div className="space-y-3">
                {favoriteStores.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <button
                      onClick={() => handleStoreClick(store.id, store.name)}
                      className="w-full text-left"
                    >
                      <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                        <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          <img
                            src={store.logo}
                            alt={store.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="flex-1 font-bold text-base">
                          {store.name}
                        </span>
                        <Heart className="w-5 h-5 text-red-500 fill-red-500 flex-shrink-0" />
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "履歴" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-3">
                {historyStores.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <button
                      onClick={() => handleStoreClick(store.id, store.name)}
                      className="w-full text-left"
                    >
                      <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                        <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          <img
                            src={store.logo}
                            alt={store.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-base">{store.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            最終注文: {store.lastOrder}
                          </p>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <OrderTypeModal
        open={!!selectedStore}
        storeName={selectedStore?.name ?? ""}
        onClose={() => setSelectedStore(null)}
        onSelectSameDay={() => setSelectedStore(null)}
        onSelectReservation={handleReservation}
      />
    </div>
  );
}
