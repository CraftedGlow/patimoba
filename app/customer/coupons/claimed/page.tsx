"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";

interface ClaimedCoupon {
  title: string;
  discountLabel: string;
  nextPath: string;
}

const STORAGE_KEY = "patimoba_claimed_coupon";

export default function CouponClaimedPage() {
  const router = useRouter();
  const [claimed, setClaimed] = useState<ClaimedCoupon | null>(null);

  useEffect(() => {
    let data: ClaimedCoupon | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (!data) {
      router.replace("/customer/takeout");
      return;
    }
    setClaimed(data);
  }, [router]);

  if (!claimed) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-amber-50/60 to-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 14 }}
          className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mx-auto mb-5"
        >
          <Gift className="w-8 h-8 text-white" />
        </motion.div>

        <h1 className="text-lg font-bold text-gray-900 mb-2">クーポンを獲得しました🎉</h1>
        <p className="text-sm text-gray-500 mb-6">注文時にお選びいただけます</p>

        <div className="bg-white border border-amber-200 rounded-2xl p-5 mb-8 shadow-sm">
          <p className="font-bold text-gray-900 text-base mb-1">{claimed.title}</p>
          <span className="inline-block text-sm bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">
            {claimed.discountLabel}
          </span>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push(claimed.nextPath)}
          className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          注文へ進む
        </motion.button>
      </motion.div>
    </div>
  );
}
