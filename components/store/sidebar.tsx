"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Menu, X as XIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useStoreContext } from "@/lib/store-context";

interface MenuItem {
  label: string;
  href: string;
  hasNotification?: boolean;
  offsetLabel?: boolean;
  children?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  { label: "ダッシュボード", href: "/store/dashboard", offsetLabel: true },
  { label: "予約管理", href: "/store/orders", offsetLabel: true },
  { label: "顧客管理", href: "/store/customers", offsetLabel: true },
  { label: "商品管理", href: "/store/products", offsetLabel: true },
  { label: "商品登録", href: "/store/register" },
  { label: "デコレーション", href: "/store/decorations" },
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
  const { storeName, storeLogo } = useStoreContext();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <>
      {/* モバイル: ハンバーガーボタン */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-[60] p-2 rounded-lg bg-white shadow border border-gray-200"
        aria-label="メニューを開く"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {/* モバイル: オーバーレイ */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

    <aside className={`
      h-screen border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto
      fixed lg:sticky top-0 left-0 z-50
      w-[240px] lg:w-[200px]
      transition-transform duration-300
      ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
    `}>
      {/* モバイル: 閉じるボタン */}
      <button
        onClick={() => setMobileOpen(false)}
        className="lg:hidden absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
        aria-label="メニューを閉じる"
      >
        <XIcon className="w-5 h-5" />
      </button>

      <Link href="/store/dashboard" className="flex items-center justify-center px-4 py-5 border-b border-gray-100">
        {storeLogo ? (
          <Image
            src={storeLogo}
            alt={storeName || "店舗ロゴ"}
            width={120}
            height={60}
            className="object-contain max-h-[60px]"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-amber-600">
              {(storeName || "P").charAt(0)}
            </span>
          </div>
        )}
      </Link>

      <nav className="flex flex-col flex-1">
        <div className="flex flex-col">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/") || (item.children?.some((c) => pathname === c.href));
            return (
              <div key={item.href}>
                <Link href={item.href} className="relative" onClick={() => setMobileOpen(false)}>
                  <motion.div
                    className={`px-5 text-base transition-colors relative ${
                      item.offsetLabel ? "pt-4 pb-2" : "py-3"
                    } ${
                      isActive
                        ? "font-bold text-amber-700 bg-amber-50"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-r" />
                    )}
                    {isActive && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    )}
                    {item.hasNotification && !isActive && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <span className={isActive ? "pl-3" : ""}>{item.label}</span>
                  </motion.div>
                </Link>
                {isActive && item.children && (
                  <div className="flex flex-col bg-amber-50/40">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link key={child.href} href={child.href}>
                          <div
                            className={`px-8 py-2 text-sm transition-colors ${
                              childActive
                                ? "font-bold text-amber-700 bg-amber-100"
                                : "text-gray-600 hover:text-gray-900 hover:bg-amber-100/60"
                            }`}
                          >
                            {childActive && "● "}
                            {child.label}
                          </div>
                        </Link>
                      );
                    })}
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
                  className={`px-5 py-3 text-base transition-colors ${
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
              className="px-5 py-3 text-base text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors text-left"
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
    </>
  );
}
