"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { LineSpinner } from "@/components/ui/line-spinner";
import { isDevOnlyStoreVisible } from "@/lib/store-visibility";

interface ChildStore {
  id: string;
  name: string;
  image: string | null;
  address: string | null;
  postal_code: string | null;
  is_dev_only: boolean;
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
        const { data: rows, error } = await supabase
          .from("stores")
          .select("id, name, image, address, postal_code, is_dev_only")
          .eq("parent_store_id", masterStoreId)
          .eq("is_active", true);

        if (error) throw error;
        const childStores = (rows || []).filter((s) => isDevOnlyStoreVisible(s.is_dev_only));
        if (childStores.length === 0) {
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
    <div className="min-h-screen bg-white">
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        <h1 className="text-lg font-bold text-gray-900 mb-1">店舗を選択してください</h1>
        <p className="text-sm text-gray-500 mb-6">お受け取りする店舗をお選びください</p>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-4 pb-10">
        {stores.map((store, i) => (
          <motion.button
            key={store.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            onClick={() => handleSelect(store.id)}
            className="w-full flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-amber-300 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
          >
            <div className="w-full h-[150px] bg-gray-100">
              {store.image && (
                <img
                  src={store.image}
                  alt={store.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-4">
              <p className="font-bold text-base text-gray-900 leading-snug">{store.name}</p>
              {store.postal_code && (
                <p className="text-xs text-gray-500 mt-1">〒{store.postal_code}</p>
              )}
              {store.address && (
                <p className="text-xs text-gray-500">{store.address}</p>
              )}
              {store.orderCount > 0 && (
                <p className="text-xs text-amber-600 mt-1">注文回数 {store.orderCount}回</p>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
