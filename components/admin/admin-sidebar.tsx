"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Building2, ChartBar as BarChart3, Lightbulb, User, LogOut, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/admin", icon: LayoutGrid, label: "ダッシュボード" },
  { href: "/admin/stores", icon: Building2, label: "店舗一覧" },
  { href: "/admin/revenue", icon: BarChart3, label: "収益分析" },
  { href: "/admin/insights", icon: Lightbulb, label: "営業インサイト" },
  { href: "/admin/legal", icon: FileText, label: "規約管理" },
  { href: "/admin/account", icon: User, label: "アカウント設定" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-14 bg-white border-r border-gray-200 flex flex-col items-center py-4 z-50">
      <Link href="/" className="mb-6" title="トップページ">
        <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">PM</span>
        </div>
      </Link>

      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} title={item.label}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5" />
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        title="ログアウト"
        onClick={() => {
          logout();
          router.push("/");
        }}
        className="mt-auto mb-2"
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </motion.div>
      </button>
    </aside>
  );
}
