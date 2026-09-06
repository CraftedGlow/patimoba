"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gift, Ban, PartyPopper } from "lucide-react";

interface ClaimedCoupon {
  title: string;
  discountLabel?: string;
  minOrderAmount?: number | null;
  wholeCakeOnly?: boolean;
  validFrom?: string | null;
  expiresAt?: string | null;
  alreadyUsed?: boolean;
  nextPath: string;
}

const STORAGE_KEY = "patimoba_claimed_coupon";

function conditionText(c: Pick<ClaimedCoupon, "minOrderAmount" | "wholeCakeOnly">) {
  const parts: string[] = [];
  if (c.minOrderAmount) parts.push(`${c.minOrderAmount.toLocaleString()}円以上`);
  if (c.wholeCakeOnly) parts.push("ホールケーキ");
  if (parts.length === 0) return null;
  return `${parts.join("・")}ご注文の方`;
}

function validPeriodText(c: Pick<ClaimedCoupon, "validFrom" | "expiresAt">) {
  const now = new Date();
  const fmt = (d: string) => new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  if (c.validFrom && now < new Date(c.validFrom)) return `${fmt(c.validFrom)}から利用可能`;
  return c.expiresAt ? `${fmt(c.expiresAt)}まで有効` : "無期限";
}

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

  if (claimed.alreadyUsed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
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
            className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center mx-auto mb-5"
          >
            <Ban className="w-8 h-8 text-white" />
          </motion.div>

          <h1 className="text-lg font-bold text-gray-900 mb-2">このクーポンは使用済みです</h1>
          <p className="text-sm text-gray-500 mb-6">すでにご注文でご利用いただいています</p>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8 shadow-sm">
            <p className="font-bold text-gray-900 text-base">{claimed.title}</p>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(claimed.nextPath)}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            お店のページへ進む
          </motion.button>
        </motion.div>
      </div>
    );
  }

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

        <h1 className="text-lg font-bold text-gray-900 mb-2 flex items-center justify-center gap-1.5">
          クーポンを獲得しました
          <PartyPopper className="w-5 h-5 text-amber-500" />
        </h1>
        <p className="text-sm text-gray-500 mb-6">注文時にお選びいただけます</p>

        <div className="bg-white border border-amber-200 rounded-2xl p-5 mb-8 shadow-sm text-left">
          <p className="font-bold text-gray-900 text-base mb-1 text-center">{claimed.title}</p>
          <div className="text-center">
            <span className="inline-block text-base bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">
              {claimed.discountLabel}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            {conditionText(claimed) && (
              <p className="text-sm text-gray-900">ご利用条件：{conditionText(claimed)}</p>
            )}
            <p className="text-sm text-gray-900">有効期限：{validPeriodText(claimed)}</p>
            <p className="text-sm text-gray-900">店頭でのご注文ではご利用いただけません</p>
          </div>
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
