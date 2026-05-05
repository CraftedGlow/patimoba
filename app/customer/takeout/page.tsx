"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useStores } from "@/hooks/use-stores";
import { useAuth } from "@/lib/auth-context";
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
  const { user, loading: authLoading } = useAuth();
  const {
    profile,
    favorites,
    toggleFavorite,
    viewedStoreIds,
  } = useCustomerContext();
  const { stores, loading } = useStores();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("店舗一覧");
  const [searchQuery, setSearchQuery] = useState("");
  const [favSearchQuery, setFavSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  // LINEログイン（未ログイン時のみ）
  const [progress, setProgress] = useState(0);
  const [loginDone, setLoginDone] = useState(false);
  const animStarted = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setLoginDone(true);
      return;
    }
    if (animStarted.current) return;
    animStarted.current = true;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) { clearInterval(timer); return 100; }
        return prev + 4;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [authLoading, user]);

  useEffect(() => {
    if (progress !== 100) return;
    const t = setTimeout(() => setLoginDone(true), 600);
    return () => clearTimeout(t);
  }, [progress]);

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
    router.push(`/customer/takeout/store/${store.id}`);
  };

  if (!loginDone) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-[#FFF9C4] h-2.5 shrink-0" aria-hidden />
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-10"
          >
            <Image
              src="/スクリーンショット_2026-04-09_14.49.59.png"
              alt="パティモバ"
              width={280}
              height={80}
              className="h-14 w-auto"
              priority
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="w-full max-w-xs text-center"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">LINEログイン中...</h2>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-3 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-[#F9A825]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.08 }}
              />
            </div>
            <p className="text-lg font-bold text-gray-900">{progress}%</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
      />
      <StepProgress currentStep={1} steps={steps} />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="flex border-b border-gray-200 md:max-w-md">
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

      <div className="px-4 md:px-8 lg:px-12 pt-4 pb-8 flex-1">
        <AnimatePresence mode="wait">
          {activeTab === "店舗一覧" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex gap-2 mb-4 md:max-w-md">
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
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
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
              <div className="flex gap-2 mb-4 md:max-w-md">
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
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
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
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
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

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
