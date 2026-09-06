"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Ticket } from "lucide-react";
import { useCouponBadge } from "@/lib/coupon-badge-context";
import type { MyCoupon } from "@/hooks/use-my-coupons";

function formatDiscount(c: Pick<MyCoupon, "discountType" | "discountValue">) {
  return c.discountType === "percentage" ? `${c.discountValue}% OFF` : `${c.discountValue.toLocaleString()}円引き`;
}

function formatValidPeriod(c: Pick<MyCoupon, "validFrom" | "expiresAt">) {
  const now = new Date();
  const fmt = (d: string) => new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  if (c.validFrom && now < new Date(c.validFrom)) {
    return { notStarted: true, label: `${fmt(c.validFrom)}から利用可能` };
  }
  return { notStarted: false, label: c.expiresAt ? `${fmt(c.expiresAt)}まで有効` : "無期限" };
}

function conditionText(c: Pick<MyCoupon, "minOrderAmount" | "wholeCakeOnly">) {
  const parts: string[] = [];
  if (c.minOrderAmount) parts.push(`${c.minOrderAmount.toLocaleString()}円以上`);
  if (c.wholeCakeOnly) parts.push("ホールケーキ");
  if (parts.length === 0) return null;
  return `${parts.join("・")}ご注文の方`;
}

/**
 * ヘッダーのクーポンアイコンから開く、保有クーポン一覧ドロワー。
 * カートと違い各ページの状態には依存せず、CouponBadgeProvider から直接データを取得する自己完結型。
 */
export function CouponDrawer() {
  const { coupons, loading, open, closeDrawer } = useCouponBadge();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const panelContent = (
    <>
      {!isDesktop && (
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
      )}

      <div
        className={`flex items-center justify-between px-6 pb-4 border-b border-gray-100 ${
          isDesktop ? "pt-6" : "pt-2"
        }`}
      >
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-gray-900">
            クーポン
            {coupons.length > 0 && (
              <span className="ml-1.5 text-sm font-medium text-gray-900">({coupons.length}枚)</span>
            )}
          </h2>
        </div>
        <button
          onClick={closeDrawer}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {!loading && coupons.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Ticket className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-gray-500 text-base font-medium">保有しているクーポンはありません</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {coupons.map((c) => {
              const period = formatValidPeriod(c);
              const condition = conditionText(c);
              return (
                <div key={c.deliveryId} className="border border-gray-200 rounded-xl p-3.5">
                  <p className="font-bold text-gray-900 text-sm">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-sm bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                      {formatDiscount(c)}
                    </span>
                    <span className={`text-xs ${period.notStarted ? "text-blue-600 font-bold" : "text-gray-600"}`}>
                      {period.label}
                    </span>
                  </div>
                  {condition && (
                    <p className="text-xs text-gray-900 mt-1.5">ご利用条件：{condition}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-[60]"
            onClick={closeDrawer}
          />

          {isDesktop ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={closeDrawer}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-h-[85vh] min-h-[420px] w-full max-w-md flex flex-col overflow-hidden"
              >
                {panelContent}
              </motion.div>
            </div>
          ) : (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-3xl max-h-[85vh] min-h-[420px] flex flex-col"
            >
              {panelContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
