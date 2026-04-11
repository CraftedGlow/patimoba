"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useStores } from "@/hooks/use-stores";
import { useCustomerContext } from "@/lib/customer-context";
import { Store } from "@/lib/types";
import { MapPin, Truck } from "lucide-react";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

export default function ECStorePage() {
  const { stores, loading } = useStores({ ecOnly: true });
  const { setSelectedStoreId, setSelectedStoreName } = useCustomerContext();

  const handleStoreClick = (store: Store) => {
    setSelectedStoreId(store.id);
    setSelectedStoreName(store.name);
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
      <CustomerHeader shopName="パティモバ EC" showCart />
      <StepProgress currentStep={1} steps={ecSteps} />

      <div className="px-4 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold">配送可能な店舗</h2>
        </div>
        <div className="space-y-3">
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                href={`/customer/ec/products?store=${store.id}`}
                onClick={() => handleStoreClick(store)}
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
                    <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                      配送対応
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
