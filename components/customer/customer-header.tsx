"use client";

import { User, ShoppingCart, ArrowLeft, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart-context";
import { useOptionalCouponBadge } from "@/lib/coupon-badge-context";
import { useRouter } from "next/navigation";

interface CustomerHeaderProps {
  shopName?: string;
  userName?: string;
  avatarUrl?: string;
  logoUrl?: string | null;
  points?: number;
  showCart?: boolean;
  onCartClick?: () => void;
  showBack?: boolean;
  backHref?: string;
}

export function CustomerHeader({
  shopName,
  userName,
  avatarUrl,
  logoUrl,
  points,
  showCart = true,
  onCartClick,
  showBack = false,
  backHref,
}: CustomerHeaderProps) {
  const { itemCount } = useCart();
  const couponBadge = useOptionalCouponBadge();
  const router = useRouter();

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <>
      <motion.header
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-[var(--ec-header,#ffff9d)] px-4 py-[11px] flex items-center justify-between sticky top-0 z-50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={shopName || "店舗ロゴ"}
                className="h-9 max-w-[120px] object-contain"
              />
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="w-9 h-9 rounded-full object-cover border-2 border-white"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          {!logoUrl && (
            <span className="font-bold text-[var(--ec-header-text,#111827)] text-sm truncate">
              {userName || shopName || "ゲスト"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {points !== undefined && (
            <span className="font-bold text-[var(--ec-header-text,#111827)] text-sm tracking-wide">
              {points.toLocaleString()}PT
            </span>
          )}
          {couponBadge && couponBadge.count > 0 && (
            <button onClick={couponBadge.openDrawer} className="relative">
              <Ticket className="w-6 h-6 text-[var(--ec-header-text,#111827)]" />
              <motion.span
                key={couponBadge.count}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center leading-none px-1"
              >
                {couponBadge.count > 99 ? "99+" : couponBadge.count}
              </motion.span>
            </button>
          )}
          {showCart && (
            <button onClick={onCartClick} className="relative">
              <ShoppingCart className="w-6 h-6 text-[var(--ec-header-text,#111827)]" />
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center leading-none px-1"
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </motion.span>
              )}
            </button>
          )}
        </div>
      </motion.header>

      {/* 戻るボタン: ヘッダーの外・左下 */}
      {showBack && (
        <div className="px-3 pt-1 pb-0">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      )}
    </>
  );
}
