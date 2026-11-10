"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CustomerHeader } from "@/components/customer/customer-header";
import { useStores } from "@/hooks/use-stores";
import { useAuth } from "@/lib/auth-context";
import { useCustomerContext } from "@/lib/customer-context";
import { completeLiffLogin } from "@/lib/liff-login";
import { useEcContext } from "@/lib/ec-context";
import { useCart } from "@/lib/cart-context";
import { Store } from "@/lib/types";
import { Search } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";

const LIFF_LOGIN_TIMESTAMP_KEY = "patimoba_liff_login_ts";
// takeoutのpatimoba_order_liff_idと同じ目的だが、同一タブ内でEC/テイクアウトの
// フローが混ざらないよう別キーにする
const EC_ORDER_LIFF_ID_KEY = "patimoba_ec_order_liff_id";

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
  const { user, loading: authLoading, setUser } = useAuth();
  const { setSelectedStoreId, setSelectedStoreName, profile, userId,
    points } = useCustomerContext();
  const { storeLogoUrl } = useEcContext();
  const { clear: clearCart } = useCart();
  const [loginDone, setLoginDone] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 店舗選択画面では前回選んだ店舗のロゴ・テーマを引きずらないようにリセットする
  useEffect(() => {
    setSelectedStoreId(null);
  }, []);

  // テイクアウトの一覧画面と同じ「店舗に紐付かない共通LIFF」でログインを試みる。
  // LINEアプリ外からの通常アクセスはエラーにせずゲストのまま進める。
  useEffect(() => {
    if (authLoading) return;

    const ts = sessionStorage.getItem(LIFF_LOGIN_TIMESTAMP_KEY);
    if (ts && Date.now() - Number(ts) < 15000 && user) {
      setLoginDone(true);
      return;
    }

    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          setLoginDone(true);
          return;
        }

        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isInClient()) {
          setLoginDone(true);
          return;
        }

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const { authUser } = await completeLiffLogin(liff);
        setUser(authUser);
        sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
        sessionStorage.setItem(EC_ORDER_LIFF_ID_KEY, liffId);
        setLoginDone(true);
      } catch (err: any) {
        console.error("[EC List LIFF] login error:", err);
        setLoginError(err?.message || "LIFF初期化エラー");
      }
    })();
  }, [authLoading]);

  // ゲストがリンクから入り直したときはカートをリセット(LIFFログイン判定が終わるまで待つ。
  // 先に判定してしまうとLINEログイン済みの再訪問者のカートまで誤って消してしまうため)
  // userIdはCustomerProvider側のeffectで1テンポ遅れて更新されることがあるため、
  // 同じレンダーで確定しているuser(useAuth)も合わせて見て誤判定を防ぐ
  useEffect(() => {
    if (!loginDone) return;
    if (user || userId) return;
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
  }, [loginDone]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStoreClick = (store: Store) => {
    setSelectedStoreId(store.id);
    setSelectedStoreName(store.name);
    router.push(`/customer/ec/products?store=${store.id}`);
  };

  if (loginError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-8">
        <p className="text-red-500 text-sm text-center">{loginError}</p>
      </div>
    );
  }

  if (!loginDone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LineSpinner size={30} />
          <p className="text-lg font-bold text-gray-900">ログイン中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ec-bg,#ffffff)] flex flex-col">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        logoUrl={storeLogoUrl}
        points={points}
        showCart
      />
      <div className="px-4 pb-8 pt-4 flex-1">
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
