"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { LineSpinner } from "@/components/ui/line-spinner";

interface ChildStore {
  id: string;
  name: string;
  logo_url: string | null;
  image: string | null;
  orderCount: number;
}

export default function StoreSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const masterStoreId = searchParams.get("master");
  const { user } = useAuth();

  const [stores, setStores] = useState<ChildStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!masterStoreId) {
      router.replace("/customer/takeout");
      return;
    }

    (async () => {
      try {
        const { data: childStores, error } = await supabase
          .from("stores")
          .select("id, name, logo_url, image")
          .eq("parent_store_id", masterStoreId)
          .eq("is_active", true);

        if (error) throw error;
        if (!childStores || childStores.length === 0) {
          router.replace("/customer/takeout");
          return;
        }

        // 注文履歴から頻度を取得してソート
        let orderCounts: Record<string, number> = {};
        if (user?.id) {
          const { data: orders } = await supabase
            .from("orders")
            .select("store_id")
            .eq("user_id", user.id)
            .in("store_id", childStores.map((s) => s.id));

          for (const o of orders ?? []) {
            orderCounts[o.store_id] = (orderCounts[o.store_id] ?? 0) + 1;
          }
        }

        const sorted = [...childStores]
          .map((s) => ({ ...s, orderCount: orderCounts[s.id] ?? 0 }))
          .sort((a, b) => b.orderCount - a.orderCount);

        setStores(sorted);
      } finally {
        setLoading(false);
      }
    })();
  }, [masterStoreId, user]);

  const handleSelect = (storeId: string) => {
    router.push(`/customer/takeout/store/${storeId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LineSpinner size={30} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 to-white">
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        <Image
          src="/パティモバ　ロゴ.png"
          alt="パティモバ"
          width={160}
          height={46}
          className="w-[160px] h-auto mb-8"
          priority
        />
        <h1 className="text-lg font-bold text-gray-900 mb-1">店舗を選択してください</h1>
        <p className="text-sm text-gray-500 mb-6">ご注文される店舗をお選びください</p>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-3 pb-10">
        {stores.map((store, i) => (
          <motion.button
            key={store.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            onClick={() => handleSelect(store.id)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
          >
            <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {store.logo_url || store.image ? (
                <img
                  src={store.logo_url || store.image || ""}
                  alt={store.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <span className="text-[10px] text-gray-600 font-medium text-center leading-tight px-1">
                  {store.name.slice(0, 4)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-gray-900 truncate">{store.name}</p>
              {store.orderCount > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">注文回数 {store.orderCount}回</p>
              )}
            </div>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
