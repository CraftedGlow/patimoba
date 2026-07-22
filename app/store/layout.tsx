"use client"

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StoreSidebar } from "@/components/store/sidebar";
import { StoreProvider } from "@/lib/store-context";
import { NewOrderAlert } from "@/components/store/new-order-alert";
import { useAuth } from "@/lib/auth-context";
import { LineSpinner } from "@/components/ui/line-spinner";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/store/login";

  useEffect(() => {
    if (loading || isLoginPage) return;
    if (!user || user.userType !== "store") {
      router.replace("/store/login");
    }
  }, [loading, user, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !user || user.userType !== "store") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LineSpinner size={24} />
      </div>
    );
  }

  return (
    <StoreProvider>
      <div className="flex h-screen overflow-hidden bg-white">
        <StoreSidebar />
        <main className="flex-1 overflow-y-auto store-scope pt-0 lg:pt-0">
          {/* モバイルでハンバーガーボタン分の余白 */}
          <div className="h-12 lg:hidden" />
          {children}
        </main>
        <NewOrderAlert />
      </div>
    </StoreProvider>
  );
}
