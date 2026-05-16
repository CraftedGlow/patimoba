"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useStores } from "@/hooks/use-stores";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";
import { useCustomerContext } from "@/lib/customer-context";
import { completeLiffLogin } from "@/lib/liff-login";
import { Store } from "@/lib/types";
import { Search, Heart } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";

const LIFF_LOGIN_TIMESTAMP_KEY = "liff_login_timestamp";

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
  const { user, loading: authLoading, setUser } = useAuth();
  const {
    profile,
    points,
    favorites,
    toggleFavorite,
    viewedStoreIds,
  } = useCustomerContext();
  const { stores, loading } = useStores();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("店舗一覧");
  const [searchQuery, setSearchQuery] = useState("");
  const [favSearchQuery, setFavSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const [loginDone, setLoginDone] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const liffStarted = useRef(false);

  // 常にLINEクライアント内ではフレッシュログイン
  useEffect(() => {
    if (authLoading) return;
    if (liffStarted.current) return;
    liffStarted.current = true;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      if (user) setLoginDone(true);
      return;
    }

    // 直前にroot pageや他のページでLIFFログイン済みなら再実行不要
    const ts = sessionStorage.getItem(LIFF_LOGIN_TIMESTAMP_KEY);
    if (ts && Date.now() - Number(ts) < 15000 && user) {
      setLoginDone(true);
      return;
    }

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isInClient()) {
          if (user) { setLoginDone(true); return; }
          setLoginError("このページはLINEアプリからアクセスしてください");
          return;
        }

        // LINEクライアント内：常にフレッシュログイン
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        setUser(null);

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const { authUser } = await completeLiffLogin(liff);
        setUser(authUser);
        sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
        setLoginDone(true);
      } catch (err: any) {
        setLoginError(err?.message || "LIFF初期化エラー");
      }
    })();
  }, [authLoading]);

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-xs text-center"
          >
            {loginError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                <p className="text-sm font-bold text-red-700 mb-1">ログインエラー</p>
                <p className="text-xs text-red-600 break-all">{loginError}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <LineSpinner size={30} />
                <p className="text-base font-bold text-gray-900">LINEログイン中...</p>
              </div>
            )}
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
        points={points}
        onCartClick={() => setCartOpen(true)}
      />
      <StepProgress currentStep={1} steps={steps} />

      <div className="px-4 md:px-8 lg:px-12">
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
              <input
                type="text"
                placeholder="店舗名を検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-4"
              />

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <LineSpinner size={24} />
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
              <input
                type="text"
                placeholder="店舗名を検索"
                value={favSearchQuery}
                onChange={(e) => setFavSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-4"
              />

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
