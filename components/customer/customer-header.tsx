"use client";

import Link from "next/link";
import { User, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

interface CustomerHeaderProps {
  shopName?: string;
  avatarUrl?: string;
  showCart?: boolean;
  cartCount?: number;
  cartHref?: string;
}

export function CustomerHeader({
  shopName,
  avatarUrl,
  showCart = false,
  cartCount = 0,
  cartHref = "/customer/ec/products",
}: CustomerHeaderProps) {
  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-[#FFEB3B] px-4 py-3 flex items-center justify-between sticky top-0 z-50"
    >
      <div className="flex items-center gap-2">
        {shopName && (
          <h1 className="font-bold text-gray-900 text-base truncate max-w-[200px]">
            {shopName}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/customer/profile" className="flex-shrink-0">
          {avatarUrl ? (
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
        </Link>

        {showCart && (
          <Link href={cartHref} className="relative flex-shrink-0">
            <ShoppingCart className="w-6 h-6 text-gray-900" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center leading-none px-1"
              >
                {cartCount}
              </motion.span>
            )}
          </Link>
        )}
      </div>
    </motion.header>
  );
}
