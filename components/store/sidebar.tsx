"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStoreContext } from "@/lib/store-context";

interface MenuItem {
  label: string;
  href: string;
  hasNotification?: boolean;
  children?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  { label: "ダッシュボード", href: "/store/dashboard" },
  {
    label: "予約管理",
    href: "/store/orders",
    children: [{ label: "注文履歴", href: "/store/orders/history" }],
  },
  { label: "顧客管理", href: "/store/customers" },
  { label: "商品管理", href: "/store/products" },
  { label: "商品登録", href: "/store/register" },
  { label: "営業日設定", href: "/store/business-days", hasNotification: true },
  { label: "レポート", href: "/store/report" },
];

const bottomItems = [
  { label: "アカウント", href: "/store/account" },
];

export function StoreSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { storeName, storeImage, storeLogo } = useStoreContext();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoSrc = storeLogo || storeImage;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <aside className="w-[180px] min-h-screen border-r border-gray-200 bg-white flex flex-col shrink-0">
      <Link href="/store/dashboard" className="flex items-center justify-center px-4 py-4">
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt={storeName || "店舗ロゴ"}
            width={140}
            height={48}
            className="object-contain max-h-12 w-auto"
            unoptimized
          />
        ) : (
          <span className="text-sm font-bold text-amber-600">{storeName || "パティモバ"}</span>
        )}
      </Link>

      <nav className="flex flex-col flex-1">
        <div className="flex flex-col">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/") || (item.children?.some((c) => pathname === c.href));
            return (
              <div key={item.href}>
                <Link href={item.href} className="relative">
                  <motion.div
                    className={`px-5 py-3 text-sm transition-colors relative ${
                      isActive
                        ? "font-bold text-gray-900 bg-gray-50"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.hasNotification && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    {item.label}
                  </motion.div>
                </Link>
                {isActive && item.children && (
                  <div className="flex flex-col">
                    {item.children.map((child) => (
                      <Link key={child.href} href={child.href}>
                        <div className="px-8 py-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                          {child.label}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col pb-6">
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`px-5 py-3 text-sm transition-colors ${
                    isActive
                      ? "font-bold text-gray-900 bg-gray-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <motion.div
              className="px-5 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors text-left"
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
            >
              ログアウト
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {showLogoutConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
              onClick={() => setShowLogoutConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8"
              >
                <p className="text-lg font-bold text-center mb-6">
                  ログアウトしますか？
                </p>
                <div className="flex gap-3 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="px-8 py-2 rounded-lg bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors"
                  >
                    はい
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-8 py-2 rounded-lg border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </aside>
  );
}
