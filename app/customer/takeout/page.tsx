"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { OrderTypeModal } from "@/components/customer/order-type-modal";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useStores } from "@/hooks/use-stores";
import { useCustomerContext } from "@/lib/customer-context";
import { Store } from "@/lib/types";
import { Search, Heart, Loader2 } from "lucide-react";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];
const tabs = ["店舗一覧", "お気に入り", "履歴"] as const;

function StoreCard({
  store,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: {
  store: Store;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all duration-200 active:scale-[0.98]">
      <button onClick={onSelect} className="flex items-center gap-4 flex-1 min-w-0 text-left">
        <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {store.logoUrl || store.image ? (
            <img
              src={store.logoUrl || store.image}
              alt={store.name}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <span className="text-[10px] text-gray-400 font-medium text-center leading-tight px-1">
              {store.name.slice(0, 4)}
            </span>
          )}
        </div>
        <span className="flex-1 font-bold text-base text-gray-900 truncate">
          {store.name}
        </span>
      </button>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        whileTap={{ scale: 0.8 }}
        className="flex-shrink-0 p-1"
      >
        <Heart
          className={`w-5 h-5 transition-colors duration-200 ${
            isFavorite ? "text-red-500 fill-red-500" : "text-gray-300"
          }`}
        />
      </motion.button>
    </div>
  );
}

export default function TakeoutStorePage() {
  const router = useRouter();
  const {
    setSelectedStoreId,
    setSelectedStoreName,
    profile,
    favorites,
    toggleFavorite,
    viewedStoreIds,
    addViewedStore,
  } = useCustomerContext();
  const { stores, loading } = useStores();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("店舗一覧");
  const [searchQuery, setSearchQuery] = useState("");
  const [favSearchQuery, setFavSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favoriteStores = stores
    .filter((s) => favorites.has(s.id))
    .filter((s) => s.name.toLowerCase().includes(favSearchQuery.toLowerCase()));

  const viewedStores = viewedStoreIds
    .map((id) => stores.find((s) => s.id === id))
    .filter((s): s is Store => !!s);

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store);
    setSelectedStoreId(store.id);
    setSelectedStoreName(store.name);
    addViewedStore(store.id);
  };

  const handleSameDay = () => {
    if (selectedStore) {
      router.push(`/customer/takeout/products?store=${selectedStore.id}&type=sameday`);
    }
  };

  const handleReservation = () => {
    if (selectedStore) {
      router.push(`/customer/takeout/products?store=${selectedStore.id}&type=reservation`);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
      />
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

      <div className="px-4 pt-4 pb-8 flex-1">
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
                <button className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-5 rounded-lg text-sm transition-colors flex items-center gap-1">
                  <Search className="w-4 h-4" />
                  検索
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm">
                  店舗が見つかりませんでした
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStores.map((store, i) => (
                    <motion.div
                      key={store.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <StoreCard
                        store={store}
                        isFavorite={favorites.has(store.id)}
                        onToggleFavorite={() => toggleFavorite(store.id)}
                        onSelect={() => handleStoreClick(store)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
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
                  value={favSearchQuery}
                  onChange={(e) => setFavSearchQuery(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-5 rounded-lg text-sm transition-colors flex items-center gap-1">
                  <Search className="w-4 h-4" />
                  検索
                </button>
              </div>

              {favoriteStores.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <Heart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">お気に入りの店舗はありません</p>
                  <p className="text-gray-300 text-xs mt-1">
                    店舗一覧のハートをタップして追加できます
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {favoriteStores.map((store, i) => (
                    <motion.div
                      key={store.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <StoreCard
                        store={store}
                        isFavorite={true}
                        onToggleFavorite={() => toggleFavorite(store.id)}
                        onSelect={() => handleStoreClick(store)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
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
              {viewedStores.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">閲覧履歴はありません</p>
                  <p className="text-gray-300 text-xs mt-1">
                    店舗を選択すると履歴に表示されます
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {viewedStores.map((store, i) => (
                    <motion.div
                      key={store.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <StoreCard
                        store={store}
                        isFavorite={favorites.has(store.id)}
                        onToggleFavorite={() => toggleFavorite(store.id)}
                        onSelect={() => handleStoreClick(store)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <OrderTypeModal
        open={!!selectedStore}
        store={selectedStore}
        onClose={() => setSelectedStore(null)}
        onSelectSameDay={handleSameDay}
        onSelectReservation={handleReservation}
      />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
